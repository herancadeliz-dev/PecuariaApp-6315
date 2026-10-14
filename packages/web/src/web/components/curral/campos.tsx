import type { ReactNode } from "react";
import { formatarData, hojeISO, somarDias } from "../../lib/campo/manejo";

const INPUT =
  "h-[64px] w-full rounded-xl border-[3px] border-tinta bg-papel px-4 text-[20px] font-bold outline-none placeholder:text-tinta/40 focus:outline-4 focus:outline-sol";
export const classeInput = INPUT;

/** Data com atalhos grandes (Hoje / Ontem) + calendário nativo. */
export function CampoData({ valor, onChange, rotulo = "Data", passado = true }: { valor: string; onChange: (v: string) => void; rotulo?: string; passado?: boolean }) {
  const hoje = hojeISO();
  const ontem = somarDias(hoje, -1);
  return (
    <div>
      <p className="rotulo mb-2">{rotulo}</p>
      <div className="grid grid-cols-[1fr_1fr_1.3fr] gap-2">
        {[
          [hoje, "Hoje"],
          [ontem, "Ontem"],
        ].map(([d, r]) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            aria-pressed={valor === d}
            className={`btn-campo h-[60px] font-display text-[22px] font-extrabold uppercase ${valor === d ? "bg-tinta text-white" : "bg-papel"}`}
          >
            {r}
          </button>
        ))}
        <input
          type="date"
          aria-label={rotulo}
          value={valor}
          max={passado ? hoje : undefined}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className={`h-[60px] rounded-2xl border-[3px] border-tinta px-2 text-[17px] font-bold shadow-duro outline-none ${valor !== hoje && valor !== ontem ? "bg-tinta text-white" : "bg-papel"}`}
        />
      </div>
      {valor !== hoje && valor !== ontem && <p className="mt-1.5 text-[15px] font-bold">{formatarData(valor)}</p>}
    </div>
  );
}

export function CampoTexto({
  rotulo,
  valor,
  onChange,
  placeholder,
  tipo = "text",
  modo,
  ajuda,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tipo?: string;
  modo?: "numeric" | "decimal" | "text";
  ajuda?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="rotulo mb-2 block">{rotulo}</span>
      <input type={tipo} inputMode={modo} aria-label={rotulo} value={valor} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={INPUT} />
      {ajuda && <span className="mt-1 block text-[14px] font-semibold">{ajuda}</span>}
    </label>
  );
}

/** Grupo de botões grandes de escolha única. */
export function Opcoes<T extends string>({
  rotulo,
  valor,
  opcoes,
  onChange,
  colunas = 2,
}: {
  rotulo: string;
  valor: T | null;
  opcoes: { valor: T; rotulo: string; ajuda?: string }[];
  onChange: (v: T) => void;
  colunas?: 2 | 3 | 4;
}) {
  const grid = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[colunas];
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="rotulo mb-2">{rotulo}</legend>
      <div className={`grid gap-2 ${grid}`}>
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => onChange(o.valor)}
            aria-pressed={valor === o.valor}
            className={`btn-campo min-h-[64px] px-2 py-1.5 ${valor === o.valor ? "bg-mata text-white" : "bg-papel"}`}
          >
            <span className="block font-display text-[22px] font-extrabold uppercase leading-none">{o.rotulo}</span>
            {o.ajuda && <span className={`mt-0.5 block text-[12px] font-bold leading-tight ${valor === o.valor ? "text-sol" : ""}`}>{o.ajuda}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Selecao({ rotulo, valor, onChange, opcoes, vazio = "— nenhum —" }: { rotulo: string; valor: string; onChange: (v: string) => void; opcoes: { valor: string; rotulo: string }[]; vazio?: string }) {
  return (
    <label className="block">
      <span className="rotulo mb-2 block">{rotulo}</span>
      <select aria-label={rotulo} value={valor} onChange={(e) => onChange(e.target.value)} className={`${INPUT} appearance-none bg-[length:24px] bg-[right_12px_center] bg-no-repeat pr-10`}>
        <option value="">{vazio}</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}
