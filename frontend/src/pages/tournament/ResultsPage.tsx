import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Layers,
  Trophy,
  FileText,
  DoorOpen,
  ChevronRight,
  GitBranch,
  Crown,
  RotateCcw,
  Sparkles,
  Shuffle,
  ArrowUpDown,
  CheckCircle2,
  Users,
  Send,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { API_BASE } from '../../config/api';

interface BracketTeam {
  id: string;
  name: string;
  seed: number;
  organization?: string;
  wins?: number;
  speakerScore?: number;
}

interface BracketMatch {
  id: string;
  roundIndex: number;
  matchIndex: number;
  gov: BracketTeam | null;
  opp: BracketTeam | null;
  winnerId: string | null;
  isBye?: boolean;
  fromOfficialBallots?: boolean;
  flipping?: boolean;
}

const generateSeedOrder = (size: number): number[] => {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const nextSize = seeds.length * 2;
    const nextSeeds: number[] = [];
    for (const s of seeds) {
      nextSeeds.push(s, nextSize + 1 - s);
    }
    seeds = nextSeeds;
  }
  return seeds;
};

const getNextPowerOfTwo = (n: number): number => {
  if (n <= 2) return 2;
  return Math.pow(2, Math.ceil(Math.log2(n)));
};

const getPlayoffStageMeta = (roundIndex: number, totalRounds: number): { type: string; title: string } => {
  const remaining = totalRounds - roundIndex;
  if (remaining === 1) return { type: 'GRAND_FINAL', title: 'Гранд-финал' };
  if (remaining === 2) return { type: 'SEMIFINAL', title: 'Полуфинал' };
  if (remaining === 3) return { type: 'QUARTERFINAL', title: '1/4 финала' };
  if (remaining === 4) return { type: 'OCTOFINAL', title: '1/8 финала' };
  if (remaining === 5) return { type: 'ROUND_OF_32', title: '1/16 финала' };
  return { type: 'PLAYOFF', title: `Плей-офф ${roundIndex + 1}` };
};

const DEMO_TEAMS: BracketTeam[] = Array.from({ length: 24 }, (_, idx) => {
  const names = [
    'Astana Prime', 'Nomad Rhetoric', 'Steppe Eagles', 'Almaty Union',
    'Qazaq Orators', 'Iron Logic', 'Vox Populi', 'Golden Griffin',
    'Esil Vanguard', 'Saryarka Debate', 'Turan Speakers', 'Irbis Policy',
    'Baiterek Club', 'Alash Arguments', 'Khan Tengri', 'Zhetysu Union',
    'Silk Road Forum', 'Tulpar Debate', 'Arystan Bench', 'Samruk Orators',
    'Kokshetau Voice', 'Caspian Logic', 'Altai Rhetoric', 'Balkhash Union',
  ];
  const orgs = [
    'Esil University', 'NU Debate Club', 'ENU Orators', 'KIMEP Debate',
    'KazGUU Club', 'SDU Debate', 'AITU Speakers', 'NIS Astana',
  ];
  return {
    id: `demo-${idx + 1}`,
    name: names[idx] || `Команда #${idx + 1}`,
    seed: idx + 1,
    organization: orgs[idx % orgs.length],
    wins: Math.max(1, 6 - Math.floor(idx / 4)),
    speakerScore: 1150 - idx * 6,
  };
});

