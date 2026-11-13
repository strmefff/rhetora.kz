import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  Shield,
  Calendar,
  Camera,
  Trash2,
  Crown,
  Send,
  Building2,
  MapPin,
  Trophy,
  Gavel,
  CheckCircle2,
  Sliders,
  Volume2,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API_BASE } from '../config/api';

const compressImageToBase64 = (file: File, size = 160, quality = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas не поддерживается'));

        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });
};

// Мягкий звуковой сигнал через Web Audio API (без внешних аудиофайлов)
const playTestChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // Игнорируем, если браузер заблокировал автовоспроизведение
  }
};

export const ProfilePage = () => {
  const { token } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Данные профиля
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [organization, setOrganization] = useState('');
  const [city, setCity] = useState('');
  const [role, setRole] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);

  // Статистика активности
  const [stats, setStats] = useState({
    tournamentsCount: 0,
    judgedGamesCount: 0,
    submittedBallotsCount: 0,
  });

  // Локальные настройки таб-рума
  const [defaultFormat, setDefaultFormat] = useState<string>(
    () => localStorage.getItem('rhetora_default_format') || 'WSDC'
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    () => localStorage.getItem('rhetora_sound_notifications') !== 'false'
  );

  // Поля смены пароля
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const getCacheKey = (id: string) => `rhetora_avatar_${id || 'current'}`;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setUserId(data.id || '');
          setName(data.name || '');
          setEmail(data.email || '');
          setTelegram(data.telegram || '');
          setOrganization(data.organization || '');
          setCity(data.city || '');
          setRole(data.role || '');
          setCreatedAt(data.createdAt ? new Date(data.createdAt).toLocaleDateString() : '');

          if (data.stats) {
            setStats(data.stats);
          }

          const cachedAvatar = localStorage.getItem(getCacheKey(data.id));
          setAvatar(data.avatar || cachedAvatar || null);
        } else {
          showError(data.error || 'Не удалось загрузить профиль');
        }
      } catch (err) {
        showError('Ошибка сети при загрузке профиля');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchProfile();
  }, [token]);

  const notifySidebarUpdate = () => {
    window.dispatchEvent(new Event('rhetora_profile_updated'));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Выберите файл изображения (JPG, PNG, WebP)');
      return;
    }

    try {
      const compressedBase64 = await compressImageToBase64(file);
      setAvatar(compressedBase64);
      localStorage.setItem(getCacheKey(userId), compressedBase64);
      notifySidebarUpdate();

      await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar: compressedBase64 }),
      }).catch(() => {});

      showSuccess('Аватарка обновлена');
    } catch (err: any) {
      showError(err.message || 'Не удалось обработать фото');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatar(null);
    localStorage.removeItem(getCacheKey(userId));
    notifySidebarUpdate();

    await fetch(`${API_BASE}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ avatar: null }),
    }).catch(() => {});

    showSuccess('Аватарка удалена');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, telegram, organization, city }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.user?.telegram !== undefined) {
          setTelegram(data.user.telegram || '');
        }
        notifySidebarUpdate();
        showSuccess('Профиль успешно обновлён!');
      } else {
        showError(data.error || 'Ошибка сохранения профиля');
      }
    } catch (err) {
      showError('Ошибка сети');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFormatChange = (fmt: string) => {
    setDefaultFormat(fmt);
    localStorage.setItem('rhetora_default_format', fmt);
    showSuccess(`Формат по умолчанию: ${fmt}`);
  };

  const handleSoundToggle = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('rhetora_sound_notifications', String(next));
    if (next) playTestChime();
    showSuccess(next ? 'Звуковые уведомления включены' : 'Звуковые уведомления отключены');
  };

  const handleResetLocalCache = () => {
    if (!confirm('Очистить локальный кэш браузера (кроме текущей сессии)?')) return;
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    localStorage.clear();
    if (savedToken) localStorage.setItem('token', savedToken);
    if (savedUser) localStorage.setItem('user', savedUser);
    notifySidebarUpdate();
    showSuccess('Локальный кэш очищен');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showError('Новые пароли не совпадают');
      return;
    }
    if (newPassword.length < 6) {
      showError('Пароль должен быть не менее 6 символов');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess('Пароль успешно изменён!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showError(data.error || 'Ошибка смены пароля');
      }
    } catch (err) {
      showError('Ошибка сети');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-44 bg-white rounded-3xl border border-slate-200 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <style>{`
        @keyframes superadminGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .superadmin-badge {
          background: linear-gradient(120deg, #4f46e5, #d946ef, #f43f5e, #f59e0b, #06b6d4, #4f46e5);
          background-size: 300% 300%;
          animation: superadminGradient 4s ease infinite;
        }
      `}</style>

      {/* 1. Шапка профиля */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />

          <div className="relative group shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Нажмите, чтобы загрузить фото"
              className="w-16 h-16 rounded-2xl bg-rhetora-teal/10 text-rhetora-teal flex items-center justify-center font-extrabold text-2xl shadow-inner overflow-hidden relative cursor-pointer border border-slate-200/60"
            >
              {avatar ? (
                <img src={avatar} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span>{name ? name.charAt(0).toUpperCase() : 'U'}</span>
              )}

              <div className="absolute inset-0 bg-slate-900/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={20} />
              </div>
            </button>

            {avatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                title="Удалить фото"
                className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-rose-600 shadow-sm flex items-center justify-center cursor-pointer transition"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          <div>
            <h1 className="text-xl font-extrabold text-slate-900">{name || 'Пользователь'}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
              <p className="text-sm text-slate-500">{email}</p>
              {telegram && (
                <a
                  href={`https://t.me/${telegram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700"
                >
                  @{telegram} <ExternalLink size={11} />
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-rhetora-teal hover:underline mt-1 cursor-pointer"
            >
              {avatar ? 'Изменить фото' : 'Загрузить фото'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {role === 'SUPERADMIN' ? (
            <span className="superadmin-badge inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white text-xs font-extrabold tracking-wide shadow-md shadow-fuchsia-500/25 border border-white/25 select-none">
              <Crown size={14} className="text-amber-200 drop-shadow-xs" /> Суперадмин
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
              <Shield size={14} className="text-rhetora-teal" /> Организатор
            </span>
          )}

          {createdAt && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-500 text-xs font-medium border border-slate-200">
              <Calendar size={14} /> С {createdAt}
            </span>
          )}

          {stats.judgedGamesCount > 0 && (
            <button
              type="button"
              onClick={() => navigate('/judge/dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold border border-sky-200 transition cursor-pointer"
            >
              <Gavel size={14} /> Кабинет судьи
            </button>
          )}
        </div>
      </div>

      {/* 2. Полоска статистики активности */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Организовано турниров
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {stats.tournamentsCount}
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-rhetora-teal flex items-center justify-center">
            <Trophy size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Назначений в судейство
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {stats.judgedGamesCount}
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Gavel size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Отправлено бюллетеней
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              {stats.submittedBallotsCount}
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* 3. Личные данные и дебатный профиль */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Личные данные и дебатный профиль</h2>
          <p className="text-sm text-slate-500">
            Контактная информация для таб-рума, судейских коллегий и участников
          </p>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Ваше имя *
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rhetora-teal focus:ring-1 focus:ring-rhetora-teal shadow-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Email (Электронная почта) *
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rhetora-teal focus:ring-1 focus:ring-rhetora-teal shadow-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Telegram для связи
              </label>
              <div className="relative">
                <Send size={17} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="@username"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rhetora-teal focus:ring-1 focus:ring-rhetora-teal shadow-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Город
              </label>
              <div className="relative">
                <MapPin size={18} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Например: Астана"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rhetora-teal focus:ring-1 focus:ring-rhetora-teal shadow-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Клуб / Учебное заведение
            </label>
            <div className="relative">
              <Building2 size={18} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Например: Esil University / Astana Debate Union"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rhetora-teal focus:ring-1 focus:ring-rhetora-teal shadow-xs"
              />
            </div>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {savingProfile ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>

      {/* 4. Настройки таб-рума */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Sliders size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Настройки таб-рума</h2>
            <p className="text-sm text-slate-500">Персональные параметры рабочего пространства организатора</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Формат по умолчанию */}
          <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Формат турнира по умолчанию
            </div>
            <div className="grid grid-cols-3 gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
              {['WSDC', 'BP', 'LD'].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => handleFormatChange(fmt)}
                  className={`py-2 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    defaultFormat === fmt
                      ? 'bg-rhetora-teal text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Звуковой сигнал */}
          <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Volume2 size={16} className="text-rhetora-teal" /> Звук при сдаче бюллетеня
              </div>
              <p className="text-xs text-slate-500">
                Уведомлять сигналом, когда судья отправляет оценки
              </p>
            </div>
            <button
              type="button"
              onClick={handleSoundToggle}
              className={`w-12 h-7 rounded-full transition-colors p-1 cursor-pointer shrink-0 ${
                soundEnabled ? 'bg-rhetora-teal' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  soundEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Безопасность и пароль */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Безопасность и пароль</h2>
          <p className="text-sm text-slate-500">Регулярно меняйте пароль для защиты вашего аккаунта</p>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Текущий пароль
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
              <input
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rhetora-teal focus:ring-1 focus:ring-rhetora-teal shadow-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Новый пароль
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rhetora-teal focus:ring-1 focus:ring-rhetora-teal shadow-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Подтвердите пароль
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rhetora-teal focus:ring-1 focus:ring-rhetora-teal shadow-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <button
              type="submit"
              disabled={savingPassword}
              className="px-5 py-3 bg-rhetora-teal hover:bg-sky-600 text-white rounded-xl text-sm font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {savingPassword ? 'Изменение...' : 'Изменить пароль'}
            </button>

            <button
              type="button"
              onClick={handleResetLocalCache}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              <RotateCcw size={13} /> Сбросить локальный кэш
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
