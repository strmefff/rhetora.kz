import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  DoorOpen,
  Trophy,
  UserCheck,
  Save,
  Send,
  CheckCircle2,
  FileEdit,
  Layers,
  Lock,
  Check,
  RefreshCw,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { JudgeLayout } from '../../components/JudgeLayout';
import { API_BASE } from '../../config/api';

interface MatchTeamEntry {
  id: string;
  position: string;
  team?: {
    id: string;
    name: string;
    organization?: string | null;
    members: { id: string; firstName: string; lastName: string }[];
  } | null;
  participant?: {
    id: string;
    firstName: string;
    lastName: string;
    organization?: string | null;
  } | null;
}

interface AssignmentDetail {
  assignmentId: string;
  isChair: boolean;
  judge: { id: string; name: string };
  match: {
    id: string;
    gameNumber: number;
    status: string;
    format: string;
    room: { id: string; name: string; building?: string | null } | null;
    round: { id: string; number: number; name: string; format: string };
    tournament: { id: string; name: string };
    teams: MatchTeamEntry[];
    judges: { id: string; isChair: boolean; judge: { id: string; name: string } }[];
  };
  ballot: {
    id: string;
    status: 'DRAFT' | 'SUBMITTED';
    notes: string | null;
    parsedDraftData: Record<string, any> | null;
    updatedAt: string;
    submittedAt?: string | null;
  } | null;
}

type SpeakerScoreMap = Record<string, { style: number; content: number; strategy: number }>;

interface LocalBallotBackup {
  notes: string;
  winner: string;
  speakerScores: SpeakerScoreMap;
  updatedAt: string;
}

const POSITION_META: Record<string, { label: string; accent: string; badge: string }> = {
  GOV: { label: 'Правительство (GOV)', accent: 'border-sky-200 bg-sky-50/40', badge: 'bg-sky-100 text-sky-800' },
  OPP: { label: 'Оппозиция (OPP)', accent: 'border-rose-200 bg-rose-50/40', badge: 'bg-rose-100 text-rose-800' },
  OG: { label: 'Первое правительство (OG)', accent: 'border-sky-200 bg-sky-50/40', badge: 'bg-sky-100 text-sky-800' },
  OO: { label: 'Первая оппозиция (OO)', accent: 'border-rose-200 bg-rose-50/40', badge: 'bg-rose-100 text-rose-800' },
  CG: { label: 'Второе правительство (CG)', accent: 'border-indigo-200 bg-indigo-50/40', badge: 'bg-indigo-100 text-indigo-800' },
  CO: { label: 'Вторая оппозиция (CO)', accent: 'border-amber-200 bg-amber-50/40', badge: 'bg-amber-100 text-amber-800' },
  AFF: { label: 'Утверждение (AFF)', accent: 'border-sky-200 bg-sky-50/40', badge: 'bg-sky-100 text-sky-800' },
  NEG: { label: 'Отрицание (NEG)', accent: 'border-rose-200 bg-rose-50/40', badge: 'bg-rose-100 text-rose-800' },
};

const FORMAT_POSITION_ORDER: Record<string, string[]> = {
  WSDC: ['GOV', 'OPP'],
  BP: ['OG', 'OO', 'CG', 'CO'],
  LD: ['AFF', 'NEG'],
};

const fetchWithTimeout = async (url: string, options: RequestInit & { timeoutMs?: number } = {}) => {
  const { timeoutMs = 15000, signal: externalSignal, ...rest } = options;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
};

