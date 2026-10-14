import { useEffect, useState, useSyncExternalStore } from "react";
import localforage from "localforage";
import * as db from "../lib/campo/local-db";
import { MODO_DEMO } from "../lib/campo/config";
import { semearDemo, VERSAO_SEED } from "../lib/campo/seed";
import { assinarStatus, iniciarSync, lerStatus } from "../lib/campo/sync";

let preparo: Promise<void> | null = null;
function preparar() {
  preparo ??= (async () => {
    if (MODO_DEMO) {
      const meta = localforage.createInstance({ name: "manejo-campo", storeName: "meta" });
      const n = await localforage.createInstance({ name: "manejo-campo", storeName: "animais" }).length();
      const versao = (await meta.getItem<number>("seed_versao")) ?? 1;
      if (n > 0 && versao < VERSAO_SEED) {
        // Demo antigo (sem reprodução): recria os dados de exemplo
        await localforage.dropInstance({ name: "manejo-campo" });
      }
      if (n === 0 || versao < VERSAO_SEED) {
        await semearDemo();
        await localforage.createInstance({ name: "manejo-campo", storeName: "meta" }).setItem("seed_versao", VERSAO_SEED);
      }
    }
    await db.iniciar();
    iniciarSync();
  })();
  return preparo;
}

/** Garante base local carregada; re-renderiza a cada gravação local/remota. */
export function useCampo() {
  const [pronto, setPronto] = useState(db.estaPronto());
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    preparar()
      .then(() => setPronto(true))
      .catch((e) => setErro(String(e)));
  }, []);
  const versao = useSyncExternalStore(db.assinar, db.versaoAtual);
  return { pronto, erro, versao, pendentes: db.pendentes() };
}

export function useSyncStatus() {
  return useSyncExternalStore(assinarStatus, lerStatus);
}

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener("online", a);
    window.addEventListener("offline", b);
    return () => {
      window.removeEventListener("online", a);
      window.removeEventListener("offline", b);
    };
  }, []);
  return on;
}
