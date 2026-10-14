// Espelho local das tabelas do Supabase (ver pecuaria_mvp_supabase.sql).
// Campos snake_case idênticos ao banco para o sync ser um upsert direto.

export type Finalidade = "cria" | "recria" | "engorda";
export type Sexo = "M" | "F";

interface Base {
  id: string;
  fazenda_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Lote extends Base {
  nome: string;
  finalidade: Finalidade;
  gmd_meta: number;
}

export interface Pasto extends Base {
  nome: string;
  capacidade_suporte: number | null;
  status: "disponivel" | "ocupado" | "descanso" | "manutencao";
}

export interface Animal extends Base {
  brinco_visual: string;
  brinco_eletronico_rfid: string | null;
  lote_id: string | null;
  pasto_id: string | null;
  raca: string | null;
  sexo: Sexo;
  data_nascimento: string | null;
  peso_atual: number | null;
  ativo: boolean;
  mae_id?: string | null;
  pai_touro_id?: string | null;
  registro?: string | null;
}

export interface Touro extends Base {
  nome: string;
  raca: string | null;
  registro: string | null;
  central: string | null;
  tipo: "semen" | "monta";
  ativo: boolean;
}

export type TipoCobertura = "IATF" | "IA" | "monta" | "TE";
export type StatusCobertura = "aguardando" | "prenhe" | "vazia" | "parida" | "perdida";

export interface Cobertura extends Base {
  matriz_id: string;
  tipo: TipoCobertura;
  touro_id: string | null;
  partida_semen: string | null;
  data_cobertura: string;
  inseminador: string | null;
  previsao_parto: string | null;
  status: StatusCobertura;
  observacao: string | null;
}

export interface Diagnostico extends Base {
  matriz_id: string;
  cobertura_id: string | null;
  data_diagnostico: string;
  resultado: "prenhe" | "vazia";
  metodo: "toque" | "ultrassom";
  dias_gestacao: number | null;
  responsavel: string | null;
}

export interface Parto extends Base {
  matriz_id: string;
  cobertura_id: string | null;
  bezerro_id: string | null;
  data_parto: string;
  tipo_parto: "normal" | "assistido" | "cesariana";
  natimorto: boolean;
  peso_nascimento: number | null;
}

export interface Pesagem extends Base {
  animal_id: string;
  peso: number;
  data_pesagem: string; // YYYY-MM-DD
  gmd_calculado: number | null;
}

export interface Sanitario extends Base {
  animal_id: string;
  medicamento_vacina: string;
  data_aplicacao: string;
  carencia_dias: number;
  data_fim_carencia_abate: string | null;
  observacao: string | null;
}

export interface Tabelas {
  lotes: Lote;
  pastos_piquetes: Pasto;
  animais: Animal;
  historico_pesagens: Pesagem;
  historico_sanitario: Sanitario;
  touros: Touro;
  coberturas: Cobertura;
  diagnosticos_gestacao: Diagnostico;
  partos: Parto;
}
export type NomeTabela = keyof Tabelas;

/** Ordem de push respeitando as FKs. */
export const ORDEM_SYNC: NomeTabela[] = [
  "lotes",
  "pastos_piquetes",
  "touros",
  "animais",
  "historico_pesagens",
  "historico_sanitario",
  "coberturas",
  "diagnosticos_gestacao",
  "partos",
];

export interface ItemFila {
  seq: number;
  tabela: NomeTabela;
  id: string;
  criado_em: string;
  tentativas: number;
  ultimo_erro?: string;
}
