import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Calendar, Clock, MapPin, Plus, Edit, Trash2, X, Filter, Download 
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';

interface ScheduleItem {
  id: string;
  title: string;
  type: 'ROUND' | 'BREAK' | 'CEREMONY' | 'OTHER';
  startTime: string;
  endTime?: string;
  location?: string;
  description?: string;
}

export const SchedulePage = () => {
  const location = useLocation();
  const tournamentId = location.pathname.split('/')[2];
  const { token, user } = useAuth();
  const { showError, showSuccess } = useToast();

  const scheduleRef = useRef<HTMLDivElement>(null);
  const storageKey = `rhetora_schedule_${tournamentId || 'default'}`;

  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [isExporting, setIsExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Проверка прав организатора
  const isOrganizer = user?.role === 'SUPERADMIN' || user?.role === 'ORGANIZER';

  // Состояние модального окна создания/редактирования события
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    type: 'ROUND' as ScheduleItem['type'],
    startTime: '',
    endTime: '',
    location: '',
    description: '',
  });

  const sortSchedule = (items: ScheduleItem[]) =>
    [...items].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const persistSchedule = (items: ScheduleItem[]) => {
    const sorted = sortSchedule(items);
    setSchedule(sorted);
    localStorage.setItem(storageKey, JSON.stringify(sorted));
  };

  const toLocalInputString = (dateStr?: string) => {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateStr) && !dateStr.endsWith('Z')) {
      return dateStr.slice(0, 16);
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSchedule(Array.isArray(parsed) ? sortSchedule(parsed) : []);
      } else {
        setSchedule([]);
      }
    } catch {
      setSchedule([]);
    }
  };

  const fetchSchedule = async () => {
    if (!tournamentId) {
      loadFromLocalStorage();
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/schedule`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        persistSchedule(Array.isArray(data) ? data : []);
      } else {
        loadFromLocalStorage();
      }
    } catch {
      loadFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [tournamentId, token]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      title: '',
      type: 'ROUND',
      startTime: '',
      endTime: '',
      location: '',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ScheduleItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title || '',
      type: item.type || 'ROUND',
      startTime: toLocalInputString(item.startTime),
      endTime: toLocalInputString(item.endTime),
      location: item.location || '',
      description: item.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingItem) {
        let updatedItem: ScheduleItem = { ...editingItem, ...formData };

        if (tournamentId) {
          try {
            const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/schedule/${editingItem.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(formData),
            });
            if (res.ok) {
              const serverData = await res.json();
              if (serverData && serverData.id) updatedItem = serverData;
            }
          } catch {
            // Используем локальное сохранение при недоступности эндпоинта
          }
        }

        const nextList = schedule.map((item) => (item.id === editingItem.id ? updatedItem : item));
        persistSchedule(nextList);
        showSuccess('Событие обновлено!');
      } else {
        let createdItem: ScheduleItem = {
          id: Date.now().toString(),
          ...formData,
        };

        if (tournamentId) {
          try {
            const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/schedule`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(formData),
            });
            if (res.ok) {
              const serverData = await res.json();
              if (serverData && serverData.id) createdItem = serverData;
            }
          } catch {
            // Используем локальное сохранение при недоступности эндпоинта
          }
        }

        persistSchedule([...schedule, createdItem]);
        showSuccess('Событие добавлено в расписание!');
      }

      setIsModalOpen(false);
    } catch {
      showError('Ошибка сохранения события');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить это событие из расписания?')) return;

    if (tournamentId) {
      try {
        await fetch(`${API_BASE}/api/tournaments/${tournamentId}/schedule/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Игнорируем ошибку сети, удаляем локально
      }
    }

    persistSchedule(schedule.filter((item) => item.id !== id));
    showSuccess('Событие удалено');
  };

  // Функция скачивания расписания в виде PNG картинки
  const handleDownloadImage = async () => {
    if (!scheduleRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(scheduleRef.current, {
        cacheBust: true,
        backgroundColor: '#f8fafc',
        pixelRatio: 2,
        filter: (node) => {
          if (node instanceof HTMLElement && node.classList.contains('no-export')) {
            return false;
          }
          return true;
        },
      });
      const link = document.createElement('a');
      link.download = 'rhetora-schedule.png';
      link.href = dataUrl;
      link.click();
      showSuccess('Расписание успешно сохранено как картинка!');
    } catch {
      showError('Не удалось скачать изображение');
    } finally {
      setIsExporting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    const map: Record<string, { label: string; class: string }> = {
      ROUND: { label: 'Раунд дебатов', class: 'bg-blue-50 text-blue-700 border-blue-200' },
      BREAK: { label: 'Перерыв / Еда', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      CEREMONY: { label: 'Церемония', class: 'bg-purple-50 text-purple-700 border-purple-200' },
      OTHER: { label: 'Событие', class: 'bg-slate-100 text-slate-700 border-slate-200' },
    };
    const cfg = map[type] || map['OTHER'];
    return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${cfg.class}`}>{cfg.label}</span>;
  };

  const filteredSchedule = schedule.filter((item) => {
    if (filterType === 'ALL') return true;
    return item.type === filterType;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Шапка страницы */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Расписание турнира</h2>
          <p className="text-sm text-slate-500">Тайм-лайн событий, раундов и перерывов в реальном времени</p>
        </div>

        <div className="flex items-center gap-2">
          {schedule.length > 0 && (
            <button
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Download size={16} /> {isExporting ? 'Генерация...' : 'Скачать картинку'}
            </button>
          )}

          {isOrganizer && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 bg-rhetora-teal hover:bg-sky-600 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition shadow-sm cursor-pointer"
            >
              <Plus size={18} /> Добавить
            </button>
          )}
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/85 shadow-sm flex items-center gap-2 overflow-x-auto">
        <Filter size={16} className="text-slate-400 shrink-0 ml-1" />
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            filterType === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Все события
        </button>
        <button
          onClick={() => setFilterType('ROUND')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            filterType === 'ROUND' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
        >
          Раунды
        </button>
        <button
          onClick={() => setFilterType('BREAK')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            filterType === 'BREAK' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          Перерывы
        </button>
        <button
          onClick={() => setFilterType('CEREMONY')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            filterType === 'CEREMONY' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
          }`}
        >
          Церемонии
        </button>
      </div>

      {/* Область, которая экспортируется в картинку */}
      <div ref={scheduleRef} className="p-4 sm:p-6 bg-slate-50 rounded-3xl space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white h-24 rounded-2xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : filteredSchedule.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
            <Calendar size={32} className="text-slate-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">В расписании пока пусто</h3>
            <p className="text-sm text-slate-500">
              {isOrganizer
                ? 'Нажмите «Добавить», чтобы внести первый пункт расписания.'
                : 'События турнира появятся здесь в ближайшее время.'}
            </p>
            {isOrganizer && (
              <div className="pt-2">
                <button
                  onClick={handleOpenCreate}
                  className="inline-flex items-center gap-2 bg-rhetora-teal hover:bg-sky-600 text-white font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm cursor-pointer"
                >
                  <Plus size={16} /> Добавить событие
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-300 ml-4 sm:ml-6 space-y-8 pl-6 sm:pl-8 py-2">
            {filteredSchedule.map((item, index) => (
              <div key={item.id || index} className="relative group">
                <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full bg-white border-4 border-rhetora-teal shadow-xs" />

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm transition space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                        <Clock size={13} className="text-rhetora-teal" />
                        {formatTime(item.startTime)}
                        {item.endTime ? ` — ${formatTime(item.endTime)}` : ''}
                      </span>
                      {getTypeBadge(item.type)}
                    </div>

                    {isOrganizer && (
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition no-export">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-50 cursor-pointer"
                          title="Редактировать"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-50 cursor-pointer"
                          title="Удалить"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">{item.title}</h3>
                    {item.location && (
                      <div className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin size={13} className="text-rose-500" /> {item.location}
                      </div>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-xs sm:text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно создания/редактирования */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="font-bold text-lg text-slate-900">
                {editingItem ? 'Редактировать событие' : 'Новое событие расписания'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Название события *</label>
                <input
                  required
                  placeholder="Например: Отборочный раунд 1"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Категория</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as ScheduleItem['type'] })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer"
                >
                  <option value="ROUND">Раунд дебатов</option>
                  <option value="BREAK">Перерыв / Еда</option>
                  <option value="CEREMONY">Церемония / Награждение</option>
                  <option value="OTHER">Другое событие</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Начало *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Конец (необязательно)</label>
                  <input
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Место проведения (аудитория / локация)</label>
                <input
                  placeholder="Например: Актовый зал / Кабинет 305"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Описание (необязательно)</label>
                <textarea
                  rows={2}
                  placeholder="Дополнительные детали для участников..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none resize-none"
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
                  disabled={saving}
                  className="px-4 py-2 bg-rhetora-teal text-white font-medium rounded-xl text-sm hover:bg-sky-600 transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
