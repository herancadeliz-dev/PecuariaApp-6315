// Reprodução (inspirado no Produz/ABCZ, simplificado para o curral):
// cobertura/IA → diagnóstico (múltiplos toques, vale o mais recente) → parto com bezerro vinculado.
import * as db from "./local-db";
import { FAZENDA_ID } from "./config";
import { diasEntre, hojeISO, somarDias } from "./manejo";
import type { Animal, Cobertura, Diagnostico, Parto, StatusCobertura, TipoCobertura, Touro } from "./types";

const ZEBU = /nelore|gir|guzer|tabapu|brahman|sindi|indubrasil|zebu/i;
const CRUZADO = /\sx\s|cruz|meio.?sangue|f1|brangus|braford|canchim|montana/i;

/**
 * Dias de gestação de referência. Zebu ≈ 293, taurino ≈ 283, cruzado ≈ 288.
 * Considera a raça da vaca e do touro (o feto herda dos dois).
 */
export function diasGestacao(racaMatriz: string | null, racaTouro?: string | null) {
  const tipo = (r: string | null | undefined) => (!r ? null : CRUZADO.test(r) ? "x" : ZEBU.test(r) ? "z" : "t");
  const a = tipo(racaMatriz);
  const b = tipo(racaTouro) ?? a;
  if (!a) return b === "t" ? 283 : b === "x" ? 288 : 293;
  if (a === "z" && b === "z") return 293;
  if (a === "t" && b === "t") return 283;
  return 288;
}

export function previsaoParto(dataCobertura: string, matriz: Animal, touro?: Touro) {
  return somarDias(dataCobertura, diasGestacao(matriz.raca, touro?.raca));
}

export const TIPOS_COBERTURA: { valor: TipoCobertura; rotulo: string; ajuda: string }[] = [
  { valor: "IATF", rotulo: "IATF", ajuda: "Inseminação em tempo fixo" },
  { valor: "IA", rotulo: "IA", ajuda: "Inseminação no cio" },
  { valor: "monta", rotulo: "Monta", ajuda: "Touro no pasto" },
  { valor: "TE", rotulo: "TE / FIV", ajuda: "Transferência de embrião" },
];

export const STATUS_ROTULO: Record<StatusCobertura, string> = {
  aguardando: "Aguardando toque",
  prenhe: "Prenhe",
  vazia: "Vazia",
  parida: "Parida",
  perdida: "Perdeu a cria",
};

export function coberturasDaMatriz(matrizId: string) {
  return db
    .listar("coberturas")
    .filter((c) => c.matriz_id === matrizId)
    .sort((a, b) => b.data_cobertura.localeCompare(a.data_cobertura) || b.created_at.localeCompare(a.created_at));
}
export function diagnosticosDaCobertura(coberturaId: string) {
  return db
    .listar("diagnosticos_gestacao")
    .filter((d) => d.cobertura_id === coberturaId)
    .sort((a, b) => b.data_diagnostico.localeCompare(a.data_diagnostico) || b.created_at.localeCompare(a.created_at));
}
export function partosDaMatriz(matrizId: string) {
  return db
    .listar("partos")
    .filter((p) => p.matriz_id === matrizId)
    .sort((a, b) => b.data_parto.localeCompare(a.data_parto));
}

export interface SituacaoReprodutiva {
  cobertura?: Cobertura;
  touro?: Touro;
  status: StatusCobertura | "sem_registro";
  ultimoDG?: Diagnostico;
  ultimoParto?: Parto;
  diasParaParto: number | null;
  diasDesdeCobertura: number | null;
  /** Sugestão do próximo passo para o peão. */
  proximo: "cobrir" | "dg" | "parto";
}

export function situacaoReprodutiva(matriz: Animal): SituacaoReprodutiva {
  const hoje = hojeISO();
  const cobertura = coberturasDaMatriz(matriz.id)[0];
  const ultimoParto = partosDaMatriz(matriz.id)[0];
  if (!cobertura) return { status: "sem_registro", ultimoParto, diasParaParto: null, diasDesdeCobertura: null, proximo: "cobrir" };
  const touro = cobertura.touro_id ? db.obter("touros", cobertura.touro_id) : undefined;
  const ultimoDG = diagnosticosDaCobertura(cobertura.id)[0];
  const status = cobertura.status;
  return {
    cobertura,
    touro,
    status,
    ultimoDG,
    ultimoParto,
    diasParaParto: status === "prenhe" && cobertura.previsao_parto ? diasEntre(hoje, cobertura.previsao_parto) : null,
    diasDesdeCobertura: diasEntre(cobertura.data_cobertura, hoje),
    proximo: status === "aguardando" ? "dg" : status === "prenhe" ? "parto" : "cobrir",
  };
}

