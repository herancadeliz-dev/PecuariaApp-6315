import { useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { supabase } from "../../lib/campo/config";
import { sincronizar } from "../../lib/campo/sync";

/**
 * Login e-mail/senha do Supabase. A sessão fica salva no aparelho:
 * entra uma vez com sinal e depois trabalha offline normalmente.
 */
export function LoginSupabase() {
  const [email, setEmail] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", senha: "" });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) return null;

  if (email)
    return (
      <div className="cartao-campo flex items-center gap-3 px-4 py-3">
        <p className="min-w-0 flex-1 truncate text-[17px] font-bold">Conectado: {email}</p>
        <button onClick={() => void supabase!.auth.signOut()} className="btn-campo flex h-14 items-center gap-2 bg-papel px-3 text-[16px] font-bold">
          <LogOut className="size-5" strokeWidth={3} /> Sair
        </button>
      </div>
    );

  return (
    <form
      className="cartao-campo space-y-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setCarregando(true);
        setErro(null);
        const { error } = await supabase!.auth.signInWithPassword({ email: form.email.trim(), password: form.senha });
        setCarregando(false);
        if (error) setErro(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos" : error.message);
        else void sincronizar();
      }}
    >
      <p className="rotulo">Entrar para enviar os dados</p>
      <input
        type="email"
        autoComplete="email"
        aria-label="E-mail"
        placeholder="E-mail"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="h-[64px] w-full rounded-xl border-[3px] border-tinta bg-papel px-4 text-[20px] font-bold outline-none focus:outline-4 focus:outline-sol"
      />
      <input
        type="password"
        autoComplete="current-password"
        aria-label="Senha"
        placeholder="Senha"
        value={form.senha}
        onChange={(e) => setForm({ ...form, senha: e.target.value })}
        className="h-[64px] w-full rounded-xl border-[3px] border-tinta bg-papel px-4 text-[20px] font-bold outline-none focus:outline-4 focus:outline-sol"
      />
      {erro && <p className="rounded-xl bg-alerta-claro p-3 text-[16px] font-bold text-alerta">{erro}</p>}
      <button
        disabled={carregando || !form.email || !form.senha}
        className="btn-campo flex h-[68px] w-full items-center justify-center gap-2 bg-mata font-display text-[24px] font-extrabold uppercase text-white"
      >
        <LogIn className="size-7" strokeWidth={3} />
        {carregando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
