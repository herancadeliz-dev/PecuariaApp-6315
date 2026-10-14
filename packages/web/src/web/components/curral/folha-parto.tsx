import { useEffect, useMemo, useState } from "react";
import { Baby, Check } from "lucide-react";
import * as db from "../../lib/campo/local-db";
import { formatarData, hojeISO } from "../../lib/campo/manejo";
import { registrarParto, situacaoReprodutiva } from "../../lib/campo/reproducao";
import type { Animal, Parto } from "../../lib/campo/types";
import { Folha } from "./folha";
import { useAviso } from "./aviso";
import { CampoData, CampoTexto, Opcoes } from "./campos";

interface Props {
  animal: Animal;
  aberta: boolean;
  versao: number;
  onFechar: () => void;
}

/** Parto: cadastra o bezerro já ligado à mãe e ao touro da cobertura. */
export function FolhaParto({ animal, aberta, versao, onFechar }: Props) {
  const [data, setData] = useState(hojeISO());
  const [tipoParto, setTipoParto] = useState<Parto["tipo_parto"]>("normal");
  const [natimorto, setNatimorto] = useState(false);
  const [sexo, setSexo] = useState<"M" | "F" | null>(null);
  const [brinco, setBrinco] = useState("");
  const [peso, setPeso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const aviso = useAviso();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sit = useMemo(() => situacaoReprodutiva(animal), [animal, versao]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const brincos = useMemo(() => new Set(db.listar("animais").map((a) => a.brinco_visual.trim().toLowerCase())), [versao]);

  useEffect(() => {
    if (!aberta) return;
    setData(hojeISO());
    setTipoParto("normal");
    setNatimorto(false);
    setSexo(null);
    setPeso("");
    // Sugere o próximo brinco numérico livre
    const nums = [...brincos].map(Number).filter((n) => Number.isFinite(n));
    setBrinco(nums.length ? String(Math.max(...nums) + 1) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  const duplicado = !!brinco.trim() && brincos.has(brinco.trim().toLowerCase());
  const pesoNum = peso ? Number(peso.replace(",", ".")) : null;
  const pesoInvalido = pesoNum !== null && (!Number.isFinite(pesoNum) || pesoNum < 5 || pesoNum > 90);
  const pronto = natimorto || (!!sexo && brinco.trim().length > 0 && !duplicado && !pesoInvalido);

  async function salvar() {
    if (!pronto || salvando) return;
    setSalvando(true);
    try {
      const r = await registrarParto(animal, {
        data,
        tipoParto,
        natimorto,
        bezerro: natimorto ? undefined : { brinco: brinco.trim(), sexo: sexo!, peso: pesoNum },
      });
      aviso(
        natimorto ? "Parto registrado" : "Bezerro cadastrado",
        r.bezerro ? `Brinco ${r.bezerro.brinco_visual} · filho(a) da ${animal.brinco_visual}` : `Vaca ${animal.brinco_visual} · natimorto`,
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
      titulo="Parto"
      subtitulo={`Vaca ${animal.brinco_visual}${sit.cobertura?.previsao_parto && sit.status === "prenhe" ? ` · previsto ${formatarData(sit.cobertura.previsao_parto)}` : ""}${sit.touro ? ` · pai ${sit.touro.nome}` : ""}`}
      rodape={
        <button
          onClick={() => void salvar()}
          disabled={!pronto || salvando}
          className="btn-campo flex h-[84px] w-full items-center justify-center gap-3 bg-sol font-display text-[28px] font-extrabold uppercase"
        >
          <Check className="size-9" strokeWidth={3} />
          {salvando ? "Salvando…" : natimorto ? "Registrar natimorto" : pronto ? "Cadastrar bezerro" : "Preencha o bezerro"}
        </button>
      }
    >
      <div className="space-y-5">
        <CampoData valor={data} onChange={setData} rotulo="Data do parto" />

        <Opcoes
          rotulo="Bezerro"
          valor={natimorto ? "morto" : "vivo"}
          onChange={(v) => setNatimorto(v === "morto")}
          opcoes={[
            { valor: "vivo", rotulo: "Nasceu vivo" },
            { valor: "morto", rotulo: "Natimorto" },
          ]}
        />

        {!natimorto && (
          <>
            <Opcoes
              rotulo="Sexo do bezerro"
              valor={sexo}
              onChange={setSexo}
              opcoes={[
                { valor: "M", rotulo: "Macho" },
                { valor: "F", rotulo: "Fêmea" },
              ]}
            />
            <CampoTexto
              rotulo="Brinco do bezerro"
              valor={brinco}
              onChange={setBrinco}
              modo="numeric"
              ajuda={duplicado ? <span className="text-alerta">Esse brinco já existe na fazenda</span> : "Sugerimos o próximo número livre"}
            />
            <div>
              <CampoTexto rotulo="Peso ao nascer (kg, opcional)" valor={peso} onChange={setPeso} modo="decimal" placeholder="Ex.: 32" ajuda={pesoInvalido ? <span className="text-alerta">Entre 5 e 90 kg</span> : undefined} />
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[28, 32, 35, 38].map((p) => (
                  <button key={p} onClick={() => setPeso(String(p))} className={`btn-campo h-[52px] font-display text-[20px] font-extrabold ${peso === String(p) ? "bg-tinta text-white" : "bg-papel"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <Opcoes
          rotulo="Tipo de parto"
          valor={tipoParto}
          onChange={setTipoParto}
          colunas={3}
          opcoes={[
            { valor: "normal", rotulo: "Normal" },
            { valor: "assistido", rotulo: "Ajudado" },
            { valor: "cesariana", rotulo: "Cesárea" },
          ]}
        />

        {!natimorto && (
          <p className="flex items-center gap-3 rounded-2xl border-[3px] border-tinta bg-ok-claro px-4 py-3 text-[16px] font-bold">
            <Baby className="size-8 shrink-0" strokeWidth={2.5} />
            O bezerro entra no mesmo lote e pasto da mãe, com mãe {animal.brinco_visual}
            {sit.touro ? ` e pai ${sit.touro.nome}` : ""} na genealogia.
          </p>
        )}
      </div>
    </Folha>
  );
}
