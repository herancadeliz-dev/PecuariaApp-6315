import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";

type Tipo = "ok" | "erro";
interface Aviso { id: number; texto: string; detalhe?: string; tipo: Tipo }

const Ctx = createContext<(texto: string, detalhe?: string, tipo?: Tipo) => void>(() => {});
export const useAviso = () => useContext(Ctx);

/** Toast grande no topo: confirmação visível mesmo no sol. */
export function AvisoProvider({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mostrar = useCallback((texto: string, detalhe?: string, tipo: Tipo = "ok") => {
    clearTimeout(timer.current);
    setAviso({ id: Date.now(), texto, detalhe, tipo });
    navigator.vibrate?.(tipo === "ok" ? 40 : [60, 40, 60]);
    timer.current = setTimeout(() => setAviso(null), 2800);
  }, []);

  return (
    <Ctx.Provider value={mostrar}>
      {children}
      {aviso && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[max(12px,env(safe-area-inset-top))]">
          <output
            key={aviso.id}
            className={`pointer-events-auto relative flex w-full max-w-[460px] items-center gap-3 rounded-2xl border-[3px] border-tinta px-4 py-3.5 shadow-duro animate-in slide-in-from-top duration-200 ${
              aviso.tipo === "ok" ? "bg-pasto text-white" : "bg-alerta text-white"
            }`}
          >
            {aviso.tipo === "ok" ? <CheckCircle2 className="size-9 shrink-0" strokeWidth={2.5} /> : <CircleAlert className="size-9 shrink-0" strokeWidth={2.5} />}
            <div className="min-w-0">
              <p className="font-display text-[24px] font-extrabold uppercase leading-tight">{aviso.texto}</p>
              {aviso.detalhe && <p className="text-[16px] font-semibold leading-snug">{aviso.detalhe}</p>}
            </div>
            <button onClick={() => setAviso(null)} aria-label="Fechar aviso" className="absolute inset-0" />
          </output>
        </div>
      )}
    </Ctx.Provider>
  );
}
