import { useMemo, useState } from "react";
import { Ban, ChevronDown, Loader2, Minus, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { Link } from "wouter";
import { useCampo } from "../hooks/use-campo";
import { calcularIndicadores, type DesempenhoLote, type Situacao } from "../lib/campo/indicadores";
import { formatarData } from "../lib/campo/manejo";
import { Cabecalho } from "../components/curral/cabecalho";
import { fmtGMD } from "../components/curral/folha-pesagem";
import { PainelReproducao } from "../components/gestor/painel-reproducao";

const PERIODOS = [7, 15, 30] as const;
const FINALIDADE = { cria: "Cria", recria: "Recria", engorda: "Engorda" } as const;

const SITUACAO: Record<Situacao, { rotulo: string; cor: string; barra: string }> = {
  acima_meta: { rotulo: "Na meta", cor: "bg-pasto text-white", barra: "bg-pasto" },
  abaixo_meta: { rotulo: "Abaixo da meta", cor: "bg-sol text-tinta", barra: "bg-sol" },
  perdendo: { rotulo: "Perdendo peso", cor: "bg-alerta text-white", barra: "bg-alerta" },
  sem_dados: { rotulo: "Sem pesagem", cor: "bg-campo text-tinta", barra: "bg-tinta/20" },
};

/** TELA 2 — Painel do Gestor: KPIs, carência e desempenho por lote. */
export default function Gestor() {
  const { pronto, versao } = useCampo();
  const [periodo, setPeriodo] = useState<number>(7);
  const [verTodasCarencias, setVerTodasCarencias] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ind = useMemo(() => (pronto ? calcularIndicadores(periodo) : null), [pronto, versao, periodo]);

  return (
    <div className="min-h-dvh bg-campo pb-[100px]">
      <Cabecalho painel="Painel do Gestor" />
      <main className="mx-auto max-w-[480px] space-y-5 px-4 pt-4">
        {!ind ? (
          <div className="flex flex-col items-center gap-3 py-24">
            <Loader2 className="size-12 animate-spin" strokeWidth={3} />
            <p className="text-[20px] font-bold">Calculando indicadores…</p>
          </div>
        ) : (
          <>
            {/* Período */}
            <fieldset className="grid grid-cols-3 gap-2 border-0 p-0" aria-label="Período">
              {PERIODOS.map((d) => (
                <button
                  key={d}
                  onClick={() => setPeriodo(d)}
                  aria-pressed={periodo === d}
                  className={`btn-campo h-[56px] font-display text-[22px] font-extrabold uppercase ${periodo === d ? "bg-tinta text-white" : "bg-papel"}`}
                >
                  {d} dias
                </button>
              ))}
            </fieldset>

            {/* KPIs */}
            <section className="grid grid-cols-2 gap-3" aria-label="Indicadores">
              <div className="cartao-campo col-span-2 flex items-stretch overflow-hidden">
                <div className="flex-1 px-4 py-3">
                  <p className="rotulo">Total de cabeças</p>
                  <p className="font-display text-[72px] font-extrabold leading-[0.9] tabular-nums">{ind.totalCabecas}</p>
                  <p className="text-[15px] font-bold">
                    {ind.machos} machos · {ind.femeas} fêmeas
                  </p>
                </div>
                <div className="flex w-[132px] flex-col justify-center gap-1 border-l-[3px] border-tinta bg-campo px-3 text-[15px] font-bold">
                  {(Object.keys(FINALIDADE) as (keyof typeof FINALIDADE)[]).map((f) => (
                    <p key={f} className="flex justify-between tabular-nums">
                      <span>{FINALIDADE[f]}</span>
                      <span>{ind.porFinalidade[f]}</span>
                    </p>
                  ))}
                </div>
              </div>

              <KpiGMD gmd={ind.gmdMedio} anterior={ind.gmdMedioAnterior} periodo={periodo} pesados={ind.animaisPesados} />

              <a
                href="#carencia"
                className={`col-span-1 rounded-2xl border-[3px] border-tinta px-4 py-3 shadow-duro ${ind.carencia.length ? "bg-alerta text-white" : "bg-ok-claro"}`}
              >
                <p className="rotulo flex items-center gap-1.5">
                  <Ban className="size-4" strokeWidth={3} /> Em carência
                </p>
                <p className="font-display text-[56px] font-extrabold leading-none tabular-nums">{ind.carencia.length}</p>
                <p className="text-[14px] font-bold leading-tight">{ind.carencia.length ? "impedidos de abate" : "todos liberados"}</p>
              </a>
            </section>

            {ind.semPesagem30d > 0 && (
              <p className="flex items-center gap-3 rounded-2xl border-[3px] border-tinta bg-sol-2 px-4 py-3 text-[17px] font-bold">
                <TriangleAlert className="size-7 shrink-0" strokeWidth={2.75} />
                {ind.semPesagem30d} animais sem pesagem há mais de 30 dias
              </p>
            )}

            {/* Desempenho por lote */}
            <section aria-label="Desempenho por lote">
              <div className="mb-2 flex items-end justify-between">
                <h2 className="font-display text-[28px] font-extrabold uppercase leading-none">Desempenho por lote</h2>
                <span className="rotulo">GMD × meta</span>
              </div>
              <GraficoLotes lotes={ind.lotes} />
              <div className="mt-3 space-y-3">
                {ind.lotes.map((d) => (
                  <CartaoLote key={d.lote.id} d={d} />
                ))}
              </div>
            </section>

            <PainelReproducao versao={versao} />

            {/* Carência */}
            <section id="carencia" aria-label="Animais em carência" className="scroll-mt-24">
              <h2 className="mb-2 font-display text-[28px] font-extrabold uppercase leading-none">Carência sanitária</h2>
              {ind.carencia.length === 0 ? (
                <p className="cartao-campo px-4 py-5 text-[18px] font-bold">Nenhum animal bloqueado para abate.</p>
              ) : (
                <div className="cartao-campo overflow-hidden">
                  <div className="grid grid-cols-[72px_1fr_auto] gap-2 border-b-[3px] border-tinta bg-alerta px-4 py-2 text-white">
                    <span className="rotulo">Brinco</span>
                    <span className="rotulo">Produto · lote</span>
                    <span className="rotulo">Libera</span>
                  </div>
                  <ul>
                    {(verTodasCarencias ? ind.carencia : ind.carencia.slice(0, 6)).map((c, i) => (
                      <li key={c.animal.id} className={`grid grid-cols-[72px_1fr_auto] items-center gap-2 px-4 py-2.5 ${i ? "border-t-2 border-tinta/15" : ""}`}>
                        <span className="font-display text-[28px] font-extrabold tabular-nums">{c.animal.brinco_visual}</span>
                        <span className="min-w-0 leading-tight">
                          <span className="block truncate text-[16px] font-bold">{c.produto}</span>
                          <span className="block truncate text-[14px] font-semibold">{c.lote?.nome ?? "Sem lote"}</span>
                        </span>
                        <span className="text-right leading-tight">
                          <span className="block text-[16px] font-bold tabular-nums">{formatarData(c.liberadoEm).slice(0, 5)}</span>
                          <span className={`inline-block rounded-md px-1.5 text-[13px] font-bold tabular-nums ${c.diasRestantes <= 3 ? "bg-sol" : "bg-alerta-claro text-alerta"}`}>
                            {c.diasRestantes === 0 ? "hoje" : `${c.diasRestantes} d`}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {ind.carencia.length > 6 && (
                    <button
                      onClick={() => setVerTodasCarencias((v) => !v)}
                      className="flex h-[60px] w-full items-center justify-center gap-2 border-t-[3px] border-tinta bg-campo text-[18px] font-bold"
                    >
                      {verTodasCarencias ? "Mostrar menos" : `Ver todos (${ind.carencia.length})`}
                      <ChevronDown className={`size-6 ${verTodasCarencias ? "rotate-180" : ""}`} strokeWidth={3} />
                    </button>
                  )}
                </div>
              )}
            </section>

            <p className="pb-2 text-center text-[14px] font-semibold">
              Calculado com os dados deste aparelho · {ind.pesagensPeriodo} pesagens no período.{" "}
              <Link to="/" className="underline decoration-2 underline-offset-2">
                Ir para o curral
              </Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function KpiGMD({ gmd, anterior, periodo, pesados }: { gmd: number | null; anterior: number | null; periodo: number; pesados: number }) {
  const delta = gmd !== null && anterior !== null ? gmd - anterior : null;
  const Icone = delta === null || Math.abs(delta) < 0.01 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  return (
    <div className="cartao-campo px-4 py-3">
      <p className="rotulo">GMD médio · {periodo}d</p>
      <p className="font-display text-[48px] font-extrabold leading-none tabular-nums">{gmd !== null ? fmtGMD(gmd) : "—"}</p>
      <p className="text-[14px] font-bold">kg/dia · {pesados} pesados</p>
      {delta !== null && (
        <p className={`mt-1 inline-flex items-center gap-1 rounded-md px-1.5 text-[14px] font-bold tabular-nums ${delta >= 0 ? "bg-ok-claro" : "bg-alerta-claro text-alerta"}`}>
          <Icone className="size-4" strokeWidth={3} />
          {fmtGMD(Math.round(delta * 1000) / 1000)} vs período anterior
        </p>
      )}
    </div>
  );
}

/** Barras horizontais: GMD real vs marcador da meta. Escala comum entre lotes. */
function GraficoLotes({ lotes }: { lotes: DesempenhoLote[] }) {
  const max = Math.max(0.2, ...lotes.flatMap((d) => [d.gmdMedio ?? 0, d.lote.gmd_meta])) * 1.15;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <figure className="cartao-campo m-0 space-y-3 px-4 py-4" aria-label="Gráfico de GMD por lote comparado com a meta">
      {lotes.map((d) => (
        <div key={d.lote.id}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-bold">{d.lote.nome}</span>
            <span className="shrink-0 font-display text-[20px] font-extrabold tabular-nums">{d.gmdMedio !== null ? fmtGMD(d.gmdMedio) : "—"}</span>
          </div>
          <div className="relative h-7 rounded-md border-[3px] border-tinta bg-campo">
            <div className={`h-full rounded-[3px] ${SITUACAO[d.situacao].barra}`} style={{ width: pct(d.gmdMedio ?? 0) }} />
            <div className="absolute -bottom-1 -top-1 w-[4px] bg-tinta" style={{ left: pct(d.lote.gmd_meta) }} title={`Meta ${d.lote.gmd_meta}`} />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[13px] font-bold">
        <span className="flex items-center gap-1.5"><span className="h-4 w-1 bg-tinta" /> Meta</span>
        <span className="flex items-center gap-1.5"><span className="size-3.5 rounded-sm border-2 border-tinta bg-pasto" /> Na meta</span>
        <span className="flex items-center gap-1.5"><span className="size-3.5 rounded-sm border-2 border-tinta bg-sol" /> Abaixo</span>
        <span className="flex items-center gap-1.5"><span className="size-3.5 rounded-sm border-2 border-tinta bg-alerta" /> Perdendo</span>
      </div>
    </figure>
  );
}

function CartaoLote({ d }: { d: DesempenhoLote }) {
  const [aberto, setAberto] = useState(false);
  const s = SITUACAO[d.situacao];
  return (
    <div className="cartao-campo overflow-hidden">
      <button onClick={() => setAberto((v) => !v)} aria-expanded={aberto} aria-label={`Detalhes do lote ${d.lote.nome}`} className="flex w-full items-stretch text-left">
        <div className="min-w-0 flex-1 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-mata px-2 py-0.5 text-[12px] font-bold uppercase text-white">{FINALIDADE[d.lote.finalidade]}</span>
            <span className={`rounded-md border-2 border-tinta px-2 py-0.5 text-[12px] font-bold uppercase ${s.cor}`}>{s.rotulo}</span>
          </div>
          <p className="mt-1.5 line-clamp-2 font-display text-[24px] font-extrabold uppercase leading-none">{d.lote.nome}</p>
          <p className="mt-1 text-[15px] font-bold tabular-nums">
            {d.totalAnimais} cab · peso médio {d.pesoMedio !== null ? `${d.pesoMedio.toLocaleString("pt-BR")} kg` : "—"}
          </p>
        </div>
        <div className={`flex w-[112px] shrink-0 flex-col items-center justify-center border-l-[3px] border-tinta px-2 text-center ${s.cor}`}>
          <span className="font-display text-[30px] font-extrabold leading-none tabular-nums">{d.pctMeta !== null ? `${Math.round(d.pctMeta * 100)}%` : "—"}</span>
          <span className="text-[12px] font-bold uppercase">da meta</span>
          <span className="mt-1 text-[13px] font-bold tabular-nums">meta {d.lote.gmd_meta.toLocaleString("pt-BR")}</span>
        </div>
      </button>
      {aberto && (
        <div className="border-t-[3px] border-tinta bg-campo px-4 py-3">
          <p className="text-[16px] font-bold">
            {d.pesagensPeriodo} pesagens no período · {d.animaisAbaixoMeta} animais abaixo da meta
            {d.diferenca !== null && ` · ${fmtGMD(d.diferenca)} kg/dia vs meta`}
          </p>
          {d.piores.length > 0 && (
            <>
              <p className="rotulo mb-1 mt-3">Menor ganho no lote</p>
              <div className="flex flex-wrap gap-2">
                {d.piores.map(({ animal, gmd }) => (
                  <span key={animal.id} className={`rounded-lg border-2 border-tinta px-2.5 py-1 text-[15px] font-bold tabular-nums ${gmd < 0 ? "bg-alerta text-white" : gmd < d.lote.gmd_meta ? "bg-sol" : "bg-papel"}`}>
                    {animal.brinco_visual} · {fmtGMD(gmd)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
