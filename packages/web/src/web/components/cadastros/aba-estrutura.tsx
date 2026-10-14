import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import * as db from "../../lib/campo/local-db";
import { FAZENDA_ID } from "../../lib/campo/config";
import type { Finalidade, Lote, Pasto, Touro } from "../../lib/campo/types";
import { Folha } from "../curral/folha";
import { useAviso } from "../curral/aviso";
import { CampoTexto, Opcoes } from "../curral/campos";

const FINALIDADES: { valor: Finalidade; rotulo: string }[] = [
  { valor: "cria", rotulo: "Cria" },
  { valor: "recria", rotulo: "Recria" },
  { valor: "engorda", rotulo: "Engorda" },
];
const META_PADRAO: Record<Finalidade, number> = { cria: 0.2, recria: 0.6, engorda: 1.4 };
const STATUS_PASTO: { valor: Pasto["status"]; rotulo: string }[] = [
  { valor: "ocupado", rotulo: "Ocupado" },
  { valor: "disponivel", rotulo: "Livre" },
  { valor: "descanso", rotulo: "Descanso" },
  { valor: "manutencao", rotulo: "Reforma" },
];

const num = (s: string) => (s.trim() ? Number(s.replace(",", ".")) : null);

function contagemPor(campo: "lote_id" | "pasto_id" | "pai_touro_id") {
  const m = new Map<string, number>();
  for (const a of db.listar("animais")) {
    const v = a[campo];
    if (a.ativo && v) m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
}

function Lista<T extends { id: string }>({ itens, novo, onNovo, onAbrir, render }: { itens: T[]; novo: string; onNovo: () => void; onAbrir: (t: T) => void; render: (t: T) => ReactNode }) {
  return (
    <div className="space-y-3">
      <button onClick={onNovo} className="btn-campo flex h-[72px] w-full items-center justify-center gap-2 bg-sol font-display text-[26px] font-extrabold uppercase">
        <Plus className="size-8" strokeWidth={3} /> {novo}
      </button>
      <ul className="cartao-campo divide-y-2 divide-tinta/15 overflow-hidden">
        {itens.map((t) => (
          <li key={t.id}>
            <button onClick={() => onAbrir(t)} className="flex min-h-[72px] w-full items-center gap-3 px-4 py-2 text-left active:bg-campo">
              {render(t)}
            </button>
          </li>
        ))}
        {itens.length === 0 && <li className="px-4 py-5 text-[17px] font-bold">Nada cadastrado ainda.</li>}
      </ul>
    </div>
  );
}

// ---------------- LOTES ----------------
export function AbaLotes({ versao }: { versao: number }) {
  const [ed, setEd] = useState<Lote | "novo" | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { itens, cont } = useMemo(() => ({ itens: db.listar("lotes").sort((a, b) => a.nome.localeCompare(b.nome)), cont: contagemPor("lote_id") }), [versao]);
  const aviso = useAviso();
  const [f, setF] = useState({ nome: "", finalidade: "recria" as Finalidade, meta: "0,6" });
  useEffect(() => {
    if (!ed) return;
    if (ed === "novo") setF({ nome: "", finalidade: "recria", meta: "0,6" });
    else setF({ nome: ed.nome, finalidade: ed.finalidade, meta: String(ed.gmd_meta).replace(".", ",") });
  }, [ed]);
  const atual = ed && ed !== "novo" ? ed : undefined;
  const meta = num(f.meta);
  const dup = itens.some((l) => l.id !== atual?.id && l.nome.trim().toLowerCase() === f.nome.trim().toLowerCase());
  const pronto = f.nome.trim().length >= 2 && meta !== null && Number.isFinite(meta) && meta >= 0 && meta <= 3 && !dup;

  return (
    <>
      <Lista
        itens={itens}
        novo="Novo lote"
        onNovo={() => setEd("novo")}
        onAbrir={setEd}
        render={(l) => (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[24px] font-extrabold uppercase leading-none">{l.nome}</span>
              <span className="block text-[15px] font-bold capitalize">
                {l.finalidade} · meta {l.gmd_meta.toLocaleString("pt-BR")} kg/d
              </span>
            </span>
            <span className="shrink-0 font-display text-[26px] font-extrabold tabular-nums">{cont.get(l.id) ?? 0}<span className="ml-1 text-[14px]">cab</span></span>
          </>
        )}
      />
      <Folha
        aberta={!!ed}
        onFechar={() => setEd(null)}
        titulo={atual ? "Editar lote" : "Novo lote"}
        rodape={
          <button
            disabled={!pronto}
            onClick={async () => {
              await db.salvar("lotes", { ...atual, id: atual?.id ?? crypto.randomUUID(), fazenda_id: atual?.fazenda_id ?? FAZENDA_ID, nome: f.nome.trim(), finalidade: f.finalidade, gmd_meta: meta! });
              aviso("Lote salvo", f.nome.trim());
              setEd(null);
            }}
            className="btn-campo h-[80px] w-full bg-sol font-display text-[28px] font-extrabold uppercase"
          >
            Salvar lote
          </button>
        }
      >
        <div className="space-y-4">
          <CampoTexto rotulo="Nome do lote" valor={f.nome} onChange={(v) => setF({ ...f, nome: v })} placeholder="Ex.: Recria Pasto Verde" ajuda={dup ? <span className="text-alerta">Já existe um lote com esse nome</span> : undefined} />
          <Opcoes rotulo="Finalidade" valor={f.finalidade} colunas={3} opcoes={FINALIDADES} onChange={(v) => setF({ ...f, finalidade: v, meta: atual ? f.meta : String(META_PADRAO[v]).replace(".", ",") })} />
          <CampoTexto rotulo="Meta de GMD (kg/dia)" valor={f.meta} onChange={(v) => setF({ ...f, meta: v })} modo="decimal" ajuda="Usada para colorir o GMD no curral e no painel" />
        </div>
      </Folha>
    </>
  );
}

// ---------------- PASTOS ----------------
export function AbaPastos({ versao }: { versao: number }) {
  const [ed, setEd] = useState<Pasto | "novo" | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { itens, cont } = useMemo(() => ({ itens: db.listar("pastos_piquetes").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true })), cont: contagemPor("pasto_id") }), [versao]);
  const aviso = useAviso();
  const [f, setF] = useState({ nome: "", cap: "", status: "ocupado" as Pasto["status"] });
  useEffect(() => {
    if (!ed) return;
    if (ed === "novo") setF({ nome: "", cap: "", status: "disponivel" });
    else setF({ nome: ed.nome, cap: ed.capacidade_suporte !== null ? String(ed.capacidade_suporte).replace(".", ",") : "", status: ed.status });
  }, [ed]);
  const atual = ed && ed !== "novo" ? ed : undefined;
  const cap = num(f.cap);
  const dup = itens.some((p) => p.id !== atual?.id && p.nome.trim().toLowerCase() === f.nome.trim().toLowerCase());
  const pronto = f.nome.trim().length >= 2 && (cap === null || (Number.isFinite(cap) && cap >= 0)) && !dup;

  return (
    <>
      <Lista
        itens={itens}
        novo="Novo pasto"
        onNovo={() => setEd("novo")}
        onAbrir={setEd}
        render={(p) => (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[24px] font-extrabold uppercase leading-none">{p.nome}</span>
              <span className="block text-[15px] font-bold">
                {STATUS_PASTO.find((s) => s.valor === p.status)?.rotulo}
                {p.capacidade_suporte !== null && ` · ${p.capacidade_suporte.toLocaleString("pt-BR")} UA/ha`}
              </span>
            </span>
            <span className="shrink-0 font-display text-[26px] font-extrabold tabular-nums">{cont.get(p.id) ?? 0}<span className="ml-1 text-[14px]">cab</span></span>
          </>
        )}
      />
      <Folha
        aberta={!!ed}
        onFechar={() => setEd(null)}
        titulo={atual ? "Editar pasto" : "Novo pasto"}
        rodape={
          <button
            disabled={!pronto}
            onClick={async () => {
              await db.salvar("pastos_piquetes", { ...atual, id: atual?.id ?? crypto.randomUUID(), fazenda_id: atual?.fazenda_id ?? FAZENDA_ID, nome: f.nome.trim(), capacidade_suporte: cap, status: f.status });
              aviso("Pasto salvo", f.nome.trim());
              setEd(null);
            }}
            className="btn-campo h-[80px] w-full bg-sol font-display text-[28px] font-extrabold uppercase"
          >
            Salvar pasto
          </button>
        }
      >
        <div className="space-y-4">
          <CampoTexto rotulo="Nome do pasto / piquete" valor={f.nome} onChange={(v) => setF({ ...f, nome: v })} placeholder="Ex.: Piquete 07 — Mombaça" ajuda={dup ? <span className="text-alerta">Já existe um pasto com esse nome</span> : undefined} />
          <Opcoes rotulo="Situação" valor={f.status} colunas={2} opcoes={STATUS_PASTO} onChange={(v) => setF({ ...f, status: v })} />
          <CampoTexto rotulo="Capacidade de suporte (UA/ha)" valor={f.cap} onChange={(v) => setF({ ...f, cap: v })} modo="decimal" placeholder="Opcional" />
        </div>
      </Folha>
    </>
  );
}

