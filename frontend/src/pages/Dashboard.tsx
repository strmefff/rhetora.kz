import { API_BASE } from "../config/api";
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Tournament {
  id: string;
  name: string;
  city: string;
  startDate: string;
  status: string;
}

export const Dashboard = () => {
  const { user, token } = useAuth();
  const { showError, showSuccess } = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Форма создания турнира
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
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTournaments(data);
      } else {
        const errData = await res.json();
        showError('Не удалось загрузить список турниров', errData.error || { statusCode: res.status });
      }
    } catch (err: any) {
      showError('Ошибка подключения к серверу', {
        message: err.message,
        stack: err.stack,
        path: '/api/tournaments',
        method: 'GET'
      });
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, [token]);

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
        // Передаем детали ошибки прямо в дебаггер тоаста
        showError(
          responseData.error?.message || responseData.error || 'Ошибка при создании турнира',
          {
            message: responseData.error?.message || typeof responseData.error === 'string' ? responseData.error : 'Validation / Database Error',
            statusCode: res.status,
            method: 'POST',
            path: '/api/tournaments',
            stack: responseData.error?.stack,
            details: responseData.error?.details || responseData
          }
        );
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
      showError('Не удалось отправить запрос на бэкенд', {
        message: error.message || 'Failed to fetch',
        stack: error.stack,
        method: 'POST',
        path: '/api/tournaments'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Добро пожаловать, {user?.name || 'Организатор'}</h2>
          <p className="text-sm text-slate-500">Управляйте своими турнирами и следите за их проведением</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-rhetora-teal hover:bg-sky-600 text-white font-medium px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-2"
        >
          <Plus size={18} />
          Создать турнир
        </button>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <span className="text-slate-500 text-sm font-medium mb-1">Всего турниров</span>
          <span className="text-3xl font-bold text-slate-800">{tournaments.length}</span>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <span className="text-slate-500 text-sm font-medium mb-1">Активные турниры</span>
          <span className="text-3xl font-bold text-rhetora-teal">
            {tournaments.filter(t => t.status === 'ACTIVE').length}
          </span>
        </div>
      </div>

      {/* Список турниров */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Ваши турниры</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                <th className="p-4 font-semibold">Название</th>
                <th className="p-4 font-semibold">Дата</th>
                <th className="p-4 font-semibold">Статус</th>
                <th className="p-4 font-semibold text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {tournaments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    У вас пока нет созданных турниров. Нажмите «Создать турнир», чтобы добавить первый!
                  </td>
                </tr>
              ) : (
                tournaments.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-medium text-slate-800 uppercase">{t.name}</td>
                    <td className="p-4 text-slate-600">
                      {new Date(t.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full inline-flex items-center gap-1 border border-green-200 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> {t.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        to={`/tournaments/${t.id}`}
                        className="text-rhetora-teal font-medium text-sm hover:underline"
                      >
                        Управление →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальное окно создания турнира */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Создание нового турнира</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition"
              >
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Дата начала</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20 focus:border-rhetora-teal transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Дата окончания</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20 focus:border-rhetora-teal transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Формат</label>
                  <select
                    value={formData.format}
                    onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20 focus:border-rhetora-teal transition"
                  >
                    <option value="BP">BP (Британский парламентский)</option>
                    <option value="AP">AP (Азиатский парламентский)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Количество раундов</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.roundsCount}
                    onChange={(e) => setFormData({ ...formData, roundsCount: parseInt(e.target.value) || 1 })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20 focus:border-rhetora-teal transition"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-medium transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-rhetora-teal hover:bg-sky-600 text-white rounded-xl text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Создание...' : 'Создать турнир'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
