import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileUp, Upload } from "lucide-react";
import { analisarCSV, COLUNAS, importarAnimais, modeloCSV, type Analise } from "../../lib/campo/csv";
import { useAviso } from "../curral/aviso";

/** Importação da lista de animais por planilha CSV, com prévia e validação. */
export function AbaImportar() {
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizar, setAtualizar] = useState(true);
  const [soErros, setSoErros] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof importarAnimais>> | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const aviso = useAviso();

  function baixarModelo() {
    const url = URL.createObjectURL(new Blob([modeloCSV()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-animais.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function ler(f: File) {
    setErro(null);
    setResultado(null);
    setArquivo(f.name);
    try {
      const buf = await f.arrayBuffer();
      // Excel no Windows costuma salvar CSV em Latin-1; tenta UTF-8 e cai para windows-1252
      let texto = new TextDecoder("utf-8").decode(buf);
      if (texto.includes(String.fromCharCode(0xfffd))) texto = new TextDecoder("windows-1252").decode(buf);
      setAnalise(analisarCSV(texto));
    } catch (e) {
      setAnalise(null);
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  async function importar() {
    if (!analise) return;
    setImportando(true);
    try {
      const r = await importarAnimais(analise, { atualizarExistentes: atualizar });
      setResultado(r);
      setAnalise(null);
      aviso("Importação concluída", `${r.animais} animais gravados no aparelho`);
    } catch (e) {
      aviso("Falha ao importar", String(e), "erro");
    } finally {
      setImportando(false);
    }
  }

  const comErro = analise?.linhas.filter((l) => l.erros.length).length ?? 0;
  const aImportar = analise ? (atualizar ? analise.validas : analise.novas) : 0;
  const linhasVisiveis = analise ? (soErros ? analise.linhas.filter((l) => l.erros.length) : analise.linhas).slice(0, 150) : [];

  return (
    <div className="space-y-4">
      <div className="cartao-campo space-y-3 p-4">
        <p className="text-[17px] font-semibold">
          Monte a planilha no Excel ou Google Planilhas e salve como <b>CSV</b>. Só <b>brinco</b> e <b>sexo</b> são obrigatórios. Lotes, pastos e touros que não existirem são criados pelo nome.
        </p>
        <p className="text-[14px] font-bold">Colunas: {COLUNAS.join(" · ")}</p>
        <button onClick={baixarModelo} className="btn-campo flex h-[64px] w-full items-center justify-center gap-2 bg-papel font-display text-[22px] font-extrabold uppercase">
          <Download className="size-7" strokeWidth={3} /> Baixar planilha modelo
        </button>
      </div>

      <input
        ref={input}
        type="file"
        accept=".csv,text/csv,.txt"
        aria-label="Arquivo CSV"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void ler(f);
          e.target.value = "";
        }}
      />
      <button onClick={() => input.current?.click()} className="btn-campo flex h-[88px] w-full items-center justify-center gap-3 bg-sol font-display text-[28px] font-extrabold uppercase">
        <FileUp className="size-9" strokeWidth={2.75} /> {arquivo ? "Escolher outro arquivo" : "Escolher arquivo CSV"}
      </button>

      {erro && (
        <p className="flex items-start gap-3 rounded-2xl border-[3px] border-tinta bg-alerta-claro px-4 py-3 text-[17px] font-bold text-alerta">
          <AlertTriangle className="size-7 shrink-0" strokeWidth={2.75} /> {erro}
        </p>
      )}

      {resultado && (
        <div className="rounded-2xl border-[3px] border-tinta bg-ok-claro px-4 py-3 shadow-duro">
          <p className="flex items-center gap-2 font-display text-[26px] font-extrabold uppercase">
            <CheckCircle2 className="size-8" strokeWidth={3} /> Importado
          </p>
          <p className="text-[17px] font-bold">
            {resultado.novos} novos · {resultado.atualizados} atualizados · {resultado.pesagens} pesagens
            {resultado.lotes + resultado.pastos + resultado.touros > 0 && ` · criados ${resultado.lotes} lotes, ${resultado.pastos} pastos, ${resultado.touros} touros`}
          </p>
          <p className="mt-1 text-[15px] font-semibold">Tudo foi salvo no aparelho e vai para o Supabase na próxima sincronização.</p>
        </div>
      )}

      {analise && (
        <>
          <div className="cartao-campo grid grid-cols-3 divide-x-[3px] divide-tinta">
            {[
              ["Novos", analise.novas, ""],
              ["Já existem", analise.atualizacoes, ""],
              ["Com erro", comErro, comErro ? "bg-alerta-claro text-alerta" : ""],
            ].map(([r, n, c]) => (
              <div key={r} className={`px-3 py-3 ${c}`}>
                <p className="font-display text-[40px] font-extrabold leading-none tabular-nums">{n}</p>
                <p className="text-[13px] font-bold uppercase">{r}</p>
              </div>
            ))}
          </div>

          {(analise.novosLotes.length > 0 || analise.novosPastos.length > 0 || analise.novosTouros.length > 0) && (
            <div className="cartao-campo space-y-1 p-4 text-[16px] font-bold">
              <p className="rotulo mb-1">Serão criados</p>
              {analise.novosLotes.length > 0 && <p>Lotes: {analise.novosLotes.join(", ")}</p>}
              {analise.novosPastos.length > 0 && <p>Pastos: {analise.novosPastos.join(", ")}</p>}
              {analise.novosTouros.length > 0 && <p>Touros: {analise.novosTouros.join(", ")}</p>}
            </div>
          )}
          {analise.colunasIgnoradas.length > 0 && <p className="text-[15px] font-bold">Colunas ignoradas: {analise.colunasIgnoradas.join(", ")}</p>}

          {analise.atualizacoes > 0 && (
            <label className="cartao-campo flex min-h-[72px] cursor-pointer items-center justify-between gap-4 px-4">
              <span className="text-[18px] font-bold">Atualizar os {analise.atualizacoes} que já existem</span>
              <input type="checkbox" aria-label="Atualizar existentes" checked={atualizar} onChange={(e) => setAtualizar(e.target.checked)} className="size-8 accent-mata" />
            </label>
          )}

          <div className="cartao-campo overflow-hidden">
            <div className="flex items-center justify-between border-b-[3px] border-tinta bg-campo px-4 py-2">
              <p className="rotulo">Prévia ({analise.linhas.length} linhas)</p>
              {comErro > 0 && (
                <button onClick={() => setSoErros((v) => !v)} className="h-10 text-[15px] font-bold underline decoration-2 underline-offset-2">
                  {soErros ? "Ver todas" : "Só erros"}
                </button>
              )}
            </div>
            <ul className="max-h-[420px] divide-y-2 divide-tinta/15 overflow-y-auto">
              {linhasVisiveis.map((l) => (
                <li key={l.n} className={`px-4 py-2 ${l.erros.length ? "bg-alerta-claro" : ""}`}>
                  <div className="flex items-baseline gap-3">
                    <span className="w-[42px] shrink-0 text-[13px] font-bold tabular-nums">L{l.n}</span>
                    <span className="font-display text-[24px] font-extrabold tabular-nums">{l.brinco || "—"}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                      {[l.sexo, l.raca, l.lote, l.peso !== null ? `${l.peso.toLocaleString("pt-BR")} kg` : null].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  {l.erros.map((e) => (
                    <p key={e} className="pl-[54px] text-[14px] font-bold text-alerta">✕ {e}</p>
                  ))}
                  {l.avisos.map((e) => (
                    <p key={e} className="pl-[54px] text-[14px] font-semibold">• {e}</p>
                  ))}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => void importar()}
            disabled={!aImportar || importando}
            className="btn-campo flex h-[84px] w-full items-center justify-center gap-3 bg-pasto font-display text-[26px] font-extrabold uppercase text-white"
          >
            <Upload className="size-8" strokeWidth={3} />
            {importando ? "Importando…" : `Importar ${aImportar} animais`}
          </button>
          {comErro > 0 && <p className="text-[15px] font-bold">Linhas com erro ficam de fora. Corrija na planilha e importe de novo — quem já entrou é só atualizado.</p>}
        </>
      )}
    </div>
  );
}
