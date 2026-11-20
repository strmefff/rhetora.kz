import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Trophy, User, LogOut, ShieldCheck, Scale } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const DashboardLayout = () => {
  const { user } = useAuth();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.hash = '#/login';
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Боковая панель */}
      <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0">
        <div>
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            {/* ТВОЙ НОВЫЙ ЛОГОТИП */}
            <img src="./logo.svg" alt="Rhetora Logo" className="w-9 h-9 object-contain" />
            
            <span className="font-bold text-xl text-slate-900 tracking-tight">Rhetora</span>
          </div>

          <nav className="p-4 space-y-1">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-rhetora-teal text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <LayoutDashboard size={18} />
              Обзор
            </NavLink>

            <NavLink
              to="/tournaments"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-rhetora-teal text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Trophy size={18} />
              Мои турниры
            </NavLink>

            {/* Пункт виден ТОЛЬКО Суперадмину */}
            {user?.role === 'SUPERADMIN' && (
              <>
                <NavLink
                  to="/judge/dashboard"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-rhetora-teal text-white shadow-sm font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <Scale size={18} />
                  Кабинет судьи
                </NavLink>

                <NavLink
                  to="/admin/users"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-rhetora-teal text-white shadow-sm font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <ShieldCheck size={18} />
                  Аккаунты
                </NavLink>
              </>
            )}

            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-rhetora-teal text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <User size={18} />
              Профиль
            </NavLink>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition"
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Основной контент */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
};
