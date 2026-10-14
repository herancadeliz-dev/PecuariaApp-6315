import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import * as db from "../../lib/campo/local-db";
import { FAZENDA_ID } from "../../lib/campo/config";
import { idadeMeses } from "../../lib/campo/manejo";
import type { Animal } from "../../lib/campo/types";
import { Folha } from "../curral/folha";
import { useAviso } from "../curral/aviso";
import { CampoTexto, classeInput, Opcoes, Selecao } from "../curral/campos";

const RACAS = ["Nelore", "Angus", "Angus x Nelore", "Brahman", "Senepol", "Brangus", "Tabapuã", "Guzerá", "Gir", "Hereford"];

export function AbaAnimais({ versao }: { versao: number }) {
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Animal | "novo" | null>(null);
  const [inativos, setInativos] = useState(false);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return db
      .listar("animais")
      .filter((a) => (inativos ? !a.ativo : a.ativo))
      .filter((a) => !q || a.brinco_visual.toLowerCase().includes(q) || (a.brinco_eletronico_rfid ?? "").includes(q) || (a.raca ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.brinco_visual.localeCompare(b.brinco_visual, "pt-BR", { numeric: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, versao, inativos]);
  const lotes = useMemo(() => new Map(db.listar("lotes").map((l) => [l.id, l.nome])), [versao]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <button onClick={() => setEditando("novo")} className="btn-campo flex h-[72px] w-full items-center justify-center gap-2 bg-sol font-display text-[26px] font-extrabold uppercase">
        <Plus className="size-8" strokeWidth={3} /> Novo animal
      </button>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-7 -translate-y-1/2" strokeWidth={3} />
        <input aria-label="Buscar animal" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Brinco, RFID ou raça" className={`${classeInput} pl-14`} />
      </div>
      <div className="flex items-center justify-between text-[16px] font-bold">
        <span>{lista.length} animais {inativos ? "inativos" : "ativos"}</span>
        <button onClick={() => setInativos((v) => !v)} className="h-12 underline decoration-2 underline-offset-4">
          {inativos ? "Ver ativos" : "Ver inativos"}
        </button>
      </div>
      <ul className="cartao-campo divide-y-2 divide-tinta/15 overflow-hidden">
        {lista.slice(0, 200).map((a) => {
          const m = idadeMeses(a.data_nascimento);
          return (
            <li key={a.id}>
              <button onClick={() => setEditando(a)} className="flex min-h-[64px] w-full items-center gap-3 px-4 py-2 text-left active:bg-campo">
                <span className="w-[84px] shrink-0 font-display text-[30px] font-extrabold tabular-nums">{a.brinco_visual}</span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[16px] font-bold">{(a.lote_id && lotes.get(a.lote_id)) || "Sem lote"}</span>
                  <span className="block truncate text-[14px] font-semibold">
                    {a.sexo} · {a.raca ?? "raça ?"}
                    {m !== null && ` · ${m} m`}
                  </span>
                </span>
                {a.peso_atual && <span className="shrink-0 text-[16px] font-bold tabular-nums">{a.peso_atual.toLocaleString("pt-BR")} kg</span>}
              </button>
            </li>
          );
        })}
        {lista.length === 0 && <li className="px-4 py-5 text-[17px] font-bold">Nenhum animal encontrado.</li>}
      </ul>
      {lista.length > 200 && <p className="text-[15px] font-bold">Mostrando 200 de {lista.length}. Refine a busca.</p>}

      <FormAnimal animal={editando} versao={versao} onFechar={() => setEditando(null)} />
    </div>
  );
}

function FormAnimal({ animal, versao, onFechar }: { animal: Animal | "novo" | null; versao: number; onFechar: () => void }) {
  const aviso = useAviso();
  const novo = animal === "novo";
  const atual = animal && animal !== "novo" ? animal : undefined;
  const vazio = { brinco: "", rfid: "", sexo: null as "M" | "F" | null, raca: "", nasc: "", lote: "", pasto: "", registro: "", mae: "", pai: "" };
  const [f, setF] = useState(vazio);
  const set = (p: Partial<typeof vazio>) => setF((v) => ({ ...v, ...p }));

  useEffect(() => {
    if (!animal) return;
    if (animal === "novo") return setF(vazio);
    const mae = animal.mae_id ? db.obter("animais", animal.mae_id) : undefined;
    setF({
      brinco: animal.brinco_visual,
      rfid: animal.brinco_eletronico_rfid ?? "",
      sexo: animal.sexo,
      raca: animal.raca ?? "",
      nasc: animal.data_nascimento ?? "",
      lote: animal.lote_id ?? "",
      pasto: animal.pasto_id ?? "",
      registro: animal.registro ?? "",
      mae: mae?.brinco_visual ?? "",
      pai: animal.pai_touro_id ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animal]);

  const ref = useMemo(
    () => ({
      animais: db.listar("animais"),
      lotes: db.listar("lotes").map((l) => ({ valor: l.id, rotulo: l.nome })),
      pastos: db.listar("pastos_piquetes").map((p) => ({ valor: p.id, rotulo: p.nome })),
      touros: db.listar("touros").map((t) => ({ valor: t.id, rotulo: `${t.nome}${t.raca ? ` (${t.raca})` : ""}` })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versao],
  );

  const outros = ref.animais.filter((a) => a.id !== atual?.id);
  const brincoDup = !!f.brinco.trim() && outros.some((a) => a.brinco_visual.trim().toLowerCase() === f.brinco.trim().toLowerCase());
  const rfidDup = !!f.rfid.trim() && outros.some((a) => a.brinco_eletronico_rfid === f.rfid.trim());
  const mae = f.mae.trim() ? outros.find((a) => a.brinco_visual.trim().toLowerCase() === f.mae.trim().toLowerCase()) : undefined;
  const maeInvalida = !!f.mae.trim() && (!mae || mae.sexo !== "F");
  const pronto = !!f.brinco.trim() && !!f.sexo && !brincoDup && !rfidDup && !maeInvalida;

  async function salvar() {
    if (!pronto) return;
    await db.salvar("animais", {
      ...atual,
      id: atual?.id ?? crypto.randomUUID(),
      fazenda_id: atual?.fazenda_id ?? FAZENDA_ID,
      brinco_visual: f.brinco.trim(),
      brinco_eletronico_rfid: f.rfid.trim() || null,
      sexo: f.sexo!,
      raca: f.raca.trim() || null,
      data_nascimento: f.nasc || null,
      lote_id: f.lote || null,
      pasto_id: f.pasto || null,
      registro: f.registro.trim() || null,
      mae_id: mae?.id ?? null,
      pai_touro_id: f.pai || null,
      peso_atual: atual?.peso_atual ?? null,
      ativo: atual?.ativo ?? true,
    });
    aviso(novo ? "Animal cadastrado" : "Animal atualizado", `Brinco ${f.brinco.trim()}`);
    onFechar();
  }

  async function alternarAtivo() {
    if (!atual) return;
    await db.salvar("animais", { ...atual, ativo: !atual.ativo });
    aviso(atual.ativo ? "Animal inativado" : "Animal reativado", `Brinco ${atual.brinco_visual}`);
    onFechar();
  }

  return (
    <Folha
      aberta={!!animal}
      onFechar={onFechar}
      titulo={novo ? "Novo animal" : `Brinco ${atual?.brinco_visual ?? ""}`}
      subtitulo="Campos com * são obrigatórios"
      rodape={
        <button onClick={() => void salvar()} disabled={!pronto} className="btn-campo h-[80px] w-full bg-sol font-display text-[28px] font-extrabold uppercase">
          Salvar
        </button>
      }
    >
      <div className="space-y-4">
        <CampoTexto rotulo="Brinco visual *" valor={f.brinco} onChange={(v) => set({ brinco: v })} ajuda={brincoDup ? <span className="text-alerta">Já existe um animal com esse brinco</span> : undefined} />
        <CampoTexto rotulo="Brinco eletrônico (RFID)" valor={f.rfid} onChange={(v) => set({ rfid: v.replace(/\s/g, "") })} modo="numeric" placeholder="15 dígitos" ajuda={rfidDup ? <span className="text-alerta">RFID já usado em outro animal</span> : undefined} />
        <Opcoes rotulo="Sexo *" valor={f.sexo} onChange={(v) => set({ sexo: v })} opcoes={[{ valor: "M", rotulo: "Macho" }, { valor: "F", rotulo: "Fêmea" }]} />
        <div>
          <CampoTexto rotulo="Raça" valor={f.raca} onChange={(v) => set({ raca: v })} />
          <div className="mt-2 flex flex-wrap gap-2">
            {RACAS.slice(0, 6).map((r) => (
              <button key={r} onClick={() => set({ raca: r })} className={`btn-campo h-[48px] px-3 text-[16px] font-bold ${f.raca === r ? "bg-tinta text-white" : "bg-papel"}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <CampoTexto rotulo="Data de nascimento" tipo="date" valor={f.nasc} onChange={(v) => set({ nasc: v })} />
        <Selecao rotulo="Lote" valor={f.lote} onChange={(v) => set({ lote: v })} opcoes={ref.lotes} vazio="— sem lote —" />
        <Selecao rotulo="Pasto / piquete" valor={f.pasto} onChange={(v) => set({ pasto: v })} opcoes={ref.pastos} vazio="— sem pasto —" />
        <p className="rotulo border-t-[3px] border-tinta pt-4">Genealogia</p>
        <CampoTexto
          rotulo="Brinco da mãe"
          valor={f.mae}
          onChange={(v) => set({ mae: v })}
          ajuda={f.mae.trim() ? (mae ? (mae.sexo === "F" ? `Mãe: ${mae.brinco_visual} · ${mae.raca ?? ""}` : <span className="text-alerta">Esse brinco é de um macho</span>) : <span className="text-alerta">Mãe não encontrada</span>) : undefined}
        />
        <Selecao rotulo="Pai (touro)" valor={f.pai} onChange={(v) => set({ pai: v })} opcoes={ref.touros} vazio="— não informado —" />
        <CampoTexto rotulo="Registro ABCZ (RGN/RGD)" valor={f.registro} onChange={(v) => set({ registro: v })} />
        {atual && (
          <button onClick={() => void alternarAtivo()} className={`btn-campo h-[64px] w-full text-[20px] font-bold ${atual.ativo ? "bg-alerta-claro text-alerta" : "bg-ok-claro"}`}>
            {atual.ativo ? "Inativar (vendido, morto, abatido)" : "Reativar animal"}
          </button>
        )}
      </div>
    </Folha>
  );
}
