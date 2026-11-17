import { API_BASE } from "../../config/api";
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, Trash2, X, Users, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

const TEAM_EMOJIS = ['🚀', '🔥', '⚡', '💡', '🏆', '🎯', '🦁', '🦅', '🐺', '⭐', '💎', '⚔️', '🛡️', '🍀', '🌀', '🌊'];

const getTeamEmoji = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TEAM_EMOJIS[Math.abs(hash) % TEAM_EMOJIS.length];
};

export const TeamsPage = () => {
  const location = useLocation();
  const tournamentId = location.pathname.split('/')[2];
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();

  const [teams, setTeams] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Состояние для модального окна просмотра участников команды
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    organization: '',
    coach: '',
  });

  const fetchData = async () => {
    if (!tournamentId) return;
    try {
      const teamsRes = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/teams`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (teamsRes.ok) setTeams(await teamsRes.json());

      const partsRes = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/participants`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (partsRes.ok) setParticipants(await partsRes.json());
    } catch (err: any) {
      showError('Ошибка загрузки данных', { message: err.message });
    }
  };

  useEffect(() => {
    fetchData();
  }, [tournamentId, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        organization: formData.organization,
        city: '',
        coach: formData.coach,
        seed: 0,
      };

      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        showError(data.error || 'Ошибка создания команды', data);
        return;
      }

      showSuccess('Команда успешно создана!');
      setIsModalOpen(false);
      setFormData({ name: '', organization: '', coach: '' });
      fetchData();
    } catch (err: any) {
      showError('Ошибка сети', { message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (teamId: string) => {
    if (!confirm('Удалить эту команду?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/teams/${teamId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showSuccess('Команда удалена');
        fetchData();
      }
    } catch (err: any) {
      showError('Ошибка удаления', { message: err.message });
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const filteredTeams = teams.filter(t =>
    `${t.name} ${t.organization} ${t.coach}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Стили для печати в PDF */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-pdf-area, #printable-pdf-area * { visibility: visible; }
          #printable-pdf-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; background: white; color: black; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Верхняя панель управления */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Команды турнира</h2>
          <p className="text-sm text-slate-500">Всего зарегистрировано команд: {teams.length}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrintPDF}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm"
          >
            <Printer size={16} /> Скачать PDF
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 bg-rhetora-teal hover:bg-sky-600 text-white font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm"
          >
            <Plus size={18} /> Добавить команду
          </button>
        </div>
      </div>

      {/* Поиск */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm no-print">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Поиск команд..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20"
          />
        </div>
      </div>

      {/* Основная таблица на экране */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden no-print">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-semibold">Название команды</th>
              <th className="p-4 font-semibold">Организация</th>
              <th className="p-4 font-semibold">Тренер / Куратор</th>
              <th className="p-4 font-semibold">Участники</th>
              <th className="p-4 font-semibold text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredTeams.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  Команды пока не добавлены.
                </td>
              </tr>
            ) : (
              filteredTeams.map(t => {
                const teamMembers = participants.filter(p => p.teamId === t.id);
                return (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-4 font-medium text-slate-900 flex items-center gap-2.5">
                      <span className="text-base select-none">{getTeamEmoji(t.name)}</span>
                      {t.name}
                    </td>
                    <td className="p-4 text-slate-600">{t.organization || '—'}</td>
                    <td className="p-4 text-slate-600">{t.coach || '—'}</td>
                    <td className="p-4">
                      <button
                        onClick={() => setSelectedTeam(t)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-xs rounded-full border border-sky-200 transition"
                      >
                        <Users size={14} />
                        {teamMembers.length} участников
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* СКРЫТЫЙ БЛОК ДЛЯ ПЕЧАТИ В PDF (Красивый официальный реестр) */}
      <div id="printable-pdf-area" className="hidden print:block font-sans">
        <div className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900">Официальный реестр команд</h1>
          <p className="text-sm text-slate-600 mt-1">Турнирная платформа Rhetora • Сформировано {new Date().toLocaleDateString('ru-RU')}</p>
          <p className="text-sm font-semibold text-slate-800 mt-2">Всего команд: {teams.length}</p>
        </div>

        <table className="w-full text-left border-collapse border border-slate-300 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
              <th className="p-2.5 border-r border-slate-300 font-bold">№</th>
              <th className="p-2.5 border-r border-slate-300 font-bold">Название команды</th>
              <th className="p-2.5 border-r border-slate-300 font-bold">Организация / ВУЗ / Школа</th>
              <th className="p-2.5 border-r border-slate-300 font-bold">Тренер</th>
              <th className="p-2.5 font-bold">Состав участников</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, idx) => {
              const members = participants.filter(p => p.teamId === t.id);
              return (
                <tr key={t.id} className="border-b border-slate-200">
                  <td className="p-2.5 border-r border-slate-200 text-center font-medium">{idx + 1}</td>
                  <td className="p-2.5 border-r border-slate-200 font-bold text-slate-900">{t.name}</td>
                  <td className="p-2.5 border-r border-slate-200 text-slate-700">{t.organization || '—'}</td>
                  <td className="p-2.5 border-r border-slate-200 text-slate-700">{t.coach || '—'}</td>
                  <td className="p-2.5 text-slate-800">
                    {members.length === 0 ? (
                      <span className="text-slate-400 italic">Нет участников</span>
                    ) : (
                      members.map((m, mIdx) => (
                        <div key={m.id} className="py-0.5">
                          {mIdx + 1}. {m.firstName} {m.lastName}
                        </div>
                      ))
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Модальное окно состава команды */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getTeamEmoji(selectedTeam.name)}</span>
                <h3 className="font-bold text-lg text-slate-900">Состав команды: {selectedTeam.name}</h3>
              </div>
              <button onClick={() => setSelectedTeam(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            
            <div className="p-5 max-h-96 overflow-y-auto space-y-3">
              {participants.filter(p => p.teamId === selectedTeam.id).length === 0 ? (
                <p className="text-center text-slate-400 py-6 text-sm">В этой команде пока нет участников.</p>
              ) : (
                participants
                  .filter(p => p.teamId === selectedTeam.id)
                  .map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                      <span className="font-semibold text-slate-900">{p.firstName} {p.lastName}</span>
                      <span className="text-xs text-slate-500">{p.organization || selectedTeam.organization || '—'}</span>
                    </div>
                  ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedTeam(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-xl text-sm transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания команды */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="font-bold text-lg text-slate-900">Создание команды</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Название команды *</label>
                <input
                  required
                  placeholder="Напр. Alpha"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Организация</label>
                <input
                  placeholder="Напр. Клуб дебатов Эсил"
                  value={formData.organization}
                  onChange={e => setFormData({...formData, organization: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Тренер / Куратор</label>
                <input
                  placeholder="Имя тренера"
                  value={formData.coach}
                  onChange={e => setFormData({...formData, coach: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                />
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
