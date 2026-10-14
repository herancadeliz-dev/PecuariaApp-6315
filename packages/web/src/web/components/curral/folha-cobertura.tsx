import { useEffect, useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import * as db from "../../lib/campo/local-db";
import { diasEntre, formatarData, hojeISO, somarDias } from "../../lib/campo/manejo";
import { criarTouro, diasGestacao, registrarCobertura, TIPOS_COBERTURA } from "../../lib/campo/reproducao";
import type { Animal, TipoCobertura } from "../../lib/campo/types";
import { Folha } from "./folha";
import { useAviso } from "./aviso";
import { CampoData, CampoTexto, Opcoes } from "./campos";

interface Props {
  animal: Animal;
  aberta: boolean;
  versao: number;
  onFechar: () => void;
}

/** Inseminar / cobrir: touro, partida do sêmen, data e previsão de parto automática. */
export function FolhaCobertura({ animal, aberta, versao, onFechar }: Props) {
  const [tipo, setTipo] = useState<TipoCobertura>("IATF");
  const [touroId, setTouroId] = useState<string | null>(null);
  const [partida, setPartida] = useState("");
  const [data, setData] = useState(hojeISO());
  const [inseminador, setInseminador] = useState("");
  const [ajuste, setAjuste] = useState(0);
  const [novoTouro, setNovoTouro] = useState<{ nome: string; raca: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const aviso = useAviso();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const touros = useMemo(() => db.listar("touros").filter((t) => t.ativo).sort((a, b) => a.nome.localeCompare(b.nome)), [versao]);

  useEffect(() => {
    if (!aberta) return;
    // Repete o último touro/partida usados — na IATF o lote inteiro costuma ser igual
    const ultima = db.listar("coberturas").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    setTipo(ultima?.tipo ?? "IATF");
    setTouroId(ultima?.touro_id ?? null);
    setPartida(ultima?.partida_semen ?? "");
    setInseminador(ultima?.inseminador ?? "");
    setData(hojeISO());
    setAjuste(0);
    setNovoTouro(null);
  }, [aberta]);

  const touro = touroId ? db.obter("touros", touroId) : undefined;
  const gestacao = diasGestacao(animal.raca, touro?.raca) + ajuste;
  const previsao = somarDias(data, gestacao);
  const usaSemen = tipo !== "monta";
  const pronto = !!touroId || tipo === "monta";

  async function adicionarTouro() {
    if (!novoTouro || novoTouro.nome.trim().length < 2) return;
    const t = await criarTouro({ nome: novoTouro.nome, raca: novoTouro.raca || null, tipo: tipo === "monta" ? "monta" : "semen" });
    setTouroId(t.id);
    setNovoTouro(null);
  }

  async function salvar() {
    if (!pronto || salvando) return;
    setSalvando(true);
    try {
      await registrarCobertura(animal, { tipo, touroId, partida: usaSemen ? partida : "", data, inseminador, previsao });
      aviso("Cobertura salva", `Vaca ${animal.brinco_visual} · parto previsto ${formatarData(previsao)}`);
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
      titulo="Inseminar / Cobrir"
      subtitulo={`Vaca ${animal.brinco_visual}${animal.raca ? ` · ${animal.raca}` : ""}`}
      rodape={
        <button
          onClick={() => void salvar()}
          disabled={!pronto || salvando}
          className="btn-campo flex h-[84px] w-full items-center justify-center gap-3 bg-sol font-display text-[28px] font-extrabold uppercase"
        >
          <Check className="size-9" strokeWidth={3} />
          {salvando ? "Salvando…" : pronto ? "Confirmar cobertura" : "Escolha o touro"}
        </button>
      }
    >
      <div className="space-y-5">
        <Opcoes rotulo="Tipo" valor={tipo} onChange={setTipo} opcoes={TIPOS_COBERTURA} colunas={4} />

        <div>
          <p className="rotulo mb-2">Touro {usaSemen ? "(sêmen)" : ""}</p>
          <div className="grid gap-2">
            {touros.map((t) => (
              <button
                key={t.id}
                onClick={() => setTouroId(t.id)}
                aria-pressed={touroId === t.id}
                className={`btn-campo flex min-h-[68px] items-center gap-3 px-4 text-left ${touroId === t.id ? "bg-mata text-white" : "bg-papel"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[24px] font-extrabold uppercase leading-none">{t.nome}</span>
                  <span className={`block text-[14px] font-bold ${touroId === t.id ? "text-sol" : ""}`}>
                    {[t.raca, t.registro, t.central].filter(Boolean).join(" · ") || "Sem dados"}
                  </span>
                </span>
                {touroId === t.id && <Check className="size-8 shrink-0" strokeWidth={3} />}
              </button>
            ))}
            {novoTouro ? (
              <div className="cartao-campo space-y-3 p-3">
                <CampoTexto rotulo="Nome do touro" valor={novoTouro.nome} onChange={(v) => setNovoTouro({ ...novoTouro, nome: v })} placeholder="Ex.: Jaguar FIV" />
                <CampoTexto rotulo="Raça" valor={novoTouro.raca} onChange={(v) => setNovoTouro({ ...novoTouro, raca: v })} placeholder="Ex.: Nelore, Angus" />
                <button onClick={() => void adicionarTouro()} disabled={novoTouro.nome.trim().length < 2} className="btn-campo h-[60px] w-full bg-sol font-display text-[22px] font-extrabold uppercase">
                  Salvar touro
                </button>
              </div>
            ) : (
              <button onClick={() => setNovoTouro({ nome: "", raca: "" })} className="btn-campo flex h-[60px] items-center justify-center gap-2 bg-sol-2 font-display text-[22px] font-extrabold uppercase">
                <Plus className="size-7" strokeWidth={3} /> Novo touro
              </button>
            )}
          </div>
        </div>

        {usaSemen && <CampoTexto rotulo="Partida do sêmen" valor={partida} onChange={setPartida} placeholder="Nº da partida (no rack)" ajuda="Repete a última usada — confira na palheta" />}

        <CampoData rotulo={tipo === "monta" ? "Data da cobertura (entrada do touro)" : "Data da inseminação"} valor={data} onChange={setData} />

        {usaSemen && <CampoTexto rotulo="Inseminador (opcional)" valor={inseminador} onChange={setInseminador} placeholder="Nome" />}

        <div className="rounded-2xl border-[3px] border-tinta bg-ok-claro px-4 py-3 shadow-duro">
          <p className="rotulo">Previsão de parto</p>
          <p className="font-display text-[44px] font-extrabold leading-none tabular-nums">{formatarData(previsao)}</p>
          <p className="text-[15px] font-bold">
            {gestacao} dias de gestação · daqui {diasEntre(hojeISO(), previsao)} dias
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={() => setAjuste((a) => a - 5)} className="btn-campo h-[52px] bg-papel text-[18px] font-bold">
              − 5 dias
            </button>
            <button onClick={() => setAjuste((a) => a + 5)} className="btn-campo h-[52px] bg-papel text-[18px] font-bold">
              + 5 dias
            </button>
          </div>
          <p className="mt-2 text-[13px] font-semibold">Calculado pela raça da vaca e do touro (zebu ≈ 293 d, europeu ≈ 283 d). O toque ajusta depois.</p>
        </div>
      </div>
    </Folha>
  );
}
