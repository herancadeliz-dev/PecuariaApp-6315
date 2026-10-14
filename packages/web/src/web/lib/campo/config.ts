import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Configuração do Supabase. Duas formas (a tela "Configurar" do app tem prioridade):
//  1) Tela Cadastros → Configurar fazenda: grava no aparelho (localStorage).
//  2) .env da raiz: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_FAZENDA_ID, VITE_FAZENDA_NOME.
// Sem URL/chave o app roda em MODO DEMONSTRAÇÃO (dados locais de exemplo).

export interface ConfigCampo {
  url: string;
  chave: string;
  fazendaId: string | null;
  fazendaNome: string | null;
}

const CHAVE_LS = "manejo-campo:config";
export const FAZENDA_DEMO = "00000000-0000-4000-8000-00000000fa01";

function lerSalva(): Partial<ConfigCampo> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_LS) ?? "{}") as Partial<ConfigCampo>;
  } catch {
    return {};
  }
}

const salva = lerSalva();
const env = import.meta.env;
export const CONFIG: ConfigCampo = {
  url: (salva.url || (env.VITE_SUPABASE_URL as string | undefined) || "").trim().replace(/\/+$/, ""),
  chave: (salva.chave || (env.VITE_SUPABASE_ANON_KEY as string | undefined) || "").trim(),
  fazendaId: salva.fazendaId || (env.VITE_FAZENDA_ID as string | undefined) || null,
  fazendaNome: salva.fazendaNome || (env.VITE_FAZENDA_NOME as string | undefined) || null,
};
export const CONFIG_NO_APARELHO = !!salva.url;

export const supabase: SupabaseClient | null =
  CONFIG.url && CONFIG.chave
    ? createClient(CONFIG.url, CONFIG.chave, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: "manejo-campo-auth" },
      })
    : null;

export const MODO_DEMO = !supabase;
/** Conectado ao Supabase mas ainda sem fazenda escolhida: não sincroniza. */
export const SEM_FAZENDA = !!supabase && !CONFIG.fazendaId;
export const FAZENDA_ID = CONFIG.fazendaId ?? FAZENDA_DEMO;
export const NOME_FAZENDA = CONFIG.fazendaNome ?? (MODO_DEMO ? "Fazenda Boa Vista (demo)" : "Minha fazenda");

/** Salva a configuração no aparelho. A página é recarregada em seguida para aplicar. */
export function gravarConfig(c: Partial<ConfigCampo>) {
  const atual = lerSalva();
  localStorage.setItem(CHAVE_LS, JSON.stringify({ ...atual, ...c }));
}
export function apagarConfig() {
  localStorage.removeItem(CHAVE_LS);
}

/** Cria um cliente temporário para testar URL/chave antes de salvar. */
export function clienteTeste(url: string, chave: string) {
  return createClient(url.trim().replace(/\/+$/, ""), chave.trim(), {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "manejo-campo-auth" },
  });
}
