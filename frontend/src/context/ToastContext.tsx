import React, { createContext, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X, Copy, ChevronDown, ChevronUp } from 'lucide-react';

export interface DebugError {
  message: string;
  statusCode?: number;
  method?: string;
  path?: string;
  timestamp?: string;
  stack?: string;
  details?: any;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  debugData?: DebugError;
}

interface ToastContextType {
  showError: (title: string, debugData?: DebugError) => void;
  showSuccess: (title: string) => void;
}

const ToastContext = createContext<ToastContextType>({} as ToastContextType);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeDebugModal, setActiveDebugModal] = useState<DebugError | null>(null);

  const addToast = (type: Toast['type'], title: string, debugData?: DebugError) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, debugData }]);

    // Авто-закрытие только для успехов и инфо. Ошибки висят до закрытия/осмотра!
    if (type !== 'error') {
      setTimeout(() => {
        removeToast(id);
      }, 4000);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showError = (title: string, debugData?: DebugError) => {
    addToast('error', title, debugData);
  };

  const showSuccess = (title: string) => {
    addToast('success', title);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Лог ошибки скопирован в буфер обмена');
  };

  return (
    <ToastContext.Provider value={{ showError, showSuccess }}>
      {children}

      {/* Правый верхний угол: Контейнер для тоастов */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 flex items-start justify-between gap-3 ${
              toast.type === 'error'
                ? 'bg-red-50/95 border-red-200 text-red-900'
                : toast.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
                : 'bg-slate-900/90 border-slate-700 text-white'
            }`}
          >
            <div className="flex items-start gap-3 flex-1">
              {toast.type === 'error' && <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />}
              {toast.type === 'success' && <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={20} />}
              
              <div className="space-y-1 flex-1">
                <h4 className="font-semibold text-sm leading-tight">{toast.title}</h4>
                {toast.debugData && (
                  <div className="pt-1">
                    <button
                      onClick={() => setActiveDebugModal(toast.debugData!)}
                      className="text-xs font-semibold underline hover:opacity-80 transition inline-flex items-center gap-1 text-red-700"
                    >
                      🔍 Детали ошибки (Debug Log)
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 transition"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Окно детальной отладки (Debug Modal) */}
      {activeDebugModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-2xl overflow-hidden font-mono text-xs">
            <div className="flex items-center justify-between p-4 bg-slate-800/60 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
                <span className="font-bold text-sm text-slate-200">Rhetora Debug Log Inspector</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(JSON.stringify(activeDebugModal, null, 2))}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-sans font-medium transition flex items-center gap-1.5"
                >
                  <Copy size={14} /> Скопировать JSON
                </button>
                <button
                  onClick={() => setActiveDebugModal(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <span className="text-slate-500 uppercase font-sans font-bold text-[10px] tracking-wider block mb-1">Ошибка:</span>
                <p className="text-red-400 font-bold text-sm bg-red-950/30 p-3 rounded-xl border border-red-900/50">
                  {activeDebugModal.message}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Status Code:</span>
                  <span className="text-amber-400 font-bold">{activeDebugModal.statusCode || '500'}</span>
                </div>
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Method:</span>
                  <span className="text-sky-400 font-bold">{activeDebugModal.method || 'POST'}</span>
                </div>
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Path:</span>
                  <span className="text-emerald-400 font-bold">{activeDebugModal.path || '/api'}</span>
                </div>
              </div>

              {activeDebugModal.stack && (
                <div>
                  <span className="text-slate-500 uppercase font-sans font-bold text-[10px] tracking-wider block mb-1">Stack Trace:</span>
                  <pre className="bg-black/60 p-4 rounded-xl border border-slate-800 text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
                    {activeDebugModal.stack}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
