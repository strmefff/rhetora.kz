import { API_BASE } from "../config/api";
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Calendar, MapPin, Trophy, X, Sparkles, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Tournament {
  id: string;
  name: string;
  city: string;
  location: string;
  startDate: string;
  format: string;
  status: string;
}

export const TournamentsList = () => {
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creatingDemo, setCreatingDemo] = useState(false);

  // Состояния для удаления турнира
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    city: 'Астана',
    location: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    format: 'BP',
    roundsCount: 5,
  });

  const fetchTournaments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tournaments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTournaments(data);
      } else {
        const errData = await res.json();
        showError('Ошибка загрузки турниров', errData.error);
      }
    } catch (err: any) {
      showError('Ошибка сети при загрузке турниров', { message: err.message });
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, [token]);

  const handleCreateDemo = async () => {
    setCreatingDemo(true);
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/demo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (res.ok) {
        showSuccess('Демо-турнир создан! 16 команд, 48 участников, 12 судей и 10 комнат готовы.');
        navigate(`/tournaments/${data.id}`);
      } else {
        showError(data.error || 'Не удалось создать демо-турнир');
      }
    } catch (err: any) {
      showError('Ошибка сети при создании демо-турнира', { message: err.message });
    } finally {
      setCreatingDemo(false);
    }
  };

  const handleDeleteTournament = async () => {
    if (!tournamentToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        showSuccess(`Турнир «${tournamentToDelete.name}» и все его данные удалены`);
        setTournaments((prev) => prev.filter((t) => t.id !== tournamentToDelete.id));
        setTournamentToDelete(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        showError(errData.error || 'Не удалось удалить турнир');
      }
    } catch (err: any) {
      showError('Ошибка сети при удалении турнира', { message: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/tournaments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const responseData = await res.json();

      if (!res.ok) {
        showError(responseData.error?.message || 'Ошибка создания турнира', responseData.error);
        return;
      }

      showSuccess('Турнир успешно создан!');
      setTournaments([responseData, ...tournaments]);
      setIsModalOpen(false);
      setFormData({
        name: '',
        description: '',
        city: 'Астана',
        location: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        format: 'BP',
        roundsCount: 5,
      });
    } catch (error: any) {
      showError('Ошибка запроса', { message: error.message });
    } finally {
      setLoading(false);
    }
  };

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
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border shadow-sm inline-flex items-center gap-1.5 ${current.bg}`}>
        {current.dot && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>}
        {current.label}
      </span>
    );
  };

  const filteredTournaments = tournaments.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || (t.city && t.city.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Мои турниры</h1>
          <p className="text-sm text-slate-500">Управление созданными дебатными турнирами</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleCreateDemo}
            disabled={creatingDemo}
            className="inline-flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Sparkles size={16} className={creatingDemo ? 'animate-spin text-amber-500' : 'text-amber-500'} />
            {creatingDemo ? 'Генерация...' : 'Демо-турнир (16 команд)'}
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-rhetora-teal hover:bg-sky-600 text-white font-medium px-4 py-2.5 rounded-xl shadow-sm transition cursor-pointer"
          >
            <Plus size={18} />
            Создать турнир
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Поиск по названию или городу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20 focus:border-rhetora-teal transition"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20 focus:border-rhetora-teal transition"
        >
          <option value="ALL">Все статусы</option>
          <option value="PREPARATION">Подготовка</option>
          <option value="REGISTRATION">Регистрация</option>
          <option value="ACTIVE">Идёт</option>
          <option value="COMPLETED">Завершён</option>
          <option value="ARCHIVED">Архив</option>
        </select>
      </div>

      {filteredTournaments.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-200/80 shadow-sm">
          Турниров по вашему запросу не найдено.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTournaments.map((tournament) => (
            <div key={tournament.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-900 text-lg uppercase tracking-wide">{tournament.name}</h3>
                  {getStatusBadge(tournament.status)}
                </div>
                
                <div className="space-y-1.5 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-slate-400" />
                    <span>{tournament.city || 'Не указан'}{tournament.location ? `, ${tournament.location}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-slate-400" />
                    <span>
                      {tournament.startDate
                        ? new Date(tournament.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
                        : 'Дата не указана'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy size={16} className="text-slate-400" />
                    <span>Формат: <strong className="text-slate-800">{tournament.format || 'BP'}</strong></span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setTournamentToDelete(tournament)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  title="Удалить турнир и очистить все связанные записи"
                >
                  <Trash2 size={16} />
                  Удалить
                </button>

                <Link
                  to={`/tournaments/${tournament.id}`}
                  className="text-sm font-medium text-rhetora-teal hover:text-sky-600 transition"
                >
                  Управление турниром →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модалка создания турнира */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Создание нового турнира</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Название турнира *</label>
                <input
                  type="text"
                  required
                  placeholder="Например: ZHABAYEV CUP 2026"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20 focus:border-rhetora-teal transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Формат турнира *</label>
                <select
                  value={formData.format}
                  onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20 focus:border-rhetora-teal transition"
                >
                  <option value="BP">БПФ (Британский парламентский формат)</option>
                  <option value="WSDC">ВШФ (Всемирный школьный формат)</option>
                  <option value="LD">ЛД (Формат Линкольн — Дуглас)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Город</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20 focus:border-rhetora-teal transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Место проведения</label>
                  <input
                    type="text"
                    placeholder="Esil University"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20 focus:border-rhetora-teal transition"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-medium transition">
                  Отмена
                </button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-rhetora-teal hover:bg-sky-600 text-white rounded-xl text-sm font-medium transition shadow-sm disabled:opacity-50">
                  {loading ? 'Создание...' : 'Создать турнир'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка подтверждения удаления */}
      {tournamentToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Удалить турнир?</h3>
              <p className="text-sm text-slate-500">
                Вы собираетесь безвозвратно удалить <strong className="text-slate-800">{tournamentToDelete.name}</strong>. Все команды, участники, судьи, комнаты, раунды и жеребьёвки этого турнира будут полностью очищены из базы данных.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setTournamentToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteTournament}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-500 text-white font-semibold rounded-xl hover:bg-rose-600 transition shadow-sm disabled:opacity-50"
              >
                {isDeleting ? 'Удаление...' : 'Да, удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
