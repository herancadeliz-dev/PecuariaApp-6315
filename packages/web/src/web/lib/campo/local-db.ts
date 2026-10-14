// Armazenamento local offline-first (IndexedDB via localForage).
// Toda leitura da UI vem daqui; toda escrita grava aqui + entra na fila de sync.
// Os dados ficam também em memória para busca instantânea no curral.
import localforage from "localforage";
import type { ItemFila, NomeTabela, Tabelas } from "./types";
import { ORDEM_SYNC } from "./types";

const NOME_DB = "manejo-campo";

const stores = Object.fromEntries(
  ORDEM_SYNC.map((t) => [t, localforage.createInstance({ name: NOME_DB, storeName: t })]),
) as Record<NomeTabela, LocalForage>;
const filaStore = localforage.createInstance({ name: NOME_DB, storeName: "fila_sync" });
const metaStore = localforage.createInstance({ name: NOME_DB, storeName: "meta" });

type Cache = { [K in NomeTabela]: Map<string, Tabelas[K]> };
const cache = Object.fromEntries(ORDEM_SYNC.map((t) => [t, new Map()])) as unknown as Cache;
let fila: ItemFila[] = [];
let versao = 0;
let pronto = false;

const ouvintes = new Set<() => void>();
function emitir() {
  versao++;
  ouvintes.forEach((fn) => fn());
}
export function assinar(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
export const versaoAtual = () => versao;
export const estaPronto = () => pronto;

export async function iniciar() {
  if (pronto) return;
  await Promise.all(
    ORDEM_SYNC.map(async (t) => {
      const mapa = cache[t] as Map<string, unknown>;
      await stores[t].iterate((valor, chave) => {
        mapa.set(chave, valor);
      });
    }),
  );
  fila = ((await filaStore.getItem<ItemFila[]>("itens")) ?? []).sort((a, b) => a.seq - b.seq);
  pronto = true;
  emitir();
}

export function listar<K extends NomeTabela>(t: K): Tabelas[K][] {
  const out: Tabelas[K][] = [];
  for (const r of cache[t].values()) if (!r.deleted_at) out.push(r as Tabelas[K]);
  return out;
}
export function obter<K extends NomeTabela>(t: K, id: string): Tabelas[K] | undefined {
  const r = cache[t].get(id) as Tabelas[K] | undefined;
  return r && !r.deleted_at ? r : undefined;
}

const agoraISO = () => new Date().toISOString();

/** Grava localmente e enfileira para envio. */
export async function salvar<K extends NomeTabela>(
  t: K,
  registro: Omit<Tabelas[K], "created_at" | "updated_at" | "deleted_at"> &
    Partial<Pick<Tabelas[K], "created_at" | "deleted_at">>,
) {
  const anterior = cache[t].get(registro.id);
  const agora = agoraISO();
  const final = {
    deleted_at: null,
    ...anterior,
    ...registro,
    created_at: anterior?.created_at ?? registro.created_at ?? agora,
    updated_at: agora,
  } as Tabelas[K];
  (cache[t] as Map<string, Tabelas[K]>).set(final.id, final);
  await stores[t].setItem(final.id, final);
  await enfileirar(t, final.id);
  emitir();
  return final;
}

/** Grava vários registros de uma vez (importação CSV): uma única gravação da fila. */
export async function salvarVarios<K extends NomeTabela>(
  t: K,
  registros: (Omit<Tabelas[K], "created_at" | "updated_at" | "deleted_at"> & Partial<Pick<Tabelas[K], "created_at" | "deleted_at">>)[],
) {
  const agora = agoraISO();
  const finais: Tabelas[K][] = [];
  for (const registro of registros) {
    const anterior = cache[t].get(registro.id);
    const final = {
      deleted_at: null,
      ...anterior,
      ...registro,
      created_at: anterior?.created_at ?? registro.created_at ?? agora,
      updated_at: agora,
    } as Tabelas[K];
    (cache[t] as Map<string, Tabelas[K]>).set(final.id, final);
    finais.push(final);
    if (!fila.some((f) => f.tabela === t && f.id === final.id)) {
      const seq = (fila.at(-1)?.seq ?? 0) + 1;
      fila.push({ seq, tabela: t, id: final.id, criado_em: agora, tentativas: 0 });
    }
  }
  await Promise.all(finais.map((f) => stores[t].setItem(f.id, f)));
  await filaStore.setItem("itens", fila);
  emitir();
  return finais;
}

/** Atualização só local (ex: peso_atual derivado), sem enfileirar. */
export async function salvarSomenteLocal<K extends NomeTabela>(t: K, registro: Tabelas[K]) {
  (cache[t] as Map<string, Tabelas[K]>).set(registro.id, registro);
  await stores[t].setItem(registro.id, registro);
  emitir();
}

async function enfileirar(tabela: NomeTabela, id: string) {
  // Um item por registro: várias edições offline viram um único upsert.
  if (!fila.some((f) => f.tabela === tabela && f.id === id)) {
    const seq = (fila.at(-1)?.seq ?? 0) + 1;
    fila.push({ seq, tabela, id, criado_em: agoraISO(), tentativas: 0 });
  }
  await filaStore.setItem("itens", fila);
}

export const filaPendente = () => fila.slice();
export const pendentes = () => fila.length;

export async function concluirFila(itens: ItemFila[]) {
  const chaves = new Set(itens.map((i) => `${i.tabela}:${i.id}`));
  fila = fila.filter((f) => !chaves.has(`${f.tabela}:${f.id}`));
  await filaStore.setItem("itens", fila);
  emitir();
}

export async function marcarErroFila(itens: ItemFila[], erro: string) {
  const chaves = new Set(itens.map((i) => `${i.tabela}:${i.id}`));
  fila = fila.map((f) =>
    chaves.has(`${f.tabela}:${f.id}`) ? { ...f, tentativas: f.tentativas + 1, ultimo_erro: erro } : f,
  );
  await filaStore.setItem("itens", fila);
  emitir();
}

/**
 * Mescla registros vindos do servidor.
 * - Registro com alteração local pendente: local vence (será enviado no próximo push).
 * - Senão: last-write-wins por updated_at.
 * - Pesagens: dedupe por (animal_id, data_pesagem), espelhando a UNIQUE do banco.
 */
export async function mesclarRemoto<K extends NomeTabela>(t: K, remotos: Tabelas[K][]) {
  if (!remotos.length) return;
  const pendentesTabela = new Set(fila.filter((f) => f.tabela === t).map((f) => f.id));
  const mapa = cache[t] as Map<string, Tabelas[K]>;

  for (const r of remotos) {
    if (pendentesTabela.has(r.id)) continue;
    const local = mapa.get(r.id);
    if (local && local.updated_at > r.updated_at) continue;

    if (t === "historico_pesagens") {
      const p = r as unknown as Tabelas["historico_pesagens"];
      for (const [id, l] of mapa as unknown as Map<string, Tabelas["historico_pesagens"]>) {
        if (id !== p.id && l.animal_id === p.animal_id && l.data_pesagem === p.data_pesagem) {
          mapa.delete(id);
          await stores[t].removeItem(id);
        }
      }
    }
    mapa.set(r.id, r);
    await stores[t].setItem(r.id, r);
  }
  emitir();
}

export async function lerMeta<T>(chave: string) {
  return metaStore.getItem<T>(chave);
}
export async function gravarMeta<T>(chave: string, valor: T) {
  await metaStore.setItem(chave, valor);
}

export async function tabelasVazias() {
  return cache.animais.size === 0;
}

/** Apaga todos os dados do aparelho (usado ao trocar de fazenda / sair do demo). */
export async function apagarTudo() {
  await localforage.dropInstance({ name: NOME_DB });
}
