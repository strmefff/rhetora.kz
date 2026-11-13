import { API_BASE } from "../../config/api";
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export const ParticipantsPage = () => {
  const location = useLocation();
  const tournamentId = location.pathname.split('/')[2];
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();

  const [participants, setParticipants] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    teamId: '',
  });

  const fetchData = async () => {
    if (!tournamentId) return;
    try {
      const pRes = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/participants`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (pRes.ok) setParticipants(await pRes.json());

      const tRes = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/teams`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (tRes.ok) setTeams(await tRes.json());
    } catch (err: any) {
      showError('Ошибка загрузки данных', { message: err.message });
    }
  };

  useEffect(() => { fetchData(); }, [tournamentId, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: `${Date.now()}@rhetora.local`,
        organization: '', // Не запрашиваем в форме, бэкенд сохраняет пустое
        city: '',
        teamId: formData.teamId || null,
      };

      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) return showError(data.error || 'Ошибка создания участника', data);

      showSuccess('Участник успешно добавлен!');
      setIsModalOpen(false);
      setFormData({ firstName: '', lastName: '', teamId: '' });
      fetchData();
    } catch (err: any) {
      showError('Ошибка сети', { message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить участника?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/participants/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showSuccess('Участник удален');
        fetchData();
      }
    } catch (err: any) {
      showError('Ошибка при удалении', { message: err.message });
    }
  };

  const filteredParticipants = participants.filter(p =>
    `${p.firstName} ${p.lastName} ${p.team?.organization || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Участники турнира</h2>
          <p className="text-sm text-slate-500">Зарегистрировано участников: {participants.length}</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-rhetora-teal hover:bg-sky-600 text-white font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm"
        >
          <Plus size={18} /> Добавить участника
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Поиск участников..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-semibold">Участник</th>
              <th className="p-4 font-semibold">Команда</th>
              <th className="p-4 font-semibold">Организация</th>
              <th className="p-4 font-semibold text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredParticipants.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400">
                  Участники пока не добавлены.
                </td>
              </tr>
            ) : (
              filteredParticipants.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-4 font-medium text-slate-900">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="p-4">
                    {p.team ? (
                      <span className="px-2.5 py-0.5 bg-sky-50 text-sky-700 font-semibold text-xs rounded-full border border-sky-200">
                        {p.team.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-xs">Без команды</span>
                    )}
                  </td>
                  <td className="p-4 text-slate-600">
                    {p.team?.organization || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="font-bold text-lg text-slate-900">Добавить участника</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Имя *</label>
                <input
                  required
                  placeholder="Владислав"
                  value={formData.firstName}
                  onChange={e => setFormData({...formData, firstName: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Фамилия *</label>
                <input
                  required
                  placeholder="Колупай"
                  value={formData.lastName}
                  onChange={e => setFormData({...formData, lastName: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Команда</label>
                <select
                  value={formData.teamId}
                  onChange={e => setFormData({...formData, teamId: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                >
                  <option value="">-- Без команды (личный зачет) --</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.organization ? `(${t.organization})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-rhetora-teal text-white font-medium rounded-xl text-sm hover:bg-sky-600 transition"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
