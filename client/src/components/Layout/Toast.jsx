import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { CheckCircle, AlertTriangle, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  error:   { icon: XCircle,     color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30'         },
  warning: { icon: AlertTriangle,color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30'     },
  info:    { icon: Info,         color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30'       },
};

function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false);
  const cfg = ICONS[toast.type] || ICONS.info;
  const Icon = cfg.icon;

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration || 3500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl backdrop-blur
      transition-all duration-300 ${cfg.bg}
      ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      style={{ minWidth: 260, maxWidth: 340 }}>
      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.color}`} />
      <div className="flex-1 min-w-0">
        {toast.title && <p className="text-white text-sm font-semibold leading-snug">{toast.title}</p>}
        {toast.message && <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">{toast.message}</p>}
      </div>
      <button onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300); }}
        className="text-slate-500 hover:text-white flex-shrink-0 -mr-1 -mt-0.5 p-1">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((type, title, message, duration) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p.slice(-4), { id, type, title, message, duration }]);
  }, []);

  const remove = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), []);

  const api = {
    success: (title, message, duration) => toast('success', title, message, duration),
    error:   (title, message, duration) => toast('error',   title, message, duration),
    warning: (title, message, duration) => toast('warning', title, message, duration),
    info:    (title, message, duration) => toast('info',    title, message, duration),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast container — top center on mobile, bottom-right on desktop */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 lg:left-auto lg:right-5 lg:translate-x-0 lg:top-auto lg:bottom-6 z-[100] flex flex-col gap-2 pointer-events-none w-[calc(100vw-2rem)] lg:w-auto">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
