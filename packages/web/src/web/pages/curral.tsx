import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useCampo } from "../hooks/use-campo";
import * as db from "../lib/campo/local-db";
import { hojeISO } from "../lib/campo/manejo";
import { Cabecalho } from "../components/curral/cabecalho";
import { BuscaAnimal, type BuscaHandle } from "../components/curral/busca-animal";
import { FichaAnimal } from "../components/curral/ficha-animal";
import { FolhaPesagem } from "../components/curral/folha-pesagem";
import { FolhaSanitario } from "../components/curral/folha-sanitario";
import { FolhaCobertura } from "../components/curral/folha-cobertura";
import { FolhaDiagnostico } from "../components/curral/folha-diagnostico";
import { FolhaParto } from "../components/curral/folha-parto";

/** TELA 1 — Painel do Peão: manejo rápido no curral, 100% offline. */
export default function Curral() {
  const { pronto, erro, versao } = useCampo();
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [folha, setFolha] = useState<"peso" | "san" | "cobrir" | "dg" | "parto" | null>(null);
  const busca = useRef<BuscaHandle>(null);

  const animal = animalId ? db.obter("animais", animalId) : undefined;
  const lote = animal?.lote_id ? db.obter("lotes", animal.lote_id) : undefined;

  const hoje = useMemo(() => {
    if (!pronto) return null;
    const d = hojeISO();
    const pes = db.listar("historico_pesagens").filter((p) => p.data_pesagem === d);
    const san = db.listar("historico_sanitario").filter((s) => s.data_aplicacao === d);
    const recentes = [...pes, ...san]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((r) => r.animal_id)
      .filter((id, i, arr) => arr.indexOf(id) === i)
      .slice(0, 6)
      .map((id) => db.obter("animais", id))
      .filter((a) => !!a);
    return { pesados: pes.length, medicados: san.length, ativos: db.listar("animais").filter((a) => a.ativo).length, recentes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, versao]);

  function proximo() {
    setAnimalId(null);
    window.scrollTo({ top: 0 });
    setTimeout(() => busca.current?.focar(), 50);
  }

  return (
    <div className="min-h-dvh bg-campo pb-[100px]">
      <Cabecalho />

      <main className="mx-auto max-w-[480px] px-4 pt-4">
        {!pronto ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            {erro ? (
              <p className="text-[18px] font-bold text-alerta">Falha ao abrir dados do aparelho: {erro}</p>
            ) : (
              <>
                <Loader2 className="size-12 animate-spin" strokeWidth={3} />
                <p className="text-[20px] font-bold">Carregando rebanho do aparelho…</p>
              </>
            )}
          </div>
        ) : animal ? (
          <>
            <button onClick={proximo} className="mb-3 flex h-12 items-center gap-2 text-[18px] font-bold underline decoration-[3px] underline-offset-4">
              <ArrowLeft className="size-6" strokeWidth={3} /> Buscar outro
            </button>
            <FichaAnimal animal={animal} versao={versao} onPesar={() => setFolha("peso")} onMedicar={() => setFolha("san")}
              onProximo={proximo}
              onReproducao={setFolha}
              onAbrir={(id) => {
                setAnimalId(id);
                window.scrollTo({ top: 0 });
              }}
            />
            <FolhaPesagem animal={animal} lote={lote} aberta={folha === "peso"} onFechar={() => setFolha(null)} />
            <FolhaSanitario animal={animal} aberta={folha === "san"} onFechar={() => setFolha(null)} />
            <FolhaCobertura animal={animal} versao={versao} aberta={folha === "cobrir"} onFechar={() => setFolha(null)} />
            <FolhaDiagnostico animal={animal} versao={versao} aberta={folha === "dg"} onFechar={() => setFolha(null)} />
            <FolhaParto animal={animal} versao={versao} aberta={folha === "parto"} onFechar={() => setFolha(null)} />
          </>
        ) : (
          <div className="space-y-5">
            <BuscaAnimal ref={busca} versao={versao} onSelecionar={(a) => setAnimalId(a.id)} />

            {hoje && (
              <section aria-label="Resumo de hoje">
                <p className="rotulo mb-2">Hoje no curral</p>
                <div className="cartao-campo grid grid-cols-3 divide-x-[3px] divide-tinta">
                  {[
                    ["Pesados", hoje.pesados],
                    ["Medicados", hoje.medicados],
                    ["Rebanho", hoje.ativos],
                  ].map(([r, n]) => (
                    <div key={r} className="px-3 py-3">
                      <p className="font-display text-[44px] font-extrabold leading-none tabular-nums">{n}</p>
                      <p className="text-[14px] font-bold uppercase">{r}</p>
                    </div>
                  ))}
                </div>

                {hoje.recentes.length > 0 && (
                  <>
                    <p className="rotulo mb-2 mt-5">Manejados agora há pouco</p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {hoje.recentes.map((a) => (
                        <button key={a.id} onClick={() => setAnimalId(a.id)} className="btn-campo h-[68px] bg-papel font-display text-[30px] font-extrabold tabular-nums">
                          {a.brinco_visual}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
