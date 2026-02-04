/// <reference types="vite/client" />
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Users,
  Package,
  CalendarDays,
  MessageSquare,
  Boxes,
  Wand2,
  Settings,
  LogOut,
  Loader2,
} from "lucide-react";

type Role = "viewer" | "editor" | "admin";
type ViewKey =
  | "dashboard"
  | "beneficiarios"
  | "estoque"
  | "eventos"
  | "mensagens"
  | "cestas"
  | "assistente"
  | "usuarios";

type Profile = {
  id: string;
  email: string | null;
  role: Role;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabase =
  supabaseUrl && supabaseAnon ? createClient(supabaseUrl, supabaseAnon) : null;

function isConfigured() {
  return !!supabase;
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function SidebarButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-left",
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
      )}
      type="button"
    >
      <span className={cn(active ? "text-white" : "text-slate-700")}>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

function Card({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="font-semibold text-slate-900">{title}</div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
      {children}
    </span>
  );
}

async function fetchMyProfile(): Promise<Profile | null> {
  if (!supabase) return null;

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,role")
    .eq("id", user.id)
    .maybeSingle();

  if (!error && data) {
    return {
      id: data.id as string,
      email: (data.email as string | null) ?? user.email ?? null,
      role: (data.role as Role) ?? "viewer",
    };
  }

  // fallback: cria perfil se não existir (útil em ambientes sem trigger)
  const email = user.email ?? null;
  const { error: insErr } = await supabase
    .from("profiles")
    .insert({ id: user.id, email, role: "viewer" });

  if (insErr) {
    // se o RLS bloquear, ainda dá pra seguir como viewer
    return { id: user.id, email, role: "viewer" };
  }

  return { id: user.id, email, role: "viewer" };
}

