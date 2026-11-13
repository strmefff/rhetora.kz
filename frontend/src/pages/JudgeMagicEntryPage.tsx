import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gavel, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { API_BASE } from '../config/api';

export const JudgeMagicEntryPage = () => {
  const { code: urlCode } = useParams<{ code?: string }>();
  const navigate = useNavigate();

  const [code, setCode] = useState(urlCode || '');
  const [loading, setLoading] = useState(Boolean(urlCode));
  const [error, setError] = useState('');

  const performMagicLogin = async (accessCode: string) => {
    const cleanCode = accessCode.trim().toUpperCase();
    if (!cleanCode) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/judge-magic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode }),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.hash = '#/judge/dashboard';
      } else {
        setError(data.error || 'Недействительная ссылка или код судьи');
        setLoading(false);
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlCode) {
      performMagicLogin(urlCode);
    }
  }, [urlCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performMagicLogin(code);
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
            <Gavel size={24} />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Вход для судьи
          </h1>
          <p className="text-sm text-slate-400">
            {loading
              ? 'Выполняем автоматический вход в кабинет...'
              : 'Введите код доступа, выданный организатором турнира'}
          </p>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-300">
            <RefreshCw size={28} className="animate-spin text-sky-400" />
            <span className="text-xs font-medium text-slate-400">
              Подготовка судейского бюллетеня...
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Код доступа
              </label>
              <input
                type="text"
                placeholder="RH-7K9M"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                className="w-full px-4 py-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-center font-mono text-lg tracking-widest uppercase focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              Перейти к судейству <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition pt-1 cursor-pointer"
            >
              Войти через Email и пароль
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
