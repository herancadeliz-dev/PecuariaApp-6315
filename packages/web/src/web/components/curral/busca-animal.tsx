import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ChevronRight, Nfc, Search, X } from "lucide-react";
import * as db from "../../lib/campo/local-db";
import { buscarAnimais, carenciaAtiva } from "../../lib/campo/manejo";
import type { Animal } from "../../lib/campo/types";
import { useAviso } from "./aviso";

export interface BuscaHandle { focar: () => void; limpar: () => void }

interface Props {
  versao: number;
  onSelecionar: (a: Animal) => void;
}

/**
 * Busca por brinco visual (parcial) ou RFID.
 * Leitores RFID bastão Bluetooth em modo teclado (HID) "digitam" o código + Enter:
 * o Enter com RFID completo seleciona o animal sem toque nenhum.
 */
export const BuscaAnimal = forwardRef<BuscaHandle, Props>(function BuscaAnimal({ versao, onSelecionar }, ref) {
  const [termo, setTermo] = useState("");
  const [teclado, setTeclado] = useState<"numeric" | "text">("numeric");
  const [lendo, setLendo] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const aviso = useAviso();

  useImperativeHandle(ref, () => ({
    focar: () => input.current?.focus(),
    limpar: () => setTermo(""),
  }));

  // Busca em memória é barata (milhares de animais em <5ms); recalcula a cada render/versão.
  void versao;
  const resultado = buscarAnimais(termo);
  const lotes = new Map(db.listar("lotes").map((l) => [l.id, l]));

  function escolher(a: Animal) {
    navigator.vibrate?.(25);
    setTermo("");
    input.current?.blur();
    onSelecionar(a);
  }

  function enviar() {
    const alvo = resultado.exato ?? (resultado.lista.length === 1 ? resultado.lista[0] : undefined);
    if (alvo) escolher(alvo);
    else if (termo && !resultado.lista.length) aviso("Brinco não encontrado", `Nenhum animal com "${termo}"`, "erro");
  }

  /** Simula o bastão: lê um RFID de um animal ativo aleatório. */
  function lerRfid() {
    setLendo(true);
    navigator.vibrate?.(15);
    setTimeout(() => {
      const comChip = db.listar("animais").filter((a) => a.ativo && a.brinco_eletronico_rfid);
      setLendo(false);
      if (!comChip.length) return aviso("Nenhum chip lido", "Cadastre animais com RFID", "erro");
      const a = comChip[Math.floor(Math.random() * comChip.length)];
      navigator.vibrate?.([30, 50, 30]);
      aviso(`RFID ${a.brinco_eletronico_rfid}`, `Brinco ${a.brinco_visual}`);
      escolher(a);
    }, 1300);
  }

  return (
    <div className="space-y-3">
      <button
        onClick={lerRfid}
        disabled={lendo}
        className="btn-campo relative flex h-[92px] w-full items-center justify-center gap-4 overflow-hidden bg-mata text-white"
      >
        {lendo && <span className="anim-varredura absolute inset-0 bg-gradient-to-b from-transparent via-sol/40 to-transparent" />}
        <Nfc className="relative size-11" strokeWidth={2.5} />
        <span className="relative text-left">
          <span className="block font-display text-[30px] font-extrabold uppercase leading-none">{lendo ? "Aproxime o bastão…" : "Ler brinco RFID"}</span>
          <span className="block text-[15px] font-semibold text-sol">{lendo ? "Lendo chip" : "Leitura simulada · toque único"}</span>
        </span>
      </button>

      <div className="flex items-center gap-2">
        <div className="h-[3px] flex-1 bg-tinta/20" />
        <span className="rotulo">ou digite o brinco</span>
        <div className="h-[3px] flex-1 bg-tinta/20" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        className="flex gap-2"
      >
        <label className="flex h-[76px] min-w-0 flex-1 items-center gap-2 rounded-2xl border-[3px] border-tinta bg-papel px-3 shadow-duro focus-within:outline focus-within:outline-4 focus-within:outline-sol">
          <Search className="size-8 shrink-0" strokeWidth={3} />
          <input
            ref={input}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            inputMode={teclado}
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Nº do brinco"
            aria-label="Número do brinco ou RFID"
            className="h-full min-w-0 flex-1 bg-transparent font-display text-[34px] font-bold tabular-nums outline-none placeholder:text-tinta/45"
          />
          {termo && (
            <button type="button" onClick={() => setTermo("")} aria-label="Limpar" className="grid size-11 shrink-0 place-items-center rounded-full bg-tinta text-white">
              <X className="size-6" strokeWidth={3} />
            </button>
          )}
        </label>
        <button
          type="button"
          onClick={() => {
            setTeclado((t) => (t === "numeric" ? "text" : "numeric"));
            setTimeout(() => input.current?.focus(), 0);
          }}
          className="btn-campo h-[76px] w-[72px] shrink-0 bg-papel font-display text-[20px] font-extrabold"
          aria-label="Alternar teclado numérico/letras"
        >
          {teclado === "numeric" ? "ABC" : "123"}
        </button>
      </form>

      {termo && (
        <ul className="cartao-campo overflow-hidden" aria-label="Resultados">
          {resultado.lista.length === 0 && <li className="px-4 py-5 text-[18px] font-bold">Nenhum animal com “{termo}”.</li>}
          {resultado.lista.map((a, i) => {
            const car = carenciaAtiva(a.id);
            return (
              <li key={a.id} className={i ? "border-t-[3px] border-tinta" : ""}>
                <button onClick={() => escolher(a)} className="flex min-h-[76px] w-full items-center gap-3 px-4 py-2 text-left active:bg-sol-2">
                  <span className="font-display text-[34px] font-extrabold tabular-nums leading-none">{a.brinco_visual}</span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[16px] font-bold">{lotes.get(a.lote_id ?? "")?.nome ?? "Sem lote"}</span>
                    <span className="block text-[15px] font-semibold tabular-nums">
                      {a.peso_atual ? `${a.peso_atual.toLocaleString("pt-BR")} kg` : "Sem peso"} · {a.sexo === "M" ? "Macho" : "Fêmea"}
                    </span>
                  </span>
                  {car && <span className="rounded-lg bg-alerta px-2 py-1 text-[13px] font-bold uppercase text-white">Carência</span>}
                  <ChevronRight className="size-7 shrink-0" strokeWidth={3} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
