import React from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Trophy, Scale, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface JudgeLayoutProps {
  judgeName?: string;
  activeTournamentName?: string | null;
  children: React.ReactNode;
}

const getInitials = (fullName?: string) => {
  if (!fullName) return 'JD';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export const JudgeLayout: React.FC<JudgeLayoutProps> = ({
  judgeName,
  activeTournamentName,
  children,
}) => {
  const { user, logout } = useAuth();
  const displayName = judgeName || user?.name || 'Судья';

  const handleLogout = () => {
    if (logout) {
      logout();
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    window.location.hash = '#/login';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Верхняя навигационная панель судьи */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Левая часть: бренд + активный турнир */}
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/judge/dashboard" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 bg-rhetora-teal rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm">
                R
              </div>
              <div className="hidden sm:block">
                <div className="font-bold text-slate-900 leading-none tracking-tight">Rhetora</div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5 flex items-center gap-1">
                  <Scale size={11} className="text-rhetora-teal" />
                  Кабинет судьи
                </div>
              </div>
            </Link>

            {activeTournamentName && (
              <>
                <span className="text-slate-200 hidden sm:inline">|</span>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 text-slate-700 text-xs font-semibold truncate max-w-[180px] sm:max-w-xs">
                  <Trophy size={13} className="text-rhetora-teal shrink-0" />
                  <span className="truncate">{activeTournamentName}</span>
                </div>
              </>
            )}
          </div>

          {/* Правая часть: имя, аватар-инициалы и выход */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user?.role === 'SUPERADMIN' && (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-rhetora-teal bg-sky-50 hover:bg-sky-100 border border-sky-200/80 transition"
                title="Вернуться в панель организатора"
              >
                <LayoutDashboard size={15} />
                <span className="hidden sm:inline">Организатор</span>
              </Link>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center text-xs font-bold">
                {getInitials(displayName)}
              </div>
              <div className="hidden md:block text-right">
                <div className="text-sm font-semibold text-slate-800 leading-tight">{displayName}</div>
                <div className="text-[11px] text-slate-400">Судейская коллегия</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/80 transition cursor-pointer"
              title="Выйти из аккаунта"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>
      </header>

      {/* Контент страницы */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
};
