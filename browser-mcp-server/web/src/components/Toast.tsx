import { useState, useCallback, createContext, useContext, type ReactNode } from "react";

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

interface ToastCtx {
  toast: (type: Toast["type"], message: string) => void;
}

const Ctx = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = ++nextId;
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const colors = {
    success: "bg-green-900/80 border-green-700 text-green-300",
    error: "bg-red-900/80 border-red-700 text-red-300",
    info: "bg-blue-900/80 border-blue-700 text-blue-300",
  };

  return (
    <Ctx.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-lg border text-sm shadow-lg backdrop-blur-sm animate-slide-up ${colors[t.type]}`}
          >
            <div className="flex items-center gap-2">
              <span>{t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}</span>
              <span>{t.message}</span>
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
