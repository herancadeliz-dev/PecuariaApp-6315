// Indicadores do Painel do Gestor, calculados sobre a base local (funciona offline).
// Mesma regra das views vw_kpis_fazenda / vw_desempenho_lote / vw_animais_em_carencia do SQL.
import * as db from "./local-db";
import { carenciaAtiva, diasEntre, hojeISO, somarDias } from "./manejo";
import type { Animal, Finalidade, Lote } from "./types";

export type Situacao = "acima_meta" | "abaixo_meta" | "perdendo" | "sem_dados";

export interface DesempenhoLote {
  lote: Lote;
  totalAnimais: number;
  pesoMedio: number | null;
  gmdMedio: number | null;
  pesagensPeriodo: number;
  /** gmdMedio / meta (1 = bateu a meta). */
  pctMeta: number | null;
  diferenca: number | null;
  situacao: Situacao;
  animaisAbaixoMeta: number;
  piores: { animal: Animal; gmd: number }[];
}

export interface AlertaCarencia {
  animal: Animal;
  lote?: Lote;
  produto: string;
  liberadoEm: string;
  diasRestantes: number;
}

export interface Indicadores {
  periodoDias: number;
  totalCabecas: number;
  machos: number;
  femeas: number;
  porFinalidade: Record<Finalidade, number>;
  gmdMedio: number | null;
  gmdMedioAnterior: number | null;
  pesagensPeriodo: number;
  animaisPesados: number;
  carencia: AlertaCarencia[];
  lotes: DesempenhoLote[];
  semPesagem30d: number;
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r3 = (n: number | null) => (n === null ? null : Math.round(n * 1000) / 1000);

export function calcularIndicadores(periodoDias = 7): Indicadores {
  const hoje = hojeISO();
  const inicio = somarDias(hoje, -periodoDias);
  const inicioAnterior = somarDias(hoje, -periodoDias * 2);

  const animais = db.listar("animais").filter((a) => a.ativo);
  const idsAtivos = new Set(animais.map((a) => a.id));
  const lotes = db.listar("lotes");
  const pesagens = db.listar("historico_pesagens").filter((p) => idsAtivos.has(p.animal_id));

  const noPeriodo = pesagens.filter((p) => p.data_pesagem >= inicio && p.gmd_calculado !== null);
  const periodoAnterior = pesagens.filter(
    (p) => p.data_pesagem >= inicioAnterior && p.data_pesagem < inicio && p.gmd_calculado !== null,
  );

  // GMD do animal no período = pesagem mais recente dentro da janela
  const gmdPorAnimal = new Map<string, number>();
  for (const p of [...noPeriodo].sort((a, b) => a.data_pesagem.localeCompare(b.data_pesagem))) {
    gmdPorAnimal.set(p.animal_id, p.gmd_calculado!);
  }

  // Última pesagem de cada animal (para "sem pesagem há 30 dias")
  const ultimaData = new Map<string, string>();
  for (const p of pesagens) {
    const u = ultimaData.get(p.animal_id);
    if (!u || p.data_pesagem > u) ultimaData.set(p.animal_id, p.data_pesagem);
  }

  const lotesMap = new Map(lotes.map((l) => [l.id, l]));
  const carencia: AlertaCarencia[] = [];
  for (const a of animais) {
    const c = carenciaAtiva(a.id);
    if (c) carencia.push({ animal: a, lote: a.lote_id ? lotesMap.get(a.lote_id) : undefined, ...c });
  }
  carencia.sort((a, b) => a.diasRestantes - b.diasRestantes || a.animal.brinco_visual.localeCompare(b.animal.brinco_visual, "pt-BR", { numeric: true }));

  const porFinalidade: Record<Finalidade, number> = { cria: 0, recria: 0, engorda: 0 };

  const desempenho: DesempenhoLote[] = lotes.map((lote) => {
    const doLote = animais.filter((a) => a.lote_id === lote.id);
    porFinalidade[lote.finalidade] += doLote.length;
    const ids = new Set(doLote.map((a) => a.id));
    const gmds = noPeriodo.filter((p) => ids.has(p.animal_id)).map((p) => p.gmd_calculado!);
    const gmdMedio = r3(media(gmds));
    const pesos = doLote.map((a) => a.peso_atual).filter((p): p is number => p !== null);
    const porAnimal = doLote
      .filter((a) => gmdPorAnimal.has(a.id))
      .map((animal) => ({ animal, gmd: gmdPorAnimal.get(animal.id)! }));

    let situacao: Situacao = "sem_dados";
    if (gmdMedio !== null) situacao = gmdMedio < 0 ? "perdendo" : gmdMedio >= lote.gmd_meta ? "acima_meta" : "abaixo_meta";

    return {
      lote,
      totalAnimais: doLote.length,
      pesoMedio: pesos.length ? Math.round(media(pesos)! * 10) / 10 : null,
      gmdMedio,
      pesagensPeriodo: gmds.length,
      pctMeta: gmdMedio !== null && lote.gmd_meta > 0 ? gmdMedio / lote.gmd_meta : null,
      diferenca: gmdMedio !== null ? r3(gmdMedio - lote.gmd_meta) : null,
      situacao,
      animaisAbaixoMeta: porAnimal.filter((x) => x.gmd < lote.gmd_meta).length,
      piores: porAnimal.sort((a, b) => a.gmd - b.gmd).slice(0, 5),
    };
  });

  // Melhor desempenho relativo à meta primeiro; sem dados por último
  desempenho.sort((a, b) => (b.pctMeta ?? -Infinity) - (a.pctMeta ?? -Infinity));

  return {
    periodoDias,
    totalCabecas: animais.length,
    machos: animais.filter((a) => a.sexo === "M").length,
    femeas: animais.filter((a) => a.sexo === "F").length,
    porFinalidade,
    gmdMedio: r3(media(noPeriodo.map((p) => p.gmd_calculado!))),
    gmdMedioAnterior: r3(media(periodoAnterior.map((p) => p.gmd_calculado!))),
    pesagensPeriodo: noPeriodo.length,
    animaisPesados: gmdPorAnimal.size,
    carencia,
    lotes: desempenho,
    semPesagem30d: animais.filter((a) => {
      const u = ultimaData.get(a.id);
      return !u || diasEntre(u, hoje) > 30;
    }).length,
  };
}
