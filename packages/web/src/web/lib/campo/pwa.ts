// Service worker: guarda o app no aparelho para abrir no curral sem internet.
// Só em produção (em dev o Vite faz HMR e o cache atrapalharia).
export function registrarServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