export default function App() {
  // -------- Auth state --------
  const [session, setSession] = useState<any>(null);
  const [booting, setBooting] = useState(true);

  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // -------- Profile / permissions --------
  const [profile, setProfile] = useState<Profile | null>(null);

  const adminEmails = useMemo(
    () =>
      (import.meta.env.VITE_ADMIN_EMAILS || "")
        .split(",")
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean),
    []
  );

  const canEdit = useMemo(() => {
    if (!session) return false;
    const role = profile?.role ?? "viewer";
    const emailLower = String(session?.user?.email || "").toLowerCase();
    const forceAdmin = adminEmails.includes(emailLower);
    return forceAdmin || role === "editor" || role === "admin";
  }, [adminEmails, profile, session]);

  const isAdmin = useMemo(() => {
    if (!session) return false;
    const role = profile?.role ?? "viewer";
    const emailLower = String(session?.user?.email || "").toLowerCase();
    const forceAdmin = adminEmails.includes(emailLower);
    return forceAdmin || role === "admin";
  }, [adminEmails, profile, session]);

  // -------- UI --------
  const [view, setView] = useState<ViewKey>("dashboard");

  useEffect(() => {
    if (!supabase) {
      setBooting(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!supabase || !session) {
        setProfile(null);
        return;
      }
      const p = await fetchMyProfile();
      if (!cancelled) setProfile(p);
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!supabase) {
      setAuthError(
        "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Netlify."
      );
      return;
    }

    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthBusy(false);

    if (error) setAuthError(error.message);
  };

  const doSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!supabase) {
      setAuthError(
        "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Netlify."
      );
      return;
    }

    setAuthBusy(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setAuthBusy(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    // após signup, o Supabase pode exigir confirmação por email dependendo do projeto
    setAuthTab("login");
    setAuthError(
      "Conta criada! Se o Supabase exigir confirmação por email, confirme e depois faça login."
    );
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  // -------- Auth screens --------
  if (booting) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  // Se o Supabase NÃO estiver configurado, mostramos uma mensagem clara.
  if (!isConfigured()) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow p-6 border border-slate-200">
          <div className="text-xl font-bold text-slate-900">Sistema ASA</div>
          <div className="mt-2 text-slate-700">
            Falta configurar as variáveis do Supabase no Netlify:
          </div>
          <div className="mt-3 text-sm bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div>
              <b>VITE_SUPABASE_URL</b>
            </div>
            <div>
              <b>VITE_SUPABASE_ANON_KEY</b>
            </div>
            <div className="mt-2 text-slate-600">
              Depois disso, faça um novo deploy.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 border border-slate-200">
          <div className="flex items-center gap-3">
            <img
              src="/asa-logo.jpg"
              alt="ASA"
              className="h-10 w-10 rounded-lg object-contain"
              onError={(e) =>
                (((e.currentTarget as HTMLImageElement).style.display = "none"))
              }
            />
            <div>
              <div className="text-xl font-bold text-slate-900">Sistema ASA</div>
              <div className="text-sm text-slate-600">Acesso ao painel</div>
            </div>
          </div>

          {/* Abas (Login / Criar conta) */}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setAuthTab("login")}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 font-semibold",
                authTab === "login"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white border-slate-200"
              )}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setAuthTab("signup")}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 font-semibold",
                authTab === "signup"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white border-slate-200"
              )}
            >
              Criar conta
            </button>
          </div>

          <form
            onSubmit={authTab === "login" ? doLogin : doSignup}
            className="mt-5 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-slate-700">
                E-mail
              </label>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Senha
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
              />
              <div className="text-xs text-slate-500 mt-1">
                Use uma senha forte. (O Supabase pode exigir confirmação por email.)
              </div>
            </div>

            {authError && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 text-sm">
                {authError}
              </div>
            )}

            <button
              disabled={authBusy}
              className="w-full rounded-lg bg-slate-900 text-white font-semibold py-2 disabled:opacity-60"
              type="submit"
            >
              {authBusy
                ? "Aguarde..."
                : authTab === "login"
                ? "Entrar"
                : "Criar conta"}
            </button>

            {/* Fallback: link textual (caso alguém não perceba as abas) */}
            <div className="text-center text-sm text-slate-600">
              {authTab === "login" ? (
                <>
                  Não tem conta?{" "}
                  <button
                    type="button"
                    className="font-semibold text-slate-900 underline"
                    onClick={() => setAuthTab("signup")}
                  >
                    Criar conta
                  </button>
                </>
              ) : (
                <>
                  Já tem conta?{" "}
                  <button
                    type="button"
                    className="font-semibold text-slate-900 underline"
                    onClick={() => setAuthTab("login")}
                  >
                    Fazer login
                  </button>
                </>
              )}
            </div>

            <div className="text-xs text-slate-500">
              Permissões: novos usuários entram como <b>Somente visualizar</b>. Um
              admin pode promover para <b>Pode editar</b>.
            </div>
          </form>
        </div>
      </div>
    );
  }

  // -------- App layout --------
  const emailDisplay = String(session?.user?.email || "");
  const roleDisplay = profile?.role ?? "viewer";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/asa-logo.jpg"
              alt="ASA"
              className="h-9 w-9 rounded-lg object-contain"
              onError={(e) =>
                (((e.currentTarget as HTMLImageElement).style.display = "none"))
              }
            />
            <div>
              <div className="text-lg font-bold text-slate-900">ASA</div>
              <div className="text-xs text-slate-600">
                {emailDisplay} • <Badge>{isAdmin ? "admin" : roleDisplay}</Badge>{" "}
                {!canEdit ? <Badge>somente leitura</Badge> : <Badge>pode editar</Badge>}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white font-semibold px-4 py-2"
            type="button"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="bg-white border border-slate-200 rounded-2xl p-3 h-fit">
          <div className="px-2 pb-3 flex items-center gap-2">
            <img
              src="/asa-logo.jpg"
              alt="ASA"
              className="h-9 w-9 rounded-lg object-contain"
              onError={(e) =>
                (((e.currentTarget as HTMLImageElement).style.display = "none"))
              }
            />
            <div>
              <div className="font-bold text-slate-900 leading-tight">Sistema ASA</div>
              <div className="text-xs text-slate-500 leading-tight">Menu</div>
            </div>
          </div>

          <div className="space-y-2">
            <SidebarButton
              active={view === "dashboard"}
              icon={<LayoutDashboard size={18} />}
              label="Visão Geral"
              onClick={() => setView("dashboard")}
            />
            <SidebarButton
              active={view === "estoque"}
              icon={<Package size={18} />}
              label="Estoque"
              onClick={() => setView("estoque")}
            />
            <SidebarButton
              active={view === "eventos"}
              icon={<CalendarDays size={18} />}
              label="Eventos"
              onClick={() => setView("eventos")}
            />
            <SidebarButton
              active={view === "mensagens"}
              icon={<MessageSquare size={18} />}
              label="Mensagens"
              onClick={() => setView("mensagens")}
            />
            <SidebarButton
              active={view === "beneficiarios"}
              icon={<Users size={18} />}
              label="Beneficiários"
              onClick={() => setView("beneficiarios")}
            />
            <SidebarButton
              active={view === "cestas"}
              icon={<Boxes size={18} />}
              label="Cestas Básicas"
              onClick={() => setView("cestas")}
            />
            <SidebarButton
              active={view === "assistente"}
              icon={<Wand2 size={18} />}
              label="Assistente"
              onClick={() => setView("assistente")}
            />

            {isAdmin && (
              <SidebarButton
                active={view === "usuarios"}
                icon={<Settings size={18} />}
                label="Usuários"
                onClick={() => setView("usuarios")}
              />
            )}
          </div>
        </aside>

        <section className="space-y-4">
          {view === "dashboard" && (
            <Card title="Visão Geral">
              <div className="text-slate-700">
                Painel pronto. Agora você pode plugar os dados do Supabase nas abas
                (beneficiários, estoque, eventos).
              </div>
            </Card>
          )}

          {view === "beneficiarios" && (
            <Card
              title="Beneficiários"
              right={!canEdit ? <Badge>somente leitura</Badge> : <Badge>pode editar</Badge>}
            >
              <div className="text-slate-700">
                Tela de beneficiários (cadastro/lista) — posso ligar ao Supabase
                nas tabelas <b>beneficiarios</b>.
              </div>
            </Card>
          )}

          {view === "estoque" && (
            <Card
              title="Estoque"
              right={!canEdit ? <Badge>somente leitura</Badge> : <Badge>pode editar</Badge>}
            >
              <div className="text-slate-700">
                Tela de estoque — posso ligar ao Supabase na tabela <b>estoque</b>.
              </div>
            </Card>
          )}

          {view === "eventos" && (
            <Card
              title="Eventos / Entregas"
              right={!canEdit ? <Badge>somente leitura</Badge> : <Badge>pode editar</Badge>}
            >
              <div className="text-slate-700">
                Tela de eventos — posso ligar ao Supabase na tabela <b>eventos_entrega</b>.
              </div>
            </Card>
          )}

          {view === "mensagens" && (
            <Card title="Mensagens">
              <div className="text-slate-700">
                Aba de mensagens. Se quiser, posso salvar mensagens no Supabase
                (tabela <b>mensagens</b>).
              </div>
            </Card>
          )}

          {view === "cestas" && (
            <Card
              title="Cestas Básicas"
              right={!canEdit ? <Badge>somente leitura</Badge> : <Badge>pode editar</Badge>}
            >
              <div className="text-slate-700">
                Gerenciador de cestas. IA (Gemini) só via Netlify Function (backend),
                não no front-end.
              </div>
            </Card>
          )}

          {view === "assistente" && (
            <Card title="Assistente ASA">
              <div className="text-slate-700">
                Assistente (placeholder). Se quiser, eu ativo via
                <b> /.netlify/functions/ai</b>.
              </div>
            </Card>
          )}

          {view === "usuarios" && isAdmin && (
            <UsersAdmin onRoleChanged={() => fetchMyProfile().then(setProfile)} />
          )}
        </section>
      </main>
    </div>
  );
}

