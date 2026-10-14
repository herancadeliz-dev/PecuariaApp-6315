import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface FolhaProps {
  aberta: boolean;
  titulo: string;
  subtitulo?: string;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
}

/** Bottom sheet de tela cheia no celular — ações ficam na zona do polegar. */
export function Folha({ aberta, titulo, subtitulo, onFechar, children, rodape }: FolhaProps) {
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [aberta, onFechar]);

  if (!aberta) return null;
  return (
    <dialog open aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-end justify-center border-0 bg-transparent p-0">
      <button aria-label="Fechar" className="absolute inset-0 bg-tinta/70 animate-in fade-in duration-150" onClick={onFechar} />
      <div className="relative flex max-h-[96dvh] w-full max-w-[480px] flex-col rounded-t-[28px] border-x-[3px] border-t-[3px] border-tinta bg-campo animate-in slide-in-from-bottom duration-200">
        <div className="flex items-start gap-3 border-b-[3px] border-tinta px-5 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[30px] font-extrabold uppercase leading-none">{titulo}</h2>
            {subtitulo && <p className="mt-1.5 text-[17px] font-semibold">{subtitulo}</p>}
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="btn-campo grid size-14 shrink-0 place-items-center bg-papel">
            <X className="size-8" strokeWidth={3} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {rodape && <div className="border-t-[3px] border-tinta bg-papel px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">{rodape}</div>}
      </div>
    </dialog>
  );
}
