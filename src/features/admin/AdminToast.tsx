import { AdminToastState } from './types';

interface AdminToastProps {
  toast: AdminToastState | null;
}

export function AdminToast({ toast }: AdminToastProps) {
  if (!toast) return null;

  const dotClassName =
    toast.type === 'error'
      ? 'bg-red-400'
      : toast.type === 'info'
        ? 'bg-blue-400'
        : 'bg-emerald-400';

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-slide-up max-w-[calc(100vw-2rem)]">
      <div className={`w-2.5 h-2.5 rounded-full ${dotClassName}`} />

      <span className="text-xs font-bold">
        {toast.message}
      </span>
    </div>
  );
}