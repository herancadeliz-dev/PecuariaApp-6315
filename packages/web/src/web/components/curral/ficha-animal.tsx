import { useMemo } from "react";
import { ArrowRight, Ban, Scale, Syringe } from "lucide-react";
import * as db from "../../lib/campo/local-db";
import { carenciaAtiva, diasEntre, formatarData, hojeISO, idadeMeses, pesagensDoAnimal, sanitarioDoAnimal } from "../../lib/campo/manejo";
import type { Animal } from "../../lib/campo/types";
import { fmtGMD } from "./folha-pesagem";
import { CartaoGenealogia, CartaoReproducao, type AcaoReproducao } from "./cartao-reproducao";

interface Props {
  animal: Animal;
  versao: number;
  onPesar: () => void;
  onMedicar: () => void;
  onProximo: () => void;
  onReproducao: (a: AcaoReproducao) => void;
  onAbrir: (id: string) => void;
}

const FINALIDADE = { cria: "Cria", recria: "Recria", engorda: "Engorda" } as const;

export function FichaAnimal({ animal, versao, onPesar, onMedicar, onProximo, onReproducao, onAbrir }: Props) {
  const dados = useMemo(() => {
    const pesagens = pesagensDoAnimal(animal.id);
    return {
      lote: animal.lote_id ? db.obter("lotes", animal.lote_id) : undefined,
      pasto: animal.pasto_id ? db.obter("pastos_piquetes", animal.pasto_id) : undefined,
      pesagens,
      ultima: pesagens[0],
      sanitario: sanitarioDoAnimal(animal.id),
      carencia: carenciaAtiva(animal.id),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animal.id, versao]);

  const { lote, pasto, ultima, carencia } = dados;
  const idade = idadeMeses(animal.data_nascimento);
  const hoje = hojeISO();
  const pesadoHoje = ultima?.data_pesagem === hoje;
  const historico = [
    ...dados.pesagens.slice(0, 4).map((p) => ({ data: p.data_pesagem, tipo: "peso" as const, p })),
    ...dados.sanitario.slice(0, 3).map((s) => ({ data: s.data_aplicacao, tipo: "san" as const, s })),
  ]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 5);

  return (
    <section className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200" aria-label={`Animal brinco ${animal.brinco_visual}`}>
      {/* Brinco em destaque */}
      <div className="cartao-campo overflow-hidden">
        <div className="flex items-stretch">
          <div className="flex-1 px-4 pb-3 pt-3">
            <p className="rotulo">Brinco</p>
            <p className="font-display text-[80px] font-extrabold leading-[0.85] tabular-nums tracking-tight">{animal.brinco_visual}</p>
            {animal.brinco_eletronico_rfid && <p className="mt-1.5 font-mono text-[14px] font-bold tracking-wider">RFID {animal.brinco_eletronico_rfid}</p>}
          </div>
          <div className="flex w-[104px] flex-col items-center justify-center gap-0.5 border-l-[3px] border-tinta bg-sol px-2 text-center">
            <span className="font-display text-[40px] font-extrabold leading-none">{animal.sexo === "M" ? "M" : "F"}</span>
            <span className="text-[14px] font-bold uppercase">{animal.sexo === "M" ? "Macho" : "Fêmea"}</span>
            {idade !== null && <span className="text-[14px] font-bold tabular-nums">{idade} meses</span>}
          </div>
        </div>
        <div className="border-t-[3px] border-tinta bg-campo px-4 py-2 text-[16px] font-bold">
          {animal.raca ?? "Raça não informada"}
          {pasto && <> · {pasto.nome}</>}
        </div>
      </div>

      {carencia && (
        <div className="flex items-center gap-3 rounded-2xl border-[3px] border-tinta bg-alerta px-4 py-3 text-white shadow-duro" role="alert">
          <Ban className="size-10 shrink-0" strokeWidth={2.75} />
          <div className="leading-tight">
            <p className="font-display text-[24px] font-extrabold uppercase">Em carência · não abater</p>
            <p className="text-[16px] font-semibold">
              {carencia.produto} · libera {formatarData(carencia.liberadoEm)} ({carencia.diasRestantes === 0 ? "último dia" : `${carencia.diasRestantes} dias`})
            </p>
          </div>
        </div>
      )}

      {/* Lote + último peso */}
      <div className="grid grid-cols-2 gap-3">
        <div className="cartao-campo px-4 py-3">
          <p className="rotulo">Lote atual</p>
          <p className="mt-1 font-display text-[26px] font-extrabold uppercase leading-[0.95]">{lote?.nome ?? "Sem lote"}</p>
          {lote && <p className="mt-1.5 inline-block rounded-md bg-mata px-2 py-0.5 text-[13px] font-bold uppercase text-white">{FINALIDADE[lote.finalidade]}</p>}
        </div>
        <div className={`rounded-2xl border-[3px] border-tinta px-4 py-3 shadow-duro ${pesadoHoje ? "bg-ok-claro" : "bg-papel"}`}>
          <p className="rotulo">{pesadoHoje ? "Pesado hoje" : "Último peso"}</p>
          {ultima ? (
            <>
              <p className="font-display text-[48px] font-extrabold leading-none tabular-nums">
                {ultima.peso.toLocaleString("pt-BR")}
                <span className="ml-1 text-[22px]">kg</span>
              </p>
              <p className="mt-1 text-[14px] font-bold tabular-nums">
                {formatarData(ultima.data_pesagem)}
                {!pesadoHoje && ` · há ${diasEntre(ultima.data_pesagem, hoje)} d`}
              </p>
              {ultima.gmd_calculado !== null && (
                <p className="text-[15px] font-bold tabular-nums">GMD {fmtGMD(ultima.gmd_calculado)} kg/d</p>
              )}
            </>
          ) : (
            <p className="mt-2 text-[18px] font-bold">Nunca pesado</p>
          )}
        </div>
      </div>

      {/* Ações de toque único */}
      <div className="grid gap-3 pt-1">
        <button onClick={onPesar} className="btn-campo flex h-[112px] items-center gap-4 bg-sol px-5 text-left">
          <span className="grid size-[68px] shrink-0 place-items-center rounded-xl border-[3px] border-tinta bg-papel">
            <Scale className="size-10" strokeWidth={2.5} />
          </span>
          <span>
            <span className="block font-display text-[32px] font-extrabold uppercase leading-[0.95]">Registrar nova pesagem</span>
            <span className="block text-[15px] font-bold">GMD calculado na hora</span>
          </span>
        </button>
        <button onClick={onMedicar} className="btn-campo flex h-[112px] items-center gap-4 bg-pasto px-5 text-left text-white">
          <span className="grid size-[68px] shrink-0 place-items-center rounded-xl border-[3px] border-tinta bg-papel text-tinta">
            <Syringe className="size-10" strokeWidth={2.5} />
          </span>
          <span>
            <span className="block font-display text-[32px] font-extrabold uppercase leading-[0.95]">Aplicar vacina / medicamento</span>
            <span className="block text-[15px] font-bold">Carência controlada</span>
          </span>
        </button>
      </div>

      {animal.sexo === "F" && (idade === null || idade >= 12) && <CartaoReproducao animal={animal} versao={versao} onAcao={onReproducao} />}

      <CartaoGenealogia animal={animal} versao={versao} onAbrir={onAbrir} />

      {historico.length > 0 && (
        <div className="cartao-campo overflow-hidden">
          <p className="rotulo border-b-[3px] border-tinta bg-campo px-4 py-2">Últimos manejos</p>
          <ul>
            {historico.map((h, i) => (
              <li key={h.tipo === "peso" ? h.p.id : h.s.id} className={`flex items-center gap-3 px-4 py-2.5 ${i ? "border-t-2 border-tinta/15" : ""}`}>
                <span className="w-[58px] shrink-0 text-[15px] font-bold tabular-nums">{formatarData(h.data).slice(0, 5)}</span>
                {h.tipo === "peso" ? (
                  <>
                    <Scale className="size-5 shrink-0" strokeWidth={2.75} />
                    <span className="flex-1 text-[17px] font-bold tabular-nums">{h.p.peso.toLocaleString("pt-BR")} kg</span>
                    {h.p.gmd_calculado !== null && (
                      <span className={`rounded-md px-2 py-0.5 text-[14px] font-bold tabular-nums ${h.p.gmd_calculado < 0 ? "bg-alerta text-white" : lote && h.p.gmd_calculado < lote.gmd_meta ? "bg-sol" : "bg-ok-claro"}`}>
                        {fmtGMD(h.p.gmd_calculado)}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <Syringe className="size-5 shrink-0" strokeWidth={2.75} />
                    <span className="min-w-0 flex-1 truncate text-[17px] font-bold">{h.s.medicamento_vacina}</span>
                    {h.s.carencia_dias > 0 && <span className="text-[14px] font-bold tabular-nums">{h.s.carencia_dias} d</span>}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={onProximo} className="btn-campo flex h-[80px] w-full items-center justify-center gap-3 bg-tinta font-display text-[28px] font-extrabold uppercase text-white">
        Próximo animal
        <ArrowRight className="size-9" strokeWidth={3} />
      </button>
    </section>
  );
}
