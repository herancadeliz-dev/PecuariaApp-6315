// Motor de sincronização bidirecional IndexedDB <-> Supabase.
//
// PUSH: fila local (1 item por registro alterado) -> upsert em lote, na ordem das FKs.
// PULL: por tabela, busca tudo com updated_at > último pull (incremental, paginado).
// Gatilhos: conexão estável (evento online + 3s + ping OK), app voltando ao primeiro
// plano, a cada 60s quando online, e manual ("Sincronizar agora").
import * as db from "./local-db";
import { CONFIG, FAZENDA_ID, MODO_DEMO, SEM_FAZENDA, supabase } from "./config";
import { ORDEM_SYNC, type ItemFila, type NomeTabela } from "./types";

export type EstadoSync = "demo" | "offline" | "sincronizando" | "ok" | "erro" | "sem_login" | "sem_fazenda";

interface Status {
  estado: EstadoSync;
  ultimoSync: string | null;
  erro: string | null;
  simularOffline: boolean;
}

let status: Status = {
  estado: MODO_DEMO ? "demo" : navigator.onLine ? "ok" : "offline",
  ultimoSync: null,
  erro: null,
  simularOffline: false,
};
const ouvintes = new Set<() => void>();
const set = (p: Partial<Status>) => {
  status = { ...status, ...p };
  ouvintes.forEach((f) => f());
};
export const lerStatus = () => status;
export function assinarStatus(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

const LOTE_PUSH = 200;
const PAGINA_PULL = 1000;
// Conflito natural de pesagem: mesmo animal no mesmo dia vindo de 2 aparelhos.
const CONFLITO: Partial<Record<NomeTabela, string>> = {
  historico_pesagens: "animal_id,data_pesagem",
};

const online = () => navigator.onLine && !status.simularOffline;

async function conexaoEstavel(): Promise<boolean> {
  if (!online()) return false;
  if (!supabase) return true;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(`${CONFIG.url}/auth/v1/health`, {
      signal: ctrl.signal,
      headers: { apikey: CONFIG.chave },
    });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

async function push() {
  const fila = db.filaPendente();
  for (const tabela of ORDEM_SYNC) {
    const itens = fila.filter((f) => f.tabela === tabela);
    for (let i = 0; i < itens.length; i += LOTE_PUSH) {
      const lote: ItemFila[] = itens.slice(i, i + LOTE_PUSH);
      const linhas = lote.map((f) => db.obter(tabela, f.id) ?? null).filter(Boolean);
      if (linhas.length) {
        const { error } = await supabase!
          .from(tabela)
          .upsert(linhas as object[], { onConflict: CONFLITO[tabela] ?? "id" });
        if (error) {
          const msg = traduzirErro(error);
          await db.marcarErroFila(lote, msg);
          throw new Error(`${tabela}: ${msg}`);
        }
      }
      await db.concluirFila(lote);
    }
  }
}

interface ErroPg {
  message: string;
  code?: string;
}
const tabelaInexistente = (e: ErroPg) =>
  e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message);
function traduzirErro(e: ErroPg) {
  if (tabelaInexistente(e) || e.code === "PGRST204")
    return "o banco está desatualizado — rode o SQL V2 (reprodução) no Supabase";
  if (e.code === "42501" || /row-level security/i.test(e.message))
    return "sem permissão nesta fazenda (confira se seu usuário é membro/gestor)";
  if (e.code === "23505") return `registro duplicado (${e.message})`;
  return e.message;
}
let avisos: string[] = [];

async function pull() {
  avisos = [];
  for (const tabela of ORDEM_SYNC) {
    const chave = `ultimo_pull:${tabela}`;
    let desde = (await db.lerMeta<string>(chave)) ?? "1970-01-01T00:00:00Z";
    for (;;) {
      const { data, error } = await supabase!
        .from(tabela)
        .select("*")
        .eq("fazenda_id", FAZENDA_ID)
        .gt("updated_at", desde)
        .order("updated_at", { ascending: true })
        .limit(PAGINA_PULL);
      if (error) {
        // Tabela da V2 ainda não criada no Supabase: segue com as demais.
        if (tabelaInexistente(error)) {
          avisos.push(tabela);
          break;
        }
        throw new Error(`${tabela}: ${traduzirErro(error)}`);
      }
      if (!data?.length) break;
      await db.mesclarRemoto(tabela, data as never[]);
      desde = (data.at(-1) as { updated_at: string }).updated_at;
      await db.gravarMeta(chave, desde);
      if (data.length < PAGINA_PULL) break;
    }
  }
}

let rodando: Promise<void> | null = null;

export function sincronizar(): Promise<void> {
  if (rodando) return rodando;
  rodando = (async () => {
    if (MODO_DEMO) return set({ estado: "demo" });
    if (SEM_FAZENDA) return set({ estado: "sem_fazenda" });
    if (!(await conexaoEstavel())) return set({ estado: "offline" });
    const { data } = await supabase!.auth.getSession();
    if (!data.session) return set({ estado: "sem_login" });

    set({ estado: "sincronizando", erro: null });
    try {
      await push(); // envia primeiro: o que foi feito no curral nunca é sobrescrito
      await pull();
      set({
        estado: "ok",
        ultimoSync: new Date().toISOString(),
        erro: avisos.length ? `Tabelas ausentes no Supabase: ${avisos.join(", ")}. Rode o SQL V2.` : null,
      });
      await db.gravarMeta("ultimo_sync", new Date().toISOString());
    } catch (e) {
      set({ estado: "erro", erro: e instanceof Error ? e.message : String(e) });
    }
  })().finally(() => {
    rodando = null;
  });
  return rodando;
}

export function simularOffline(ligado: boolean) {
  set({ simularOffline: ligado, estado: MODO_DEMO ? "demo" : ligado ? "offline" : status.estado });
  if (!ligado) void sincronizar();
}

let iniciado = false;
export function iniciarSync() {
  if (iniciado) return;
  iniciado = true;
  void db.lerMeta<string>("ultimo_sync").then((u) => u && set({ ultimoSync: u }));

  let timerEstavel: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener("online", () => {
    clearTimeout(timerEstavel);
    timerEstavel = setTimeout(() => void sincronizar(), 3000); // espera o sinal firmar
  });
  window.addEventListener("offline", () => {
    clearTimeout(timerEstavel);
    if (!MODO_DEMO) set({ estado: "offline" });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void sincronizar();
  });
  setInterval(() => online() && void sincronizar(), 60_000);
  // Toda gravação local dispara um push oportunista (com debounce).
  let debounce: ReturnType<typeof setTimeout> | undefined;
  db.assinar(() => {
    if (!db.pendentes() || status.estado === "sincronizando") return;
    clearTimeout(debounce);
    debounce = setTimeout(() => online() && void sincronizar(), 1500);
  });
  void sincronizar();
}