export async function criarTouro(dados: { nome: string; raca?: string | null; tipo?: Touro["tipo"]; registro?: string | null; central?: string | null }) {
  const existente = db.listar("touros").find((t) => t.nome.trim().toLowerCase() === dados.nome.trim().toLowerCase());
  if (existente) return existente;
  return db.salvar("touros", {
    id: crypto.randomUUID(),
    fazenda_id: FAZENDA_ID,
    nome: dados.nome.trim(),
    raca: dados.raca?.trim() || null,
    registro: dados.registro?.trim() || null,
    central: dados.central?.trim() || null,
    tipo: dados.tipo ?? "semen",
    ativo: true,
  });
}

export async function registrarCobertura(
  matriz: Animal,
  d: { tipo: TipoCobertura; touroId: string | null; partida: string; data: string; inseminador: string; previsao: string | null },
) {
  return db.salvar("coberturas", {
    id: crypto.randomUUID(),
    fazenda_id: matriz.fazenda_id ?? FAZENDA_ID,
    matriz_id: matriz.id,
    tipo: d.tipo,
    touro_id: d.touroId,
    partida_semen: d.partida.trim() || null,
    data_cobertura: d.data,
    inseminador: d.inseminador.trim() || null,
    previsao_parto: d.previsao,
    status: "aguardando",
    observacao: null,
  });
}

/**
 * Diagnóstico (toque/ultrassom). Múltiplos toques na mesma cobertura são permitidos:
 * o mais recente define o status (o banco faz o mesmo via trigger).
 * Sem cobertura aberta e PRENHE com dias informados → cria uma cobertura "monta" retroativa.
 */
export async function registrarDiagnostico(
  matriz: Animal,
  d: { resultado: "prenhe" | "vazia"; metodo: "toque" | "ultrassom"; diasGestacao: number | null; data?: string; responsavel?: string },
) {
  const data = d.data ?? hojeISO();
  const sit = situacaoReprodutiva(matriz);
  let cobertura = sit.cobertura && ["aguardando", "prenhe", "vazia"].includes(sit.cobertura.status) ? sit.cobertura : undefined;

  if (!cobertura && d.resultado === "prenhe" && d.diasGestacao) {
    const dataCob = somarDias(data, -d.diasGestacao);
    cobertura = await db.salvar("coberturas", {
      id: crypto.randomUUID(),
      fazenda_id: matriz.fazenda_id ?? FAZENDA_ID,
      matriz_id: matriz.id,
      tipo: "monta",
      touro_id: null,
      partida_semen: null,
      data_cobertura: dataCob,
      inseminador: null,
      previsao_parto: previsaoParto(dataCob, matriz),
      status: "aguardando",
      observacao: "Criada pelo diagnóstico (cobertura não registrada)",
    });
  }

  const dg = await db.salvar("diagnosticos_gestacao", {
    id: crypto.randomUUID(),
    fazenda_id: matriz.fazenda_id ?? FAZENDA_ID,
    matriz_id: matriz.id,
    cobertura_id: cobertura?.id ?? null,
    data_diagnostico: data,
    resultado: d.resultado,
    metodo: d.metodo,
    dias_gestacao: d.resultado === "prenhe" ? d.diasGestacao : null,
    responsavel: d.responsavel?.trim() || null,
  });

  if (cobertura) {
    let previsao = cobertura.previsao_parto;
    // Toque com idade gestacional ajusta a previsão (útil em monta, onde a data é incerta)
    if (d.resultado === "prenhe" && d.diasGestacao) {
      const touro = cobertura.touro_id ? db.obter("touros", cobertura.touro_id) : undefined;
      const total = diasGestacao(matriz.raca, touro?.raca);
      previsao = somarDias(data, total - d.diasGestacao);
    }
    cobertura = await db.salvar("coberturas", { ...cobertura, status: d.resultado, previsao_parto: previsao });
  }
  return { dg, cobertura };
}