export const JudgeMatchPage = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { token, user } = useAuth();
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [ballotStatus, setBallotStatus] = useState<'DRAFT' | 'SUBMITTED'>('DRAFT');
  const [notes, setNotes] = useState('');
  const [winner, setWinner] = useState<string>('');
  const [speakerScoresState, setSpeakerScoresState] = useState<SpeakerScoreMap>({});

  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'offline'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hydratedRef = useRef(false);
  const dirtyRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const autoSaveAbortRef = useRef<AbortController | null>(null);

  const storageKey = assignmentId ? `rhetora_ballot_draft_${assignmentId}` : '';

  const readLocalBackup = (): LocalBallotBackup | null => {
    if (!storageKey) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const writeLocalBackup = useCallback(
    (payload: LocalBallotBackup) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {
        // Игнорируем переполнение квоты Safari Private Mode
      }
    },
    [storageKey]
  );

  const clearLocalBackup = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    const loadMatchAndInitBallot = async () => {
      if (!assignmentId || !token) return;
      try {
        const res = await fetchWithTimeout(`${API_BASE}/api/judge/assignments/${assignmentId}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeoutMs: 20000,
        });
        const json = await res.json();

        if (!res.ok) {
          showError(json.error || 'Нет доступа к этой игре', json);
          navigate('/judge/dashboard');
          return;
        }

        setData(json);

        const ballotRes = await fetchWithTimeout(
          `${API_BASE}/api/judge/assignments/${assignmentId}/ballot`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            timeoutMs: 20000,
          }
        );

        let serverStatus: 'DRAFT' | 'SUBMITTED' = json.ballot?.status || 'DRAFT';
        let serverNotes = json.ballot?.notes || '';
        let serverDraft = json.ballot?.parsedDraftData || {};
        let serverUpdatedAt = json.ballot?.updatedAt || null;

        if (ballotRes.ok) {
          const ballotJson = await ballotRes.json();
          serverStatus = ballotJson.status || 'DRAFT';
          serverNotes = ballotJson.notes || '';
          serverDraft = ballotJson.parsedDraftData || {};
          serverUpdatedAt = ballotJson.updatedAt || null;
        }

        const localBackup = readLocalBackup();
        const serverTs = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;
        const localTs = localBackup?.updatedAt ? new Date(localBackup.updatedAt).getTime() : 0;
        const useLocal = serverStatus !== 'SUBMITTED' && localBackup && localTs > serverTs;

        const effectiveNotes = useLocal ? localBackup.notes : serverNotes;
        const effectiveWinner = useLocal ? localBackup.winner : serverDraft.winner || '';
        const baseScores: SpeakerScoreMap = useLocal
          ? { ...(localBackup.speakerScores || {}) }
          : { ...(serverDraft.speakerScores || {}) };

        if (json?.match?.teams) {
          json.match.teams.forEach((entry: any) => {
            if (entry.team?.members) {
              entry.team.members.forEach((member: any) => {
                const key = `${entry.position}_${member.id}`;
                if (!baseScores[key]) {
                  baseScores[key] = { style: 0, content: 0, strategy: 0 };
                }
              });
            }
          });
        }

        setBallotStatus(serverStatus);
        setNotes(effectiveNotes);
        setWinner(effectiveWinner);
        setSpeakerScoresState(baseScores);
        setLastSavedAt(useLocal ? localBackup.updatedAt : serverUpdatedAt);

        if (serverStatus === 'SUBMITTED') {
          clearLocalBackup();
          setSyncState('saved');
        } else if (useLocal) {
          dirtyRef.current = true;
          setSyncState('offline');
        } else if (serverUpdatedAt) {
          setSyncState('saved');
        }

        hydratedRef.current = true;
      } catch (err: any) {
        const localBackup = readLocalBackup();
        if (localBackup) {
          setNotes(localBackup.notes || '');
          setWinner(localBackup.winner || '');
          setSpeakerScoresState(localBackup.speakerScores || {});
          setLastSavedAt(localBackup.updatedAt || null);
          setSyncState('offline');
          hydratedRef.current = true;
        }
        showError('Нестабильное соединение при загрузке игры. Проверьте интернет и обновите страницу.', {
          message: err.message,
        });
      } finally {
        setLoading(false);
      }
    };

    loadMatchAndInitBallot();
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (autoSaveAbortRef.current) autoSaveAbortRef.current.abort();
    };
  }, [assignmentId, token]);

  const syncDraftToServer = useCallback(
    async (manual = false) => {
      if (!assignmentId || !token || ballotStatus === 'SUBMITTED' || !data?.isChair) return;

      if (autoSaveAbortRef.current) {
        autoSaveAbortRef.current.abort();
      }
      const controller = new AbortController();
      autoSaveAbortRef.current = controller;

      setSyncState('saving');
      try {
        const res = await fetchWithTimeout(
          `${API_BASE}/api/judge/assignments/${assignmentId}/ballot/draft`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              notes,
              draftData: {
                format: data?.match.format,
                winner,
                speakerScores: speakerScoresState,
              },
            }),
            signal: controller.signal,
            timeoutMs: 12000,
          }
        );

        if (controller.signal.aborted) return;

        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          dirtyRef.current = false;
          setBallotStatus(json.status || 'DRAFT');
          setLastSavedAt(json.updatedAt || new Date().toISOString());
          setSyncState('saved');
          if (manual) {
            showSuccess('Черновик бюллетеня сохранён');
          }
        } else if (res.status === 409) {
          dirtyRef.current = false;
          setBallotStatus('SUBMITTED');
          clearLocalBackup();
          setSyncState('saved');
        } else {
          setSyncState('offline');
          if (manual) {
            showError(json.error || 'Не удалось сохранить на сервер — данные сохранены на телефоне', json);
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' && !manual) return;
        setSyncState('offline');
        if (manual) {
          showError('Нет связи с сервером — баллы надёжно сохранены в памяти телефона');
        }
      }
    },
    [assignmentId, token, ballotStatus, data, notes, winner, speakerScoresState, clearLocalBackup, showSuccess, showError]
  );

  // Мгновенный локальный бэкап + неблокирующий автосейв на сервер через 1.5с
  useEffect(() => {
    if (!hydratedRef.current || ballotStatus === 'SUBMITTED' || !data?.isChair) return;

    const nowIso = new Date().toISOString();
    dirtyRef.current = true;
    writeLocalBackup({
      notes,
      winner,
      speakerScores: speakerScoresState,
      updatedAt: nowIso,
    });
    setLastSavedAt(nowIso);

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      syncDraftToServer(false);
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [notes, winner, speakerScoresState, ballotStatus, data?.isChair, writeLocalBackup, syncDraftToServer]);

  // Автосинхронизация при возврате интернета или разблокировке экрана телефона
  useEffect(() => {
    const handleOnlineOrVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        dirtyRef.current &&
        ballotStatus !== 'SUBMITTED' &&
        data?.isChair
      ) {
        syncDraftToServer(false);
      }
    };
    window.addEventListener('online', handleOnlineOrVisible);
    document.addEventListener('visibilitychange', handleOnlineOrVisible);
    return () => {
      window.removeEventListener('online', handleOnlineOrVisible);
      document.removeEventListener('visibilitychange', handleOnlineOrVisible);
    };
  }, [ballotStatus, data?.isChair, syncDraftToServer]);

  const getSpeakerTotal = (style: number, content: number, strategy: number) => {
    return Number(style || 0) + Number(content || 0) + Number(strategy || 0);
  };

  const handleOpenConfirm = () => {
    if (!assignmentId || ballotStatus === 'SUBMITTED' || !data?.isChair) return;
    if (!winner) {
      showError('Пожалуйста, выберите победителя дебатов перед отправкой');
      return;
    }
    setConfirmOpen(true);
  };

  const handleSubmitBallot = async () => {
    if (!assignmentId || ballotStatus === 'SUBMITTED' || !data?.isChair || submitting) return;
    if (!winner) {
      showError('Пожалуйста, выберите победителя дебатов перед отправкой');
      return;
    }

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (autoSaveAbortRef.current) autoSaveAbortRef.current.abort();

    setSubmitting(true);

    const payload = JSON.stringify({
      notes,
      draftData: {
        format: data?.match.format,
        winner,
        speakerScores: speakerScoresState,
      },
    });

    const sendAttempt = () =>
      fetchWithTimeout(`${API_BASE}/api/judge/assignments/${assignmentId}/ballot/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: payload,
        timeoutMs: 15000,
      });

    try {
      let res: Response;
      try {
        res = await sendAttempt();
      } catch {
        // Одна автоматическая повторная попытка при кратковременном провале 4G
        await new Promise((r) => setTimeout(r, 1200));
        res = await sendAttempt();
      }

      const json = await res.json().catch(() => ({}));
      if (res.ok || res.status === 409) {
        dirtyRef.current = false;
        clearLocalBackup();
        setBallotStatus('SUBMITTED');
        setLastSavedAt(json.submittedAt || json.updatedAt || new Date().toISOString());
        setSyncState('saved');
        setConfirmOpen(false);
        showSuccess('Бюллетень успешно отправлен!');
      } else {
        showError(json.error || 'Ошибка отправки бюллетеня. Попробуйте ещё раз.', json);
      }
    } catch (err: any) {
      setSyncState('offline');
      showError(
        'Слабый интернет: сервер не ответил вовремя. Все баллы сохранены на телефоне — нажмите «Подтвердить отправку» ещё раз.',
        { message: err?.message }
      );
    } finally {
      setSubmitting(false);
    }
  };

  const orderedTeams = React.useMemo(() => {
    if (!data?.match.teams) return [];
    const order = FORMAT_POSITION_ORDER[data.match.format] || [];
    return [...data.match.teams].sort((a, b) => {
      const idxA = order.indexOf(a.position);
      const idxB = order.indexOf(b.position);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [data]);

  const teamTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};
    orderedTeams.forEach((entry) => {
      let sum = 0;
      entry.team?.members?.forEach((member) => {
        const sc = speakerScoresState[`${entry.position}_${member.id}`];
        if (sc) {
          sum += getSpeakerTotal(sc.style, sc.content, sc.strategy);
        }
      });
      totals[entry.position] = sum;
    });
    return totals;
  }, [orderedTeams, speakerScoresState]);

  const formatSavedTime = (iso: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const isLocked = ballotStatus === 'SUBMITTED' || !data?.isChair;

  return (
    <JudgeLayout
      judgeName={data?.judge.name || user?.name}
      activeTournamentName={data?.match.tournament.name}
    >
      <div className="space-y-5 pb-10">
        {/* Навигация назад */}
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/judge/dashboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft size={16} />
            Назад к моим играм
          </Link>

          {!isLocked && (
            <div className="text-xs font-medium">
              {syncState === 'saving' && (
                <span className="inline-flex items-center gap-1.5 text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
                  <RefreshCw size={12} className="animate-spin" />
                  Сохранение...
                </span>
              )}
              {syncState === 'saved' && (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <Check size={12} />
                  Сохранено {lastSavedAt ? `в ${formatSavedTime(lastSavedAt)}` : ''}
                </span>
              )}
              {syncState === 'offline' && (
                <span className="inline-flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  <WifiOff size={12} />
                  На телефоне (ожидание сети)
                </span>
              )}
            </div>
          )}
        </div>

        {loading || !data ? (
          <div className="space-y-4">
            <div className="h-36 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            <div className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          </div>
        ) : (
          <>
            {/* Шапка игры */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rhetora-teal uppercase tracking-wider">
                    <Trophy size={13} />
                    {data.match.tournament.name}
                  </div>
                  <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 mt-1">
                    Раунд {data.match.round.number} · {data.match.round.name} — Игра #{data.match.gameNumber}
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-slate-900 text-white text-xs font-bold">
                    {data.match.format}
                  </span>
                  {ballotStatus === 'SUBMITTED' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                      <CheckCircle2 size={14} />
                      Отправлен
                    </span>
                  ) : !data.isChair ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                      <Lock size={14} />
                      Только просмотр (Боковой)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold">
                      <FileEdit size={14} />
                      Черновик
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-sm">
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <DoorOpen size={18} className="text-rhetora-teal shrink-0" />
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Аудитория</div>
                    <div className="font-bold text-slate-800">
                      {data.match.room ? data.match.room.name : 'Не назначена'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <UserCheck size={18} className="text-rhetora-teal shrink-0" />
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Назначенный судья</div>
                    <div className="font-bold text-slate-800">
                      {data.judge.name} ({data.isChair ? 'Главный судья (Чейр)' : 'Боковой судья'})
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <Layers size={18} className="text-rhetora-teal shrink-0" />
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Формат дебатов</div>
                    <div className="font-bold text-slate-800">{data.match.format}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Предупреждение для бокового судьи */}
            {!data.isChair && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-medium shadow-sm">
                <Lock size={20} className="text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold">Режим просмотра:</span> Вы назначены боковым судьей (Винг). Вы можете изучать составы и оставлять личные заметки, но заполнять протокол и отправлять официальный бюллетень может только Главный судья (Чейр).
                </div>
              </div>
            )}

            {/* Блок судейского листа */}
            <section className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Судейский протокол и спикерские баллы</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Критерии: Стиль (до 40), Контент (до 40), Стратегия (до 20). Прогресс сохраняется автоматически.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {orderedTeams.map((entry) => {
                  const meta = POSITION_META[entry.position] || {
                    label: entry.position,
                    accent: 'border-slate-200 bg-slate-50/40',
                    badge: 'bg-slate-100 text-slate-700',
                  };

                  return (
                    <div key={entry.id} className={`rounded-2xl border p-4 sm:p-5 space-y-4 ${meta.accent}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${meta.badge}`}>
                          {meta.label}
                        </span>
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-slate-900">
                            {entry.team?.name || 'Команда TBD'}
                          </div>
                          <div className="text-[11px] font-bold text-slate-500">
                            Сумма команды: {teamTotals[entry.position] || 0}
                          </div>
                        </div>
                      </div>

                      {/* Список спикеров с инпутами по критериям */}
                      <div className="space-y-3">
                        {entry.team?.members && entry.team.members.length > 0 ? (
                          entry.team.members.map((member, idx) => {
                            const key = `${entry.position}_${member.id}`;
                            const scores = speakerScoresState[key] || { style: 0, content: 0, strategy: 0 };
                            const total = getSpeakerTotal(scores.style, scores.content, scores.strategy);

                            return (
                              <div key={member.id} className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-2.5 shadow-sm">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px]">
                                      {idx + 1}
                                    </span>
                                    {member.firstName} {member.lastName}
                                  </span>
                                  <span className="text-rhetora-teal font-extrabold text-sm">
                                    Итого: {total} / 100
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[11px] text-slate-500 block mb-1 font-medium">Стиль (/40)</label>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      disabled={isLocked}
                                      value={scores.style ?? 0}
                                      onFocus={(e) => e.currentTarget.select()}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        const num = val === '' ? 0 : Math.min(40, Number(val));
                                        setSpeakerScoresState((prev) => ({
                                          ...prev,
                                          [key]: { ...scores, style: num },
                                        }));
                                      }}
                                      className="w-full py-2.5 px-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-base sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-rhetora-teal focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[11px] text-slate-500 block mb-1 font-medium">Контент (/40)</label>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      disabled={isLocked}
                                      value={scores.content ?? 0}
                                      onFocus={(e) => e.currentTarget.select()}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        const num = val === '' ? 0 : Math.min(40, Number(val));
                                        setSpeakerScoresState((prev) => ({
                                          ...prev,
                                          [key]: { ...scores, content: num },
                                        }));
                                      }}
                                      className="w-full py-2.5 px-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-base sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-rhetora-teal focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[11px] text-slate-500 block mb-1 font-medium">Стратегия (/20)</label>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      disabled={isLocked}
                                      value={scores.strategy ?? 0}
                                      onFocus={(e) => e.currentTarget.select()}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        const num = val === '' ? 0 : Math.min(20, Number(val));
                                        setSpeakerScoresState((prev) => ({
                                          ...prev,
                                          [key]: { ...scores, strategy: num },
                                        }));
                                      }}
                                      className="w-full py-2.5 px-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-base sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-rhetora-teal focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-xs text-slate-400 italic p-3 bg-white rounded-xl border">
                            Состав спикеров не указан
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Выбор победителя дебатов */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="block text-sm font-bold text-slate-900">
                  Победитель дебатов (Фракция) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => setWinner('GOV')}
                    className={`p-4 rounded-xl border text-center font-bold text-sm transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${
                      winner === 'GOV'
                        ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Правительство (GOV) {winner === 'GOV' && '✓'}
                  </button>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => setWinner('OPP')}
                    className={`p-4 rounded-xl border text-center font-bold text-sm transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${
                      winner === 'OPP'
                        ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Оппозиция (OPP) {winner === 'OPP' && '✓'}
                  </button>
                </div>
              </div>

              {/* Обоснование решения */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Обоснование решения и столкновения (Oral Adjudication / Notes)
                </label>
                <textarea
                  rows={4}
                  disabled={isLocked}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Опишите ключевые клэши и аргументы победившей стороны..."
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              {/* Кнопки сохранения / отправки */}
              {!isLocked && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => syncDraftToServer(true)}
                    disabled={syncState === 'saving' || submitting}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3.5 sm:py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition disabled:opacity-50 cursor-pointer"
                  >
                    <Save size={16} />
                    {syncState === 'saving' ? 'Сохранение...' : 'Сохранить черновик'}
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenConfirm}
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3.5 sm:py-2.5 rounded-xl bg-rhetora-teal hover:bg-sky-600 text-white text-sm font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    <Send size={16} />
                    Отправить бюллетень
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Встроенное окно подтверждения отправки (работает во всех мобильных браузерах, Telegram и WhatsApp) */}
      {confirmOpen && (
        <div
          onClick={() => !submitting && setConfirmOpen(false)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900">Подтвердите отправку</h3>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Победитель:</span>
                <span className="font-extrabold text-slate-900">
                  {winner === 'GOV' ? 'Правительство (GOV)' : 'Оппозиция (OPP)'}
                </span>
              </div>
              {orderedTeams.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    {entry.team?.name || entry.position} ({entry.position}):
                  </span>
                  <span className="font-bold text-slate-900">{teamTotals[entry.position] || 0} баллов</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              После отправки бюллетень попадёт в табуляцию турнира и редактирование будет заблокировано.
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className="py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition disabled:opacity-50 cursor-pointer"
              >
                Вернуться
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitBallot}
                className="py-3 rounded-xl bg-rhetora-teal hover:bg-sky-600 text-white font-bold text-sm shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Отправка...
                  </>
                ) : (
                  'Подтвердить отправку'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </JudgeLayout>
  );
};
