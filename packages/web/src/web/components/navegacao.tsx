import { Link, useLocation } from "wouter";
import { BarChart3, ClipboardList, Scale } from "lucide-react";

/** Barra inferior fixa: troca Curral, Gestor e Cadastros com o polegar. */
export function Navegacao() {
  const [loc] = useLocation();
  const itens = [
    { to: "/", rotulo: "Curral", Icone: Scale },
    { to: "/gestor", rotulo: "Gestor", Icone: BarChart3 },
    { to: "/cadastros", rotulo: "Cadastros", Icone: ClipboardList },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-tinta bg-papel pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-[480px] grid-cols-3">
        {itens.map(({ to, rotulo, Icone }) => {
          const ativo = to === "/" ? loc === "/" : loc.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={ativo ? "page" : undefined}
              className={`flex h-[68px] items-center justify-center gap-1.5 font-display text-[19px] font-extrabold uppercase ${ativo ? "bg-mata text-white" : "text-tinta"}`}
            >
              <Icone className="size-6" strokeWidth={2.75} />
              {rotulo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
