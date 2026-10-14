// Regras de negócio do manejo no curral (rodam 100% offline).
import * as db from "./local-db";
import type { Animal, Pesagem, Sanitario } from "./types";
import { FAZENDA_ID } from "./config";

export function hojeISO(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function somarDias(dataISO: string, dias: number) {
  const [a, m, d] = dataISO.split("-").map(Number);
  return hojeISO(new Date(a, m - 1, d + dias));
}
export function diasEntre(deISO: string, ateISO: string) {
  const [a1, m1, d1] = deISO.split("-").map(Number);
  const [a2, m2, d2] = ateISO.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}
export function formatarData(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a.slice(2)}`;
}
export function idadeMeses(nasc: string | null) {
  if (!nasc) return null;
  return Math.max(0, Math.floor(diasEntre(nasc, hojeISO()) / 30.44));
}

/** GMD = (peso atual − peso anterior) ÷ dias entre as pesagens. */
export function calcularGMD(pesoNovo: number, anterior: Pick<Pesagem, "peso" | "data_pesagem"> | undefined, data = hojeISO()) {
  if (!anterior) return null;
  const dias = diasEntre(anterior.data_pesagem, data);
  if (dias <= 0) return null;
  return Math.round(((pesoNovo - anterior.peso) / dias) * 1000) / 1000;
}

export function pesagensDoAnimal(animalId: string) {
  return db
    .listar("historico_pesagens")
    .filter((p) => p.animal_id === animalId)
    .sort((a, b) => b.data_pesagem.localeCompare(a.data_pesagem));
}

/** Pesagem de referência para o GMD: a mais recente ANTES da data informada. */
export function pesagemAnterior(animalId: string, data = hojeISO()) {
  return pesagensDoAnimal(animalId).find((p) => p.data_pesagem < data);
}

export function sanitarioDoAnimal(animalId: string) {
  return db
    .listar("historico_sanitario")
    .filter((s) => s.animal_id === animalId)
    .sort((a, b) => b.data_aplicacao.localeCompare(a.data_aplicacao));
}

/** Carência ativa = maior data_fim_carencia_abate ≥ hoje. */
export function carenciaAtiva(animalId: string) {
  const hoje = hojeISO();
  let maior: Sanitario | undefined;
  for (const s of sanitarioDoAnimal(animalId)) {
    if (s.data_fim_carencia_abate && s.data_fim_carencia_abate >= hoje) {
      if (!maior || s.data_fim_carencia_abate > maior.data_fim_carencia_abate!) maior = s;
    }
  }
  if (!maior) return null;
  return {
    produto: maior.medicamento_vacina,
    liberadoEm: maior.data_fim_carencia_abate!,
    diasRestantes: diasEntre(hoje, maior.data_fim_carencia_abate!),
  };
}

const normalizar = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, "");

/**
 * Busca no curral:
 * 1. RFID completo (leitor bastão envia o código inteiro) → match exato.
 * 2. Brinco visual exato.
 * 3. Brinco visual contendo o termo (parcial).
 */
export function buscarAnimais(termo: string, limite = 8): { exato?: Animal; lista: Animal[] } {
  const q = normalizar(termo);
  if (!q) return { lista: [] };
  const animais = db.listar("animais").filter((a) => a.ativo);
  const porRfid = animais.find((a) => a.brinco_eletronico_rfid && normalizar(a.brinco_eletronico_rfid) === q);
  if (porRfid) return { exato: porRfid, lista: [porRfid] };
  const porBrinco = animais.find((a) => normalizar(a.brinco_visual) === q);
  const parciais = animais
    .filter((a) => normalizar(a.brinco_visual).includes(q) || (a.brinco_eletronico_rfid ?? "").endsWith(q))
    .sort((a, b) => {
      const ia = normalizar(a.brinco_visual).indexOf(q);
      const ib = normalizar(b.brinco_visual).indexOf(q);
      return ia - ib || a.brinco_visual.localeCompare(b.brinco_visual, "pt-BR", { numeric: true });
    })
    .slice(0, limite);
  return { exato: porBrinco, lista: parciais };
}

export async function registrarPesagem(animal: Animal, peso: number, data = hojeISO()) {
  const doDia = pesagensDoAnimal(animal.id).find((p) => p.data_pesagem === data);
  const anterior = pesagemAnterior(animal.id, data);
  const gmd = calcularGMD(peso, anterior, data);

  const pesagem = await db.salvar("historico_pesagens", {
    id: doDia?.id ?? crypto.randomUUID(), // mesma data = corrige a pesagem do dia (UNIQUE animal+data)
    fazenda_id: animal.fazenda_id,
    animal_id: animal.id,
    peso,
    data_pesagem: data,
    gmd_calculado: gmd,
  });

  // peso_atual é recalculado no servidor por trigger; aqui só refletimos localmente.
  const maisRecente = pesagensDoAnimal(animal.id)[0];
  if (maisRecente) {
    await db.salvarSomenteLocal("animais", { ...animal, peso_atual: maisRecente.peso });
  }
  return { pesagem, anterior, gmd, substituiu: !!doDia };
}

export async function registrarSanitario(
  animal: Animal,
  dados: { produto: string; carenciaDias: number; observacao?: string; data?: string },
) {
  const data = dados.data ?? hojeISO();
  return db.salvar("historico_sanitario", {
    id: crypto.randomUUID(),
    fazenda_id: animal.fazenda_id ?? FAZENDA_ID,
    animal_id: animal.id,
    medicamento_vacina: dados.produto,
    data_aplicacao: data,
    carencia_dias: dados.carenciaDias,
    data_fim_carencia_abate: dados.carenciaDias > 0 ? somarDias(data, dados.carenciaDias) : null,
    observacao: dados.observacao ?? null,
  });
}

/** Produtos frequentes. Carência é referência: o peão confirma pela bula. */
export const PRODUTOS_RAPIDOS = [
  { nome: "Ivermectina 1%", carencia: 35, tipo: "Vermífugo" },
  { nome: "Ivermectina 3,15% LA", carencia: 122, tipo: "Vermífugo" },
  { nome: "Vacina Clostridioses", carencia: 21, tipo: "Vacina" },
  { nome: "Vacina Raiva", carencia: 21, tipo: "Vacina" },
  { nome: "Oxitetraciclina LA", carencia: 28, tipo: "Antibiótico" },
  { nome: "Vacina Brucelose B19", carencia: 0, tipo: "Vacina" },
] as const;
