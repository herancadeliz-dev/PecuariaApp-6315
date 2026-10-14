import { useMemo } from "react";
import { Baby, HeartPulse, Stethoscope } from "lucide-react";
import { formatarData, idadeMeses } from "../../lib/campo/manejo";
import { filhosDe, genealogia, partosDaMatriz, situacaoReprodutiva, STATUS_ROTULO } from "../../lib/campo/reproducao";
import type { Animal } from "../../lib/campo/types";

const COR_STATUS = {
  sem_registro: "bg-campo",
  aguardando: "bg-sol",
  prenhe: "bg-pasto text-white",
  vazia: "bg-alerta text-white",
  parida: "bg-ok-claro",
  perdida: "bg-alerta-claro",
} as const;

export type AcaoReproducao = "cobrir" | "dg" | "parto";

/** Status reprodutivo + 3 ações. O próximo passo provável fica amarelo. */
export function CartaoReproducao({ animal, versao, onAcao }: { animal: Animal; versao: number; onAcao: (a: AcaoReproducao) => void }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sit = useMemo(() => situacaoReprodutiva(animal), [animal, versao]);
  const cob = sit.cobertura;
  const acoes: { id: AcaoReproducao; rotulo: string; Icone: typeof Baby }[] = [
    { id: "cobrir", rotulo: "Inseminar", Icone: HeartPulse },
    { id: "dg", rotulo: "Toque", Icone: Stethoscope },
    { id: "parto", rotulo: "Parto", Icone: Baby },
  ];

  return (
    <div className="cartao-campo overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b-[3px] border-tinta bg-campo px-4 py-2">
        <p className="rotulo">Reprodução</p>
        <span className={`rounded-md border-2 border-tinta px-2 py-0.5 text-[14px] font-bold uppercase ${COR_STATUS[sit.status]}`}>
          {sit.status === "sem_registro" ? "Sem cobertura" : STATUS_ROTULO[sit.status]}
        </span>
      </div>
      <div className="px-4 py-3">
        {sit.status === "prenhe" && cob?.previsao_parto ? (
          <>
            <p className="rotulo">Parto previsto</p>
            <p className="font-display text-[44px] font-extrabold leading-none tabular-nums">{formatarData(cob.previsao_parto)}</p>
            <p className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[15px] font-bold ${sit.diasParaParto! < 0 ? "bg-alerta text-white" : sit.diasParaParto! <= 30 ? "bg-sol" : "bg-ok-claro"}`}>
              {sit.diasParaParto! < 0 ? `Atrasado ${-sit.diasParaParto!} dias` : sit.diasParaParto === 0 ? "Previsto para hoje" : `Faltam ${sit.diasParaParto} dias`}
            </p>
          </>
        ) : cob ? (
          <p className="text-[18px] font-bold">
            {cob.tipo} em {formatarData(cob.data_cobertura)} · há {sit.diasDesdeCobertura} dias
          </p>
        ) : (
          <p className="text-[18px] font-bold">Nenhuma cobertura registrada.</p>
        )}
        {cob && (
          <p className="mt-1 text-[15px] font-semibold">
            {sit.touro ? `Touro ${sit.touro.nome}` : "Touro não informado"}
            {cob.partida_semen && ` · partida ${cob.partida_semen}`}
            {sit.ultimoDG && ` · último toque ${formatarData(sit.ultimoDG.data_diagnostico).slice(0, 5)}`}
          </p>
        )}
        {sit.ultimoParto && sit.status !== "prenhe" && <p className="mt-1 text-[15px] font-semibold">Último parto: {formatarData(sit.ultimoParto.data_parto)}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2 px-3 pb-3">
        {acoes.map(({ id, rotulo, Icone }) => (
          <button
            key={id}
            onClick={() => onAcao(id)}
            className={`btn-campo flex h-[88px] flex-col items-center justify-center gap-1 ${sit.proximo === id ? "bg-sol" : "bg-papel"}`}
          >
            <Icone className="size-9" strokeWidth={2.5} />
            <span className="font-display text-[20px] font-extrabold uppercase leading-none">{rotulo}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Genealogia simples (pais e avós) + relação de filhos. */
export function CartaoGenealogia({ animal, versao, onAbrir }: { animal: Animal; versao: number; onAbrir: (id: string) => void }) {
  const dados = useMemo(
    () => ({ ...genealogia(animal), filhos: filhosDe(animal.id), partos: animal.sexo === "F" ? partosDaMatriz(animal.id).length : 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [animal, versao],
  );
  const { mae, pai, avoMaterna, avoMaterno, filhos } = dados;
  if (!mae && !pai && !filhos.length && !animal.registro) return null;

  return (
    <div className="cartao-campo overflow-hidden">
      <p className="rotulo border-b-[3px] border-tinta bg-campo px-4 py-2">Genealogia{animal.registro ? ` · ${animal.registro}` : ""}</p>
      <div>
        <Linha onAbrir={onAbrir} rotulo="Mãe" valor={mae?.brinco_visual} id={mae?.id} />
        <Linha onAbrir={onAbrir} rotulo="Pai" valor={pai ? `${pai.nome}${pai.raca ? ` (${pai.raca})` : ""}` : undefined} />
        {(avoMaterna || avoMaterno) && (
          <>
            <Linha onAbrir={onAbrir} rotulo="Avó materna" valor={avoMaterna?.brinco_visual} id={avoMaterna?.id} />
            <Linha onAbrir={onAbrir} rotulo="Avô materno" valor={avoMaterno?.nome} />
          </>
        )}
      </div>
      {filhos.length > 0 && (
        <div className="border-t-[3px] border-tinta px-4 py-3">
          <p className="rotulo mb-2">
            Filhos ({filhos.length}){dados.partos ? ` · ${dados.partos} partos registrados` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {filhos.map((f) => {
              const m = idadeMeses(f.data_nascimento);
              return (
                <button key={f.id} onClick={() => onAbrir(f.id)} className="btn-campo flex h-[56px] items-center gap-2 bg-papel px-3">
                  <span className="font-display text-[24px] font-extrabold tabular-nums">{f.brinco_visual}</span>
                  <span className="text-[13px] font-bold leading-tight">
                    {f.sexo}
                    {m !== null && <span className="block">{m}m</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Linha({ rotulo, valor, id, onAbrir }: { rotulo: string; valor?: string; id?: string; onAbrir: (id: string) => void }) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-3 border-t-2 border-tinta/15 px-4 py-1.5 first:border-t-0">
      <span className="text-[15px] font-bold uppercase">{rotulo}</span>
      {id ? (
        <button onClick={() => onAbrir(id)} className="font-display text-[24px] font-extrabold underline decoration-[3px] underline-offset-4">
          {valor}
        </button>
      ) : (
        <span className="truncate text-right text-[17px] font-bold">{valor ?? "—"}</span>
      )}
    </div>
  );
}
