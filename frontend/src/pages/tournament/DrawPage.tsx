import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  ArrowRightLeft,
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  UploadCloud,
  GripVertical,
  Plus,
  X,
  Download,
  GitBranch,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { API_BASE } from '../../config/api';

const TEAM_EMOJIS = ['🚀', '🔥', '⚡', '💡', '🏆', '🎯', '🦁', '🦅', '🐺', '⭐', '💎', '⚔️', '🛡️', '🍀', '🌀', '🌊'];

const getTeamEmoji = (name: string) => {
  if (!name) return '👻';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return TEAM_EMOJIS[Math.abs(hash) % TEAM_EMOJIS.length];
};

const PLAYOFF_STAGE_LABELS: Record<string, string> = {
  OCTOFINAL: '1/8 финала',
  QUARTERFINAL: '1/4 финала',
  SEMIFINAL: 'Полуфинал',
  GRAND_FINAL: 'Гранд-финал',
};

const shuffleArray = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const isAssemblyHallRoom = (room: any) =>
  Boolean(room?.name && room.name.toLowerCase().includes('актов'));

const DrawSkeleton = () => (
  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden text-sm w-full">
    <table className="w-full text-left table-fixed">
      <thead className="bg-slate-50/50 border-b border-slate-100">
        <tr>
          <th className="py-4 pl-6 pr-4 w-[20%]"><div className="h-4 w-24 bg-slate-200 rounded animate-pulse"></div></th>
          <th className="p-4 w-[25%]"><div className="h-4 w-32 bg-slate-200 rounded animate-pulse"></div></th>
          <th className="p-4 w-[5%]"></th>
          <th className="p-4 w-[25%]"><div className="h-4 w-32 bg-slate-200 rounded animate-pulse"></div></th>
          <th className="py-4 pl-4 pr-6 w-[25%]"><div className="h-4 w-24 bg-slate-200 rounded animate-pulse"></div></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {[...Array(4)].map((_, i) => (
          <tr key={i}>
            <td className="py-4 pl-6 pr-4"><div className="h-10 bg-slate-100 rounded-xl w-full animate-pulse"></div></td>
            <td className="p-4">
              <div className="flex gap-2 items-center">
                <div className="h-8 w-8 bg-slate-100 rounded-full animate-pulse shrink-0"></div>
                <div className="w-full"><div className="h-4 bg-slate-100 rounded w-3/4 mb-2 animate-pulse"></div></div>
              </div>
            </td>
            <td className="p-4 text-center"><div className="h-8 w-8 bg-slate-50 rounded-full mx-auto animate-pulse"></div></td>
            <td className="p-4">
              <div className="flex gap-2 items-center">
                <div className="h-8 w-8 bg-slate-100 rounded-full animate-pulse shrink-0"></div>
                <div className="w-full"><div className="h-4 bg-slate-100 rounded w-3/4 mb-2 animate-pulse"></div></div>
              </div>
            </td>
            <td className="py-4 pl-4 pr-6"><div className="h-10 bg-slate-100 rounded-xl w-full animate-pulse"></div></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const DrawPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tournamentId = location.pathname.split('/')[2];
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();

  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>(() => searchParams.get('roundId') || '');
  const [matches, setMatches] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [isFetchingDraw, setIsFetchingDraw] = useState(true);
  const [savingAction, setSavingAction] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [draggedItem, setDraggedItem] = useState<{ matchId: string; position: string } | null>(null);
  const [addingPanellistMatchId, setAddingPanellistMatchId] = useState<string | null>(null);

  const [rooms, setRooms] = useState<any[]>([]);
  const [judges, setJudges] = useState<any[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, [tournamentId]);

  useEffect(() => {
    const queryRoundId = searchParams.get('roundId');
    if (queryRoundId && queryRoundId !== selectedRoundId) {
      setSelectedRoundId(queryRoundId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedRoundId) {
      fetchDraw(selectedRoundId);
    }
  }, [selectedRoundId]);

  const fetchInitialData = async () => {
    try {
      const [roundsRes, roomsRes, judgesRes] = await Promise.all([
        fetch(`${API_BASE}/api/tournaments/${tournamentId}/rounds`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/tournaments/${tournamentId}/rooms`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/tournaments/${tournamentId}/judges`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const roundsData = await roundsRes.json();
      setRounds(roundsData);
      setRooms(await roomsRes.json());
      setJudges(await judgesRes.json());

      const queryRoundId = searchParams.get('roundId');
      if (queryRoundId && roundsData.some((r: any) => r.id === queryRoundId)) {
        setSelectedRoundId(queryRoundId);
      } else if (roundsData.length > 0 && !selectedRoundId) {
        setSelectedRoundId(roundsData[0].id);
      }
    } catch (err) {
      showError('Ошибка загрузки базовых данных');
    }
  };

  const fetchDraw = async (roundId: string) => {
    setIsFetchingDraw(true);
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/rounds/${roundId}/draw`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMatches(await res.json());
    } catch (err) {
      showError('Ошибка загрузки жеребьёвки');
    } finally {
      setIsFetchingDraw(false);
    }
  };

  const excludeAssemblyHallFromMatches = async (roundMatches: any[], allRooms: any[]) => {
    const assemblyRoomIds = new Set(
      allRooms.filter(isAssemblyHallRoom).map((r: any) => r.id)
    );
    const usedRoomIds = new Set(
      roundMatches.map((m: any) => m.roomId).filter(Boolean)
    );
    const freeRegularRooms = allRooms.filter(
      (r: any) => !isAssemblyHallRoom(r) && !usedRoomIds.has(r.id)
    );

    for (const match of roundMatches) {
      const hasAssemblyRoom =
        (match.roomId && assemblyRoomIds.has(match.roomId)) ||
        isAssemblyHallRoom(match.room);

      if (hasAssemblyRoom) {
        const replacementRoom = freeRegularRooms.shift();
        await fetch(`${API_BASE}/api/tournaments/matches/${match.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ roomId: replacementRoom ? replacementRoom.id : '' }),
        });
      }
    }
  };

  const distributeJudgesForMatches = async (roundMatches: any[], allJudges: any[]) => {
    if (!roundMatches.length || !allJudges.length) return;

    const busyJudgeIds = new Set<string>();
    roundMatches.forEach((m) => {
      (m.judges || []).forEach((j: any) => {
        if (j.judgeId) busyJudgeIds.add(j.judgeId);
        if (j.judge?.id) busyJudgeIds.add(j.judge.id);
      });
    });

    const freeJudges = shuffleArray(
      allJudges.filter((j) => !busyJudgeIds.has(j.id) && j.isActive !== false && j.status !== 'INACTIVE')
    );

    if (freeJudges.length === 0) return;

    const roomStates = roundMatches.map((m) => {
      const gov = m.teams?.find((t: any) => t.position === 'GOV')?.team;
      const opp = m.teams?.find((t: any) => t.position === 'OPP')?.team;
      const hasChair = (m.judges || []).some((j: any) => j.isChair);
      const orgs = [gov?.organization, opp?.organization]
        .filter(Boolean)
        .map((o: string) => o.trim().toLowerCase());
      const league = m.league || gov?.league || opp?.league || null;

      return {
        id: m.id,
        hasChair,
        judgeCount: (m.judges || []).length,
        orgs,
        league,
      };
    });

    const pickBestJudgeIndex = (room: (typeof roomStates)[number], pool: any[]) => {
      let idx = pool.findIndex((j) => {
        const sameLeague = !j.league || !room.league || j.league === room.league;
        const judgeOrg = j.organization ? j.organization.trim().toLowerCase() : '';
        const noConflict = !judgeOrg || !room.orgs.includes(judgeOrg);
        return sameLeague && noConflict;
      });
      if (idx !== -1) return idx;

      idx = pool.findIndex((j) => !j.league || !room.league || j.league === room.league);
      if (idx !== -1) return idx;

      return 0;
    };

    // 1. Сначала закрываем пустые места Чейров в комнатах
    for (const room of roomStates) {
      if (!room.hasChair && freeJudges.length > 0) {
        const judgeIdx = pickBestJudgeIndex(room, freeJudges);
        const [chair] = freeJudges.splice(judgeIdx, 1);

        await fetch(`${API_BASE}/api/tournaments/matches/${room.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ judgeId: chair.id }),
        });

        room.hasChair = true;
        room.judgeCount += 1;
      }
    }

    // 2. Всех оставшихся свободных судей равномерно раскидываем боковыми (панелистами)
    const activeRooms = roomStates.filter((r) => r.hasChair);
    if (activeRooms.length === 0) return;

    while (freeJudges.length > 0) {
      const judge = freeJudges.shift()!;
      const judgeOrg = judge.organization ? judge.organization.trim().toLowerCase() : '';

      activeRooms.sort((a, b) => {
        if (a.judgeCount !== b.judgeCount) return a.judgeCount - b.judgeCount;

        const aLeagueOk = !judge.league || !a.league || judge.league === a.league ? 0 : 1;
        const bLeagueOk = !judge.league || !b.league || judge.league === b.league ? 0 : 1;
        if (aLeagueOk !== bLeagueOk) return aLeagueOk - bLeagueOk;

        const aConflict = judgeOrg && a.orgs.includes(judgeOrg) ? 1 : 0;
        const bConflict = judgeOrg && b.orgs.includes(judgeOrg) ? 1 : 0;
        return aConflict - bConflict;
      });

      const targetRoom = activeRooms[0];

      await fetch(`${API_BASE}/api/tournaments/matches/${targetRoom.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ addPanellist: judge.id }),
      });

      targetRoom.judgeCount += 1;
    }
  };

  const executeGenerate = async () => {
    if (!selectedRoundId) return;
    setShowConfirmModal(false);
    setLoading(true);
    setIsFetchingDraw(true);
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/rounds/${selectedRoundId}/draw/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const [drawRes, judgesRes, roomsRes] = await Promise.all([
          fetch(`${API_BASE}/api/tournaments/${tournamentId}/rounds/${selectedRoundId}/draw`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/tournaments/${tournamentId}/judges`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/tournaments/${tournamentId}/rooms`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const generatedMatches = await drawRes.json();
        const latestJudges = await judgesRes.json();
        const latestRooms = await roomsRes.json();
        setJudges(latestJudges);
        setRooms(latestRooms);

        await excludeAssemblyHallFromMatches(generatedMatches, latestRooms);
        await distributeJudgesForMatches(generatedMatches, latestJudges);
        await fetchDraw(selectedRoundId);
        showSuccess('Жеребьёвка и судьи распределены!');
      } else {
        showError('Ошибка генерации');
        setIsFetchingDraw(false);
      }
    } catch (err) {
      showError('Ошибка сети');
      setIsFetchingDraw(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAssignJudges = async () => {
    if (!selectedRoundId || matches.length === 0) return;
    setSavingAction(true);
    try {
      const judgesRes = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/judges`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const latestJudges = await judgesRes.json();
      setJudges(latestJudges);

      await distributeJudgesForMatches(matches, latestJudges);
      await fetchDraw(selectedRoundId);
      showSuccess('Свободные судьи распределены!');
    } catch (err) {
      showError('Ошибка распределения судей');
    } finally {
      setSavingAction(false);
    }
  };

  const handleManualUpdate = async (matchId: string, payload: any) => {
    setSavingAction(true);
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const refreshRes = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/rounds/${selectedRoundId}/draw`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMatches(await refreshRes.json());
      } else {
        showError('Не удалось сохранить изменения');
      }
    } catch (err) {
      showError('Ошибка сети при сохранении');
    } finally {
      setTimeout(() => setSavingAction(false), 500);
    }
  };

  const handleDragStart = (e: React.DragEvent, matchId: string, position: string) => {
    setDraggedItem({ matchId, position });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetMatchId: string, targetPosition: string) => {
    e.preventDefault();
    if (!draggedItem) return;

    if (draggedItem.matchId === targetMatchId && draggedItem.position !== targetPosition) {
      handleManualUpdate(targetMatchId, { swapTeams: true });
    } else if (draggedItem.matchId !== targetMatchId) {
      handleManualUpdate(draggedItem.matchId, {
        crossSwap: { targetMatchId, targetPosition, sourcePosition: draggedItem.position },
      });
    }
    setDraggedItem(null);
  };

  const handlePublish = async () => {
    if (!selectedRoundId) return;
    if (!confirm('Опубликовать жеребьёвку?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/rounds/${selectedRoundId}/draw/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showSuccess('Жеребьёвка опубликована!');
        fetchInitialData();
        fetchDraw(selectedRoundId);
      }
    } catch (err) {
      showError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    const currentRound = rounds.find((r) => r.id === selectedRoundId);
    const roundTitle = currentRound ? `Раунд ${currentRound.number}: ${currentRound.name}` : 'Жеребьёвка раунда';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showError('Разрешите всплывающие окна для скачивания PDF');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${roundTitle} - Жеребьёвка</title>
          <meta charset="utf-8" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 30px; margin: 0; }
            h1 { font-size: 22px; margin-bottom: 4px; color: #0f172a; }
            p.subtitle { font-size: 13px; color: #64748b; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; vertical-align: top; }
            th { background-color: #f1f5f9; color: #334155; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
            .room { font-weight: bold; color: #0f172a; }
            .team-gov { color: #0369a1; font-weight: bold; }
            .team-opp { color: #be123c; font-weight: bold; }
            .org { font-size: 11px; color: #64748b; font-weight: normal; margin-top: 2px; }
            .judges { font-size: 11px; color: #334155; }
            .chair { font-weight: bold; color: #0f172a; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>${roundTitle}</h1>
          <p class="subtitle">Официальный лист жеребьёвки турнира • Сгенерировано в системе Rhetora</p>
          <table>
            <thead>
              <tr>
                <th style="width: 15%;">Комната</th>
                <th style="width: 35%;">Правительство (GOV)</th>
                <th style="width: 35%;">Оппозиция (OPP)</th>
                <th style="width: 15%;">Судьи</th>
              </tr>
            </thead>
            <tbody>
              ${matches
                .map((match, idx) => {
                  const gov = match.teams.find((t: any) => t.position === 'GOV')?.team;
                  const opp = match.teams.find((t: any) => t.position === 'OPP')?.team;
                  const chair = match.judges.find((j: any) => j.isChair)?.judge;
                  const panellists = match.judges.filter((j: any) => !j.isChair);
                  const roomName = match.room ? match.room.name : 'Не назначена';

                  return `
                  <tr>
                    <td class="room">Игра #${idx + 1}<br/><span style="font-weight:normal; color:#475569;">${roomName}</span></td>
                    <td>
                      <div class="team-gov">${gov?.name || 'TBD'}</div>
                      <div class="org">${gov?.organization || ''}</div>
                    </td>
                    <td>
                      <div class="team-opp">${opp?.name || 'TBD'}</div>
                      <div class="org">${opp?.organization || ''}</div>
                    </td>
                    <td class="judges">
                      ${chair ? `<div class="chair">👑 ${chair.name}</div>` : '<div style="color:#94a3b8;">Чейр не назначен</div>'}
                      ${panellists.length > 0 ? `<div style="margin-top: 4px; color: #64748b;">Панель: ${panellists.map((p: any) => p.judge.name).join(', ')}</div>` : ''}
                    </td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const getConflicts = () => {
    const roomCounts: Record<string, number> = {};
    const judgeCounts: Record<string, number> = {};
    matches.forEach((m) => {
      if (m.roomId) roomCounts[m.roomId] = (roomCounts[m.roomId] || 0) + 1;
      const chair = m.judges.find((j: any) => j.isChair);
      if (chair?.judgeId) judgeCounts[chair.judgeId] = (judgeCounts[chair.judgeId] || 0) + 1;
    });
    return { roomCounts, judgeCounts };
  };

  const { roomCounts, judgeCounts } = getConflicts();
  const currentRound = rounds.find((r) => r.id === selectedRoundId);
  const format = currentRound?.format || 'WSDC';
  const isPlayoffRound = Boolean(currentRound && PLAYOFF_STAGE_LABELS[currentRound.type]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Жеребьёвка</h2>
          {matches.length > 0 && !isFetchingDraw && (
            <div className={`flex items-center gap-1.5 text-xs font-medium transition-opacity duration-300 ${savingAction ? 'text-slate-400' : 'text-emerald-500'}`}>
              {savingAction ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {savingAction ? 'Сохранение...' : 'Изменения сохранены'}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={selectedRoundId}
              onChange={(e) => {
                setSelectedRoundId(e.target.value);
                setSearchParams({ roundId: e.target.value });
              }}
              className="appearance-none bg-white border border-slate-200 rounded-xl py-2.5 pl-4 pr-10 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none"
            >
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.status === 'ACTIVE' ? 'Опубликован' : 'Черновик'}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3.5 top-3 text-slate-400 pointer-events-none" />
          </div>

          {matches.length > 0 && !isFetchingDraw && (
            <>
              <button
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-semibold transition text-slate-700 shadow-sm cursor-pointer"
                title="Скачать PDF лист жеребьевки"
              >
                <Download size={16} /> PDF
              </button>

              <button
                onClick={handleAutoAssignJudges}
                disabled={loading || savingAction}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-semibold transition text-slate-700 shadow-sm cursor-pointer"
                title="Раскидать оставшихся судей по комнатам"
              >
                <Users size={16} /> Раскидать судей
              </button>
            </>
          )}

          <button
            onClick={() => (matches.length > 0 ? setShowConfirmModal(true) : executeGenerate())}
            disabled={loading || isFetchingDraw}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-semibold transition text-slate-700 shadow-sm cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Пересобрать
          </button>

          {matches.length > 0 && !isFetchingDraw && currentRound?.status !== 'ACTIVE' && (
            <button
              onClick={handlePublish}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-rhetora-teal hover:bg-sky-600 text-white rounded-xl text-sm font-semibold transition shadow-sm cursor-pointer"
            >
              <UploadCloud size={16} /> Опубликовать
            </button>
          )}
        </div>
      </div>

      {/* Плашка связи с турнирной сеткой для этапов плей-офф */}
      {isPlayoffRound && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-300 flex items-center justify-center shrink-0">
              <GitBranch size={18} />
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-sky-300">
                Этап плей-офф · {PLAYOFF_STAGE_LABELS[currentRound.type]}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Пары синхронизированы с турнирной сеткой. После отправки бюллетеней победитель автоматически продвинется в следующий раунд.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/tournaments/${tournamentId}/results?tab=playoffs`)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold transition shrink-0 cursor-pointer"
          >
            <GitBranch size={14} className="text-sky-300" /> Открыть сетку плей-офф
          </button>
        </div>
      )}

      {format === 'WSDC' &&
        (isFetchingDraw ? (
          <DrawSkeleton />
        ) : matches.length > 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden text-sm">
            <table className="w-full text-left table-fixed border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400 font-bold">
                <tr>
                  <th className="py-4 pl-6 pr-4 w-[20%]">Комната</th>
                  <th className="p-4 w-[25%] text-sky-700">Правительство</th>
                  <th className="p-4 w-[5%] text-center"></th>
                  <th className="p-4 w-[25%] text-rose-700">Оппозиция</th>
                  <th className="py-4 pl-4 pr-6 w-[25%]">Судьи</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {matches.map((match) => {
                  const gov = match.teams.find((t: any) => t.position === 'GOV')?.team;
                  const opp = match.teams.find((t: any) => t.position === 'OPP')?.team;
                  const chair = match.judges.find((j: any) => j.isChair)?.judge;
                  const panellists = match.judges.filter((j: any) => !j.isChair);

                  const isRoomConflict = match.roomId && roomCounts[match.roomId] > 1;
                  const isJudgeConflict = chair?.id && judgeCounts[chair.id] > 1;

                  return (
                    <tr key={match.id} className="transition group">
                      <td className="py-4 pl-6 pr-4">
                        <div className="relative">
                          <select
                            value={match.roomId || ''}
                            onChange={(e) => handleManualUpdate(match.id, { roomId: e.target.value })}
                            className={`appearance-none w-full p-2.5 pl-3 pr-8 bg-white border rounded-xl text-sm font-medium focus:outline-none focus:ring-1 cursor-pointer truncate ${
                              isRoomConflict
                                ? 'border-rose-400 ring-rose-400 text-rose-600 bg-rose-50'
                                : 'border-slate-200 focus:border-rhetora-teal focus:ring-rhetora-teal hover:border-slate-300 shadow-sm'
                            }`}
                          >
                            <option value="">Не назначена</option>
                            {rooms.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                        </div>
                      </td>

                      {/* Правительство */}
                      <td
                        className="p-4 bg-gradient-to-r from-transparent via-sky-50/30 to-sky-50/60 group-hover:via-sky-50/40 group-hover:to-sky-100/60 transition truncate border-none"
                        draggable
                        onDragStart={(e) => handleDragStart(e, match.id, 'GOV')}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, match.id, 'GOV')}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical
                            size={16}
                            className="text-slate-300 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity mt-1 shrink-0"
                          />
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border border-sky-100 shadow-sm shrink-0 text-lg">
                            {getTeamEmoji(gov?.name)}
                          </div>
                          <div className="truncate min-w-0">
                            <div className="font-bold text-slate-900 text-[15px] truncate">{gov?.name || 'TBD'}</div>
                            <div className="text-xs text-slate-500 mt-0.5 truncate">{gov?.organization || 'Без организации'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Кнопка свапа */}
                      <td className="p-4 text-center bg-gradient-to-r from-sky-50/60 to-rose-50/60 group-hover:from-sky-100/60 group-hover:to-rose-100/60 transition border-none">
                        <button
                          onClick={() => handleManualUpdate(match.id, { swapTeams: true })}
                          className="p-2 text-slate-400 hover:text-rhetora-teal bg-white border border-slate-100 shadow-sm hover:bg-slate-50 rounded-full transition cursor-pointer"
                        >
                          <ArrowRightLeft size={14} />
                        </button>
                      </td>

                      {/* Оппозиция */}
                      <td
                        className="p-4 bg-gradient-to-l from-transparent via-rose-50/30 to-rose-50/60 group-hover:via-rose-50/40 group-hover:to-rose-100/60 transition truncate border-none"
                        draggable
                        onDragStart={(e) => handleDragStart(e, match.id, 'OPP')}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, match.id, 'OPP')}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical
                            size={16}
                            className="text-slate-300 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity mt-1 shrink-0"
                          />
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border border-rose-100 shadow-sm shrink-0 text-lg">
                            {getTeamEmoji(opp?.name)}
                          </div>
                          <div className="truncate min-w-0">
                            <div className="font-bold text-slate-900 text-[15px] truncate">{opp?.name || 'TBD'}</div>
                            <div className="text-xs text-slate-500 mt-0.5 truncate">{opp?.organization || 'Без организации'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Судейская панель */}
                      <td className="py-4 pl-4 pr-6">
                        <div className="space-y-1.5">
                          <div className="relative">
                            <select
                              value={chair?.id || ''}
                              onChange={(e) => handleManualUpdate(match.id, { judgeId: e.target.value })}
                              className={`appearance-none w-full p-2.5 pl-3 pr-8 bg-white border rounded-xl text-sm font-medium focus:outline-none focus:ring-1 cursor-pointer truncate ${
                                isJudgeConflict
                                  ? 'border-rose-400 ring-rose-400 text-rose-600 bg-rose-50'
                                  : 'border-slate-200 focus:border-rhetora-teal focus:ring-rhetora-teal shadow-sm hover:border-slate-300'
                              }`}
                            >
                              <option value="">Пусто</option>
                              {judges.map((j) => (
                                <option key={j.id} value={j.id}>
                                  {j.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                          </div>

                          <div className="text-[11px] text-slate-400 font-medium px-1">Чейр — модератор раунда</div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {panellists.map((p: any) => (
                              <span
                                key={p.id}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px] font-semibold border border-slate-200"
                              >
                                {p.judge.name.split(' ')[0]}
                                <X
                                  size={12}
                                  className="cursor-pointer hover:text-rose-500 transition"
                                  onClick={() => handleManualUpdate(match.id, { removePanellist: p.judgeId })}
                                />
                              </span>
                            ))}

                            {addingPanellistMatchId === match.id ? (
                              <select
                                autoFocus
                                onBlur={() => setAddingPanellistMatchId(null)}
                                onChange={(e) => {
                                  if (e.target.value) handleManualUpdate(match.id, { addPanellist: e.target.value });
                                  setAddingPanellistMatchId(null);
                                }}
                                className="px-2 py-1 text-xs border rounded-md focus:outline-none focus:border-rhetora-teal"
                              >
                                <option value="">Выбрать...</option>
                                {judges.map((j) => (
                                  <option key={j.id} value={j.id}>
                                    {j.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <button
                                onClick={() => setAddingPanellistMatchId(match.id)}
                                className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border border-dashed border-slate-300 text-slate-400 hover:text-rhetora-teal hover:border-rhetora-teal transition cursor-pointer"
                                title="Добавить бокового судью"
                              >
                                <Plus size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center p-16 bg-white rounded-2xl border border-slate-200 border-dashed text-slate-400">
            Жеребьёвка для этого раунда еще не сформирована. Нажмите «Пересобрать».
          </div>
        ))}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Пересобрать жеребьёвку?</h3>
              <p className="text-sm text-slate-500">Текущая сетка будет полностью удалена и перестроена случайным образом.</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition"
              >
                Отмена
              </button>
              <button
                onClick={executeGenerate}
                className="flex-1 py-2.5 bg-rose-500 text-white font-semibold rounded-xl hover:bg-rose-600 transition shadow-sm"
              >
                Да, пересобрать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
