import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Syringe } from "lucide-react";
import { formatarData, hojeISO, PRODUTOS_RAPIDOS, registrarSanitario, somarDias } from "../../lib/campo/manejo";
import type { Animal } from "../../lib/campo/types";
import { Folha } from "./folha";
import { useAviso } from "./aviso";

interface Props {
  animal: Animal;
  aberta: boolean;
  onFechar: () => void;
}

export function FolhaSanitario({ animal, aberta, onFechar }: Props) {
  const [produto, setProduto] = useState<string>("");
  const [outro, setOutro] = useState(false);
  const [carencia, setCarencia] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const aviso = useAviso();
  const campoOutro = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (outro) campoOutro.current?.focus();
  }, [outro]);

  useEffect(() => {
    if (aberta) {
      setProduto("");
      setOutro(false);
      setCarencia(0);
    }
  }, [aberta]);

  const hoje = hojeISO();
  const liberaEm = carencia > 0 ? somarDias(hoje, carencia) : null;
  const pronto = produto.trim().length >= 2;

  async function salvar() {
    if (!pronto || salvando) return;
    setSalvando(true);
    try {
      await registrarSanitario(animal, { produto: produto.trim(), carenciaDias: carencia });
      aviso("Aplicação salva", liberaEm ? `Brinco ${animal.brinco_visual} · abate liberado em ${formatarData(liberaEm)}` : `Brinco ${animal.brinco_visual} · sem carência`);
      onFechar();
    } catch (e) {
      aviso("Não salvou", String(e), "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Folha
      aberta={aberta}
      onFechar={onFechar}
      titulo="Vacina / Medicamento"
      subtitulo={`Brinco ${animal.brinco_visual} · aplicação hoje, ${formatarData(hoje)}`}
      rodape={
        <button
          onClick={() => void salvar()}
          disabled={!pronto || salvando}
          className="btn-campo flex h-[84px] w-full items-center justify-center gap-3 bg-pasto font-display text-[28px] font-extrabold uppercase text-white"
        >
          <Syringe className="size-9" strokeWidth={2.75} />
          {salvando ? "Salvando…" : pronto ? "Confirmar aplicação" : "Escolha o produto"}
        </button>
      }
    >
      <p className="rotulo mb-2">Produto</p>
      <div className="grid grid-cols-2 gap-2.5">
        {PRODUTOS_RAPIDOS.map((p) => {
          const ativo = !outro && produto === p.nome;
          return (
            <button
              key={p.nome}
              onClick={() => {
                navigator.vibrate?.(15);
                setOutro(false);
                setProduto(p.nome);
                setCarencia(p.carencia);
              }}
              aria-pressed={ativo}
              className={`btn-campo min-h-[88px] px-3 py-2 text-left ${ativo ? "bg-mata text-white" : "bg-papel"}`}
            >
              <span className={`block text-[13px] font-bold uppercase ${ativo ? "text-sol" : ""}`}>{p.tipo}</span>
              <span className="block text-[18px] font-bold leading-tight">{p.nome}</span>
              <span className="block text-[14px] font-bold tabular-nums">{p.carencia ? `Carência ${p.carencia} d` : "Sem carência"}</span>
            </button>
          );
        })}
        <button
          onClick={() => {
            setOutro(true);
            setProduto("");
          }}
          aria-pressed={outro}
          className={`btn-campo col-span-2 h-[68px] font-display text-[22px] font-extrabold uppercase ${outro ? "bg-mata text-white" : "bg-sol-2"}`}
        >
          Outro produto
        </button>
      </div>

      {outro && (
        <input
          ref={campoOutro}
          aria-label="Nome do produto"
          value={produto}
          onChange={(e) => setProduto(e.target.value)}
          placeholder="Nome do produto"
          className="mt-3 h-[72px] w-full rounded-2xl border-[3px] border-tinta bg-papel px-4 text-[24px] font-bold shadow-duro outline-none placeholder:text-tinta/45 focus:outline-4 focus:outline-sol"
        />
      )}

      <p className="rotulo mb-2 mt-5">Carência para abate (dias) — confira a bula</p>
      <div className="flex items-stretch gap-2.5">
        <button onClick={() => setCarencia((c) => Math.max(0, c - 1))} aria-label="Menos um dia" className="btn-campo grid h-[80px] w-[80px] place-items-center bg-papel">
          <Minus className="size-10" strokeWidth={3} />
        </button>
        <div className="cartao-campo flex flex-1 items-center justify-center">
          <span className="font-display text-[56px] font-extrabold tabular-nums leading-none">{carencia}</span>
          <span className="ml-1.5 font-display text-[24px] font-bold">dias</span>
        </div>
        <button onClick={() => setCarencia((c) => Math.min(365, c + 1))} aria-label="Mais um dia" className="btn-campo grid h-[80px] w-[80px] place-items-center bg-papel">
          <Plus className="size-10" strokeWidth={3} />
        </button>
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-2">
        {[0, 21, 28, 35].map((d) => (
          <button key={d} onClick={() => setCarencia(d)} className={`btn-campo h-[56px] font-display text-[22px] font-extrabold ${carencia === d ? "bg-tinta text-white" : "bg-papel"}`}>
            {d}
          </button>
        ))}
      </div>

      <div className={`mt-4 rounded-2xl border-[3px] border-tinta px-4 py-3 text-[18px] font-bold ${liberaEm ? "bg-alerta text-white" : "bg-ok-claro"}`}>
        {liberaEm ? (
          <>
            Bloqueado para abate até <span className="font-display text-[26px] font-extrabold">{formatarData(liberaEm)}</span>
          </>
        ) : (
          "Não bloqueia abate"
        )}
      </div>
    </Folha>
  );
}
