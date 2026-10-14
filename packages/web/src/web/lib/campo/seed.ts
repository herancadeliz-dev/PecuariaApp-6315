// Dados de exemplo para o MODO DEMONSTRAÇÃO (sem Supabase configurado).
// Gravados direto no IndexedDB, fora da fila de sync.
import localforage from "localforage";
import { FAZENDA_ID } from "./config";
import { hojeISO, somarDias } from "./manejo";
import { diasGestacao } from "./reproducao";
import type { Animal, Cobertura, Diagnostico, Lote, Parto, Pasto, Pesagem, Sanitario, Touro } from "./types";

export const VERSAO_SEED = 2;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export async function semearDemo() {
  const r = rng(42);
  const agora = new Date().toISOString();
  const base = { fazenda_id: FAZENDA_ID, created_at: agora, updated_at: agora, deleted_at: null };
  const hoje = hojeISO();
  const uuid = () => crypto.randomUUID();

  const lotes: Lote[] = [
    { ...base, id: uuid(), nome: "Engorda Confinamento 01", finalidade: "engorda", gmd_meta: 1.4 },
    { ...base, id: uuid(), nome: "Recria Pasto Verde", finalidade: "recria", gmd_meta: 0.6 },
    { ...base, id: uuid(), nome: "Recria Novilhas", finalidade: "recria", gmd_meta: 0.5 },
    { ...base, id: uuid(), nome: "Cria Matrizes Nelore", finalidade: "cria", gmd_meta: 0.2 },
  ];
  const pastos: Pasto[] = [
    { ...base, id: uuid(), nome: "Confinamento Baia 3", capacidade_suporte: 120, status: "ocupado" },
    { ...base, id: uuid(), nome: "Piquete 07 — Mombaça", capacidade_suporte: 3.5, status: "ocupado" },
    { ...base, id: uuid(), nome: "Piquete 12 — Brachiarão", capacidade_suporte: 2.2, status: "ocupado" },
    { ...base, id: uuid(), nome: "Pasto da Represa", capacidade_suporte: 1.5, status: "ocupado" },
  ];
  const perfis = [
    { lote: 0, pasto: 0, peso: [380, 470], gmd: [1.1, 1.8], idade: [20, 28], sexo: "M" as const },
    { lote: 1, pasto: 1, peso: [230, 320], gmd: [0.35, 0.85], idade: [12, 18], sexo: "M" as const },
    { lote: 2, pasto: 2, peso: [210, 290], gmd: [0.3, 0.7], idade: [12, 18], sexo: "F" as const },
    { lote: 3, pasto: 3, peso: [400, 480], gmd: [-0.1, 0.35], idade: [40, 90], sexo: "F" as const },
  ];
  const racas = ["Nelore", "Nelore", "Nelore", "Angus x Nelore", "Brangus", "Senepol"];
  const entre = ([a, b]: number[]) => a + r() * (b - a);

  const animais: Animal[] = [];
  const pesagens: Pesagem[] = [];
  const sanitario: Sanitario[] = [];
  let brinco = 1001;

  perfis.forEach((p, iLote) => {
    const qtd = [18, 16, 12, 14][iLote];
    for (let i = 0; i < qtd; i++) {
      const id = uuid();
      const gmd = entre(p.gmd);
      let peso = entre(p.peso);
      const datas = [somarDias(hoje, -63), somarDias(hoje, -35), somarDias(hoje, -1 - Math.floor(r() * 6))];
      let anterior: { peso: number; data: string } | null = null;
      for (const data of datas) {
        if (anterior) peso = anterior.peso + gmd * ((Date.parse(data) - Date.parse(anterior.data)) / 86_400_000) + (r() - 0.5) * 4;
        const pesoR = Math.round(peso * 2) / 2;
        const g = anterior ? Math.round(((pesoR - anterior.peso) / ((Date.parse(data) - Date.parse(anterior.data)) / 86_400_000)) * 1000) / 1000 : null;
        pesagens.push({ ...base, id: uuid(), animal_id: id, peso: pesoR, data_pesagem: data, gmd_calculado: g });
        anterior = { peso: pesoR, data };
      }
      const num = String(brinco++);
      animais.push({
        ...base,
        id,
        brinco_visual: num,
        brinco_eletronico_rfid: `982000${String(410000 + Math.floor(r() * 89999)).padStart(6, "0")}${num.slice(-3)}`,
        lote_id: lotes[p.lote].id,
        pasto_id: pastos[p.pasto].id,
        raca: racas[Math.floor(r() * racas.length)],
        sexo: p.sexo,
        data_nascimento: somarDias(hoje, -Math.round(entre(p.idade) * 30.4)),
        peso_atual: anterior!.peso,
        ativo: true,
      });
      // Alguns animais da engorda medicados recentemente -> em carência
      if (iLote === 0 && i % 5 === 0) {
        const aplic = somarDias(hoje, -Math.floor(r() * 20));
        sanitario.push({
          ...base, id: uuid(), animal_id: id, medicamento_vacina: "Oxitetraciclina LA",
          data_aplicacao: aplic, carencia_dias: 28, data_fim_carencia_abate: somarDias(aplic, 28), observacao: "Tristeza parasitária",
        });
      }
      const vac = somarDias(hoje, -90);
      sanitario.push({
        ...base, id: uuid(), animal_id: id, medicamento_vacina: "Vacina Clostridioses",
        data_aplicacao: vac, carencia_dias: 21, data_fim_carencia_abate: somarDias(vac, 21), observacao: null,
      });
    }
  });

  // ---------- Reprodução (V2) ----------
  const touros: Touro[] = [
    { ...base, id: uuid(), nome: "Jaguar FIV da Serra", raca: "Nelore", registro: "RGD 4471", central: "Central Genética", tipo: "semen", ativo: true },
    { ...base, id: uuid(), nome: "Black Bravo", raca: "Angus", registro: "HBB 9012", central: "Central Genética", tipo: "semen", ativo: true },
    { ...base, id: uuid(), nome: "Barão (repasse)", raca: "Nelore", registro: null, central: "Próprio", tipo: "monta", ativo: true },
  ];
  const coberturas: Cobertura[] = [];
  const dgs: Diagnostico[] = [];
  const partos: Parto[] = [];
  const matrizes = animais.filter((a) => a.lote_id === lotes[3].id);
  const cob = (m: Animal, diasAtras: number, touro: Touro, tipo: Cobertura["tipo"], status: Cobertura["status"], partida: string | null) => {
    const data = somarDias(hoje, -diasAtras);
    const c: Cobertura = {
      ...base, id: uuid(), matriz_id: m.id, tipo, touro_id: touro.id, partida_semen: partida, data_cobertura: data,
      inseminador: tipo === "monta" ? null : "Zé Inseminador", previsao_parto: somarDias(data, diasGestacao(m.raca, touro.raca)), status, observacao: null,
    };
    coberturas.push(c);
    if (status !== "aguardando") {
      dgs.push({
        ...base, id: uuid(), matriz_id: m.id, cobertura_id: c.id, data_diagnostico: somarDias(data, 32),
        resultado: status === "vazia" ? "vazia" : "prenhe", metodo: "ultrassom", dias_gestacao: status === "vazia" ? null : 32, responsavel: "Dr. Paulo",
      });
    }
    return c;
  };
  matrizes.forEach((m, i) => {
    if (i <= 6) cob(m, 280 - i * 15, touros[i % 2], "IATF", "prenhe", i % 2 ? "BB-2405" : "JG-0318");
    else if (i <= 9) cob(m, 20, touros[0], "IATF", "aguardando", "JG-0421");
    else if (i <= 11) cob(m, 64, touros[1], "IATF", "vazia", "BB-2405");
    else {
      const c = cob(m, 340, touros[2], "monta", "parida", null);
      const dataParto = somarDias(hoje, -47);
      const bezId = uuid();
      const pesoNasc = 31 + i;
      const pesoHoje = Math.round((pesoNasc + 0.82 * (47 - 3)) * 2) / 2;
      animais.push({
        ...base, id: bezId, brinco_visual: String(2001 + i - 12), brinco_eletronico_rfid: null, lote_id: m.lote_id, pasto_id: m.pasto_id,
        raca: "Nelore", sexo: i % 2 ? "F" : "M", data_nascimento: dataParto, peso_atual: pesoHoje, ativo: true, mae_id: m.id, pai_touro_id: touros[2].id, registro: null,
      });
      pesagens.push({ ...base, id: uuid(), animal_id: bezId, peso: pesoNasc, data_pesagem: dataParto, gmd_calculado: null });
      pesagens.push({ ...base, id: uuid(), animal_id: bezId, peso: pesoHoje, data_pesagem: somarDias(hoje, -3), gmd_calculado: Math.round(((pesoHoje - pesoNasc) / 44) * 1000) / 1000 });
      partos.push({ ...base, id: uuid(), matriz_id: m.id, cobertura_id: c.id, bezerro_id: bezId, data_parto: dataParto, tipo_parto: "normal", natimorto: false, peso_nascimento: pesoNasc });
    }
  });
  // Genealogia: parte da recria é filha das matrizes da fazenda
  animais
    .filter((a) => a.lote_id === lotes[1].id || a.lote_id === lotes[2].id)
    .slice(0, 12)
    .forEach((a, i) => {
      a.mae_id = matrizes[i % matrizes.length].id;
      a.pai_touro_id = touros[i % 3].id;
    });

  const gravar = async (store: string, linhas: { id: string }[]) => {
    const inst = localforage.createInstance({ name: "manejo-campo", storeName: store });
    await Promise.all(linhas.map((l) => inst.setItem(l.id, l)));
  };
  await gravar("lotes", lotes);
  await gravar("pastos_piquetes", pastos);
  await gravar("animais", animais);
  await gravar("historico_pesagens", pesagens);
  await gravar("historico_sanitario", sanitario);
  await gravar("touros", touros);
  await gravar("coberturas", coberturas);
  await gravar("diagnosticos_gestacao", dgs);
  await gravar("partos", partos);
}