export async function registrarParto(
  matriz: Animal,
  d: {
    data: string;
    tipoParto: Parto["tipo_parto"];
    natimorto: boolean;
    bezerro?: { brinco: string; sexo: "M" | "F"; peso: number | null; rfid?: string };
  },
) {
  const sit = situacaoReprodutiva(matriz);
  const cobertura = sit.cobertura && ["aguardando", "prenhe"].includes(sit.cobertura.status) ? sit.cobertura : undefined;
  const touro = cobertura?.touro_id ? db.obter("touros", cobertura.touro_id) : undefined;

  let bezerro: Animal | undefined;
  if (!d.natimorto && d.bezerro) {
    const racaBezerro =
      touro?.raca && matriz.raca && touro.raca.toLowerCase() !== matriz.raca.toLowerCase()
        ? `${touro.raca} x ${matriz.raca}`
        : (matriz.raca ?? touro?.raca ?? null);
    bezerro = await db.salvar("animais", {
      id: crypto.randomUUID(),
      fazenda_id: matriz.fazenda_id ?? FAZENDA_ID,
      brinco_visual: d.bezerro.brinco.trim(),
      brinco_eletronico_rfid: d.bezerro.rfid?.trim() || null,
      lote_id: matriz.lote_id,
      pasto_id: matriz.pasto_id,
      raca: racaBezerro,
      sexo: d.bezerro.sexo,
      data_nascimento: d.data,
      peso_atual: d.bezerro.peso,
      ativo: true,
      mae_id: matriz.id,
      pai_touro_id: touro?.id ?? null,
      registro: null,
    });
    if (d.bezerro.peso) {
      await db.salvar("historico_pesagens", {
        id: crypto.randomUUID(),
        fazenda_id: bezerro.fazenda_id,
        animal_id: bezerro.id,
        peso: d.bezerro.peso,
        data_pesagem: d.data,
        gmd_calculado: null,
      });
    }
  }

  const parto = await db.salvar("partos", {
    id: crypto.randomUUID(),
    fazenda_id: matriz.fazenda_id ?? FAZENDA_ID,
    matriz_id: matriz.id,
    cobertura_id: cobertura?.id ?? null,
    bezerro_id: bezerro?.id ?? null,
    data_parto: d.data,
    tipo_parto: d.tipoParto,
    natimorto: d.natimorto,
    peso_nascimento: d.bezerro?.peso ?? null,
  });
  if (cobertura) await db.salvar("coberturas", { ...cobertura, status: d.natimorto ? "perdida" : "parida" });
  return { parto, bezerro };
}

/** Relação de filhos da matriz (mais novo primeiro). */
export function filhosDe(animalId: string) {
  return db
    .listar("animais")
    .filter((a) => a.mae_id === animalId)
    .sort((a, b) => (b.data_nascimento ?? "").localeCompare(a.data_nascimento ?? ""));
}

/** Genealogia simples: pais e avós (quando cadastrados). */
export function genealogia(animal: Animal) {
  const mae = animal.mae_id ? db.obter("animais", animal.mae_id) : undefined;
  const pai = animal.pai_touro_id ? db.obter("touros", animal.pai_touro_id) : undefined;
  const avoMaterna = mae?.mae_id ? db.obter("animais", mae.mae_id) : undefined;
  const avoMaterno = mae?.pai_touro_id ? db.obter("touros", mae.pai_touro_id) : undefined;
  return { mae, pai, avoMaterna, avoMaterno };
}

export interface PartoPrevisto {
  cobertura: Cobertura;
  matriz: Animal;
  touro?: Touro;
  dias: number;
}

export interface IndicadoresReproducao {
  matrizes: number;
  prenhes: number;
  vazias: number;
  aguardandoDG: number;
  /** prenhes / diagnosticadas nos últimos 12 meses. */
  taxaPrenhez: number | null;
  diagnosticadas: number;
  partos30: number;
  partos60: number;
  partos90: number;
  previstos: PartoPrevisto[];
  atrasados: PartoPrevisto[];
  nascidos12m: number;
}

export function calcularReproducao(): IndicadoresReproducao {
  const hoje = hojeISO();
  const umAno = somarDias(hoje, -365);
  const femeas = db.listar("animais").filter((a) => a.ativo && a.sexo === "F");
  // Matriz = fêmea com 18+ meses ou que já tem registro reprodutivo
  const comRegistro = new Set(db.listar("coberturas").map((c) => c.matriz_id));
  const matrizes = femeas.filter(
    (a) => comRegistro.has(a.id) || (a.data_nascimento && diasEntre(a.data_nascimento, hoje) >= 548),
  );

  let prenhes = 0;
  let vazias = 0;
  let aguardandoDG = 0;
  const previstos: PartoPrevisto[] = [];
  for (const m of matrizes) {
    const s = situacaoReprodutiva(m);
    if (s.status === "prenhe") {
      prenhes++;
      if (s.cobertura?.previsao_parto)
        previstos.push({ cobertura: s.cobertura, matriz: m, touro: s.touro, dias: diasEntre(hoje, s.cobertura.previsao_parto) });
    } else if (s.status === "vazia") vazias++;
    else if (s.status === "aguardando") aguardandoDG++;
  }
  previstos.sort((a, b) => a.dias - b.dias);

  const cobAno = db.listar("coberturas").filter((c) => c.data_cobertura >= umAno && c.status !== "aguardando");
  const positivas = cobAno.filter((c) => c.status !== "vazia").length;

  return {
    matrizes: matrizes.length,
    prenhes,
    vazias,
    aguardandoDG,
    taxaPrenhez: cobAno.length ? positivas / cobAno.length : null,
    diagnosticadas: cobAno.length,
    partos30: previstos.filter((p) => p.dias >= 0 && p.dias <= 30).length,
    partos60: previstos.filter((p) => p.dias >= 0 && p.dias <= 60).length,
    partos90: previstos.filter((p) => p.dias >= 0 && p.dias <= 90).length,
    previstos: previstos.filter((p) => p.dias >= 0),
    atrasados: previstos.filter((p) => p.dias < 0),
    nascidos12m: db.listar("partos").filter((p) => p.data_parto >= umAno && !p.natimorto).length,
  };
}
