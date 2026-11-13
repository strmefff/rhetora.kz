import { API_BASE } from "../../config/api";
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Shield, Users, UserCheck, DoorOpen, Calendar, 
  CheckCircle2, Circle, ArrowRight, Plus, MapPin, Building, Activity, Edit2, Check, X 
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export const OverviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const tournamentId = location.pathname.split('/')[2];
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();

  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Состояния для редактирования описания «на лету»
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descInput, setDescInput] = useState('');

  const fetchOverview = async () => {
    if (!tournamentId) return;
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
        setDescInput(data.description || '');
      } else {
        showError('Не удалось загрузить данные обзора');
      }
    } catch (err: any) {
      showError('Ошибка сети', { message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [tournamentId, token]);

  const handleSaveDescription = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ description: descInput })
      });

      if (res.ok) {
        showSuccess('Описание турнира обновлено!');
        setOverview({ ...overview, description: descInput });
        setIsEditingDesc(false);
      } else {
        showError('Ошибка сохранения описания');
      }
    } catch (err: any) {
      showError('Ошибка сети', { message: err.message });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        setOverview({ ...overview, status: newStatus });
        showSuccess('Статус турнира изменен!');
      } else {
        showError('Не удалось обновить статус');
      }
    } catch (err: any) {
      showError('Ошибка сети', { message: err.message });
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Загрузка обзора турнира...</div>;
  }

  if (!overview) {
    return <div className="p-8 text-center text-slate-400">Турнир не найден</div>;
  }

  // Настройка названий, стилей плашек и градиентов для каждого формата
  const getFormatBadge = (formatCode: string) => {
    switch (formatCode) {
      case 'BP':
        return {
          label: 'БПФ (Британский парламентский формат)',
          badgeStyle: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          gradient: 'from-blue-950 via-slate-900 to-slate-900 border-blue-900/50'
        };
      case 'WSDC':
        return {
          label: 'ВШФ (Всемирный школьный формат)',
          badgeStyle: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          gradient: 'from-emerald-950 via-slate-900 to-slate-900 border-emerald-900/50'
        };
      case 'LD':
        return {
          label: 'ЛД (Формат Линкольн — Дуглас)',
          badgeStyle: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
          gradient: 'from-rose-950 via-slate-900 to-slate-900 border-rose-900/50'
        };
      default:
        return {
          label: formatCode || 'Не указан',
          badgeStyle: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
          gradient: 'from-slate-900 to-slate-800 border-slate-800'
        };
    }
  };

  const formatInfo = getFormatBadge(overview.format);

  // Расчет чек-листа готовности
  const counts = overview._count || {};
  const checklist = [
    { label: 'Регистрация команд (минимум 4)', done: counts.teams >= 4, link: 'teams' },
    { label: 'Добавление участников', done: counts.participants > 0, link: 'participants' },
    { label: 'Формирование судейской коллегии', done: counts.judges > 0, link: 'judges' },
    { label: 'Добавление аудиторий / комнат', done: counts.rooms > 0, link: 'rooms' },
    { label: 'Создание первого раунда', done: counts.rounds > 0, link: 'rounds' },
  ];

  const completedSteps = checklist.filter(item => item.done).length;
  const progressPercent = Math.round((completedSteps / checklist.length) * 100);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      
      {/* Шапка турнира с динамическим градиентом под формат */}
      <div className={`bg-gradient-to-r ${formatInfo.gradient} border rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all duration-500`}>
        <div className="space-y-3 flex-1">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${formatInfo.badgeStyle}`}>
            {formatInfo.label}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{overview.name}</h1>
          
          {/* Редактируемое описание с иконкой карандаша («Добавить описание» курсивом) */}
          {isEditingDesc ? (
            <div className="space-y-2 max-w-xl">
              <textarea
                value={descInput}
                onChange={e => setDescInput(e.target.value)}
                placeholder="Введите описание турнира..."
                className="w-full p-3 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rhetora-teal resize-none"
                rows={3}
              />
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleSaveDescription}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-rhetora-teal hover:bg-sky-600 text-white rounded-lg text-xs font-semibold transition"
                >
                  <Check size={14} /> Сохранить
                </button>
                <button 
                  onClick={() => setIsEditingDesc(false)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  <X size={14} /> Отмена
                </button>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setIsEditingDesc(true)}
              className="group inline-flex items-center gap-2 cursor-pointer text-slate-400 hover:text-white transition text-sm max-w-xl"
            >
              {overview.description ? (
                <span>{overview.description}</span>
              ) : (
                <span className="italic flex items-center gap-1.5 text-slate-400 group-hover:text-rhetora-teal transition">
                  Добавить описание
                </span>
              )}
              <Edit2 size={14} className="opacity-0 group-hover:opacity-100 text-rhetora-teal transition shrink-0" />
            </div>
          )}
        </div>

        {/* Интерактивный блок изменения статуса турнира */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 text-right space-y-1.5 min-w-[220px] backdrop-blur-sm">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">Статус турнира</div>
          <select
            value={overview.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 text-emerald-400 font-bold text-xs rounded-xl focus:outline-none focus:border-rhetora-teal cursor-pointer"
          >
            <option value="PREPARATION">🛠 Подготовка</option>
            <option value="REGISTRATION">📋 Регистрация</option>
            <option value="ACTIVE">⚡ Идёт</option>
            <option value="COMPLETED">🏆 Завершён</option>
            <option value="ARCHIVED">📦 Архив</option>
          </select>
        </div>
      </div>

      {/* 1. Блок статистики */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Команды', count: counts.teams, icon: Shield, link: 'teams', color: 'text-sky-600 bg-sky-50' },
          { label: 'Участники', count: counts.participants, icon: Users, link: 'participants', color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Судьи', count: counts.judges, icon: UserCheck, link: 'judges', color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Комнаты', count: counts.rooms, icon: DoorOpen, link: 'rooms', color: 'text-amber-600 bg-amber-50' },
          { label: 'Раунды', count: counts.rounds, icon: Calendar, link: 'rounds', color: 'text-purple-600 bg-purple-50' },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div 
              key={idx} 
              onClick={() => navigate(`/tournaments/${tournamentId}/${stat.link}`)}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-rhetora-teal/50 transition cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <Icon size={20} />
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-rhetora-teal transition transform group-hover:translate-x-0.5" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{stat.count}</div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 2. Готовность турнира (Чек-лист) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-900">Готовность турнира</h3>
            <span className="text-sm font-bold text-rhetora-teal">{progressPercent}%</span>
          </div>
          
          {/* Прогресс-бар */}
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div className="bg-rhetora-teal h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
          </div>

          <div className="space-y-3">
            {checklist.map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => navigate(`/tournaments/${tournamentId}/${item.link}`)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition cursor-pointer border border-transparent hover:border-slate-100"
              >
                <div className="flex items-center gap-3">
                  {item.done ? (
                    <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                  ) : (
                    <Circle size={20} className="text-slate-300 shrink-0" />
                  )}
                  <span className={`text-sm font-medium ${item.done ? 'text-slate-700 line-through opacity-80' : 'text-slate-900'}`}>
                    {item.label}
                  </span>
                </div>
                <ArrowRight size={14} className="text-slate-300" />
              </div>
            ))}
          </div>
        </div>

        {/* 4. Быстрые действия */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
          <h3 className="font-bold text-lg text-slate-900">Быстрые действия</h3>
          <div className="grid grid-cols-1 gap-2.5">
            {[
              { label: 'Добавить команду', link: 'teams', icon: Plus },
              { label: 'Добавить участника', link: 'participants', icon: Plus },
              { label: 'Добавить судью', link: 'judges', icon: Plus },
              { label: 'Добавить комнату', link: 'rooms', icon: Plus },
              { label: 'Управление раундами', link: 'rounds', icon: Calendar },
            ].map((action, idx) => {
              const Icon = action.icon;
              return (
                <button
                  key={idx}
                  onClick={() => navigate(`/tournaments/${tournamentId}/${action.link}`)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-rhetora-teal/5 hover:text-rhetora-teal text-slate-700 rounded-xl text-sm font-semibold transition border border-slate-100 group"
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={16} className="text-slate-400 group-hover:text-rhetora-teal transition" />
                    {action.label}
                  </span>
                  <ArrowRight size={16} className="text-slate-300 group-hover:text-rhetora-teal transition" />
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. Информация о турнире */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
          <h3 className="font-bold text-lg text-slate-900">О турнире</h3>
          
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-slate-400 font-medium">Город и локация</div>
                <div className="font-medium text-slate-800">{overview.city || 'Не указано'}, {overview.location || 'Не указано'}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar size={18} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-slate-400 font-medium">Даты проведения</div>
                <div className="font-medium text-slate-800">
                  {new Date(overview.startDate).toLocaleDateString()} — {new Date(overview.endDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building size={18} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-slate-400 font-medium">Организатор</div>
                <div className="font-medium text-slate-800">{overview.organizer?.name} ({overview.organizer?.email})</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 3 & 5. Ближайшие события и Последняя активность */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Ближайшие события */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="font-bold text-lg text-slate-900">Ближайшие события</h3>
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-2">
            <Calendar size={28} className="mx-auto text-slate-400" />
            <div className="text-sm font-semibold text-slate-700">Расписание раундов пока не создано</div>
            <p className="text-xs text-slate-400">События и раунды появятся здесь сразу после настройки расписания.</p>
          </div>
        </div>

        {/* Последняя активность */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="font-bold text-lg text-slate-900">Последняя активность</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100">
              <Activity size={16} className="text-rhetora-teal shrink-0" />
              <div className="flex-1">
                <span className="font-medium text-slate-800">Турнир «{overview.name}» успешно инициализирован</span>
                <div className="text-xs text-slate-400">{new Date(overview.createdAt).toLocaleString()}</div>
              </div>
            </div>

            {counts.teams > 0 && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100">
                <Activity size={16} className="text-sky-500 shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-slate-800">Зарегистрировано команд: {counts.teams}</span>
                  <div className="text-xs text-slate-400">Актуальные данные турнира</div>
                </div>
              </div>
            )}

            {counts.participants > 0 && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100">
                <Activity size={16} className="text-indigo-500 shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-slate-800">Добавлено участников: {counts.participants}</span>
                  <div className="text-xs text-slate-400">Состав участников обновлен</div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
