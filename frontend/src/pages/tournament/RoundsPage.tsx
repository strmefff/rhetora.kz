import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Plus, Search, Calendar, Clock, Trash2, Edit, Copy, AlertCircle, X, Check, Maximize2 
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';

export const RoundsPage = () => {
  const location = useLocation();
  const tournamentId = location.pathname.split('/')[2];
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();

  const [rounds, setRounds] = useState<any[]>([]);
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Фильтры
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Модальное окно создания/редактирования
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRound, setEditingRound] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'PRELIMINARY',
    format: 'BP',
    duration: 60,
    dateTime: '',
    status: 'PLANNED',
    motion: '', // Явное наличие поля резолюции
  });

  // Состояние для полноэкранного показа резолюции
  const [fullscreenMotion, setFullscreenMotion] = useState<{ roundName: string; motion: string } | null>(null);

  const fetchData = async () => {
    if (!tournamentId) return;
    try {
      const tRes = await fetch(`${API_BASE}/api/tournaments/${tournamentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (tRes.ok) {
        const tData = await tRes.json();
        setTournament(tData);
        if (!editingRound) {
          setFormData(prev => ({ ...prev, format: tData.format || 'BP' }));
        }
      }

      const rRes = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/rounds`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (rRes.ok) {
        const rData = await rRes.json();
        setRounds(rData);
      }
    } catch (err: any) {
      showError('Ошибка загрузки данных раундов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tournamentId, token]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreenMotion(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenCreate = () => {
    setEditingRound(null);
    setFormData({
      name: `Раунд ${rounds.length + 1}`,
      type: 'PRELIMINARY',
      format: tournament?.format || 'BP',
      duration: 60,
      dateTime: '',
      status: 'PLANNED',
      motion: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (round: any) => {
    setEditingRound(round);
    setFormData({
      name: round.name || '',
      type: round.type || 'PRELIMINARY',
      format: round.format || 'BP',
      duration: round.duration || 60,
      dateTime: round.dateTime ? new Date(round.dateTime).toISOString().slice(0, 16) : '',
      status: round.status || 'PLANNED',
      motion: round.motion || '', // Гарантированно подтягиваем сохраненную резолюцию
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingRound 
        ? `${API_BASE}/api/tournaments/rounds/${editingRound.id}`
        : `${API_BASE}/api/tournaments/${tournamentId}/rounds`;
      
      const method = editingRound ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });

      const json = await res.json();

      if (res.ok) {
        showSuccess(editingRound ? 'Раунд успешно обновлен!' : 'Раунд успешно создан!');
        setIsModalOpen(false);
        fetchData();
      } else {
        showError(json.error || 'Ошибка сохранения раунда');
      }
    } catch (err: any) {
      showError('Ошибка сети');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/rounds/${id}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showSuccess('Раунд успешно дублирован!');
        fetchData();
      } else {
        showError('Не удалось дублировать раунд');
      }
    } catch (err: any) {
      showError('Ошибка сети');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот раунд?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/rounds/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showSuccess('Раунд удален');
        fetchData();
      } else {
        showError('Ошибка при удалении');
      }
    } catch (err: any) {
      showError('Ошибка сети');
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; class: string }> = {
      PLANNED: { label: 'Запланирован', class: 'bg-amber-50 text-amber-700 border-amber-200' },
      ACTIVE: { label: 'Идёт', class: 'bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse' },
      COMPLETED: { label: 'Завершён', class: 'bg-slate-100 text-slate-700 border-slate-200' },
      CANCELLED: { label: 'Отменён', class: 'bg-rose-50 text-rose-700 border-rose-200' },
    };
    const cfg = map[status] || { label: status, class: 'bg-slate-100 text-slate-700' };
    return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${cfg.class}`}>{cfg.label}</span>;
  };

  const getTypeBadge = (type: string) => {
    const map: Record<string, string> = {
      PRELIMINARY: 'Предварительный',
      QUARTERFINAL: 'Четвертьфинал',
      SEMIFINAL: 'Полуфинал',
      GRAND_FINAL: 'Финал',
    };
    return map[type] || type;
  };

  const getFormatBadge = (fmt: string) => {
    if (fmt === 'WSDC') return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-bold">ВШФ</span>;
    if (fmt === 'BP') return <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-bold">БПФ</span>;
    if (fmt === 'LD') return <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-xs font-bold">ЛД</span>;
    return <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs font-bold">{fmt}</span>;
  };

  const filteredRounds = rounds.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'ALL' || r.type === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Управление раундами</h2>
          <p className="text-sm text-slate-500">Настройка структуры раундов, резолюций и стадий плей-офф турнира</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 bg-rhetora-teal hover:bg-sky-600 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition shadow-sm cursor-pointer"
        >
          <Plus size={18} /> Создать раунд
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/85 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Поиск по названию раунда..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none cursor-pointer"
        >
          <option value="ALL">Все типы</option>
          <option value="PRELIMINARY">Предварительные</option>
          <option value="QUARTERFINAL">Четвертьфиналы</option>
          <option value="SEMIFINAL">Полуфиналы</option>
          <option value="GRAND_FINAL">Финалы</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none cursor-pointer"
        >
          <option value="ALL">Все статусы</option>
          <option value="PLANNED">Запланирован</option>
          <option value="ACTIVE">Идёт</option>
          <option value="COMPLETED">Завершён</option>
          <option value="CANCELLED">Отменён</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-semibold w-16">№</th>
              <th className="p-4 font-semibold">Название раунда</th>
              <th className="p-4 font-semibold">Резолюция</th>
              <th className="p-4 font-semibold">Тип / Формат</th>
              <th className="p-4 font-semibold">Статус</th>
              <th className="p-4 font-semibold text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredRounds.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-400">
                  Раунды пока не созданы. Нажмите «Создать раунд», чтобы начать.
                </td>
              </tr>
            ) : (
              filteredRounds.map((round) => (
                <tr key={round.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-4 font-bold text-slate-700">#{round.number}</td>
                  <td className="p-4">
                    <div className="font-medium text-slate-900">{round.name}</div>
                    {round.dateTime && (
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar size={12} />
                        {new Date(round.dateTime).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    {round.motion ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700 text-xs line-clamp-1 max-w-xs" title={round.motion}>
                          {round.motion}
                        </span>
                        <button
                          onClick={() => setFullscreenMotion({ roundName: round.name, motion: round.motion })}
                          title="Вывести резолюцию на весь экран"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer"
                        >
                          <Maximize2 size={13} /> Показ
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-xs">Не задана</span>
                    )}
                  </td>
                  <td className="p-4 space-y-1">
                    <div className="text-slate-600 font-medium text-xs">{getTypeBadge(round.type)}</div>
                    <div>{getFormatBadge(round.format)}</div>
                  </td>
                  <td className="p-4">{getStatusBadge(round.status)}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => handleDuplicate(round.id)} 
                        title="Дублировать раунд"
                        className="p-1.5 text-slate-400 hover:text-rhetora-teal transition rounded-lg hover:bg-slate-100 cursor-pointer"
                      >
                        <Copy size={16} />
                      </button>
                      <button 
                        onClick={() => handleOpenEdit(round)} 
                        title="Редактировать"
                        className="p-1.5 text-slate-400 hover:text-sky-600 transition rounded-lg hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(round.id)} 
                        title="Удалить"
                        className="p-1.5 text-slate-400 hover:text-rose-500 transition rounded-lg hover:bg-slate-100 cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="font-bold text-lg text-slate-900">
                {editingRound ? 'Редактировать раунд' : 'Создать новый раунд'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Название раунда *</label>
                <input
                  required
                  placeholder="Например: Отборочный раунд 1"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Резолюция раунда (Motion)</label>
                <textarea
                  rows={3}
                  placeholder="Введите тему/резолюцию дебатов..."
                  value={formData.motion}
                  onChange={e => setFormData({...formData, motion: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Тип раунда</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer"
                  >
                    <option value="PRELIMINARY">Предварительный</option>
                    <option value="QUARTERFINAL">Четвертьфинал</option>
                    <option value="SEMIFINAL">Полуфинал</option>
                    <option value="GRAND_FINAL">Финал</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Формат дебатов</label>
                  <select
                    value={formData.format}
                    onChange={e => setFormData({...formData, format: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer"
                  >
                    <option value="WSDC">ВШФ (World Schools)</option>
                    <option value="BP">БПФ (British Parliamentary)</option>
                    <option value="LD">ЛД (Lincoln-Douglas)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Длительность (минут)</label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={e => setFormData({...formData, duration: Number(e.target.value)})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Статус</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer"
                  >
                    <option value="PLANNED">Запланирован</option>
                    <option value="ACTIVE">Идёт</option>
                    <option value="COMPLETED">Завершён</option>
                    <option value="CANCELLED">Отменён</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Дата и время проведения (необязательно)</label>
                <input
                  type="datetime-local"
                  value={formData.dateTime}
                  onChange={e => setFormData({...formData, dateTime: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rhetora-teal text-white font-medium rounded-xl text-sm hover:bg-sky-600 transition cursor-pointer"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {fullscreenMotion && (
        <div 
          onClick={() => setFullscreenMotion(null)}
          className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center p-8 sm:p-16 select-none cursor-pointer animate-in fade-in duration-200"
        >
          <button 
            onClick={() => setFullscreenMotion(null)}
            className="absolute top-6 right-6 p-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            title="Закрыть (Esc)"
          >
            <X size={24} />
          </button>

          <div className="max-w-4xl text-center space-y-8">
            <span className="inline-block px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-sm font-bold uppercase tracking-widest">
              {fullscreenMotion.roundName}
            </span>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-tight tracking-tight">
              {fullscreenMotion.motion}
            </h1>

            <p className="text-xs text-slate-400 uppercase tracking-widest pt-8">
              Нажмите в любом месте или клавишу Esc для выхода
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
