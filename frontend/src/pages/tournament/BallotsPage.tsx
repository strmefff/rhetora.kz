import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  CheckCircle2, 
  Clock, 
  FileText, 
  ShieldAlert, 
  Layers, 
  DoorOpen, 
  UserCheck, 
  ChevronDown, 
  ChevronUp,
  Eye,
  FileEdit,
  Trophy
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { API_BASE } from '../../config/api';

export const BallotsPage = () => {
  const location = useLocation();
  const tournamentId = location.pathname.split('/')[2];
  const { token } = useAuth();
  const { showError } = useToast();

  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoundId, setSelectedRoundId] = useState<string>('all');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const fetchBallots = async () => {
    if (!tournamentId || !token) return;
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/ballots`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setRounds(data);
        if (data.length > 0 && selectedRoundId === 'all') {
          // По умолчанию выберем первый раунд
          setSelectedRoundId(data[0].id);
        }
      } else {
        showError(data.error || 'Не удалось загрузить бюллетени');
      }
    } catch (err: any) {
      showError('Ошибка сети при загрузке бюллетеней', { message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBallots();
  }, [tournamentId, token]);

  const currentRound = rounds.find(r => r.id === selectedRoundId);

  // Статистика по раунду
  const stats = React.useMemo(() => {
    let totalAssignments = 0;
    let submittedCount = 0;

    rounds.forEach(r => {
      if (selectedRoundId === 'all' || r.id === selectedRoundId) {
        r.matches.forEach((m: any) => {
          m.judges.forEach((j: any) => {
            totalAssignments++;
            if (j.ballot?.status === 'SUBMITTED') submittedCount++;
          });
        });
      }
    });

    return { totalAssignments, submittedCount, percent: totalAssignments > 0 ? Math.round((submittedCount / totalAssignments) * 100) : 0 };
  }, [rounds, selectedRoundId]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Шапка и фильтры по раундам */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Мониторинг бюллетеней (Таб-рум)</h2>
          <p className="text-sm text-slate-500">Контроль заполнения судейских протоколов в реальном времени</p>
        </div>

        {/* Переключатель раундов */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <button
            onClick={() => setSelectedRoundId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedRoundId === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Все раунды
          </button>
          {rounds.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRoundId(r.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedRoundId === r.id
                  ? 'bg-rhetora-teal text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Раунд {r.number}: {r.name}
            </button>
          ))}
        </div>
      </div>

      {/* Прогресс-бар заполнения */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 w-full sm:w-auto">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Статус сбора бюллетеней</div>
          <div className="text-2xl font-extrabold text-slate-900">
            {stats.submittedCount} из {stats.totalAssignments} отправлено{' '}
            <span className="text-sm font-semibold text-rhetora-teal">({stats.percent}%)</span>
          </div>
        </div>
        <div className="w-full sm:w-64 bg-slate-100 h-3 rounded-full overflow-hidden">
          <div 
            className="bg-rhetora-teal h-full transition-all duration-500 rounded-full"
            style={{ width: `${stats.percent}%` }}
          />
        </div>
      </div>

      {/* Список матчей и комнат */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="bg-white h-24 rounded-2xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : rounds.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <FileText className="mx-auto text-slate-300" size={40} />
          <h3 className="font-bold text-slate-800">Раунды и жеребьёвка ещё не созданы</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">Создайте раунды и сгенерируйте жеребьёвку, чтобы здесь появились судейские бюллетени.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rounds
            .filter(r => selectedRoundId === 'all' || r.id === selectedRoundId)
            .map(round => (
              <div key={round.id} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white text-xs font-bold">
                    Раунд {round.number}
                  </span>
                  <span className="text-sm font-bold text-slate-800">{round.name}</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {round.matches.map((match: any, matchIndex: number) => {
                    const isExpanded = expandedMatchId === match.id;

                    // Находим решение главного судьи для подсветки победителя на плашке
                    let matchWinner: string | null = null;
                    match.judges.forEach((j: any) => {
                      if (j.ballot?.status === 'SUBMITTED') {
                        try {
                          const draft = JSON.parse(j.ballot.draftData || '{}');
                          if (draft.winner) matchWinner = draft.winner;
                        } catch (e) {}
                      }
                    });

                    return (
                      <div 
                        key={match.id}
                        className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition hover:border-slate-300"
                      >
                        <div 
                          onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                          className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900 text-base">Игра #{matchIndex + 1}</span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-700 text-xs font-bold">{round.format}</span>
                              <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                                <DoorOpen size={14} className="text-rhetora-teal" />
                                {match.room ? match.room.name : 'Комната не назначена'}
                              </span>
                            </div>

                            {/* Список команд с динамической подсветкой победителя */}
                            <div className="text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                              {match.teams.map((t: any) => {
                                const isWinner = matchWinner === t.position;
                                const isGov = t.position === 'GOV';

                                let badgeStyle = "bg-white border-slate-200 text-slate-700";
                                if (isWinner) {
                                  badgeStyle = isGov 
                                    ? "bg-sky-50 border-sky-300 text-sky-900 font-bold shadow-sm ring-1 ring-sky-300" 
                                    : "bg-rose-50 border-rose-300 text-rose-900 font-bold shadow-sm ring-1 ring-rose-300";
                                }

                                return (
                                  <span key={t.id} className={`px-2.5 py-1 rounded-lg border transition ${badgeStyle}`}>
                                    <strong className={isWinner ? (isGov ? "text-sky-700" : "text-rose-700") : "text-slate-900"}>
                                      {t.position}:
                                    </strong>{' '}
                                    {t.team?.name || t.participant?.firstName + ' ' + t.participant?.lastName || 'TBD'}
                                    {isWinner && <span className="ml-1 text-xs">👑</span>}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3">
                            {/* Индикатор судейских статусов */}
                            <div className="flex items-center gap-1.5">
                              {match.judges.map((j: any) => {
                                const status = j.ballot?.status;
                                if (status === 'SUBMITTED') {
                                  return (
                                    <span key={j.id} title={`${j.judge.name}: Отправлен`} className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold border border-emerald-300">
                                      <CheckCircle2 size={14} />
                                    </span>
                                  );
                                }
                                if (status === 'DRAFT') {
                                  return (
                                    <span key={j.id} title={`${j.judge.name}: Черновик`} className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold border border-sky-300">
                                      <FileEdit size={14} />
                                    </span>
                                  );
                                }
                                return (
                                  <span key={j.id} title={`${j.judge.name}: Ожидает`} className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold border border-amber-300">
                                    <Clock size={14} />
                                  </span>
                                );
                              })}
                            </div>

                            <button className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                          </div>
                        </div>

                        {/* Раскрывающийся список судей этого матча и их деталей */}
                        {isExpanded && (
                          <div className="border-t border-slate-200/80 p-4 sm:p-5 bg-white space-y-3">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Судейская коллегия матча и протоколы</div>
                            <div className="grid grid-cols-1 gap-4">
                              {match.judges.map((j: any) => {
                                const ballot = j.ballot;
                                const isSubmitted = ballot?.status === 'SUBMITTED';

                                let draft: any = {};
                                try {
                                  draft = JSON.parse(ballot?.draftData || '{}');
                                } catch (e) {}

                                const speakerScores = draft.speakerScores || {};
                                const winner = draft.winner;

                                return (
                                  <div key={j.id} className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                                      <div className="font-bold text-slate-800 flex items-center gap-2 text-base">
                                        <UserCheck size={18} className="text-rhetora-teal" />
                                        {j.judge.name} 
                                        {j.isChair && (
                                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md font-semibold">
                                            Главный судья (Чейр)
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {winner && (
                                          <span className={`px-3 py-1 rounded-xl text-xs font-bold ${winner === 'GOV' ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}`}>
                                            Победитель: {winner === 'GOV' ? 'Правительство (GOV)' : 'Оппозиция (OPP)'}
                                          </span>
                                        )}
                                        {isSubmitted ? (
                                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                                            <CheckCircle2 size={14} /> Отправлен
                                          </span>
                                        ) : ballot?.status === 'DRAFT' ? (
                                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold">
                                            <FileEdit size={14} /> Черновик
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                                            <Clock size={14} /> Не начат
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Спикерские баллы из протокола */}
                                    <div className="space-y-2">
                                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Спикерские баллы по протоколу</div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {match.teams.map((t: any) => (
                                          <div key={t.id} className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-2 shadow-sm">
                                            <div className="font-bold text-xs text-slate-900 uppercase">
                                              {t.position}: {t.team?.name || t.participant?.firstName + ' ' + t.participant?.lastName || 'TBD'}
                                            </div>
                                            <div className="space-y-1.5">
                                              {t.team?.members?.length > 0 ? (
                                                t.team.members.map((m: any) => {
                                                  const key = `${t.position}_${m.id}`;
                                                  const sc = speakerScores[key] || speakerScores[m.id];
                                                  const total = sc ? Number(sc.style || 0) + Number(sc.content || 0) + Number(sc.strategy || 0) : '—';

                                                  return (
                                                    <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 gap-1">
                                                      <span className="font-bold text-slate-800">{m.firstName} {m.lastName}</span>
                                                      {sc ? (
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-600">
                                                          <span>Стиль: <strong className="text-slate-900">{sc.style}</strong></span>
                                                          <span>Контент: <strong className="text-slate-900">{sc.content}</strong></span>
                                                          <span>Стратегия: <strong className="text-slate-900">{sc.strategy}</strong></span>
                                                          <span className="text-rhetora-teal font-extrabold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                                                            Итого: {total} / 100
                                                          </span>
                                                        </div>
                                                      ) : (
                                                        <span className="text-slate-400 italic">Оценки не выставлены</span>
                                                      )}
                                                    </div>
                                                  );
                                                })
                                              ) : (
                                                <div className="text-xs text-slate-400 italic p-2">Состав спикеров пустой</div>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Обоснование решения / Заметки */}
                                    <div className="text-xs text-slate-600 bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-1">
                                      <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Обоснование решения (Комментарий судьи):</div>
                                      <p className="italic text-slate-600 whitespace-pre-wrap">
                                        {ballot?.notes ? ballot.notes : 'Судья ещё не оставил текстовое обоснование решения.'}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
