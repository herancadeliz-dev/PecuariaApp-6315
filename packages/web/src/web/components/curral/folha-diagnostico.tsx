import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import { formatarData, hojeISO } from "../../lib/campo/manejo";
import { diagnosticosDaCobertura, registrarDiagnostico, situacaoReprodutiva } from "../../lib/campo/reproducao";
import type { Animal } from "../../lib/campo/types";
import { Folha } from "./folha";
import { useAviso } from "./aviso";
import { CampoData, Opcoes } from "./campos";

interface Props {
  animal: Animal;
  aberta: boolean;
  versao: number;
  onFechar: () => void;
}

/** Diagnóstico de gestação (toque/ultrassom). Pode repetir: vale o mais recente. */
export function FolhaDiagnostico({ animal, aberta, versao, onFechar }: Props) {
  const [resultado, setResultado] = useState<"prenhe" | "vazia" | null>(null);
  const [metodo, setMetodo] = useState<"toque" | "ultrassom">("toque");
  const [dias, setDias] = useState<number | null>(null);
  const [data, setData] = useState(hojeISO());
  const [salvando, setSalvando] = useState(false);
  const aviso = useAviso();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sit = useMemo(() => situacaoReprodutiva(animal), [animal, versao]);
  const anteriores = useMemo(
    () => (sit.cobertura ? diagnosticosDaCobertura(sit.cobertura.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sit.cobertura?.id, versao],
  );
  const coberturaAberta = sit.cobertura && ["aguardando", "prenhe", "vazia"].includes(sit.cobertura.status) ? sit.cobertura : undefined;

  useEffect(() => {
    if (!aberta) return;
    setResultado(null);
    setData(hojeISO());
    // Sugere a idade gestacional pelos dias desde a cobertura
    setDias(coberturaAberta ? Math.min(300, Math.max(20, sit.diasDesdeCobertura ?? 0)) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  async function salvar() {
    if (!resultado || salvando) return;
    setSalvando(true);
    try {
      const r = await registrarDiagnostico(animal, { resultado, metodo, diasGestacao: resultado === "prenhe" ? dias : null, data });
      aviso(
        resultado === "prenhe" ? "Prenhe!" : "Vazia",
        resultado === "prenhe" && r.cobertura?.previsao_parto ? `Vaca ${animal.brinco_visual} · parto previsto ${formatarData(r.cobertura.previsao_parto)}` : `Vaca ${animal.brinco_visual} · liberada para nova cobertura`,
      );
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
      titulo="Diagnóstico (toque)"
      subtitulo={
        coberturaAberta
          ? `Vaca ${animal.brinco_visual} · ${coberturaAberta.tipo} em ${formatarData(coberturaAberta.data_cobertura)} (${sit.diasDesdeCobertura} d)${sit.touro ? ` · ${sit.touro.nome}` : ""}`
          : `Vaca ${animal.brinco_visual} · sem cobertura registrada`
      }
      rodape={
        <button
          onClick={() => void salvar()}
          disabled={!resultado || salvando}
          className="btn-campo flex h-[84px] w-full items-center justify-center gap-3 bg-sol font-display text-[28px] font-extrabold uppercase"
        >
          <Check className="size-9" strokeWidth={3} />
          {salvando ? "Salvando…" : resultado ? "Confirmar diagnóstico" : "Prenhe ou vazia?"}
        </button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setResultado("prenhe")}
            aria-pressed={resultado === "prenhe"}
            className={`btn-campo flex h-[120px] flex-col items-center justify-center gap-1 ${resultado === "prenhe" ? "bg-pasto text-white" : "bg-papel"}`}
          >
            <Check className="size-12" strokeWidth={3.25} />
            <span className="font-display text-[32px] font-extrabold uppercase leading-none">Prenhe</span>
          </button>
          <button
            onClick={() => setResultado("vazia")}
            aria-pressed={resultado === "vazia"}
            className={`btn-campo flex h-[120px] flex-col items-center justify-center gap-1 ${resultado === "vazia" ? "bg-alerta text-white" : "bg-papel"}`}
          >
            <X className="size-12" strokeWidth={3.25} />
            <span className="font-display text-[32px] font-extrabold uppercase leading-none">Vazia</span>
          </button>
        </div>

        {resultado === "prenhe" && (
          <div>
            <p className="rotulo mb-2">Dias de gestação (tamanho do feto)</p>
            <div className="flex items-stretch gap-2.5">
              <button onClick={() => setDias((d) => Math.max(20, (d ?? 60) - 5))} aria-label="Menos 5 dias" className="btn-campo grid h-[76px] w-[76px] place-items-center bg-papel">
                <Minus className="size-9" strokeWidth={3} />
              </button>
              <div className="cartao-campo flex flex-1 items-center justify-center">
                <span className="font-display text-[52px] font-extrabold leading-none tabular-nums">{dias ?? "—"}</span>
                <span className="ml-1.5 font-display text-[22px] font-bold">dias</span>
              </div>
              <button onClick={() => setDias((d) => Math.min(300, (d ?? 55) + 5))} aria-label="Mais 5 dias" className="btn-campo grid h-[76px] w-[76px] place-items-center bg-papel">
                <Plus className="size-9" strokeWidth={3} />
              </button>
            </div>
            <div className="mt-2.5 grid grid-cols-5 gap-2">
              {[30, 60, 90, 120, 150].map((d) => (
                <button key={d} onClick={() => setDias(d)} className={`btn-campo h-[52px] font-display text-[20px] font-extrabold ${dias === d ? "bg-tinta text-white" : "bg-papel"}`}>
                  {d}
                </button>
              ))}
            </div>
            <button onClick={() => setDias(null)} className="mt-2 text-[15px] font-bold underline decoration-2 underline-offset-2">
              Não sei os dias
            </button>
          </div>
        )}

        <Opcoes
          rotulo="Método"
          valor={metodo}
          onChange={setMetodo}
          opcoes={[
            { valor: "toque", rotulo: "Toque" },
            { valor: "ultrassom", rotulo: "Ultrassom" },
          ]}
        />

        <CampoData valor={data} onChange={setData} rotulo="Data do diagnóstico" />

        {anteriores.length > 0 && (
          <div className="cartao-campo overflow-hidden">
            <p className="rotulo border-b-[3px] border-tinta bg-campo px-4 py-2">Toques anteriores nesta cobertura</p>
            <ul>
              {anteriores.map((d, i) => (
                <li key={d.id} className={`flex items-center gap-3 px-4 py-2.5 text-[17px] font-bold ${i ? "border-t-2 border-tinta/15" : ""}`}>
                  <span className="w-[64px] tabular-nums">{formatarData(d.data_diagnostico).slice(0, 5)}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[14px] uppercase ${d.resultado === "prenhe" ? "bg-pasto text-white" : "bg-alerta text-white"}`}>{d.resultado}</span>
                  <span className="text-[15px]">{d.metodo}{d.dias_gestacao ? ` · ${d.dias_gestacao} d` : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Folha>
  );
}
