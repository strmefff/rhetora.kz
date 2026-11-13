import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  DoorOpen,
  Trophy,
  UserCheck,
  Users,
  Save,
  Send,
  CheckCircle2,
  FileEdit,
  Layers,
  Lock,
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

const POSITION_META: Record<string, { label: string; accent: string; badge: string }> = {
  // WSDC
  GOV: { label: 'Правительство (GOV)', accent: 'border-sky-200 bg-sky-50/40', badge: 'bg-sky-100 text-sky-800' },
  OPP: { label: 'Оппозиция (OPP)', accent: 'border-rose-200 bg-rose-50/40', badge: 'bg-rose-100 text-rose-800' },
  // BP
  OG: { label: 'Первое правительство (OG)', accent: 'border-sky-200 bg-sky-50/40', badge: 'bg-sky-100 text-sky-800' },
  OO: { label: 'Первая оппозиция (OO)', accent: 'border-rose-200 bg-rose-50/40', badge: 'bg-rose-100 text-rose-800' },
  CG: { label: 'Второе правительство (CG)', accent: 'border-indigo-200 bg-indigo-50/40', badge: 'bg-indigo-100 text-indigo-800' },
  CO: { label: 'Вторая оппозиция (CO)', accent: 'border-amber-200 bg-amber-50/40', badge: 'bg-amber-100 text-amber-800' },
  // LD
  AFF: { label: 'Утверждение (AFF)', accent: 'border-sky-200 bg-sky-50/40', badge: 'bg-sky-100 text-sky-800' },
  NEG: { label: 'Отрицание (NEG)', accent: 'border-rose-200 bg-rose-50/40', badge: 'bg-rose-100 text-rose-800' },
};

const FORMAT_POSITION_ORDER: Record<string, string[]> = {
  WSDC: ['GOV', 'OPP'],
  BP: ['OG', 'OO', 'CG', 'CO'],
  LD: ['AFF', 'NEG'],
};

