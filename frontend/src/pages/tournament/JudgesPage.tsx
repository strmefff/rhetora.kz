import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus,
  Search,
  Trash2,
  X,
  UserCheck,
  Link2,
  Copy,
  Check,
  QrCode,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';

const copyToClipboard = async (text: string): Promise<boolean> => {
  // 1. Современный API (работает на HTTPS и localhost)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Переходим к запасному варианту
    }
  }

  // 2. Запасной вариант для HTTP (локальный IP) и мобильного Safari
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);

    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
};

const buildJudgeMagicLink = (accessCode: string) => {
  const basePath = window.location.pathname
    .replace(/\/index\.html$/, '')
    .replace(/\/$/, '');
  return `${window.location.origin}${basePath}/#/judge/enter/${accessCode}`;
};

export const JudgesPage = () => {
  const location = useLocation();
  const tournamentId = location.pathname.split('/')[2];
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();

  const [judges, setJudges] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [qrJudge, setQrJudge] = useState<{ name: string; accessCode: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [addMode, setAddMode] = useState<'quick' | 'existing'>('quick');
  const [formData, setFormData] = useState({
    name: '',
    organization: '',
    userId: '',
    category: 'JUDGE',
  });

  const fetchData = async () => {
    if (!tournamentId || !token) return;
    try {
      const judgesRes = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/judges`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (judgesRes.ok) setJudges(await judgesRes.json());

      const usersRes = await fetch(`${API_BASE}/api/users/list/judges`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (usersRes.ok) setAvailableUsers(await usersRes.json());
    } catch (err: any) {
      showError('Ошибка загрузки данных', { message: err.message });
    }
  };

  useEffect(() => {
    fetchData();
  }, [tournamentId, token]);

  const handleCopyMagicLink = async (judge: { name: string; accessCode?: string }) => {
    if (!judge.accessCode) {
      showError('Код доступа для этого судьи ещё не сгенерирован');
      return;
    }

    const link = buildJudgeMagicLink(judge.accessCode);
    const copied = await copyToClipboard(link);

    if (copied) {
      setCopiedCode(judge.accessCode);
      setTimeout(() => setCopiedCode(null), 2000);
      showSuccess(`Ссылка для ${judge.name} скопирована (код: ${judge.accessCode})`);
    } else {
      showError('Не удалось скопировать ссылку. Откройте QR-код и скопируйте ссылку вручную.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let payload: any = {
      organization: formData.organization.trim(),
      experience: '',
      category: formData.category,
      rating: 5.0,
    };

    if (addMode === 'quick') {
      if (!formData.name.trim()) {
        showError('Введите имя и фамилию судьи');
        return;
      }
      payload.name = formData.name.trim();
      payload.userId = null;
    } else {
      if (!formData.userId) {
        showError('Выберите пользователя из списка');
        return;
      }
      const selectedUser = availableUsers.find((u) => u.id === formData.userId);
      if (!selectedUser) return;

      payload.name = selectedUser.name;
      payload.userId = selectedUser.id;
    }

    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/judges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        showError(data.error || 'Ошибка добавления судьи', data);
        return;
      }

      showSuccess(
        data.accessCode
          ? `Судья добавлен! Код доступа: ${data.accessCode}`
          : 'Судья успешно добавлен в коллегию!'
      );
      setIsModalOpen(false);
      setFormData({ name: '', organization: '', userId: '', category: 'JUDGE' });
      fetchData();
    } catch (err: any) {
      showError('Ошибка сети', { message: err.message });
    }
  };

  const handleLinkAccount = async (judgeId: string, newUserId: string) => {
    setUpdatingId(judgeId);
    try {
      const selectedUser = availableUsers.find((u) => u.id === newUserId);
      const res = await fetch(`${API_BASE}/api/tournaments/judges/${judgeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: newUserId || null,
          ...(selectedUser ? { name: selectedUser.name } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showError(data.error || 'Не удалось привязать аккаунт', data);
        return;
      }

      showSuccess(
        newUserId ? 'Аккаунт успешно привязан к карточке судьи' : 'Привязка аккаунта снята'
      );
      fetchData();
    } catch (err: any) {
      showError('Ошибка сети при привязке аккаунта', { message: err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить судью из турнира?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/judges/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showSuccess('Судья удален');
        fetchData();
      }
    } catch (err: any) {
      showError('Ошибка удаления', { message: err.message });
    }
  };

  const filtered = judges.filter((j) =>
    `${j.name} ${j.accessCode || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const getCategoryBadge = (cat: string) => {
    const config: Record<string, { label: string; bg: string }> = {
      CHAIR: { label: 'Главный судья', bg: 'bg-purple-100 text-purple-800 border-purple-200' },
      COORDINATOR: { label: 'Координатор', bg: 'bg-blue-100 text-blue-800 border-blue-200' },
      JUDGE: { label: 'Судья', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
      PANELLIST: { label: 'Боковой судья', bg: 'bg-slate-100 text-slate-700 border-slate-200' },
    };
    const current = config[cat] || {
      label: cat,
      bg: 'bg-slate-100 text-slate-700 border-slate-200',
    };
    return (
      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${current.bg}`}>
        {current.label}
      </span>
    );
  };

  const formatRole = (role: string) => {
    switch (role) {
      case 'SUPERADMIN':
        return 'Суперадмин';
      case 'ORGANIZER':
        return 'Организатор';
      case 'JUDGE':
        return 'Судья';
      default:
        return role;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Судейская коллегия</h2>
          <p className="text-sm text-slate-500">Всего судей в турнире: {judges.length}</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-rhetora-teal hover:bg-sky-600 text-white font-medium px-4 py-2 rounded-xl text-sm shadow-sm transition cursor-pointer"
        >
          <Plus size={18} /> Добавить судью
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Поиск по имени или коду доступа (RH-...)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-semibold">Судья</th>
              <th className="p-4 font-semibold">Категория</th>
              <th className="p-4 font-semibold">Вход без пароля (Magic-ссылка)</th>
              <th className="p-4 font-semibold">Привязанный аккаунт</th>
              <th className="p-4 font-semibold text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  Судьи пока не добавлены. Нажмите «Добавить судью».
                </td>
              </tr>
            ) : (
              filtered.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-4 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <UserCheck
                        size={16}
                        className={j.userId ? 'text-emerald-600' : 'text-sky-500'}
                      />
                      <div>
                        <div>{j.name}</div>
                        {j.organization && (
                          <div className="text-xs text-slate-400 font-normal">{j.organization}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">{getCategoryBadge(j.category)}</td>
                  <td className="p-4">
                    {j.accessCode ? (
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-mono text-xs font-bold text-slate-800 tracking-wider">
                          {j.accessCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyMagicLink(j)}
                          title="Скопировать персональную ссылку для входа"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                            copiedCode === j.accessCode
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200'
                          }`}
                        >
                          {copiedCode === j.accessCode ? (
                            <>
                              <Check size={13} /> Скопировано
                            </>
                          ) : (
                            <>
                              <Copy size={13} /> Ссылка
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setQrJudge({ name: j.name, accessCode: j.accessCode })}
                          title="Показать QR-код для входа"
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition cursor-pointer"
                        >
                          <QrCode size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Обновите страницу</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 max-w-xs">
                      <Link2
                        size={15}
                        className={
                          j.userId ? 'text-emerald-600 shrink-0' : 'text-slate-400 shrink-0'
                        }
                      />
                      <select
                        disabled={updatingId === j.id}
                        value={j.userId || ''}
                        onChange={(e) => handleLinkAccount(j.id, e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium focus:outline-none focus:border-rhetora-teal ${
                          j.userId
                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <option value="">— Автосоздание при входе по ссылке —</option>
                        {availableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(j.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Модальное окно добавления судьи */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border overflow-hidden p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-slate-900">Добавить судью в турнир</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Переключатель режима добавления */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setAddMode('quick')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  addMode === 'quick'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles size={14} className="text-rhetora-teal" /> По имени (без аккаунта)
              </button>
              <button
                type="button"
                onClick={() => setAddMode('existing')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  addMode === 'existing'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus size={14} /> Из аккаунтов
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {addMode === 'quick' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Имя и фамилия судьи *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Например: Айгерим Садыкова"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Клуб / организация (необязательно)
                    </label>
                    <input
                      type="text"
                      placeholder="Например: Astana Debate Union"
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                    />
                  </div>
                  <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-100 text-xs text-sky-800">
                    Система создаст персональную ссылку и код доступа. Судье не нужно регистрироваться — временный аккаунт создастся сам при открытии ссылки.
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Пользователь системы *
                  </label>
                  <select
                    required
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                  >
                    <option value="">
                      -- Выберите пользователя (Судья / Организатор / Админ) --
                    </option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) — [{formatRole(u.role)}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Категория в турнире
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                >
                  <option value="CHAIR">Главный судья</option>
                  <option value="COORDINATOR">Координатор</option>
                  <option value="JUDGE">Судья</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
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
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно QR-кода для входа судьи */}
      {qrJudge && (
        <div
          onClick={() => setQrJudge(null)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4 border border-slate-100"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Вход по QR-коду
              </span>
              <button
                onClick={() => setQrJudge(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-slate-900">{qrJudge.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Отсканируйте камерой телефона для заполнения бюллетеней
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  buildJudgeMagicLink(qrJudge.accessCode)
                )}`}
                alt={`QR ${qrJudge.name}`}
                className="w-48 h-48 rounded-xl bg-white"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-400">
                Или введите код вручную на <span className="font-mono text-slate-600">/#/judge/enter</span>:
              </div>
              <div className="inline-block px-4 py-1.5 rounded-xl bg-slate-100 font-mono text-base font-extrabold text-slate-900 tracking-widest border border-slate-200">
                {qrJudge.accessCode}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleCopyMagicLink(qrJudge)}
              className={`w-full py-2.5 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer ${
                copiedCode === qrJudge.accessCode
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rhetora-teal hover:bg-sky-600'
              }`}
            >
              {copiedCode === qrJudge.accessCode ? (
                <>
                  <Check size={15} /> Ссылка скопирована
                </>
              ) : (
                <>
                  <Copy size={15} /> Скопировать ссылку
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