export const ResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tournamentId = location.pathname.split('/')[2];
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'rounds' | 'standings' | 'playoffs' | 'ballots'>(() => {
    const t = searchParams.get('tab');
    if (t === 'playoffs' || t === 'rounds' || t === 'standings' || t === 'ballots') return t;
    return 'overview';
  });

  // Данные обзора
  const [overviewData, setOverviewData] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Выбранный раунд для вкладки «Результаты раундов»
  const [selectedRoundId, setSelectedRoundId] = useState<string>('');
  const [roundResults, setRoundResults] = useState<any>(null);
  const [loadingRound, setLoadingRound] = useState(false);
  const [roundFilter, setRoundFilter] = useState<'all' | 'completed' | 'pending'>('all');

  // Детали выбранной игры для модального окна
  const [selectedMatch, setSelectedMatch] = useState<any>(null);

  // Турнирная таблица
  const [standings, setStandings] = useState<any[]>([]);
  const [loadingStandings, setLoadingStandings] = useState(false);

  // Бюллетени
  const [ballotsList, setBallotsList] = useState<any[]>([]);
  const [loadingBallots, setLoadingBallots] = useState(false);

  // Интерактивная сетка плей-офф (поддерживает любое число команд, включая 18, 20, 21)
  const [breakCount, setBreakCount] = useState<number>(8);
  const [customBreakInput, setCustomBreakInput] = useState<string>('8');
  const [bracketRounds, setBracketRounds] = useState<BracketMatch[][]>([]);
  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null);
  const [bracketAnimKey, setBracketAnimKey] = useState<number>(0);
  const [sendingStageType, setSendingStageType] = useState<string | null>(null);
  const [syncingPlayoffs, setSyncingPlayoffs] = useState<boolean>(false);

  const storageKey = `rhetora_playoffs_v2_${tournamentId}`;

  const switchTab = (tab: 'overview' | 'rounds' | 'standings' | 'playoffs' | 'ballots') => {
    setActiveTab(tab);
    setSearchParams(tab === 'overview' ? {} : { tab });
  };

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'playoffs' || t === 'rounds' || t === 'standings' || t === 'ballots') {
      setActiveTab(t);
    }
  }, [searchParams]);

  // Построение сетки с поддержкой неполного брейка и автоматических BYE-проходов
  const buildBracketFromTeams = (teamsPool: BracketTeam[], targetBreakCount: number): BracketMatch[][] => {
    const safeCount = Math.max(2, Math.min(32, Math.floor(targetBreakCount)));
    const bracketCapacity = getNextPowerOfTwo(safeCount);
    const totalRounds = Math.log2(bracketCapacity);
    const seedOrder = generateSeedOrder(bracketCapacity);

    const activePool = teamsPool.slice(0, safeCount);

    const firstRoundMatches: BracketMatch[] = [];
    for (let i = 0; i < bracketCapacity / 2; i++) {
      const seedA = seedOrder[i * 2];
      const seedB = seedOrder[i * 2 + 1];

      const teamA = seedA <= safeCount ? activePool[seedA - 1] || null : null;
      const teamB = seedB <= safeCount ? activePool[seedB - 1] || null : null;

      // Если у топ-посева нет пары (seedB > safeCount), это автоматический проход (BYE)
      const isByeMatch = Boolean((teamA && !teamB && seedB > safeCount) || (!teamA && teamB && seedA > safeCount));
      const byeWinner = isByeMatch ? teamA || teamB : null;

      firstRoundMatches.push({
        id: `r0-m${i}`,
        roundIndex: 0,
        matchIndex: i,
        gov: teamA,
        opp: teamB,
        winnerId: byeWinner ? byeWinner.id : null,
        isBye: isByeMatch,
      });
    }

    const rounds: BracketMatch[][] = [firstRoundMatches];
    for (let r = 1; r < totalRounds; r++) {
      const matchesCount = bracketCapacity / Math.pow(2, r + 1);
      const roundMatches: BracketMatch[] = [];
      for (let m = 0; m < matchesCount; m++) {
        roundMatches.push({
          id: `r${r}-m${m}`,
          roundIndex: r,
          matchIndex: m,
          gov: null,
          opp: null,
          winnerId: null,
        });
      }
      rounds.push(roundMatches);
    }

    // Автоматически продвигаем команды с BYE из 1-го раунда во 2-й раунд
    if (rounds.length > 1) {
      firstRoundMatches.forEach((m, idx) => {
        if (m.isBye && m.winnerId) {
          const winnerTeam = m.gov?.id === m.winnerId ? m.gov : m.opp;
          const nextMatchIdx = Math.floor(idx / 2);
          if (idx % 2 === 0) {
            rounds[1][nextMatchIdx].gov = winnerTeam;
          } else {
            rounds[1][nextMatchIdx].opp = winnerTeam;
          }
        }
      });
    }

    setBracketRounds(rounds);
    setBracketAnimKey((k) => k + 1);
    localStorage.setItem(storageKey, JSON.stringify({ breakCount: safeCount, rounds }));
    return rounds;
  };

  const fetchOverview = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/results/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setOverviewData(data);
        if (data.rounds?.length > 0 && !selectedRoundId) {
          setSelectedRoundId(data.rounds[0].id);
        }
        return data;
      } else {
        showError(data.error || 'Не удалось загрузить обзор результатов');
      }
    } catch (err: any) {
      showError('Ошибка сети при загрузке результатов', { message: err.message });
    } finally {
      setLoadingOverview(false);
    }
    return null;
  };

  const fetchRoundResults = async (rId: string) => {
    if (!rId) return;
    setLoadingRound(true);
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/results/rounds/${rId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setRoundResults(data);
      } else {
        showError(data.error || 'Не удалось загрузить игры раунда');
      }
    } catch (err: any) {
      showError('Ошибка сети', { message: err.message });
    } finally {
      setLoadingRound(false);
    }
  };

  const fetchStandings = async (): Promise<any[]> => {
    setLoadingStandings(true);
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/results/standings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setStandings(data);
        return data;
      } else {
        showError(data.error || 'Не удалось загрузить таблицу');
      }
    } catch (err: any) {
      showError('Ошибка сети', { message: err.message });
    } finally {
      setLoadingStandings(false);
    }
    return [];
  };

  const fetchBallotsControl = async () => {
    setLoadingBallots(true);
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/ballots`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setBallotsList(data);
      } else {
        showError(data.error || 'Не удалось загрузить бюллетени');
      }
    } catch (err: any) {
      showError('Ошибка сети', { message: err.message });
    } finally {
      setLoadingBallots(false);
    }
  };

  // Синхронизация сетки с реальными раундами плей-офф из DrawPage и бюллетенями судей
  const syncBracketWithRealRounds = async (
    baseRounds: BracketMatch[][],
    currentBreakCount: number,
    allRoundsList: any[],
    seedMap: Map<string, number>,
    silent = true
  ) => {
    const playoffRoundsInDb = (allRoundsList || []).filter((r: any) =>
      ['ROUND_OF_32', 'OCTOFINAL', 'QUARTERFINAL', 'SEMIFINAL', 'GRAND_FINAL'].includes(r.type)
    );

    if (playoffRoundsInDb.length === 0) {
      if (!silent) showSuccess('В турнире пока нет созданных раундов плей-офф');
      return;
    }

    setSyncingPlayoffs(true);
    try {
      const detailedResults = await Promise.all(
        playoffRoundsInDb.map(async (r: any) => {
          const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/results/rounds/${r.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return null;
          const data = await res.json();
          return { roundType: r.type, matches: data.matches || [] };
        })
      );

      const next = baseRounds.map((r) => r.map((m) => ({ ...m })));
      const totalRounds = next.length;

      for (let rIdx = 0; rIdx < totalRounds; rIdx++) {
        const meta = getPlayoffStageMeta(rIdx, totalRounds);
        const foundStage = detailedResults.find((d) => d && d.roundType === meta.type);
        if (!foundStage || foundStage.matches.length === 0) continue;

        // В раунде с BYE реальные матчи из БД соответствуют не-BYE слотам по порядку
        const playableSlots = next[rIdx].filter((m) => !m.isBye);

        foundStage.matches.forEach((dbMatch: any, idx: number) => {
          const targetSlot = playableSlots[idx];
          if (!targetSlot) return;

          const govRaw = dbMatch.teams?.find((t: any) => t.position === 'GOV')?.team;
          const oppRaw = dbMatch.teams?.find((t: any) => t.position === 'OPP')?.team;

          if (govRaw) {
            targetSlot.gov = {
              id: govRaw.id,
              name: govRaw.name,
              seed: seedMap.get(govRaw.id) || targetSlot.gov?.seed || idx * 2 + 1,
              organization: govRaw.organization,
            };
          }
          if (oppRaw) {
            targetSlot.opp = {
              id: oppRaw.id,
              name: oppRaw.name,
              seed: seedMap.get(oppRaw.id) || targetSlot.opp?.seed || idx * 2 + 2,
              organization: oppRaw.organization,
            };
          }

          if (dbMatch.winner === 'GOV' && targetSlot.gov) {
            const winTeam = targetSlot.gov;
            targetSlot.winnerId = winTeam.id;
            targetSlot.fromOfficialBallots = true;

            if (rIdx + 1 < totalRounds) {
              const nextMatchIdx = Math.floor(targetSlot.matchIndex / 2);
              if (targetSlot.matchIndex % 2 === 0) next[rIdx + 1][nextMatchIdx].gov = winTeam;
              else next[rIdx + 1][nextMatchIdx].opp = winTeam;
            }
          } else if (dbMatch.winner === 'OPP' && targetSlot.opp) {
            const winTeam = targetSlot.opp;
            targetSlot.winnerId = winTeam.id;
            targetSlot.fromOfficialBallots = true;

            if (rIdx + 1 < totalRounds) {
              const nextMatchIdx = Math.floor(targetSlot.matchIndex / 2);
              if (targetSlot.matchIndex % 2 === 0) next[rIdx + 1][nextMatchIdx].gov = winTeam;
              else next[rIdx + 1][nextMatchIdx].opp = winTeam;
            }
          }
        });
      }

      setBracketRounds(next);
      localStorage.setItem(storageKey, JSON.stringify({ breakCount: currentBreakCount, rounds: next }));
      if (!silent) showSuccess('Сетка синхронизирована с жеребьёвкой и бюллетенями');
    } catch {
      if (!silent) showError('Не удалось синхронизировать раунды плей-офф');
    } finally {
      setSyncingPlayoffs(false);
    }
  };

  useEffect(() => {
    if (tournamentId && token) {
      fetchOverview();
    }
  }, [tournamentId, token]);

  useEffect(() => {
    if (selectedRoundId && activeTab === 'rounds') {
      fetchRoundResults(selectedRoundId);
    }
  }, [selectedRoundId, activeTab]);

  useEffect(() => {
    if (activeTab === 'standings') {
      fetchStandings();
    }
    if (activeTab === 'ballots') {
      fetchBallotsControl();
    }
    if (activeTab === 'playoffs') {
      const initPlayoffs = async () => {
        const [currentStandings, currentOverview] = await Promise.all([
          standings.length > 0 ? Promise.resolve(standings) : fetchStandings(),
          overviewData ? Promise.resolve(overviewData) : fetchOverview(),
        ]);

        const seedMap = new Map<string, number>();
        const mappedTeams: BracketTeam[] = currentStandings.map((t: any, idx: number) => {
          const rank = t.rank || idx + 1;
          seedMap.set(t.teamId, rank);
          return {
            id: t.teamId,
            name: t.teamName,
            seed: rank,
            organization: t.organization,
            wins: t.wins,
            speakerScore: t.totalSpeakerScore,
          };
        });

        let activeBreakCount = mappedTeams.length >= 2 ? Math.min(32, mappedTeams.length) : 8;
        let initialRounds: BracketMatch[][] = [];

        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed?.rounds?.length > 0) {
              activeBreakCount = parsed.breakCount || activeBreakCount;
              initialRounds = parsed.rounds;
              setBreakCount(activeBreakCount);
              setCustomBreakInput(String(activeBreakCount));
              setBracketRounds(initialRounds);
            }
          } catch {
            // ignore corrupted storage
          }
        }

        if (initialRounds.length === 0) {
          setBreakCount(activeBreakCount);
          setCustomBreakInput(String(activeBreakCount));
          initialRounds = buildBracketFromTeams(mappedTeams, activeBreakCount);
        }

        await syncBracketWithRealRounds(
          initialRounds,
          activeBreakCount,
          currentOverview?.rounds || [],
          seedMap,
          true
        );
      };
      initPlayoffs();
    }
  }, [activeTab]);

  // Отправка выбранного этапа плей-офф в DrawPage (исключая BYE-проходы)
  const handleSendStageToDraw = async (roundIndex: number) => {
    const stageMatches = bracketRounds[roundIndex] || [];
    const meta = getPlayoffStageMeta(roundIndex, bracketRounds.length);

    const readyPairs = stageMatches
      .filter((m) => !m.isBye && m.gov && m.opp)
      .map((m) => ({
        govTeamId: m.gov!.id,
        oppTeamId: m.opp!.id,
      }));

    if (readyPairs.length === 0) {
      showError(`Сначала определите обе стороны (GOV и OPP) для этапа «${meta.title}»`);
      return;
    }

    setSendingStageType(meta.type);
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/draw/playoffs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stageType: meta.type,
          stageName: meta.title,
          pairs: readyPairs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showError(data.error || 'Не удалось создать жеребьёвку этапа');
        return;
      }

      showSuccess(`Этап «${meta.title}» отправлен в жеребьёвку (${data.matchesCount} игр)`);
      navigate(`/tournaments/${tournamentId}/draw?roundId=${data.round.id}`);
    } catch {
      showError('Ошибка сети при отправке в жеребьёвку');
    } finally {
      setSendingStageType(null);
    }
  };

  const handleSeedFromStandings = async (targetCount: number = breakCount) => {
    const safeCount = Math.max(2, Math.min(32, Math.floor(targetCount || 2)));
    const currentStandings = standings.length > 0 ? standings : await fetchStandings();

    const sourceTeams: BracketTeam[] =
      currentStandings.length > 0
        ? currentStandings.map((t: any, idx: number) => ({
            id: t.teamId,
            name: t.teamName,
            seed: t.rank || idx + 1,
            organization: t.organization,
            wins: t.wins,
            speakerScore: t.totalSpeakerScore,
          }))
        : DEMO_TEAMS;

    setBreakCount(safeCount);
    setCustomBreakInput(String(safeCount));
    buildBracketFromTeams(sourceTeams, safeCount);

    const capacity = getNextPowerOfTwo(safeCount);
    const byes = capacity - safeCount;
    showSuccess(
      byes > 0
        ? `Сетка на ${safeCount} команд сформирована (автопроходов BYE: ${byes})`
        : `Сетка Топ-${safeCount} сформирована по текущему рейтингу`
    );
  };

  const handleLoadDemoBracket = () => {
    const target = Math.max(2, Math.min(24, breakCount || 20));
    setBreakCount(target);
    setCustomBreakInput(String(target));
    buildBracketFromTeams(DEMO_TEAMS, target);
    showSuccess(`Загружена демо-сетка на ${target} команд`);
  };

  const handleSelectWinner = (roundIndex: number, matchIndex: number, team: BracketTeam | null) => {
    if (!team) return;
    const current = bracketRounds[roundIndex]?.[matchIndex];
    if (current?.isBye) return; // BYE-проход фиксируется автоматически

    setBracketRounds((prev) => {
      const next = prev.map((r) => r.map((m) => ({ ...m })));
      const currentMatch = next[roundIndex][matchIndex];
      const isUnselecting = currentMatch.winnerId === team.id;
      const oldWinnerId = currentMatch.winnerId;

      currentMatch.winnerId = isUnselecting ? null : team.id;
      currentMatch.fromOfficialBallots = false;

      let r = roundIndex;
      let m = matchIndex;
      let propagatedTeam: BracketTeam | null = isUnselecting ? null : team;

      while (r + 1 < next.length) {
        const nextMatchIdx = Math.floor(m / 2);
        const isTopSlot = m % 2 === 0;
        const targetMatch = next[r + 1][nextMatchIdx];

        const prevSlotTeam = isTopSlot ? targetMatch.gov : targetMatch.opp;
        if (isTopSlot) {
          targetMatch.gov = propagatedTeam;
        } else {
          targetMatch.opp = propagatedTeam;
        }

        if (
          targetMatch.winnerId &&
          (targetMatch.winnerId === oldWinnerId ||
            (prevSlotTeam && targetMatch.winnerId === prevSlotTeam.id))
        ) {
          targetMatch.winnerId = null;
          propagatedTeam = null;
        } else {
          break;
        }

        r += 1;
        m = nextMatchIdx;
      }

      localStorage.setItem(storageKey, JSON.stringify({ breakCount, rounds: next }));
      return next;
    });
  };

  const handleSwapSides = (roundIndex: number, matchIndex: number) => {
    setBracketRounds((prev) => {
      const next = prev.map((r) => r.map((m) => ({ ...m })));
      const match = next[roundIndex][matchIndex];
      if (match.isBye) return prev;
      const temp = match.gov;
      match.gov = match.opp;
      match.opp = temp;
      localStorage.setItem(storageKey, JSON.stringify({ breakCount, rounds: next }));
      return next;
    });
  };

  const handleCoinFlip = (roundIndex: number, matchIndex: number) => {
    const target = bracketRounds[roundIndex]?.[matchIndex];
    if (!target || target.isBye) return;

    setBracketRounds((prev) => {
      const next = prev.map((r) => r.map((m) => ({ ...m })));
      next[roundIndex][matchIndex].flipping = true;
      return next;
    });

    setTimeout(() => {
      setBracketRounds((prev) => {
        const next = prev.map((r) => r.map((m) => ({ ...m })));
        const match = next[roundIndex][matchIndex];
        match.flipping = false;
        if (Math.random() > 0.5) {
          const temp = match.gov;
          match.gov = match.opp;
          match.opp = temp;
        }
        localStorage.setItem(storageKey, JSON.stringify({ breakCount, rounds: next }));
        return next;
      });
      showSuccess('Стороны GOV / OPP определены жребием');
    }, 320);
  };

  const championTeam = useMemo(() => {
    if (bracketRounds.length === 0) return null;
    const finalRound = bracketRounds[bracketRounds.length - 1];
    const finalMatch = finalRound?.[0];
    if (!finalMatch || !finalMatch.winnerId) return null;
    if (finalMatch.gov?.id === finalMatch.winnerId) return finalMatch.gov;
    if (finalMatch.opp?.id === finalMatch.winnerId) return finalMatch.opp;
    return null;
  }, [bracketRounds]);

  const byeCount = useMemo(() => {
    return getNextPowerOfTwo(breakCount) - breakCount;
  }, [breakCount]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <style>{`
        @keyframes bracketCardIn {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes winnerAdvancePop {
          0% {
            transform: scale(0.96);
            box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.45);
          }
          50% {
            transform: scale(1.015);
            box-shadow: 0 0 0 8px rgba(14, 165, 233, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(14, 165, 233, 0);
          }
        }
        @keyframes connectorDashFlow {
          to {
            stroke-dashoffset: -24;
          }
        }
        @keyframes championGlow {
          0%, 100% {
            box-shadow: 0 12px 32px -8px rgba(245, 158, 11, 0.25), 0 0 0 1px rgba(251, 191, 36, 0.4);
          }
          50% {
            box-shadow: 0 18px 40px -6px rgba(14, 165, 233, 0.28), 0 0 0 1px rgba(56, 189, 248, 0.55);
          }
        }
        .bracket-card-enter {
          animation: bracketCardIn 0.42s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .winner-slot-pop {
          animation: winnerAdvancePop 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .connector-flow {
          stroke-dasharray: 6 6;
          animation: connectorDashFlow 1.1s linear infinite;
        }
        .champion-card-glow {
          animation: championGlow 3.5s ease-in-out infinite;
        }
      `}</style>

      {/* Шапка и переключатель подразделов */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Результаты турнира (WSDC)</h1>
          <p className="text-sm text-slate-500">Управление раундами, таблицей лидеров, плей-офф и протоколами</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
          <button
            onClick={() => switchTab('overview')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 size={15} /> Обзор
          </button>
          <button
            onClick={() => switchTab('rounds')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'rounds' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={15} /> Раунды
          </button>
          <button
            onClick={() => switchTab('standings')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'standings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trophy size={15} /> Таблица
          </button>
          <button
            onClick={() => switchTab('playoffs')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'playoffs'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <GitBranch size={15} className={activeTab === 'playoffs' ? 'text-sky-400' : 'text-rhetora-teal'} />
            Плей-офф
          </button>
          <button
            onClick={() => switchTab('ballots')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ballots' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={15} /> Бюллетени
          </button>
        </div>
      </div>

      {/* 1. ПОДРАЗДЕЛ: ОБЗОР */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {loadingOverview ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : (
            overviewData && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Всего игр</div>
                    <div className="text-2xl font-extrabold text-slate-900">{overviewData.stats.totalGames}</div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Завершено игр</div>
                    <div className="text-2xl font-extrabold text-emerald-600">{overviewData.stats.completedGames}</div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Получено бюллетеней</div>
                    <div className="text-2xl font-extrabold text-rhetora-teal">{overviewData.stats.totalBallotsSubmitted}</div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ожидается бюллетеней</div>
                    <div className="text-2xl font-extrabold text-amber-600">{overviewData.stats.pendingBallots}</div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-bold text-slate-900">Статус раундов турнира</h3>
                    <button
                      onClick={() => switchTab('playoffs')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold transition cursor-pointer"
                    >
                      <GitBranch size={14} /> Открыть сетку плей-офф
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase font-bold">
                          <th className="pb-3 px-3">Раунд</th>
                          <th className="pb-3 px-3">Игр</th>
                          <th className="pb-3 px-3">Бюллетени</th>
                          <th className="pb-3 px-3">Статус</th>
                          <th className="pb-3 px-3 text-right">Действие</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {overviewData.rounds.map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-3.5 px-3 font-bold text-slate-800">
                              Раунд {r.number}: {r.name}
                            </td>
                            <td className="py-3.5 px-3 text-slate-600 font-medium">
                              {r.completedMatchesCount} / {r.matchesCount} игр
                            </td>
                            <td className="py-3.5 px-3 text-slate-600 font-medium">
                              {r.ballotsSubmitted} / {r.ballotsExpected}
                            </td>
                            <td className="py-3.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                  r.status === 'COMPLETED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : r.status === 'IN_PROGRESS'
                                    ? 'bg-sky-100 text-sky-800'
                                    : r.status === 'WAITING_FOR_BALLOTS'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {r.status === 'COMPLETED'
                                  ? 'Завершён'
                                  : r.status === 'IN_PROGRESS'
                                  ? 'В процессе'
                                  : r.status === 'WAITING_FOR_BALLOTS'
                                  ? 'Ожидает бюллетеней'
                                  : 'Не начат'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedRoundId(r.id);
                                  switchTab('rounds');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
                              >
                                Смотреть <ChevronRight size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )
          )}
        </div>
      )}

      {/* 2. ПОДРАЗДЕЛ: РЕЗУЛЬТАТЫ РАУНДОВ */}
      {activeTab === 'rounds' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2 overflow-x-auto">
              {overviewData?.rounds?.map((r: any) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoundId(r.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedRoundId === r.id ? 'bg-rhetora-teal text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Раунд {r.number}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setRoundFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  roundFilter === 'all' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600'
                }`}
              >
                Все
              </button>
              <button
                onClick={() => setRoundFilter('completed')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  roundFilter === 'completed' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600'
                }`}
              >
                Завершённые
              </button>
              <button
                onClick={() => setRoundFilter('pending')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  roundFilter === 'pending' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600'
                }`}
              >
                Ожидающие
              </button>
            </div>
          </div>

          {loadingRound ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-20 bg-white rounded-2xl border animate-pulse" />
              ))}
            </div>
          ) : (
            roundResults && (
              <div className="space-y-3">
                {roundResults.matches
                  .filter((m: any) => {
                    if (roundFilter === 'completed') return m.status === 'COMPLETED';
                    if (roundFilter === 'pending') return m.status !== 'COMPLETED';
                    return true;
                  })
                  .map((match: any) => {
                    const govTeam = match.teams.find((t: any) => t.position === 'GOV')?.team?.name || 'ГОВ TBD';
                    const oppTeam = match.teams.find((t: any) => t.position === 'OPP')?.team?.name || 'ОПП TBD';

                    return (
                      <div
                        key={match.id}
                        onClick={() => setSelectedMatch(match)}
                        className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-slate-300 transition"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">Игра #{match.gameNumber}</span>
                            <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                              <DoorOpen size={13} /> {match.room?.name || 'Без комнаты'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span
                              className={`px-2.5 py-1 rounded-lg border font-bold ${
                                match.winner === 'GOV'
                                  ? 'bg-sky-50 border-sky-300 text-sky-900'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              GOV: {govTeam} {match.winner === 'GOV' && '👑'}
                            </span>
                            <span
                              className={`px-2.5 py-1 rounded-lg border font-bold ${
                                match.winner === 'OPP'
                                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              OPP: {oppTeam} {match.winner === 'OPP' && '👑'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right text-xs font-semibold text-slate-500">
                            Бюллетени: <strong className="text-slate-900">{match.submittedCount} / {match.totalJudges}</strong>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-xl text-xs font-bold ${
                              match.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {match.status === 'COMPLETED' ? 'Готово' : 'Ожидание'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )
          )}
        </div>
      )}

      {/* 3. ПОДРАЗДЕЛ: ТУРНИРНАЯ ТАБЛИЦА */}
      {activeTab === 'standings' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Турнирная таблица (WSDC Leaderboard)</h3>
              <p className="text-xs text-slate-400">Рейтинг строится по числу побед и сумме спикерских баллов</p>
            </div>
            <button
              onClick={() => switchTab('playoffs')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <GitBranch size={14} className="text-sky-400" /> Сформировать сетку плей-офф
            </button>
          </div>

          {loadingStandings ? (
            <div className="h-48 bg-slate-50 rounded-xl animate-pulse" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase font-bold">
                    <th className="pb-3 px-3">Место</th>
                    <th className="pb-3 px-3">Команда</th>
                    <th className="pb-3 px-3">Организация</th>
                    <th className="pb-3 px-3 text-center">Победы</th>
                    <th className="pb-3 px-3 text-center">Поражения</th>
                    <th className="pb-3 px-3 text-right">Спикерские баллы</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium">
                  {standings.map((team) => (
                    <tr
                      key={team.teamId}
                      className={`hover:bg-slate-50/50 transition ${team.rank <= breakCount ? 'bg-sky-50/20' : ''}`}
                    >
                      <td className="py-3.5 px-3 font-extrabold text-slate-900 flex items-center gap-2">
                        <span>#{team.rank}</span>
                        {team.rank <= breakCount && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 text-[10px] font-bold">BREAK</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-slate-800">{team.teamName}</td>
                      <td className="py-3.5 px-3 text-slate-500 text-xs">{team.organization || '—'}</td>
                      <td className="py-3.5 px-3 text-center text-emerald-600 font-bold">{team.wins}</td>
                      <td className="py-3.5 px-3 text-center text-rose-600 font-bold">{team.losses}</td>
                      <td className="py-3.5 px-3 text-right font-extrabold text-rhetora-teal">{team.totalSpeakerScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. ПОДРАЗДЕЛ: ИНТЕРАКТИВНАЯ СЕТКА ПЛЕЙ-ОФФ */}
      {activeTab === 'playoffs' && (
        <div className="space-y-6">
          {/* Панель управления сеткой */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">
                  Команд на брейк:
                </span>
                {[4, 8, 12, 16, 20, 24, 32].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handleSeedFromStandings(count)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      breakCount === count
                        ? 'bg-rhetora-teal text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {count}
                  </button>
                ))}

                {/* Произвольное число команд (например, 18, 21) */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const parsed = Number(customBreakInput);
                    if (parsed >= 2 && parsed <= 32) {
                      handleSeedFromStandings(parsed);
                    } else {
                      showError('Укажите число команд от 2 до 32');
                    }
                  }}
                  className="inline-flex items-center gap-1 ml-1"
                >
                  <input
                    type="number"
                    min={2}
                    max={32}
                    value={customBreakInput}
                    onChange={(e) => setCustomBreakInput(e.target.value)}
                    placeholder="18, 21..."
                    title="Любое число команд (например, 18, 20, 21)"
                    className="w-16 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-rhetora-teal"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    ОК
                  </button>
                </form>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={syncingPlayoffs}
                  onClick={async () => {
                    const freshOverview = await fetchOverview();
                    const seedMap = new Map<string, number>();
                    standings.forEach((t, idx) => seedMap.set(t.teamId, t.rank || idx + 1));
                    await syncBracketWithRealRounds(
                      bracketRounds,
                      breakCount,
                      freshOverview?.rounds || [],
                      seedMap,
                      false
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={14} className={syncingPlayoffs ? 'animate-spin' : ''} /> Синхронизировать с бюллетенями
                </button>

                <button
                  type="button"
                  onClick={() => handleSeedFromStandings(breakCount)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
                >
                  <RotateCcw size={14} /> Перепосеять
                </button>

                {standings.length < 2 && (
                  <button
                    type="button"
                    onClick={handleLoadDemoBracket}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition cursor-pointer"
                  >
                    <Sparkles size={14} /> Демо-команды
                  </button>
                )}
              </div>
            </div>

            {/* Информационная полоска при неполном брейке (BYE) */}
            {byeCount > 0 && (
              <div className="px-3.5 py-2.5 rounded-xl bg-sky-50/70 border border-sky-200/80 text-xs text-sky-900 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>Неполный брейк ({breakCount} команд):</strong> Топ-{byeCount}{' '}
                  {byeCount === 1 ? 'команда получает' : byeCount < 5 ? 'команды получают' : 'команд получают'}{' '}
                  автоматический проход (<strong>BYE</strong>) во второй круг, остальные{' '}
                  <strong>{breakCount - byeCount}</strong> играют стыковой этап ({(breakCount - byeCount) / 2}{' '}
                  {(breakCount - byeCount) / 2 === 1 ? 'игра' : (breakCount - byeCount) / 2 < 5 ? 'игры' : 'игр'}).
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-rhetora-teal" />
              Кнопка «В жеребьёвку» создаёт игры только для реальных пар этапа (без пустых BYE-слотов)
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <Users size={13} /> Наведите на команду для подсветки пути
            </span>
          </div>

          {/* Дерево плей-офф с SVG-соединителями */}
          <div
            key={bracketAnimKey}
            className="bg-gradient-to-br from-slate-50 via-white to-sky-50/40 rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-8 overflow-x-auto"
          >
            <div className="min-w-[820px] flex items-stretch">
              {bracketRounds.map((roundMatches, rIdx) => {
                const isLastRound = rIdx === bracketRounds.length - 1;
                const stageMeta = getPlayoffStageMeta(rIdx, bracketRounds.length);
                const activeMatchesInStage = roundMatches.filter((m) => !m.isBye);
                const hasReadyPairs = activeMatchesInStage.some((m) => m.gov && m.opp);

                return (
                  <React.Fragment key={rIdx}>
                    <div className="w-68 shrink-0 flex flex-col">
                      <div className="mb-4 flex items-center justify-between gap-2 px-1">
                        <div>
                          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 block">
                            {stageMeta.title}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            {activeMatchesInStage.length}{' '}
                            {activeMatchesInStage.length === 1
                              ? 'игра'
                              : activeMatchesInStage.length < 5
                              ? 'игры'
                              : 'игр'}
                            {roundMatches.length > activeMatchesInStage.length &&
                              ` · ${roundMatches.length - activeMatchesInStage.length} BYE`}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={!hasReadyPairs || sendingStageType === stageMeta.type}
                          onClick={() => handleSendStageToDraw(rIdx)}
                          title="Создать или обновить этот раунд в жеребьёвке"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rhetora-teal disabled:bg-slate-200 disabled:text-slate-400 text-white text-[11px] font-bold transition shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Send size={11} />
                          {sendingStageType === stageMeta.type ? 'Создание...' : 'В жеребьёвку'}
                        </button>
                      </div>

                      <div className="flex-1 flex flex-col justify-around gap-4">
                        {roundMatches.map((match, mIdx) => {
                          const govIsHovered = hoveredTeamId && match.gov?.id === hoveredTeamId;
                          const oppIsHovered = hoveredTeamId && match.opp?.id === hoveredTeamId;
                          const govIsWinner = Boolean(match.winnerId && match.gov?.id === match.winnerId);
                          const oppIsWinner = Boolean(match.winnerId && match.opp?.id === match.winnerId);

                          return (
                            <div
                              key={match.id}
                              style={{ animationDelay: `${rIdx * 90 + mIdx * 40}ms` }}
                              className={`bracket-card-enter rounded-2xl border transition-all duration-300 shadow-xs overflow-hidden ${
                                match.isBye
                                  ? 'bg-slate-50/80 border-dashed border-slate-300/90'
                                  : 'bg-white border-slate-200/90 hover:border-slate-300'
                              } ${
                                govIsHovered || oppIsHovered
                                  ? 'border-sky-400 ring-2 ring-sky-400/20 shadow-md'
                                  : ''
                              } ${match.flipping ? 'scale-[0.98] opacity-80' : ''}`}
                            >
                              <div className="px-3 py-1.5 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                                <span className="flex items-center gap-1.5">
                                  <span>
                                    {stageMeta.title} · #{mIdx + 1}
                                  </span>
                                  {match.isBye && (
                                    <span className="px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 text-[9px] font-extrabold">
                                      BYE · АВТОПРОХОД
                                    </span>
                                  )}
                                  {match.fromOfficialBallots && (
                                    <span
                                      title="Победитель определён по судейским бюллетеням"
                                      className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 text-[9px] font-extrabold"
                                    >
                                      БЮЛЛЕТЕНИ
                                    </span>
                                  )}
                                </span>
                                {!match.isBye && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSwapSides(rIdx, mIdx)}
                                      title="Поменять стороны GOV / OPP"
                                      className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                                    >
                                      <ArrowUpDown size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCoinFlip(rIdx, mIdx)}
                                      title="Случайный жребий сторон (монетка)"
                                      className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-rhetora-teal transition cursor-pointer"
                                    >
                                      <Shuffle size={11} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Слот GOV */}
                              <button
                                type="button"
                                disabled={!match.gov || match.isBye}
                                onMouseEnter={() => match.gov && setHoveredTeamId(match.gov.id)}
                                onMouseLeave={() => setHoveredTeamId(null)}
                                onClick={() => handleSelectWinner(rIdx, mIdx, match.gov)}
                                className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-2 transition-all duration-200 border-b border-slate-100 ${
                                  !match.gov
                                    ? 'cursor-default opacity-50'
                                    : match.isBye
                                    ? 'cursor-default'
                                    : 'cursor-pointer hover:bg-sky-50/60'
                                } ${
                                  govIsWinner
                                    ? match.isBye
                                      ? 'bg-sky-50/50'
                                      : 'bg-emerald-50/80 winner-slot-pop'
                                    : govIsHovered
                                    ? 'bg-sky-50/80'
                                    : ''
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-extrabold shrink-0">
                                    GOV
                                  </span>
                                  {match.gov ? (
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-slate-400">#{match.gov.seed}</span>
                                        <span
                                          className={`text-xs font-bold truncate ${
                                            govIsWinner && !match.isBye ? 'text-emerald-900' : 'text-slate-800'
                                          }`}
                                        >
                                          {match.gov.name}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">
                                      {match.isBye ? 'Свободный слот (BYE)' : 'Ожидается...'}
                                    </span>
                                  )}
                                </div>

                                {govIsWinner && !match.isBye && (
                                  <Crown size={14} className="text-amber-500 shrink-0 drop-shadow-2xs" />
                                )}
                              </button>

                              {/* Слот OPP */}
                              <button
                                type="button"
                                disabled={!match.opp || match.isBye}
                                onMouseEnter={() => match.opp && setHoveredTeamId(match.opp.id)}
                                onMouseLeave={() => setHoveredTeamId(null)}
                                onClick={() => handleSelectWinner(rIdx, mIdx, match.opp)}
                                className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-2 transition-all duration-200 ${
                                  !match.opp
                                    ? 'cursor-default opacity-50'
                                    : match.isBye
                                    ? 'cursor-default'
                                    : 'cursor-pointer hover:bg-rose-50/40'
                                } ${
                                  oppIsWinner
                                    ? match.isBye
                                      ? 'bg-sky-50/50'
                                      : 'bg-emerald-50/80 winner-slot-pop'
                                    : oppIsHovered
                                    ? 'bg-sky-50/80'
                                    : ''
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-extrabold shrink-0">
                                    OPP
                                  </span>
                                  {match.opp ? (
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-slate-400">#{match.opp.seed}</span>
                                        <span
                                          className={`text-xs font-bold truncate ${
                                            oppIsWinner && !match.isBye ? 'text-emerald-900' : 'text-slate-800'
                                          }`}
                                        >
                                          {match.opp.name}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">
                                      {match.isBye ? 'Свободный слот (BYE)' : 'Ожидается...'}
                                    </span>
                                  )}
                                </div>

                                {oppIsWinner && !match.isBye && (
                                  <Crown size={14} className="text-amber-500 shrink-0 drop-shadow-2xs" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {!isLastRound && (
                      <div className="w-12 shrink-0 flex flex-col pt-10">
                        {Array.from({ length: roundMatches.length / 2 }).map((_, pairIdx) => {
                          const topMatch = roundMatches[pairIdx * 2];
                          const bottomMatch = roundMatches[pairIdx * 2 + 1];

                          const topActive =
                            Boolean(topMatch?.winnerId) && (!hoveredTeamId || topMatch?.winnerId === hoveredTeamId);
                          const bottomActive =
                            Boolean(bottomMatch?.winnerId) &&
                            (!hoveredTeamId || bottomMatch?.winnerId === hoveredTeamId);

                          const topHighlighted = hoveredTeamId && topMatch?.winnerId === hoveredTeamId;
                          const bottomHighlighted = hoveredTeamId && bottomMatch?.winnerId === hoveredTeamId;

                          return (
                            <div key={pairIdx} className="flex-1 relative">
                              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                <path
                                  d="M 0 25 C 50 25, 50 50, 100 50"
                                  fill="none"
                                  vectorEffect="non-scaling-stroke"
                                  stroke={topHighlighted ? '#0284c7' : topActive ? '#10b981' : '#cbd5e1'}
                                  strokeWidth={topHighlighted ? 3 : topActive ? 2.5 : 1.75}
                                  className={`transition-all duration-300 ${topHighlighted ? 'connector-flow' : ''}`}
                                />
                                <path
                                  d="M 0 75 C 50 75, 50 50, 100 50"
                                  fill="none"
                                  vectorEffect="non-scaling-stroke"
                                  stroke={bottomHighlighted ? '#0284c7' : bottomActive ? '#10b981' : '#cbd5e1'}
                                  strokeWidth={bottomHighlighted ? 3 : bottomActive ? 2.5 : 1.75}
                                  className={`transition-all duration-300 ${bottomHighlighted ? 'connector-flow' : ''}`}
                                />
                              </svg>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

              <div className="w-10 shrink-0 flex items-center pt-10">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-24">
                  <line
                    x1="0"
                    y1="50"
                    x2="100"
                    y2="50"
                    vectorEffect="non-scaling-stroke"
                    stroke={championTeam ? '#f59e0b' : '#cbd5e1'}
                    strokeWidth={championTeam ? 3 : 1.75}
                    className={`transition-all duration-500 ${championTeam ? 'connector-flow' : ''}`}
                  />
                </svg>
              </div>

              <div className="w-64 shrink-0 flex flex-col pt-10">
                <div className="flex-1 flex items-center">
                  {championTeam ? (
                    <div className="w-full p-5 rounded-3xl bg-gradient-to-br from-amber-50 via-white to-sky-50 border border-amber-300 champion-card-glow text-center space-y-2.5 winner-slot-pop">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-white flex items-center justify-center mx-auto shadow-md shadow-amber-400/30">
                        <Crown size={24} />
                      </div>
                      <div className="text-[11px] font-extrabold uppercase tracking-widest text-amber-600">
                        Чемпион турнира
                      </div>
                      <div className="text-lg font-extrabold text-slate-900 leading-tight">{championTeam.name}</div>
                      <div className="text-xs text-slate-500">
                        Посев #{championTeam.seed}
                        {championTeam.organization ? ` · ${championTeam.organization}` : ''}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full p-5 rounded-3xl border-2 border-dashed border-slate-200 bg-white/70 text-center space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Trophy size={20} />
                      </div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Чемпион турнира</div>
                      <p className="text-xs text-slate-400">Выберите победителя в карточке Гранд-финала</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ПОДРАЗДЕЛ: БЮЛЛЕТЕНИ */}
      {activeTab === 'ballots' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Контроль судейских бюллетеней</h3>
          {loadingBallots ? (
            <div className="h-48 bg-slate-50 rounded-xl animate-pulse" />
          ) : (
            <div className="space-y-3">
              {ballotsList.map((round: any) => (
                <div key={round.id} className="space-y-2">
                  <div className="text-xs font-bold bg-slate-900 text-white px-3 py-1 rounded-lg inline-block">
                    Раунд {round.number}: {round.name}
                  </div>
                  {round.matches.map((m: any, idx: number) => (
                    <div
                      key={m.id}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                    >
                      <div className="font-bold text-slate-800">
                        Игра #{idx + 1} ({m.room?.name || 'Без комнаты'})
                      </div>
                      <div className="space-y-1">
                        {m.judges.map((j: any) => (
                          <div key={j.id} className="flex items-center justify-between">
                            <span>
                              {j.judge.name} {j.isChair && '👑'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-bold ${
                                j.ballot?.status === 'SUBMITTED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {j.ballot?.status === 'SUBMITTED' ? 'Отправлен' : 'Ожидание'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Модальное окно детализации игры */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-extrabold text-slate-900">Детали игры #{selectedMatch.gameNumber}</h3>
              <button
                onClick={() => setSelectedMatch(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                {selectedMatch.teams.map((t: any) => (
                  <div key={t.id} className="p-3.5 rounded-2xl border bg-slate-50 space-y-2">
                    <span className="font-bold text-xs uppercase text-slate-500">
                      {t.position}: {t.team?.name}
                    </span>
                    <ul className="space-y-1 text-xs font-semibold text-slate-800">
                      {t.team?.members?.map((m: any, mIdx: number) => (
                        <li key={m.id}>
                          {mIdx + 1}С: {m.firstName} {m.lastName}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold uppercase text-slate-400">Судейская коллегия и бюллетени</div>
                {selectedMatch.judges.map((j: any) => {
                  let draft: any = {};
                  try {
                    draft = JSON.parse(j.ballot?.draftData || '{}');
                  } catch (e) {}

                  return (
                    <div key={j.id} className="p-4 rounded-xl border bg-white space-y-2">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>
                          {j.judge.name} {j.isChair && '(Чейр)'}
                        </span>
                        <span className="text-rhetora-teal">Победитель: {draft.winner || 'Не указан'}</span>
                      </div>
                      <p className="text-xs text-slate-600 italic">Комментарий: {j.ballot?.notes || 'Нет заметок'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