export const JudgeMatchPage = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { token, user } = useAuth();
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Состояния судейского протокола
  const [ballotStatus, setBallotStatus] = useState<'DRAFT' | 'SUBMITTED'>('DRAFT');
  const [notes, setNotes] = useState('');
  const [winner, setWinner] = useState<string>(''); // 'GOV' или 'OPP'
  const [speakerScoresState, setSpeakerScoresState] = useState<Record<string, { style: number; content: number; strategy: number }>>({});
  
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const loadMatchAndInitBallot = async () => {
      if (!assignmentId || !token) return;
      try {
        const res = await fetch(`${API_BASE}/api/judge/assignments/${assignmentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (!res.ok) {
          showError(json.error || 'Нет доступа к этой игре', json);
          navigate('/judge/dashboard');
          return;
        }

        setData(json);

        const ballotRes = await fetch(
          `${API_BASE}/api/judge/assignments/${assignmentId}/ballot`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (ballotRes.ok) {
          const ballotJson = await ballotRes.json();
          setBallotStatus(ballotJson.status || 'DRAFT');
          setNotes(ballotJson.notes || '');
          
          const draft = ballotJson.parsedDraftData || {};
          setWinner(draft.winner || '');

          // Инициализируем баллы с дефолтными нулями для всех участников команды
          const initialScores = draft.speakerScores || {};
          if (json?.match?.teams) {
            json.match.teams.forEach((entry: any) => {
              if (entry.team?.members) {
                entry.team.members.forEach((member: any) => {
                  const key = `${entry.position}_${member.id}`;
                  if (!initialScores[key]) {
                    initialScores[key] = { style: 0, content: 0, strategy: 0 };
                  }
                });
              }
            });
          }
          setSpeakerScoresState(initialScores);
          setLastSavedAt(ballotJson.updatedAt || null);
        }
      } catch (err: any) {
        showError('Ошибка сети при загрузке игры', { message: err.message });
      } finally {
        setLoading(false);
      }
    };

    loadMatchAndInitBallot();
  }, [assignmentId, token]);

  const getSpeakerTotal = (style: number, content: number, strategy: number) => {
    return Number(style || 0) + Number(content || 0) + Number(strategy || 0);
  };

  const handleSaveDraft = async () => {
    if (!assignmentId || ballotStatus === 'SUBMITTED' || !data?.isChair) return;
    setSavingDraft(true);
    try {
      const res = await fetch(
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
        }
      );

      const json = await res.json();
      if (res.ok) {
        setBallotStatus(json.status);
        setLastSavedAt(json.updatedAt);
        showSuccess('Черновик бюллетеня сохранён');
      } else {
        showError(json.error || 'Не удалось сохранить черновик', json);
      }
    } catch (err: any) {
      showError('Ошибка сети при сохранении черновика', { message: err.message });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitBallot = async () => {
    if (!assignmentId || ballotStatus === 'SUBMITTED' || !data?.isChair) return;
    if (!winner) {
      showError('Пожалуйста, выберите победителя дебатов перед отправкой');
      return;
    }
    if (!confirm('Отправить бюллетень? После отправки редактирование будет заблокировано.')) return;

    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/judge/assignments/${assignmentId}/ballot/submit`,
        {
          method: 'POST',
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
        }
      );

      const json = await res.json();
      if (res.ok) {
        setBallotStatus('SUBMITTED');
        setLastSavedAt(json.submittedAt || json.updatedAt);
        showSuccess('Бюллетень успешно отправлен!');
      } else {
        showError(json.error || 'Ошибка отправки бюллетеня', json);
      }
    } catch (err: any) {
      showError('Ошибка сети при отправке бюллетеня', { message: err.message });
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

  // Заблокировано если отправлено ИЛИ если судья боковой (!data.isChair)
  const isLocked = ballotStatus === 'SUBMITTED' || !data?.isChair;

  return (
    <JudgeLayout
      judgeName={data?.judge.name || user?.name}
      activeTournamentName={data?.match.tournament.name}
    >
      <div className="space-y-6">
        {/* Навигация назад */}
        <div>
          <Link
            to="/judge/dashboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft size={16} />
            Назад к моим играм
          </Link>
        </div>

        {loading || !data ? (
          <div className="space-y-4">
            <div className="h-36 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            <div className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          </div>
        ) : (
          <>
            {/* Шапка игры */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rhetora-teal uppercase tracking-wider">
                    <Trophy size={13} />
                    {data.match.tournament.name}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
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

            {/* Блок судейского листа WSDC (баллы спикеров по критериям) */}
            <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Судейский протокол и спикерские баллы</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Критерии: Стиль (до 40), Контент (до 40), Стратегия (до 20). Сумма до 100 баллов рассчитывается автоматически.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        <span className="text-sm font-extrabold text-slate-900">
                          {entry.team?.name || 'Команда TBD'}
                        </span>
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

                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">Стиль (/40)</label>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      disabled={isLocked}
                                      value={scores.style ?? 0}
                                      onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        const num = val === '' ? 0 : Math.min(40, Number(val));
                                        setSpeakerScoresState({
                                          ...speakerScoresState,
                                          [key]: { ...scores, style: num }
                                        });
                                      }}
                                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-slate-800 focus:outline-none focus:border-rhetora-teal disabled:bg-slate-100 disabled:text-slate-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">Контент (/40)</label>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      disabled={isLocked}
                                      value={scores.content ?? 0}
                                      onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        const num = val === '' ? 0 : Math.min(40, Number(val));
                                        setSpeakerScoresState({
                                          ...speakerScoresState,
                                          [key]: { ...scores, content: num }
                                        });
                                      }}
                                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-slate-800 focus:outline-none focus:border-rhetora-teal disabled:bg-slate-100 disabled:text-slate-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">Стратегия (/20)</label>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      disabled={isLocked}
                                      value={scores.strategy ?? 0}
                                      onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        const num = val === '' ? 0 : Math.min(20, Number(val));
                                        setSpeakerScoresState({
                                          ...speakerScoresState,
                                          [key]: { ...scores, strategy: num }
                                        });
                                      }}
                                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-slate-800 focus:outline-none focus:border-rhetora-teal disabled:bg-slate-100 disabled:text-slate-500"
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
                    className={`p-3.5 rounded-xl border text-center font-bold text-sm transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${
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
                    className={`p-3.5 rounded-xl border text-center font-bold text-sm transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              {/* Кнопки сохранения / отправки */}
              {!isLocked && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={savingDraft || submitting}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition disabled:opacity-50 cursor-pointer"
                  >
                    <Save size={16} />
                    {savingDraft ? 'Сохранение...' : 'Сохранить черновик'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitBallot}
                    disabled={savingDraft || submitting}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rhetora-teal hover:bg-sky-600 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    <Send size={16} />
                    {submitting ? 'Отправка...' : 'Отправить бюллетень'}
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </JudgeLayout>
  );
};
