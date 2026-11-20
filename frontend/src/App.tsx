import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { TournamentLayout } from './components/layout/TournamentLayout';
import { ProtectedRoute } from './components/ProtectedRoute';

import { Dashboard } from './pages/Dashboard';
import { TournamentsList } from './pages/TournamentsList';
import { RegisterPage } from './pages/RegisterPage';
import { UsersManagementPage } from './pages/UsersManagementPage';
import { ProfilePage } from './pages/ProfilePage';
import { JudgeMagicEntryPage } from './pages/JudgeMagicEntryPage';

// Страницы управления сущностями турнира
import { OverviewPage } from './pages/tournament/OverviewPage';
import { ParticipantsPage } from './pages/tournament/ParticipantsPage';
import { TeamsPage } from './pages/tournament/TeamsPage';
import { JudgesPage } from './pages/tournament/JudgesPage';
import { RoomsPage } from './pages/tournament/RoomsPage';
import { RoundsPage } from './pages/tournament/RoundsPage';
import { DrawPage } from './pages/tournament/DrawPage';
import { BallotsPage } from './pages/tournament/BallotsPage';
import { ResultsPage } from './pages/tournament/ResultsPage';
import { StandingsPage } from './pages/tournament/StandingsPage';
import { SchedulePage } from './pages/tournament/SchedulePage';

// Страницы личного кабинета судьи
import { JudgeDashboardPage } from './pages/judge/JudgeDashboardPage';
import { JudgeMatchPage } from './pages/judge/JudgeMatchPage';

// Умное перенаправление в зависимости от роли пользователя
const RoleBasedRedirect = () => {
  const { user, token } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'JUDGE') {
    return <Navigate to="/judge/dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<RoleBasedRedirect />} />
            
            {/* Публичные страницы входа, регистрации и входа для судей без пароля */}
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<RegisterPage />} />
            <Route path="/judge/enter" element={<JudgeMagicEntryPage />} />
            <Route path="/judge/enter/:code" element={<JudgeMagicEntryPage />} />

            {/* ЗАЩИЩЁННЫЕ РОУТЫ ДЛЯ СУДЕЙ (JUDGE) */}
            <Route element={<ProtectedRoute allowedRoles={['JUDGE', 'SUPERADMIN']} />}>
              <Route path="/judge/dashboard" element={<JudgeDashboardPage />} />
              <Route path="/judge/matches/:assignmentId" element={<JudgeMatchPage />} />
            </Route>

            {/* ЗАЩИЩЁННЫЕ РОУТЫ ДЛЯ ОРГАНИЗАТОРОВ И СУПЕРАДМИНОВ */}
            <Route element={<ProtectedRoute allowedRoles={['SUPERADMIN', 'ORGANIZER']} />}>
              
              {/* Главный дашборд */}
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tournaments" element={<TournamentsList />} />
                
                {/* Панель Суперадмина (Только для SUPERADMIN) */}
                <Route element={<ProtectedRoute allowedRoles={['SUPERADMIN']} />}>
                  <Route path="/admin/users" element={<UsersManagementPage />} />
                </Route>

                <Route path="/profile" element={<ProfilePage />} />
              </Route>

              {/* Управление конкретным турниром */}
              <Route path="/tournaments/:tournamentId" element={<TournamentLayout />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<OverviewPage />} />
                <Route path="applications" element={<div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">Заявки</div>} />
                
                <Route path="teams" element={<TeamsPage />} />
                <Route path="participants" element={<ParticipantsPage />} />
                <Route path="judges" element={<JudgesPage />} />
                <Route path="rooms" element={<RoomsPage />} />

                <Route path="schedule" element={<SchedulePage />} />
                <Route path="rounds" element={<RoundsPage />} />
                <Route path="draw" element={<DrawPage />} />
                <Route path="ballots" element={<BallotsPage />} />
                
                {/* Результаты и Рейтинг спикеров */}
                <Route path="results" element={<ResultsPage />} />
                <Route path="standings" element={<StandingsPage />} />

                <Route path="settings" element={<div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">Настройки турнира</div>} />
              </Route>

            </Route>

            {/* Редирект для любых неизвестных путей */}
            <Route path="*" element={<RoleBasedRedirect />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