// ---------------- TOUROS ----------------
export function AbaTouros({ versao }: { versao: number }) {
  const [ed, setEd] = useState<Touro | "novo" | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { itens, filhos } = useMemo(() => ({ itens: db.listar("touros").sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome)), filhos: contagemPor("pai_touro_id") }), [versao]);
  const prenhes = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of db.listar("coberturas")) if (c.touro_id && c.status === "prenhe") m.set(c.touro_id, (m.get(c.touro_id) ?? 0) + 1);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao]);
  const aviso = useAviso();
  const vazio = { nome: "", raca: "", registro: "", central: "", tipo: "semen" as Touro["tipo"] };
  const [f, setF] = useState(vazio);
  useEffect(() => {
    if (!ed) return;
    if (ed === "novo") setF(vazio);
    else setF({ nome: ed.nome, raca: ed.raca ?? "", registro: ed.registro ?? "", central: ed.central ?? "", tipo: ed.tipo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ed]);
  const atual = ed && ed !== "novo" ? ed : undefined;
  const dup = itens.some((t) => t.id !== atual?.id && t.nome.trim().toLowerCase() === f.nome.trim().toLowerCase());
  const pronto = f.nome.trim().length >= 2 && !dup;

  async function salvar(ativo = atual?.ativo ?? true) {
    await db.salvar("touros", {
      ...atual,
      id: atual?.id ?? crypto.randomUUID(),
      fazenda_id: atual?.fazenda_id ?? FAZENDA_ID,
      nome: f.nome.trim(),
      raca: f.raca.trim() || null,
      registro: f.registro.trim() || null,
      central: f.central.trim() || null,
      tipo: f.tipo,
      ativo,
    });
    aviso("Touro salvo", f.nome.trim());
    setEd(null);
  }

  return (
    <>
      <Lista
        itens={itens}
        novo="Novo touro"
        onNovo={() => setEd("novo")}
        onAbrir={setEd}
        render={(t) => (
          <>
            <span className={`min-w-0 flex-1 ${t.ativo ? "" : "opacity-50"}`}>
              <span className="block truncate font-display text-[24px] font-extrabold uppercase leading-none">{t.nome}</span>
              <span className="block truncate text-[15px] font-bold">
                {t.tipo === "semen" ? "Sêmen" : "Monta"} · {[t.raca, t.registro, t.central].filter(Boolean).join(" · ") || "sem dados"}
              </span>
            </span>
            <span className="shrink-0 text-right text-[14px] font-bold leading-tight tabular-nums">
              {filhos.get(t.id) ?? 0} filhos
              <span className="block">{prenhes.get(t.id) ?? 0} prenhes</span>
            </span>
          </>
        )}
      />
      <Folha
        aberta={!!ed}
        onFechar={() => setEd(null)}
        titulo={atual ? "Editar touro" : "Novo touro"}
        rodape={
          <button disabled={!pronto} onClick={() => void salvar()} className="btn-campo h-[80px] w-full bg-sol font-display text-[28px] font-extrabold uppercase">
            Salvar touro
          </button>
        }
      >
        <div className="space-y-4">
          <CampoTexto rotulo="Nome do touro" valor={f.nome} onChange={(v) => setF({ ...f, nome: v })} ajuda={dup ? <span className="text-alerta">Já existe um touro com esse nome</span> : undefined} />
          <Opcoes rotulo="Uso" valor={f.tipo} onChange={(v) => setF({ ...f, tipo: v })} opcoes={[{ valor: "semen", rotulo: "Sêmen (IA)" }, { valor: "monta", rotulo: "Monta natural" }]} />
          <CampoTexto rotulo="Raça" valor={f.raca} onChange={(v) => setF({ ...f, raca: v })} placeholder="Ex.: Nelore" />
          <CampoTexto rotulo="Registro (RGD / HBB)" valor={f.registro} onChange={(v) => setF({ ...f, registro: v })} placeholder="Opcional" />
          <CampoTexto rotulo="Central de sêmen / origem" valor={f.central} onChange={(v) => setF({ ...f, central: v })} placeholder="Ex.: nome da central ou Próprio" />
          {atual && (
            <button onClick={() => void salvar(!atual.ativo)} className="btn-campo h-[64px] w-full bg-campo text-[20px] font-bold">
              {atual.ativo ? "Inativar (some da lista do curral)" : "Reativar touro"}
            </button>
          )}
        </div>
      </Folha>
    </>
  );
}
