import { API_BASE } from "../../config/api";
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Search, Trash2, DoorOpen, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export const RoomsPage = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();

  const [rooms, setRooms] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Используем поле building, так как бэкенд ожидает его в модели
  const [formData, setFormData] = useState({ name: '', building: '', floor: '' });

  const fetchRooms = async () => {
    if (!tournamentId) return;
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setRooms(await res.json());
    } catch (err: any) {
      showError('Ошибка загрузки комнат', { message: err.message });
    }
  };

  useEffect(() => { fetchRooms(); }, [tournamentId, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        showSuccess('Комната добавлена!');
        setIsModalOpen(false);
        setFormData({ name: '', building: '', floor: '' });
        fetchRooms();
      }
    } catch (err: any) {
      showError('Ошибка сети', { message: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить комнату?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/rooms/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showSuccess('Комната удалена');
        fetchRooms();
      }
    } catch (err: any) {
      showError('Ошибка удаления', { message: err.message });
    }
  };

  const filtered = rooms
    .filter(r => `${r.name} ${r.building || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const isAPreferred = a.name.toLowerCase().includes('актовый зал');
      const isBPreferred = b.name.toLowerCase().includes('актовый зал');
      if (isAPreferred && !isBPreferred) return -1;
      if (!isAPreferred && isBPreferred) return 1;
      return 0;
    });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Помещения и Кабинеты</h2>
          <p className="text-sm text-slate-500">Доступно аудиторий: {rooms.length}</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-2 bg-rhetora-teal hover:bg-sky-600 text-white font-medium px-4 py-2 rounded-xl text-sm shadow-sm transition">
          <Plus size={18} /> Добавить комнату
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
          <input type="text" placeholder="Поиск комнат..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filtered.map(r => {
          const isAssemblyHall = r.name.toLowerCase().includes('актовый зал');
          return (
            <div key={r.id} className={`bg-white p-5 rounded-2xl border shadow-sm flex items-center justify-between ${isAssemblyHall ? 'border-rose-200 bg-rose-50/20 ring-1 ring-rose-200/50' : 'border-slate-200/80'}`}>
              <div className="space-y-1">
                <div className="font-bold text-slate-900 text-lg uppercase flex items-center gap-2">
                  <DoorOpen className={isAssemblyHall ? 'text-rose-500' : 'text-rhetora-teal'} size={20} />
                  {r.name}
                </div>
                
                {/* Выводим описание (поле building в базе) */}
                <div className="text-xs text-slate-600 font-medium">
                  {r.building || <span className="text-slate-300 italic">Без описания</span>}
                </div>

                <div className="text-xs text-slate-400 pt-0.5">
                  Этаж: <span className="text-slate-600">{r.floor || 1}</span>
                </div>
              </div>
              
              <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-red-500 p-1.5 transition">
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border overflow-hidden p-5 space-y-3">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg">Добавить помещение</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input required placeholder="Номер / Название (напр. Каб. 301) *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm" />
              
              {/* Поле для ввода описания (сохраняется в building) */}
              <input placeholder="Описание / Корпус (напр. Главный корпус, 3 этаж)" value={formData.building} onChange={e => setFormData({...formData, building: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm" />
              
              <input type="number" placeholder="Этаж" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm" />
              <button type="submit" className="w-full py-2.5 bg-rhetora-teal text-white font-medium rounded-xl text-sm">Сохранить</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
