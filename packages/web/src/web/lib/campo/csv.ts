// Importação de animais por planilha CSV (Excel "Salvar como CSV" ou Google Planilhas).
// Aceita ; , ou TAB, datas dd/mm/aaaa ou aaaa-mm-dd e decimal com vírgula.
import * as db from "./local-db";
import { FAZENDA_ID } from "./config";
import { calcularGMD, hojeISO, pesagemAnterior } from "./manejo";
import type { Animal, Finalidade, Lote, Pasto, Pesagem, Touro } from "./types";

export const COLUNAS = ["brinco", "rfid", "sexo", "raca", "nascimento", "lote", "pasto", "peso", "data_pesagem", "registro", "mae_brinco", "pai_touro"] as const;
type Coluna = (typeof COLUNAS)[number];

const ALIASES: Record<string, Coluna> = {
  brinco: "brinco", brinco_visual: "brinco", numero: "brinco", n: "brinco", animal: "brinco", identificacao: "brinco",
  rfid: "rfid", brinco_eletronico: "rfid", brinco_eletronico_rfid: "rfid", eletronico: "rfid", chip: "rfid",
  sexo: "sexo",
  raca: "raca",
  nascimento: "nascimento", data_nascimento: "nascimento", nasc: "nascimento", dt_nascimento: "nascimento",
  lote: "lote", lote_atual: "lote",
  pasto: "pasto", piquete: "pasto", pasto_piquete: "pasto",
  peso: "peso", peso_kg: "peso", peso_atual: "peso", ultimo_peso: "peso",
  data_pesagem: "data_pesagem", data_peso: "data_pesagem", dt_pesagem: "data_pesagem",
  registro: "registro", rgn: "registro", rgd: "registro", registro_abcz: "registro",
  mae: "mae_brinco", mae_brinco: "mae_brinco", brinco_mae: "mae_brinco", matriz: "mae_brinco",
  pai: "pai_touro", pai_touro: "pai_touro", touro: "pai_touro", touro_pai: "pai_touro",
};

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");
const BOM = String.fromCharCode(0xfeff);
const chave = (s: string) => semAcento(s.trim().toLowerCase()).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const igual = (a: string, b: string) => chave(a) === chave(b);

export function modeloCSV() {
  const linhas = [
    COLUNAS.join(";"),
    "1001;982000411234001;M;Nelore;15/03/2024;Recria Pasto Verde;Piquete 07;285,5;01/10/2026;;;",
    "1002;;F;Nelore;02/01/2020;Cria Matrizes;Pasto da Represa;452;01/10/2026;RGD 123456;;Jaguar FIV",
    "2001;;F;Nelore;20/08/2025;Cria Matrizes;Pasto da Represa;160;;;1002;Barão",
  ];
  return BOM + linhas.join("\r\n");
}

/** Parser CSV com aspas, detectando o separador pela linha de cabeçalho. */
export function lerCSV(texto: string): string[][] {
  const t = texto.startsWith(BOM) ? texto.slice(1) : texto;
  const primeira = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].map((s) => [s, primeira.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim()));
}

