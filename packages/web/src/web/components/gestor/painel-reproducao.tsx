import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatarData } from "../../lib/campo/manejo";
import { calcularReproducao, type PartoPrevisto } from "../../lib/campo/reproducao";

const JANELAS = [30, 60, 90] as const;

/** Bloco de reprodução do Painel do Gestor: taxa de prenhez, vazias e partos previstos. */
export function PainelReproducao({ versao }: { versao: number }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const r = useMemo(() => calcularReproducao(), [versao]);
  const [janela, setJanela] = useState<number>(60);
  const [verTodos, setVerTodos] = useState(false);

  if (!r.matrizes) return null;
  const naJanela = r.previstos.filter((p) => p.dias <= janela);
  const lista = [...r.atrasados, ...naJanela];
  const visiveis = verTodos ? lista : lista.slice(0, 6);
  const contagem = { 30: r.partos30, 60: r.partos60, 90: r.partos90 } as Record<number, number>;

  return (
    <section aria-label="Reprodução" className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-[28px] font-extrabold uppercase leading-none">Reprodução</h2>
        <span className="rotulo">{r.matrizes} matrizes</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="cartao-campo px-4 py-3">
          <p className="rotulo">Taxa de prenhez · 12m</p>
          <p className="font-display text-[52px] font-extrabold leading-none tabular-nums">
            {r.taxaPrenhez !== null ? `${Math.round(r.taxaPrenhez * 100)}%` : "—"}
          </p>
          <p className="text-[14px] font-bold">{r.diagnosticadas} coberturas diagnosticadas</p>
        </div>
        <div className="cartao-campo grid grid-rows-3 divide-y-2 divide-tinta/15 px-4 py-1 text-[16px] font-bold">
          <p className="flex items-center justify-between">
            <span>Prenhes</span>
            <span className="rounded-md bg-pasto px-2 font-display text-[22px] text-white tabular-nums">{r.prenhes}</span>
          </p>
          <p className="flex items-center justify-between">
            <span>Aguard. toque</span>
            <span className="rounded-md bg-sol px-2 font-display text-[22px] tabular-nums">{r.aguardandoDG}</span>
          </p>
          <p className="flex items-center justify-between">
            <span>Vazias</span>
            <span className="rounded-md bg-alerta px-2 font-display text-[22px] text-white tabular-nums">{r.vazias}</span>
          </p>
        </div>
      </div>

      <div className="cartao-campo overflow-hidden">
        <div className="border-b-[3px] border-tinta bg-mata px-4 py-3 text-white">
          <p className="rotulo text-sol">Partos previstos</p>
          <fieldset className="mt-2 grid grid-cols-3 gap-2 border-0 p-0" aria-label="Janela de partos">
            {JANELAS.map((d) => (
              <button
                key={d}
                onClick={() => setJanela(d)}
                aria-pressed={janela === d}
                className={`btn-campo h-[64px] leading-none ${janela === d ? "bg-sol text-tinta" : "bg-papel text-tinta"}`}
              >
                <span className="block font-display text-[30px] font-extrabold tabular-nums">{contagem[d]}</span>
                <span className="block text-[13px] font-bold uppercase">até {d} dias</span>
              </button>
            ))}
          </fieldset>
        </div>
        {lista.length === 0 ? (
          <p className="px-4 py-4 text-[17px] font-bold">Nenhum parto previsto nos próximos {janela} dias.</p>
        ) : (
          <ul>
            {visiveis.map((p, i) => (
              <LinhaParto key={p.cobertura.id} p={p} primeira={i === 0} />
            ))}
          </ul>
        )}
        {lista.length > 6 && (
          <button onClick={() => setVerTodos((v) => !v)} className="flex h-[60px] w-full items-center justify-center gap-2 border-t-[3px] border-tinta bg-campo text-[18px] font-bold">
            {verTodos ? "Mostrar menos" : `Ver todos (${lista.length})`}
            <ChevronDown className={`size-6 ${verTodos ? "rotate-180" : ""}`} strokeWidth={3} />
          </button>
        )}
      </div>
      {r.nascidos12m > 0 && <p className="text-[15px] font-bold">{r.nascidos12m} bezerros nascidos vivos nos últimos 12 meses.</p>}
    </section>
  );
}

function LinhaParto({ p, primeira }: { p: PartoPrevisto; primeira: boolean }) {
  const cor = p.dias < 0 ? "bg-alerta text-white" : p.dias <= 15 ? "bg-sol" : "bg-ok-claro";
  return (
    <li className={`grid grid-cols-[72px_1fr_auto] items-center gap-2 px-4 py-2.5 ${primeira ? "" : "border-t-2 border-tinta/15"}`}>
      <span className="font-display text-[28px] font-extrabold tabular-nums">{p.matriz.brinco_visual}</span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[16px] font-bold">{p.touro?.nome ?? "Touro não informado"}</span>
        <span className="block text-[14px] font-semibold">
          {p.cobertura.tipo} · {formatarData(p.cobertura.data_cobertura)}
        </span>
      </span>
      <span className="text-right leading-tight">
        <span className="block text-[16px] font-bold tabular-nums">{formatarData(p.cobertura.previsao_parto!).slice(0, 5)}</span>
        <span className={`inline-block rounded-md px-1.5 text-[13px] font-bold tabular-nums ${cor}`}>
          {p.dias < 0 ? `atraso ${-p.dias} d` : p.dias === 0 ? "hoje" : `${p.dias} d`}
        </span>
      </span>
    </li>
  );
}
