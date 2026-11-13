import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  FileEdit,
  DoorOpen,
  ArrowRight,
  Gavel,
  Trophy,
  Inbox,
  User,
  Mail,
  Lock,
  Camera,
  Trash2,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Timer as TimerIcon,
  Bell,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { JudgeLayout } from '../../components/JudgeLayout';
import { API_BASE } from '../../config/api';

interface JudgeAssignmentItem {
  assignmentId: string;
  isChair: boolean;
  judgeName: string;
  matchId: string;
  gameNumber: number;
  format: string;
  room: { id: string; name: string; building?: string | null } | null;
  round: { id: string; number: number; name: string; status: string };
  tournament: { id: string; name: string; status: string };
  ballot: { id: string; status: string; updatedAt: string; submittedAt?: string | null } | null;
  ballotStatus: 'PENDING' | 'DRAFT' | 'SUBMITTED';
}

interface DashboardResponse {
  judge: { id: string; name: string; email: string };
  activeTournament: { id: string; name: string; status: string } | null;
  stats: {
    totalAssignments: number;
    submittedCount: number;
    pendingCount: number;
  };
  assignments: JudgeAssignmentItem[];
}

// Сжатие и обрезка аватарки в квадрат 160x160 (~8-12 КБ) в браузере
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

export const JudgeDashboardPage = () => {
  const { token, user } = useAuth();
  const { showError, showSuccess } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'games' | 'timer' | 'profile'>('games');
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Состояния таймера (5 минут по умолчанию для основной речи)
  const [timerSeconds, setTimerSeconds] = useState<number>(300); 
  const [initialSeconds, setInitialSeconds] = useState<number>(300);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Функция воспроизведения кастомного аудиофайла гонга
  const playGongSound = () => {
    try {
      const audio = new Audio('/gong.mp3');
      audio.volume = 1.0;
      audio.play().catch((err) => {
        console.error('Не удалось воспроизвести аудиофайл:', err);
      });
    } catch (e) {
      console.error('Audio error:', e);
    }
  };

  // Логика работы таймера и звуковых сигналов
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          const next = prev - 1;
          
          // Проверка регламентных точек для звукового сигнала
          if (initialSeconds === 300) {
            // Для 5-минутной речи: 
            // Прошла 1 минута (осталось 240 сек) -> гонг
            // Последняя минута (осталось 60 сек) -> гонг
            // Конец времени (0 сек) -> гонг
            if (next === 240 || next === 60 || next === 0) {
              playGongSound();
            }
          } else if (initialSeconds === 180) {
            // Для 3-минутной аналитики:
            // Прошла 1 минута (осталось 120 сек) и последняя минута (осталось 60 сек)
            if (next === 120 || next === 60 || next === 0) {
              playGongSound();
            }
          }

          if (next === 0) {
            setIsTimerRunning(false);
          }

          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, initialSeconds]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSetPreset = (secs: number) => {
    setIsTimerRunning(false);
    setInitialSeconds(secs);
    setTimerSeconds(secs);
  };

  const handleToggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(initialSeconds);
  };

  const handleAdd15Seconds = () => {
    setTimerSeconds((prev) => prev + 15);
  };

  // Состояния профиля и аватарки
  const [userId, setUserId] = useState<string>(user?.id || '');
  const [profileName, setProfileName] = useState<string>(user?.name || '');
  const [profileEmail, setProfileEmail] = useState<string>(user?.email || '');
  const [avatar, setAvatar] = useState<string | null>(() => {
    if (user?.id) {
      return localStorage.getItem(`rhetora_avatar_${user.id}`);
    }
    return null;
  });

  // Состояния форм редактирования
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const getCacheKey = (id: string) => `rhetora_avatar_${id || 'current'}`;

  useEffect(() => {
    if (!token) return;

    const fetchAllData = async () => {
      try {
        const [dashRes, meRes] = await Promise.all([
          fetch(`${API_BASE}/api/judge/dashboard`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const dashJson = await dashRes.json();
        if (dashRes.ok) {
          setData(dashJson);
          if (!profileName && dashJson.judge?.name) setProfileName(dashJson.judge.name);
          if (!profileEmail && dashJson.judge?.email) setProfileEmail(dashJson.judge.email);
        } else {
          showError(dashJson.error || 'Не удалось загрузить кабинет судьи', dashJson);
        }

        if (meRes.ok) {
          const meJson = await meRes.json();
          const resolvedId = meJson.id || user?.id || '';
          setUserId(resolvedId);
          if (meJson.name) setProfileName(meJson.name);
          if (meJson.email) setProfileEmail(meJson.email);

          const cachedAvatar = localStorage.getItem(getCacheKey(resolvedId));
          setAvatar(meJson.avatar || cachedAvatar || null);
        }
      } catch (err: any) {
        showError('Ошибка сети при загрузке данных', { message: err.message });
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [token]);

  // Загрузка и сжатие новой аватарки в кэш
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

      await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail,
          avatar: compressedBase64,
        }),
      }).catch(() => {});

      showSuccess('Аватарка обновлена');
    } catch (err: any) {
      showError(err.message || 'Не удалось обработать фото');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Удаление аватарки
  const handleRemoveAvatar = async () => {
    setAvatar(null);
    localStorage.removeItem(getCacheKey(userId));

    await fetch(`${API_BASE}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: profileName,
        email: profileEmail,
        avatar: null,
      }),
    }).catch(() => {});

    showSuccess('Аватарка удалена');
  };

  // Сохранение имени и Email
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
        body: JSON.stringify({ name: profileName, email: profileEmail }),
      });
      const resData = await res.json();
      if (res.ok) {
        showSuccess('Профиль успешно обновлён!');
      } else {
        showError(resData.error || 'Ошибка сохранения профиля');
      }
    } catch (err) {
      showError('Ошибка сети');
    } finally {
      setSavingProfile(false);
    }
  };

  // Смена пароля
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
      const resData = await res.json();
      if (res.ok) {
        showSuccess('Пароль успешно изменён!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showError(resData.error || 'Ошибка смены пароля');
      }
    } catch (err) {
      showError('Ошибка сети');
    } finally {
      setSavingPassword(false);
    }
  };

  // Группировка игр по раундам (с учётом турнира)
  const groupedRounds = useMemo(() => {
    if (!data?.assignments) return [];
    const map = new Map<
      string,
      {
        key: string;
        tournamentName: string;
        roundNumber: number;
        roundName: string;
        items: JudgeAssignmentItem[];
      }
    >();

    data.assignments.forEach((item) => {
      const key = `${item.tournament.id}_${item.round.id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          tournamentName: item.tournament.name,
          roundNumber: item.round.number,
          roundName: item.round.name,
          items: [],
        });
      }
      map.get(key)!.items.push(item);
    });

    return Array.from(map.values()).sort((a, b) => a.roundNumber - b.roundNumber);
  }, [data]);

  const renderStatusBadge = (status: JudgeAssignmentItem['ballotStatus']) => {
    if (status === 'SUBMITTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={13} />
          Отправлен
        </span>
      );
    }
    if (status === 'DRAFT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
          <FileEdit size={13} />
          Черновик
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock size={13} />
        Ожидает заполнения
      </span>
    );
  };

  const displayName = profileName || data?.judge.name || user?.name || 'Личный кабинет судьи';
  const displayEmail = profileEmail || data?.judge.email || user?.email || '';

  return (
    <JudgeLayout
      judgeName={displayName}
      activeTournamentName={data?.activeTournament?.name}
    >
      <div className="space-y-6 pb-20">
        {/* Карточка судьи с аватаркой и переключателем вкладок (оптимизировано под мобайл) */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />

            {/* Аватар */}
            <div className="relative group shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Нажмите, чтобы загрузить или обновить фото"
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rhetora-teal/10 text-rhetora-teal flex items-center justify-center font-extrabold text-xl sm:text-2xl shadow-inner overflow-hidden relative cursor-pointer border border-slate-200/70"
              >
                {avatar ? (
                  <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span>{displayName ? displayName.charAt(0).toUpperCase() : 'S'}</span>
                )}

                <div className="absolute inset-0 bg-slate-900/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={18} />
                </div>
              </button>

              {avatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  title="Удалить фото"
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-rose-600 shadow-sm flex items-center justify-center cursor-pointer transition"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
                  {displayName}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
                  <Gavel size={11} className="text-rhetora-teal" /> Судья
                </span>
              </div>
              {displayEmail && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{displayEmail}</p>
              )}
            </div>
          </div>

          {/* Переключатель вкладок (Мои игры / Таймер / Профиль) */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('games')}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'games'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Gavel size={15} /> Игры
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timer')}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'timer'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TimerIcon size={15} /> Таймер
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings size={15} /> Профиль
            </button>
          </div>
        </div>

        {/* ВКЛАДКА 1: МОИ ИГРЫ */}
        {activeTab === 'games' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm text-center">
                <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Всего игр
                </div>
                <div className="text-xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                  {loading ? '—' : data?.stats.totalAssignments ?? 0}
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm text-center">
                <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Сдано
                </div>
                <div className="text-xl sm:text-3xl font-extrabold text-emerald-600 mt-1">
                  {loading ? '—' : data?.stats.submittedCount ?? 0}
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm text-center">
                <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Ждут
                </div>
                <div className="text-xl sm:text-3xl font-extrabold text-amber-600 mt-1">
                  {loading ? '—' : data?.stats.pendingCount ?? 0}
                </div>
              </div>
            </div>

            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Назначенные дебаты</h2>
                {!loading && data && data.assignments.length > 0 && (
                  <span className="text-xs font-medium text-slate-400">
                    По раундам
                  </span>
                )}
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((n) => (
                    <div
                      key={n}
                      className="bg-white h-28 rounded-2xl border border-slate-200/80 animate-pulse"
                    />
                  ))}
                </div>
              ) : groupedRounds.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Inbox size={24} />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Игр пока нет</h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    Как только организатор распределит вас на дебаты, карточки игр появятся здесь.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {groupedRounds.map((group) => (
                    <div key={group.key} className="space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2 px-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-900 text-white text-xs font-bold">
                          Раунд {group.roundNumber}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-800">{group.roundName}</span>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {group.items.map((item) => (
                          <div
                            key={item.assignmentId}
                            className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col gap-3.5"
                          >
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-bold text-slate-900 text-sm sm:text-base">
                                  Игра #{item.gameNumber}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                                    {item.format}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                                      item.isChair
                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                        : 'bg-slate-50 text-slate-600 border border-slate-200'
                                    }`}
                                  >
                                    {item.isChair ? 'Чейр' : 'Боковой'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col gap-1 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1.5 truncate">
                                  <Trophy size={13} className="text-slate-400 shrink-0" />
                                  {item.tournament.name}
                                </span>
                                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                                  <DoorOpen size={13} className="text-rhetora-teal shrink-0" />
                                  {item.room ? item.room.name : 'Аудитория не назначена'}
                                </span>
                              </div>

                              <div>{renderStatusBadge(item.ballotStatus)}</div>
                            </div>

                            <Link
                              to={`/judge/matches/${item.assignmentId}`}
                              className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition shadow-sm ${
                                item.ballotStatus === 'SUBMITTED'
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  : 'bg-rhetora-teal hover:bg-sky-600 text-white'
                              }`}
                            >
                              {item.ballotStatus === 'SUBMITTED' ? 'Просмотреть бюллетень' : 'Открыть игру и бюллетень'}
                              <ArrowRight size={16} />
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ВКЛАДКА 2: МОБИЛЬНЫЙ ТАЙМЕР ДЕБАТОВ */}
        {activeTab === 'timer' && (
          <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 text-left">Таймер речи спикера</h2>
                <p className="text-xs sm:text-sm text-slate-500 text-left">
                  Регламент с авто-сигналами (гонг)
                </p>
              </div>
              {/* Кнопка ручного звонка/гонга */}
              <button
                type="button"
                onClick={playGongSound}
                title="Издать звуковой гонг вручную"
                className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Bell size={15} /> Звонок
              </button>
            </div>

            {/* Быстрые пресеты дебатного времени (5 минут и 3 минуты) */}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleSetPreset(300)}
                className={`flex-1 py-3 rounded-2xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
                  initialSeconds === 300
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                5 минут (Основная)
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset(180)}
                className={`flex-1 py-3 rounded-2xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
                  initialSeconds === 180
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                3 минуты (Аналитика)
              </button>
            </div>

            {/* Большое циферблатное табло таймера */}
            <div
              className={`py-8 sm:py-12 rounded-3xl border transition-colors relative overflow-hidden ${
                timerSeconds === 0
                  ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse'
                  : timerSeconds <= 60
                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              {/* Подсказка про защищенное время для 5-минутной речи */}
              {initialSeconds === 300 && (
                <div className="absolute top-3 inset-x-0 text-[11px] font-bold uppercase tracking-wider text-slate-400 px-4">
                  {timerSeconds > 240 ? '🛡️ Первая минута (Защищенное время)' : timerSeconds <= 60 ? '🛡️ Последняя минута (Защищенное время)' : '💬 Время вопросов (POI открыты)'}
                </div>
              )}

              {/* Подсказка для 3-минутной аналитики */}
              {initialSeconds === 180 && (
                <div className="absolute top-3 inset-x-0 text-[11px] font-bold uppercase tracking-wider text-slate-400 px-4">
                  {timerSeconds > 120 ? '🛡️ Первая минута (Защищенное время)' : timerSeconds <= 60 ? '🛡️ Последняя минута (Защищенное время)' : '💬 Время вопросов (POI открыты)'}
                </div>
              )}

              <div className="text-6xl sm:text-8xl font-black tracking-tighter mt-2">
                {formatTime(timerSeconds)}
              </div>
              <div className="text-xs uppercase tracking-widest font-bold mt-2 text-slate-400">
                {timerSeconds === 0 ? 'Время вышло!' : isTimerRunning ? 'Идёт отсчёт...' : 'Пауза'}
              </div>
            </div>

            {/* Кнопки управления под палец на смартфоне */}
            <div className="grid grid-cols-3 gap-2.5 max-w-md mx-auto">
              <button
                type="button"
                onClick={handleToggleTimer}
                className={`py-4 rounded-2xl text-sm sm:text-base font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer text-white ${
                  isTimerRunning
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isTimerRunning ? (
                  <>
                    <Pause size={18} /> Пауза
                  </>
                ) : (
                  <>
                    <Play size={18} /> Старт
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleAdd15Seconds}
                className="py-4 rounded-2xl text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center gap-1 transition cursor-pointer"
                title="Добавить 15 секунд"
              >
                <Plus size={16} /> 15 сек
              </button>

              <button
                type="button"
                onClick={handleResetTimer}
                className="py-4 rounded-2xl text-sm sm:text-base font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw size={18} /> Сброс
              </button>
            </div>
          </div>
        )}

        {/* ВКЛАДКА 3: РЕДАКТИРОВАНИЕ ПРОФИЛЯ */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Личные данные</h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Обновите ваше имя или адрес электронной почты
                </p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Ваше имя
                  </label>
                  <div className="relative">
                    <User
                      size={18}
                      className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rhetora-teal focus:ring-1 focus:ring-rhetora-teal shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Email (Электронная почта)
                  </label>
                  <div className="relative">
                    <Mail
                      size={18}
                      className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none"
                    />
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rhetora-teal focus:ring-1 focus:ring-rhetora-teal shadow-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {savingProfile ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </form>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Безопасность и пароль</h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Регулярно меняйте пароль для защиты аккаунта
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Текущий пароль
                  </label>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none"
                    />
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

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Новый пароль
                  </label>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none"
                    />
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
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Подтвердите новый пароль
                  </label>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none"
                    />
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

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="w-full sm:w-auto px-5 py-3 bg-rhetora-teal hover:bg-sky-600 text-white rounded-xl text-sm font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {savingPassword ? 'Изменение...' : 'Изменить пароль'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </JudgeLayout>
  );
};
