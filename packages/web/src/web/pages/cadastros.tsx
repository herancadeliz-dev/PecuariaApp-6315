import { Loader2 } from "lucide-react";
import { Link, useParams } from "wouter";
import { useCampo } from "../hooks/use-campo";
import { Cabecalho } from "../components/curral/cabecalho";
import { AbaAnimais } from "../components/cadastros/aba-animais";
import { AbaLotes, AbaPastos, AbaTouros } from "../components/cadastros/aba-estrutura";
import { AbaImportar } from "../components/cadastros/aba-importar";
import { AbaConfigurar } from "../components/cadastros/aba-configurar";

const ABAS = [
  { id: "animais", rotulo: "Animais" },
  { id: "lotes", rotulo: "Lotes" },
  { id: "pastos", rotulo: "Pastos" },
  { id: "touros", rotulo: "Touros" },
  { id: "importar", rotulo: "Importar CSV" },
  { id: "configurar", rotulo: "Fazenda" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

/** TELA 3 — Cadastros: animais, lotes, pastos, touros, importação e configuração. */
export default function Cadastros() {
  const { pronto, versao } = useCampo();
  const params = useParams<{ aba?: string }>();
  const aba: Aba = (ABAS.find((a) => a.id === params.aba)?.id ?? "animais") as Aba;

  return (
    <div className="min-h-dvh bg-campo pb-[100px]">
      <Cabecalho painel="Cadastros" />
      <nav aria-label="Seções de cadastro" className="sticky top-0 z-20 border-b-[3px] border-tinta bg-papel">
        <div className="mx-auto flex max-w-[480px] gap-2 overflow-x-auto px-4 py-3">
          {ABAS.map((a) => (
            <Link
              key={a.id}
              to={`/cadastros/${a.id}`}
              aria-current={aba === a.id ? "page" : undefined}
              className={`shrink-0 rounded-lg border-[3px] border-tinta px-4 py-2.5 font-display text-[18px] font-extrabold uppercase ${aba === a.id ? "bg-mata text-white" : "bg-white text-tinta"}`}
            >
              {a.rotulo}
            </Link>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-[480px] space-y-4 px-4 pt-4">
        {aba === "configurar" ? (
          <AbaConfigurar />
        ) : !pronto ? (
          <div className="flex flex-col items-center gap-3 py-24">
            <Loader2 className="size-12 animate-spin" strokeWidth={3} />
            <p className="text-[20px] font-bold">Carregando…</p>
          </div>
        ) : aba === "animais" ? (
          <AbaAnimais versao={versao} />
        ) : aba === "lotes" ? (
          <AbaLotes versao={versao} />
        ) : aba === "pastos" ? (
          <AbaPastos versao={versao} />
        ) : aba === "touros" ? (
          <AbaTouros versao={versao} />
        ) : (
          <AbaImportar />
        )}
      </main>
    </div>
  );
}
