import { API_BASE } from "../../config/api";
import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams, Link } from 'react-router-dom';
import { 
  LayoutDashboard, Users, User, Scale, DoorOpen, Calendar, 
  ListOrdered, Shuffle, FileText, BarChart, Trophy, Settings, ArrowLeft 
} from 'lucide-react';

interface Tournament {
  id: string;
  name: string;
  city: string;
  startDate: string;
  status: string;
}

export const TournamentLayout = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    if (!tournamentId) return;

    // Подгружаем реальные данные о турнире из API
    fetch(`${API_BASE}/api/tournaments/${tournamentId}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Турнир не найден');
      })
      .then((data) => setTournament(data))
      .catch((err) => {
        console.error('Ошибка загрузки турнира:', err);
        // Заглушка на случай ответа сервера
        setTournament({
          id: tournamentId,
          name: 'Загрузка турнира...',
          city: 'Астана',
          startDate: new Date().toISOString(),
          status: 'PREPARATION'
        });
      });
  }, [tournamentId]);

  const navItems = [
    { path: 'overview', label: 'Обзор', icon: LayoutDashboard },
    { path: 'applications', label: 'Заявки', icon: FileText },
    { path: 'teams', label: 'Команды', icon: Users },
    { path: 'participants', label: 'Участники', icon: User },
    { path: 'judges', label: 'Судьи', icon: Scale },
    { path: 'rooms', label: 'Комнаты', icon: DoorOpen },
    { path: 'schedule', label: 'Расписание', icon: Calendar },
    { path: 'rounds', label: 'Раунды', icon: ListOrdered },
    { path: 'draw', label: 'Жеребьёвка', icon: Shuffle },
    { path: 'ballots', label: 'Бюллетени', icon: FileText },
    { path: 'results', label: 'Результаты', icon: BarChart },
    { path: 'standings', label: 'Рейтинг', icon: Trophy },
    { path: 'settings', label: 'Настройки', icon: Settings },
  ];

  if (!tournament) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Загрузка параметров турнира...
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; bg: string; dot?: boolean }> = {
      PREPARATION: { label: 'Подготовка', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
      REGISTRATION: { label: 'Регистрация', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
      ACTIVE: { label: 'Идёт', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: true },
      COMPLETED: { label: 'Завершён', bg: 'bg-slate-100 text-slate-700 border-slate-200' },
      ARCHIVED: { label: 'Архив', bg: 'bg-gray-100 text-gray-500 border-gray-200' },
    };
    const current = config[status] || { label: status, bg: 'bg-slate-100 text-slate-700 border-slate-200' };

    return (
      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full flex items-center gap-1.5 border shadow-sm ${current.bg}`}>
        {current.dot && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
        {current.label}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Шапка турнира */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-4 flex flex-col gap-2 shrink-0">
        <Link to="/tournaments" className="flex items-center text-sm text-slate-500 hover:text-rhetora-teal w-max transition">
          <ArrowLeft size={16} className="mr-1" /> Мои турниры
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{tournament.name}</h1>
          {getStatusBadge(tournament.status)}
        </div>
        <div className="text-sm text-slate-500">
          {formatDate(tournament.startDate)} {tournament.city ? `• ${tournament.city}` : ''}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Боковое меню турнира */}
        <aside className="w-64 bg-white border-r border-slate-200/80 overflow-y-auto hidden md:block py-4 shrink-0">
          <nav className="space-y-0.5 px-3">
            {navItems.map((item) => (
              <NavLink 
                key={item.path} 
                to={item.path}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${isActive 
                    ? 'bg-rhetora-teal text-white shadow-sm font-semibold' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                `}
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Рабочая область */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