function UsersAdmin({ onRoleChanged }: { onRoleChanged: () => void }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Profile[]>([]);

  const load = async () => {
    setErr(null);
    if (!supabase) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,role,created_at")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setRows(
      ((data as any[]) || []).map((r) => ({
        id: String(r.id),
        email: (r.email as string | null) ?? null,
        role: (r.role as Role) ?? "viewer",
      }))
    );
  };

  useEffect(() => {
    load();
  }, []);

  const setRole = async (id: string, role: Role) => {
    setErr(null);
    if (!supabase) return;

    setLoading(true);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    await load();
    onRoleChanged();
  };

  return (
    <Card
      title="Usuários (admin)"
      right={
        <button
          onClick={load}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          type="button"
        >
          Recarregar
        </button>
      }
    >
      {err && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 text-red-800 px-3 py-2 text-sm">
          {err}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="animate-spin" size={18} />
          Carregando…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-slate-600">Nenhum usuário encontrado.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2"
            >
              <div>
                <div className="font-semibold text-slate-900">
                  {u.email ?? "(sem email)"}
                </div>
                <div className="text-xs text-slate-600">{u.id}</div>
              </div>

              <div className="flex items-center gap-2">
                <Badge>{u.role}</Badge>
                <select
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  value={u.role}
                  onChange={(e) => setRole(u.id, e.target.value as Role)}
                >
                  <option value="viewer">viewer</option>
                  <option value="editor">editor</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
