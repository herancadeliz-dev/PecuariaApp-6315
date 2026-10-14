import { useState } from "react";
import { AlertTriangle, CheckCircle2, CloudOff, HardDrive, LogIn, RefreshCw, Settings, Wifi, WifiOff } from "lucide-react";
import { useCampo, useOnline, useSyncStatus } from "../../hooks/use-campo";
import { Link } from "wouter";
import { MODO_DEMO, NOME_FAZENDA, SEM_FAZENDA } from "../../lib/campo/config";
import { simularOffline, sincronizar, type EstadoSync } from "../../lib/campo/sync";
import { filaPendente } from "../../lib/campo/local-db";
import { Folha } from "./folha";
import { LoginSupabase } from "./login-supabase";


const ROTULO: Record<EstadoSync, string> = {
  demo: "No aparelho",
  offline: "Sem sinal",
  sincronizando: "Sincronizando",
  ok: "Sincronizado",
  erro: "Erro no envio",
  sem_login: "Entrar p/ enviar",
  sem_fazenda: "Escolher fazenda",
};

const NOME_TABELA: Record<string, string> = {
  historico_pesagens: "Pesagem",
  historico_sanitario: "Sanitário",
  animais: "Animal",
  lotes: "Lote",
  pastos_piquetes: "Pasto",
  touros: "Touro",
  coberturas: "Cobertura / IA",
  diagnosticos_gestacao: "Diagnóstico",
  partos: "Parto",
};

function IconeEstado({ estado, className }: { estado: EstadoSync; className?: string }) {
  const p = { className, strokeWidth: 2.75 };
  if (estado === "sincronizando") return <RefreshCw {...p} className={`${className} animate-spin`} />;
  if (estado === "offline") return <CloudOff {...p} />;
  if (estado === "erro") return <AlertTriangle {...p} />;
  if (estado === "sem_login" || estado === "sem_fazenda") return <LogIn {...p} />;
  if (estado === "demo") return <HardDrive {...p} />;
  return <CheckCircle2 {...p} />;
}

export function Cabecalho({ painel = "Painel do Peão" }: { painel?: string }) {
  const { pendentes } = useCampo();
  const st = useSyncStatus();
  const online = useOnline() && !st.simularOffline;
  const [aberto, setAberto] = useState(false);

  const corPilula =
    st.estado === "erro" ? "bg-alerta text-white" : st.estado === "ok" && !pendentes ? "bg-ok-claro text-tinta" : "bg-sol text-tinta";

  return (
    <>
      <header className="sticky top-0 z-40 border-b-[3px] border-tinta bg-mata text-white">
        <div className="mx-auto flex max-w-[480px] items-center gap-3 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
          <div className="min-w-0 flex-1">
            <p className="rotulo text-sol">{painel}</p>
            <h1 className="truncate font-display text-[24px] font-extrabold uppercase leading-none">{NOME_FAZENDA}</h1>
          </div>
          <button
            onClick={() => setAberto(true)}
            className={`flex h-14 items-center gap-2 rounded-full border-[3px] border-tinta px-3.5 shadow-duro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${corPilula}`}
            aria-label={`Sincronização: ${ROTULO[st.estado]}, ${pendentes} pendentes`}
          >
            <IconeEstado estado={st.estado} className="size-6" />
            <span className="text-left leading-none">
              <span className="block text-[15px] font-bold">{ROTULO[st.estado]}</span>
              {pendentes > 0 && <span className="block text-[13px] font-bold">{pendentes} na fila</span>}
            </span>
          </button>
        </div>
      </header>

      <Folha aberta={aberto} onFechar={() => setAberto(false)} titulo="Sincronização" subtitulo="Tudo é salvo no celular primeiro. Envia sozinho quando o sinal firmar.">
        <div className="space-y-4">
          <div className="cartao-campo grid grid-cols-2 divide-x-[3px] divide-tinta">
            <div className="p-4">
              <p className="rotulo">Na fila</p>
              <p className="font-display text-[48px] font-extrabold leading-none tabular-nums">{pendentes}</p>
            </div>
            <div className="p-4">
              <p className="rotulo">Sinal</p>
              <p className="mt-2 flex items-center gap-2 text-[22px] font-bold">
                {online ? <Wifi className="size-7" strokeWidth={3} /> : <WifiOff className="size-7 text-alerta" strokeWidth={3} />}
                {online ? "Com internet" : "Sem internet"}
              </p>
            </div>
          </div>

          <div className="cartao-campo p-4 text-[17px] font-semibold">
            <p>
              Estado: <b>{ROTULO[st.estado]}</b>
            </p>
            <p>Último envio: <b>{st.ultimoSync ? new Date(st.ultimoSync).toLocaleString("pt-BR") : "nunca"}</b></p>
            {(MODO_DEMO || SEM_FAZENDA) && (
              <p className="mt-2 rounded-xl bg-sol-2 p-3">
                {MODO_DEMO ? "Modo demonstração: Supabase não configurado. Os dados ficam só neste aparelho." : "Falta escolher ou criar a fazenda."}
              </p>
            )}
            {st.erro && <p className="mt-2 rounded-xl bg-alerta-claro p-3 text-alerta">{st.erro}</p>}
          </div>

          <Link
            to="/cadastros/configurar"
            onClick={() => setAberto(false)}
            className="btn-campo flex h-[68px] w-full items-center justify-center gap-2 bg-mata font-display text-[22px] font-extrabold uppercase text-white"
          >
            <Settings className="size-7" strokeWidth={2.75} />
            {MODO_DEMO || SEM_FAZENDA ? "Configurar fazenda" : "Trocar fazenda / conexão"}
          </Link>

          {!SEM_FAZENDA && <LoginSupabase />}

          {pendentes > 0 && (
            <ul className="cartao-campo max-h-48 divide-y-2 divide-tinta/15 overflow-y-auto">
              {filaPendente().slice(-20).reverse().map((f) => (
                <li key={`${f.tabela}:${f.id}`} className="flex justify-between gap-2 px-4 py-2.5 text-[16px] font-semibold">
                  <span>{NOME_TABELA[f.tabela] ?? f.tabela}</span>
                  <span className="tabular-nums">{new Date(f.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          )}

          <button
            disabled={MODO_DEMO || st.estado === "sincronizando"}
            onClick={() => void sincronizar()}
            className="btn-campo flex h-[76px] w-full items-center justify-center gap-3 bg-sol font-display text-[26px] font-extrabold uppercase"
          >
            <RefreshCw className={`size-8 ${st.estado === "sincronizando" ? "animate-spin" : ""}`} strokeWidth={3} />
            Sincronizar agora
          </button>

          <label className="cartao-campo flex min-h-[72px] cursor-pointer items-center justify-between gap-4 px-4">
            <span className="text-[18px] font-bold">Simular sem sinal (teste)</span>
            <input
              type="checkbox"
              aria-label="Simular sem sinal"
              checked={st.simularOffline}
              onChange={(e) => simularOffline(e.target.checked)}
              className="size-8 accent-mata"
            />
          </label>
        </div>
      </Folha>
    </>
  );
}