function data(v: string): string | null | "invalida" {
  const s = v.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  let a: number, me: number, d: number;
  if (m) [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else {
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (!m) return "invalida";
    [d, me, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (a < 100) a += a > 50 ? 1900 : 2000;
  }
  const dt = new Date(a, me - 1, d);
  if (dt.getMonth() !== me - 1 || dt.getDate() !== d) return "invalida";
  const iso = hojeISO(dt);
  return iso > hojeISO() ? "invalida" : iso;
}

function sexo(v: string): "M" | "F" | null {
  const s = chave(v);
  if (["m", "macho", "boi", "garrote", "touro", "bezerro", "novilho"].includes(s)) return "M";
  if (["f", "femea", "vaca", "novilha", "bezerra", "matriz"].includes(s)) return "F";
  return null;
}

export interface LinhaImport {
  n: number;
  brinco: string;
  rfid: string | null;
  sexo: "M" | "F" | null;
  raca: string | null;
  nascimento: string | null;
  lote: string | null;
  pasto: string | null;
  peso: number | null;
  dataPesagem: string;
  registro: string | null;
  mae: string | null;
  pai: string | null;
  existente?: Animal;
  erros: string[];
  avisos: string[];
}

export interface Analise {
  colunasReconhecidas: Coluna[];
  colunasIgnoradas: string[];
  linhas: LinhaImport[];
  novosLotes: string[];
  novosPastos: string[];
  novosTouros: string[];
  validas: number;
  novas: number;
  atualizacoes: number;
}

export function analisarCSV(texto: string): Analise {
  const tabela = lerCSV(texto);
  if (tabela.length < 2) throw new Error("A planilha precisa ter o cabeçalho e pelo menos uma linha.");
  const cab = tabela[0].map((c) => ALIASES[chave(c)] ?? null);
  if (!cab.includes("brinco")) throw new Error('Não achei a coluna "brinco". Baixe o modelo e use os mesmos nomes de coluna.');
  const ignoradas = tabela[0].filter((_, i) => !cab[i]).map((c) => c.trim()).filter(Boolean);

  const animais = db.listar("animais");
  const porBrinco = new Map(animais.map((a) => [chave(a.brinco_visual), a]));
  const porRfid = new Map(animais.filter((a) => a.brinco_eletronico_rfid).map((a) => [a.brinco_eletronico_rfid!, a]));
  const lotes = db.listar("lotes");
  const pastos = db.listar("pastos_piquetes");
  const touros = db.listar("touros");

  const vistosBrinco = new Map<string, number>();
  const vistosRfid = new Map<string, number>();
  const novosLotes = new Set<string>();
  const novosPastos = new Set<string>();
  const novosTouros = new Set<string>();
  const hoje = hojeISO();

  const linhas: LinhaImport[] = tabela.slice(1).map((cols, i) => {
    const v = (c: Coluna) => {
      const idx = cab.indexOf(c);
      return idx >= 0 ? (cols[idx] ?? "").trim() : "";
    };
    const n = i + 2; // nº da linha como aparece no Excel
    const erros: string[] = [];
    const avisos: string[] = [];
    const brinco = v("brinco");
    const rfid = v("rfid").replace(/\s/g, "") || null;
    const existente = brinco ? porBrinco.get(chave(brinco)) : undefined;

    if (!brinco) erros.push("sem brinco");
    else if (vistosBrinco.has(chave(brinco))) erros.push(`brinco repetido (linha ${vistosBrinco.get(chave(brinco))})`);
    else vistosBrinco.set(chave(brinco), n);

    if (rfid) {
      if (!/^\d{8,16}$/.test(rfid)) avisos.push("RFID fora do padrão (15 dígitos)");
      const dono = porRfid.get(rfid);
      if (dono && dono.id !== existente?.id) erros.push(`RFID já é do brinco ${dono.brinco_visual}`);
      else if (vistosRfid.has(rfid)) erros.push(`RFID repetido (linha ${vistosRfid.get(rfid)})`);
      else vistosRfid.set(rfid, n);
    }

    const sx = v("sexo") ? sexo(v("sexo")) : (existente?.sexo ?? null);
    if (!sx) erros.push(v("sexo") ? `sexo "${v("sexo")}" inválido (use M ou F)` : "sem sexo");

    const nasc = data(v("nascimento"));
    if (nasc === "invalida") erros.push(`nascimento "${v("nascimento")}" inválido`);

    const pesoTxt = v("peso").replace(/\s|kg/gi, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    const peso = pesoTxt ? Number(pesoTxt) : null;
    if (peso !== null && (!Number.isFinite(peso) || peso < 5 || peso > 1500)) erros.push(`peso "${v("peso")}" inválido`);
    const dp = data(v("data_pesagem"));
    if (dp === "invalida") erros.push(`data de pesagem "${v("data_pesagem")}" inválida`);

    const lote = v("lote") || null;
    if (lote && !lotes.some((l) => igual(l.nome, lote))) novosLotes.add(lote);
    const pasto = v("pasto") || null;
    if (pasto && !pastos.some((p) => igual(p.nome, pasto))) novosPastos.add(pasto);
    const pai = v("pai_touro") || null;
    if (pai && !touros.some((t) => igual(t.nome, pai))) novosTouros.add(pai);
    const mae = v("mae_brinco") || null;
    if (mae && igual(mae, brinco)) erros.push("mãe igual ao próprio animal");
    if (existente) avisos.push("já cadastrado — será atualizado");

    return {
      n, brinco, rfid, sexo: sx, raca: v("raca") || null,
      nascimento: nasc === "invalida" ? null : nasc, lote, pasto,
      peso: peso !== null && Number.isFinite(peso) ? Math.round(peso * 10) / 10 : null,
      dataPesagem: dp && dp !== "invalida" ? dp : hoje,
      registro: v("registro") || null, mae, pai, existente, erros, avisos,
    };
  });

  // Mãe precisa existir (no rebanho ou na própria planilha) e ser fêmea
  const sexoPlanilha = new Map(linhas.filter((l) => !l.erros.length).map((l) => [chave(l.brinco), l.sexo]));
  for (const l of linhas) {
    if (!l.mae) continue;
    const sx = sexoPlanilha.get(chave(l.mae)) ?? porBrinco.get(chave(l.mae))?.sexo;
    if (!sx) l.avisos.push(`mãe ${l.mae} não encontrada — fica sem mãe`);
    else if (sx !== "F") l.erros.push(`mãe ${l.mae} é macho`);
  }

  const validas = linhas.filter((l) => !l.erros.length);
  return {
    colunasReconhecidas: cab.filter((c): c is Coluna => !!c),
    colunasIgnoradas: ignoradas,
    linhas,
    novosLotes: [...novosLotes],
    novosPastos: [...novosPastos],
    novosTouros: [...novosTouros],
    validas: validas.length,
    novas: validas.filter((l) => !l.existente).length,
    atualizacoes: validas.filter((l) => l.existente).length,
  };
}

function finalidadePeloNome(nome: string): Finalidade {
  const s = chave(nome);
  if (/engorda|confina|termina|abate/.test(s)) return "engorda";
  if (/cria|matriz|vaca|maternidade/.test(s) && !/recria/.test(s)) return "cria";
  return "recria";
}
const META: Record<Finalidade, number> = { cria: 0.2, recria: 0.6, engorda: 1.4 };

/** Grava tudo no aparelho (entra na fila de sync). Retorna contagens. */
export async function importarAnimais(analise: Analise, opcoes: { atualizarExistentes: boolean }) {
  const linhas = analise.linhas.filter((l) => !l.erros.length && (opcoes.atualizarExistentes || !l.existente));
  const base = { fazenda_id: FAZENDA_ID };

  // 1) Lotes, pastos e touros que não existem
  const lotes = new Map(db.listar("lotes").map((l) => [chave(l.nome), l.id]));
  const pastos = new Map(db.listar("pastos_piquetes").map((p) => [chave(p.nome), p.id]));
  const touros = new Map(db.listar("touros").map((t) => [chave(t.nome), t.id]));
  const novosL: Omit<Lote, "created_at" | "updated_at" | "deleted_at">[] = [];
  const novosP: Omit<Pasto, "created_at" | "updated_at" | "deleted_at">[] = [];
  const novosT: Omit<Touro, "created_at" | "updated_at" | "deleted_at">[] = [];
  for (const l of linhas) {
    if (l.lote && !lotes.has(chave(l.lote))) {
      const f = finalidadePeloNome(l.lote);
      const r = { ...base, id: crypto.randomUUID(), nome: l.lote, finalidade: f, gmd_meta: META[f] };
      lotes.set(chave(l.lote), r.id);
      novosL.push(r);
    }
    if (l.pasto && !pastos.has(chave(l.pasto))) {
      const r = { ...base, id: crypto.randomUUID(), nome: l.pasto, capacidade_suporte: null, status: "ocupado" as const };
      pastos.set(chave(l.pasto), r.id);
      novosP.push(r);
    }
    if (l.pai && !touros.has(chave(l.pai))) {
      const r = { ...base, id: crypto.randomUUID(), nome: l.pai, raca: null, registro: null, central: null, tipo: "semen" as const, ativo: true };
      touros.set(chave(l.pai), r.id);
      novosT.push(r);
    }
  }
  if (novosL.length) await db.salvarVarios("lotes", novosL);
  if (novosP.length) await db.salvarVarios("pastos_piquetes", novosP);
  if (novosT.length) await db.salvarVarios("touros", novosT);

  // 2) Animais (id estável por brinco, para a mãe poder estar na mesma planilha)
  const idPorBrinco = new Map(db.listar("animais").map((a) => [chave(a.brinco_visual), a.id]));
  for (const l of linhas) if (!l.existente) idPorBrinco.set(chave(l.brinco), crypto.randomUUID());

  const registros = linhas.map((l) => {
    const e = l.existente;
    const maeId = l.mae ? (idPorBrinco.get(chave(l.mae)) ?? null) : (e?.mae_id ?? null);
    return {
      ...e,
      ...base,
      fazenda_id: e?.fazenda_id ?? FAZENDA_ID,
      id: idPorBrinco.get(chave(l.brinco))!,
      brinco_visual: l.brinco,
      brinco_eletronico_rfid: l.rfid ?? e?.brinco_eletronico_rfid ?? null,
      sexo: l.sexo!,
      raca: l.raca ?? e?.raca ?? null,
      data_nascimento: l.nascimento ?? e?.data_nascimento ?? null,
      lote_id: l.lote ? lotes.get(chave(l.lote))! : (e?.lote_id ?? null),
      pasto_id: l.pasto ? pastos.get(chave(l.pasto))! : (e?.pasto_id ?? null),
      peso_atual: l.peso ?? e?.peso_atual ?? null,
      ativo: e?.ativo ?? true,
      registro: l.registro ?? e?.registro ?? null,
      mae_id: maeId,
      pai_touro_id: l.pai ? touros.get(chave(l.pai))! : (e?.pai_touro_id ?? null),
    };
  });
  const salvos = await db.salvarVarios("animais", registros);

  // 3) Pesagens informadas (uma por animal/dia, GMD contra a anterior)
  const pesagens: Omit<Pesagem, "created_at" | "updated_at" | "deleted_at">[] = [];
  const existentes = new Map(db.listar("historico_pesagens").map((p) => [`${p.animal_id}|${p.data_pesagem}`, p.id]));
  for (const l of linhas) {
    if (l.peso === null) continue;
    const id = idPorBrinco.get(chave(l.brinco))!;
    pesagens.push({
      ...base,
      id: existentes.get(`${id}|${l.dataPesagem}`) ?? crypto.randomUUID(),
      animal_id: id,
      peso: l.peso,
      data_pesagem: l.dataPesagem,
      gmd_calculado: calcularGMD(l.peso, pesagemAnterior(id, l.dataPesagem), l.dataPesagem),
    });
  }
  if (pesagens.length) await db.salvarVarios("historico_pesagens", pesagens);

  return {
    animais: salvos.length,
    novos: linhas.filter((l) => !l.existente).length,
    atualizados: linhas.filter((l) => l.existente).length,
    pesagens: pesagens.length,
    lotes: novosL.length,
    pastos: novosP.length,
    touros: novosT.length,
  };
}
