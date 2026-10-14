import { useEffect, useMemo, useState } from "react";
import { Delete, Scale, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { calcularGMD, diasEntre, formatarData, hojeISO, pesagemAnterior, pesagensDoAnimal, registrarPesagem } from "../../lib/campo/manejo";
import type { Animal, Lote } from "../../lib/campo/types";
import { Folha } from "./folha";
import { useAviso } from "./aviso";

interface Props {
  animal: Animal;
  lote?: Lote;
  aberta: boolean;
  onFechar: () => void;
}

const kg = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
export const fmtGMD = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;

/** Teclado numérico próprio: teclas de 72px, funciona com luva e não depende do teclado do sistema. */
export function FolhaPesagem({ animal, lote, aberta, onFechar }: Props) {
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const aviso = useAviso();
  const hoje = hojeISO();

  useEffect(() => {
    if (aberta) setValor("");
  }, [aberta]);

  const anterior = useMemo(() => (aberta ? pesagemAnterior(animal.id, hoje) : undefined), [aberta, animal.id, hoje]);
  const doDia = useMemo(() => (aberta ? pesagensDoAnimal(animal.id).find((p) => p.data_pesagem === hoje) : undefined), [aberta, animal.id, hoje]);

  const peso = valor ? Number(valor.replace(",", ".")) : 0;
  const valido = peso >= 20 && peso <= 1500;
  const gmd = valido ? calcularGMD(peso, anterior, hoje) : null;
  const dias = anterior ? diasEntre(anterior.data_pesagem, hoje) : 0;
  const variacao = anterior && valido ? peso - anterior.peso : null;
  const suspeito = anterior && valido && Math.abs(peso - anterior.peso) / anterior.peso > 0.25;
  const meta = lote?.gmd_meta ?? null;

  function tecla(t: string) {
    navigator.vibrate?.(12);
    setValor((v) => {
      if (t === "⌫") return v.slice(0, -1);
      if (t === ",") return v.includes(",") || !v ? v : v + ",";
      const [int, dec] = v.split(",");
      if (dec !== undefined) return dec.length >= 1 ? v : v + t; // 1 casa decimal (balança: 0,5 kg)
      if (int.length >= 4) return v;
      if (v === "0") return t;
      return v + t;
    });
  }

  // Teclado físico / leitor de balança via HID também funciona
  useEffect(() => {
    if (!aberta) return;
    const h = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) tecla(e.key);
      else if (e.key === "," || e.key === ".") tecla(",");
      else if (e.key === "Backspace") tecla("⌫");
      else if (e.key === "Enter" && valido) void salvar();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  async function salvar() {
    if (!valido || salvando) return;
    setSalvando(true);
    try {
      const r = await registrarPesagem(animal, peso, hoje);
      aviso(
        `${kg(peso)} kg salvo`,
        r.gmd !== null ? `GMD ${fmtGMD(r.gmd)} kg/dia · brinco ${animal.brinco_visual}` : `Primeira pesagem · brinco ${animal.brinco_visual}`,
      );
      onFechar();
    } catch (e) {
      aviso("Não salvou", String(e), "erro");
    } finally {
      setSalvando(false);
    }
  }

  const corGMD =
    gmd === null ? "bg-papel" : gmd < 0 ? "bg-alerta text-white" : meta !== null && gmd < meta ? "bg-sol" : "bg-pasto text-white";

  return (
    <Folha
      aberta={aberta}
      onFechar={onFechar}
      titulo="Nova pesagem"
      subtitulo={`Brinco ${animal.brinco_visual} · ${lote?.nome ?? "sem lote"}`}
      rodape={
        <button
          onClick={() => void salvar()}
          disabled={!valido || salvando}
          className="btn-campo flex h-[84px] w-full items-center justify-center gap-3 bg-pasto font-display text-[30px] font-extrabold uppercase text-white"
        >
          <Scale className="size-9" strokeWidth={2.75} />
          {salvando ? "Salvando…" : valido ? `Salvar ${kg(peso)} kg` : "Digite o peso"}
        </button>
      }
    >
      {/* Visor */}
      <div className="cartao-campo flex items-end justify-between gap-2 px-4 py-3" aria-live="polite">
        <span className="rotulo pb-2">Peso</span>
        <span className="flex items-baseline gap-1.5">
          <span className={`font-display text-[72px] font-extrabold leading-none tabular-nums ${valor ? "" : "text-tinta/30"}`}>{valor || "0"}</span>
          <span className="font-display text-[32px] font-bold">kg</span>
        </span>
      </div>

      {/* GMD automático */}
      <div className="mt-3 grid grid-cols-[1.3fr_1fr] gap-3">
        <div className={`rounded-2xl border-[3px] border-tinta px-4 py-3 shadow-duro ${corGMD}`}>
          <p className="rotulo flex items-center gap-1.5">
            {gmd !== null && (gmd >= 0 ? <TrendingUp className="size-4" strokeWidth={3} /> : <TrendingDown className="size-4" strokeWidth={3} />)}
            GMD calculado
          </p>
          <p className="font-display text-[40px] font-extrabold leading-none tabular-nums">
            {gmd !== null ? fmtGMD(gmd) : "—"}
            <span className="ml-1 text-[18px] font-bold">kg/dia</span>
          </p>
          {meta !== null && <p className="mt-1 text-[14px] font-bold">Meta do lote: {fmtGMD(meta)}</p>}
        </div>
        <div className="cartao-campo px-3 py-3">
          <p className="rotulo">Anterior</p>
          {anterior ? (
            <>
              <p className="font-display text-[28px] font-extrabold leading-none tabular-nums">{kg(anterior.peso)} kg</p>
              <p className="mt-1 text-[14px] font-bold tabular-nums">
                {formatarData(anterior.data_pesagem)} · {dias} dias
              </p>
              {variacao !== null && (
                <p className="text-[15px] font-bold tabular-nums">
                  {variacao >= 0 ? "+" : ""}
                  {kg(variacao)} kg
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-[16px] font-bold leading-tight">Primeira pesagem — sem GMD</p>
          )}
        </div>
      </div>

      {suspeito && (
        <p className="mt-3 flex items-center gap-2 rounded-2xl border-[3px] border-tinta bg-sol px-4 py-3 text-[17px] font-bold">
          <TriangleAlert className="size-7 shrink-0" strokeWidth={2.75} />
          Diferença acima de 25%. Confira a balança.
        </p>
      )}
      {doDia && (
        <p className="mt-3 rounded-2xl border-[3px] border-tinta bg-papel px-4 py-3 text-[16px] font-bold">
          Já pesado hoje ({kg(doDia.peso)} kg). Salvar vai corrigir a pesagem do dia.
        </p>
      )}

      {/* Teclado */}
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"].map((t) => (
          <button
            key={t}
            onClick={() => tecla(t)}
            onContextMenu={(e) => {
              if (t === "⌫") {
                e.preventDefault();
                setValor("");
              }
            }}
            aria-label={t === "⌫" ? "Apagar" : t === "," ? "Vírgula" : t}
            className={`btn-campo grid h-[72px] place-items-center font-display text-[40px] font-extrabold ${t === "⌫" ? "bg-tinta text-white" : t === "," ? "bg-sol-2" : "bg-papel"}`}
          >
            {t === "⌫" ? <Delete className="size-9" strokeWidth={2.5} /> : t}
          </button>
        ))}
      </div>
    </Folha>
  );
}
