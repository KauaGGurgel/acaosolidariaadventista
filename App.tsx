import { useEffect, useMemo, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Users,
  Package,
  CalendarDays,
  Boxes,
  Settings,
  LogOut,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  AlertTriangle,
} from "lucide-react";

/**
 * ✅ Regras deste App.tsx
 * - Login + Criar conta (Supabase Auth)
 * - Roles via tabela public.profiles (viewer/editor/admin)
 * - Abas: Dashboard, Estoque, Eventos, Beneficiários, Cestas
 * - Estoque: CRUD + categorias detalhadas + alertas (views alertas_validade / alertas_minimo)
 * - Sem “Assistente” e sem “Mensagens”
 *
 * ENV no Netlify:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 * - VITE_ADMIN_EMAILS (opcional: emails separados por vírgula para forçar admin no front)
 */

type Role = "viewer" | "editor" | "admin";
type ViewKey = "dashboard" | "estoque" | "eventos" | "beneficiarios" | "cestas" | "usuarios";

type Profile = {
  id: string;
  email: string | null;
  role: Role;
};

type Beneficiario = {
  id: string; // TEXT (conforme seu SQL)
  name: string;
  familySize: number;
  address: string;
  phone: string;
  lastBasketDate: string | null;
  notes: string | null;
  history: any[];
  created_at: string;
};

type EstoqueItem = {
  id: string; // UUID
  nome: string | null;
  categoria: string | null;
  quantidade: number;
  unidade: string;
  validade: string | null; // date em string YYYY-MM-DD
  status_conservacao: string | null;
  codigo_barras: string | null;
  minimo_alerta: number | null;
  data_entrada: string | null;
  status: string;
  observacoes: string | null;
  created_at: string | null;
};

type Evento = {
  id: string; // TEXT
  title: string;
  date: string; // YYYY-MM-DD
  description: string | null;
  created_at: string;
};

type AlertValidade = {
  id: string;
  nome: string;
  categoria: string;
  validade: string;
  dias_para_vencer: number;
};

type AlertMinimo = {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  minimo: number;
  falta_para_minimo: number;
};

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const supabaseAnon = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabase =
  supabaseUrl && supabaseAnon ? createClient(supabaseUrl, supabaseAnon) : null;

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
      {children}
    </span>
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
    >
      <span className={cn(active ? "text-white" : "text-slate-700")}>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
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
      id: String(data.id),
      email: (data.email as string | null) ?? user.email ?? null,
      role: (data.role as Role) ?? "viewer",
    };
  }

  // fallback: cria perfil se não existir (se RLS bloquear, segue como viewer)
  const email = user.email ?? null;
  const { error: insErr } = await supabase.from("profiles").insert({ id: user.id, email, role: "viewer" });
  if (insErr) return { id: user.id, email, role: "viewer" };
  return { id: user.id, email, role: "viewer" };
}

function prettyCat(c?: string | null) {
  const m: Record<string, string> = {
    alimento_perecivel: "Alimento (Perecível)",
    alimento_nao_perecivel: "Alimento (Não perecível)",
    higiene: "Higiene",
    roupa_masculina: "Vestimenta (Masculino)",
    roupa_feminina: "Vestimenta (Feminino)",
    roupa_infantil: "Vestimenta (Infantil)",
    movel: "Móveis",
    outros: "Outros",
  };
  if (!c) return "-";
  return m[c] ?? c;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const adminEmails = useMemo(
    () =>
      String((import.meta as any).env?.VITE_ADMIN_EMAILS || "")
        .split(",")
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean),
    []
  );

  const canEdit = useMemo(() => {
    if (!session) return false;
    const role = profile?.role ?? "viewer";
    const emailLower = String(session.user?.email || "").toLowerCase();
    const forceAdmin = adminEmails.includes(emailLower);
    return forceAdmin || role === "editor" || role === "admin";
  }, [adminEmails, profile, session]);

  const isAdmin = useMemo(() => {
    if (!session) return false;
    const role = profile?.role ?? "viewer";
    const emailLower = String(session.user?.email || "").toLowerCase();
    const forceAdmin = adminEmails.includes(emailLower);
    return forceAdmin || role === "admin";
  }, [adminEmails, profile, session]);

  const [view, setView] = useState<ViewKey>("dashboard");

  // ---------- Data ----------
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [alertValidade, setAlertValidade] = useState<AlertValidade[]>([]);
  const [alertMinimo, setAlertMinimo] = useState<AlertMinimo[]>([]);
  const [dataErr, setDataErr] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  // ---------- Estoque modal ----------
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EstoqueItem | null>(null);

  const emptyItem = useMemo(
    () => ({
      nome: "",
      categoria: "alimento_nao_perecivel",
      quantidade: 0,
      unidade: "unidade",
      validade: "",
      status_conservacao: "",
      codigo_barras: "",
      minimo_alerta: 0,
      data_entrada: "",
      status: "disponivel",
      observacoes: "",
    }),
    []
  );

  const [formItem, setFormItem] = useState<any>(emptyItem);

  // ---------- boot/auth ----------
  useEffect(() => {
    if (!supabase) {
      setBooting(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
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
      setAuthError("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Netlify.");
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
      setAuthError("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Netlify.");
      return;
    }

    setAuthBusy(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setAuthBusy(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setAuthTab("login");
    setAuthError("Conta criada! Se o Supabase exigir confirmação por email, confirme e depois faça login.");
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  // ---------- Load all data ----------
  const loadAll = async () => {
    if (!supabase) return;
    setDataErr(null);
    setDataLoading(true);

    try {
      // Beneficiários
      const b = await supabase.from("beneficiarios").select("*").order("created_at", { ascending: false });
      if (b.error) throw b.error;

      // Eventos
      const e = await supabase.from("eventos_entrega").select("*").order("date", { ascending: true });
      if (e.error) throw e.error;

      // Estoque
      const s = await supabase
        .from("estoque")
        .select("id,nome,categoria,quantidade,unidade,validade,status_conservacao,codigo_barras,minimo_alerta,data_entrada,status,observacoes,created_at")
        .order("created_at", { ascending: false });
      if (s.error) throw s.error;

      // Alertas (views)
      const av = await supabase.from("alertas_validade").select("*").order("dias_para_vencer", { ascending: true });
      const am = await supabase.from("alertas_minimo").select("*").order("falta_para_minimo", { ascending: false });

      // views podem falhar se não existirem ainda
      setAlertValidade((av.data as any[])?.map((r) => ({
        id: String(r.id),
        nome: String(r.nome),
        categoria: String(r.categoria),
        validade: String(r.validade),
        dias_para_vencer: Number(r.dias_para_vencer),
      })) ?? []);
      setAlertMinimo((am.data as any[])?.map((r) => ({
        id: String(r.id),
        nome: String(r.nome),
        categoria: String(r.categoria),
        quantidade: Number(r.quantidade ?? 0),
        minimo: Number(r.minimo ?? 0),
        falta_para_minimo: Number(r.falta_para_minimo ?? 0),
      })) ?? []);

      setBeneficiarios((b.data as any[]) as Beneficiario[]);
      setEventos((e.data as any[]) as Evento[]);
      setEstoque((s.data as any[])?.map((r) => ({
        ...r,
        quantidade: Number(r.quantidade ?? 0),
        minimo_alerta: r.minimo_alerta == null ? null : Number(r.minimo_alerta),
      })) as EstoqueItem[]);
    } catch (err: any) {
      setDataErr(err?.message ?? String(err));
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!supabase || !session) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ---------- Estoque CRUD ----------
  const openNewItem = () => {
    setEditingItem(null);
    setFormItem({ ...emptyItem });
    setItemModalOpen(true);
  };

  const openEditItem = (it: EstoqueItem) => {
    setEditingItem(it);
    setFormItem({
      nome: it.nome ?? "",
      categoria: it.categoria ?? "outros",
      quantidade: it.quantidade ?? 0,
      unidade: it.unidade ?? "unidade",
      validade: it.validade ?? "",
      status_conservacao: it.status_conservacao ?? "",
      codigo_barras: it.codigo_barras ?? "",
      minimo_alerta: it.minimo_alerta ?? 0,
      data_entrada: it.data_entrada ?? "",
      status: it.status ?? "disponivel",
      observacoes: it.observacoes ?? "",
    });
    setItemModalOpen(true);
  };

  const saveItem = async () => {
    if (!supabase) return;
    setDataErr(null);

    if (!canEdit) {
      setDataErr("Você não tem permissão para editar.");
      return;
    }

    const payload: any = {
      nome: String(formItem.nome || "").trim(),
      categoria: String(formItem.categoria || "outros"),
      quantidade: Number(formItem.quantidade || 0),
      unidade: String(formItem.unidade || "unidade"),
      validade: formItem.validade ? String(formItem.validade) : null,
      status_conservacao: formItem.status_conservacao ? String(formItem.status_conservacao) : null,
      codigo_barras: formItem.codigo_barras ? String(formItem.codigo_barras) : null,
      minimo_alerta: formItem.minimo_alerta === "" ? 0 : Number(formItem.minimo_alerta || 0),
      data_entrada: formItem.data_entrada ? String(formItem.data_entrada) : null,
      status: String(formItem.status || "disponivel"),
      observacoes: formItem.observacoes ? String(formItem.observacoes) : null,
    };

    if (!payload.nome) {
      setDataErr("Informe o nome do item.");
      return;
    }

    setDataLoading(true);
    try {
      if (editingItem?.id) {
        const { error } = await supabase.from("estoque").update(payload).eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("estoque").insert(payload);
        if (error) throw error;
      }
      setItemModalOpen(false);
      await loadAll();
    } catch (err: any) {
      setDataErr(err?.message ?? String(err));
    } finally {
      setDataLoading(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!supabase) return;
    setDataErr(null);

    if (!canEdit) {
      setDataErr("Você não tem permissão para editar.");
      return;
    }

    if (!confirm("Excluir este item do estoque?")) return;

    setDataLoading(true);
    try {
      const { error } = await supabase.from("estoque").delete().eq("id", id);
      if (error) throw error;
      await loadAll();
    } catch (err: any) {
      setDataErr(err?.message ?? String(err));
    } finally {
      setDataLoading(false);
    }
  };

  // ---------- UI ----------
  if (booting) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow p-6 border border-slate-200">
          <div className="text-xl font-bold text-slate-900">Sistema ASA</div>
          <div className="mt-2 text-slate-700">Falta configurar as variáveis do Supabase no Netlify:</div>
          <div className="mt-3 text-sm bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div>
              <b>VITE_SUPABASE_URL</b>
            </div>
            <div>
              <b>VITE_SUPABASE_ANON_KEY</b>
            </div>
            <div className="mt-2 text-slate-600">Depois disso, faça um novo deploy.</div>
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
              onError={(e) => (((e.currentTarget as HTMLImageElement).style.display = "none"))}
            />
            <div>
              <div className="text-xl font-bold text-slate-900">Sistema ASA</div>
              <div className="text-sm text-slate-600">Acesso ao painel</div>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setAuthTab("login")}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 font-semibold",
                authTab === "login" ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200"
              )}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setAuthTab("signup")}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 font-semibold",
                authTab === "signup" ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200"
              )}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={authTab === "login" ? doLogin : doSignup} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">E-mail</label>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Senha</label>
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
            >
              {authBusy ? "Aguarde..." : authTab === "login" ? "Entrar" : "Criar conta"}
            </button>

            <div className="text-xs text-slate-500">
              Permissões: novos usuários entram como <b>Somente visualizar</b>. Admin pode liberar edição.
            </div>
          </form>
        </div>
      </div>
    );
  }

  const emailDisplay = String(session.user?.email || "");
  const roleDisplay = profile?.role ?? "viewer";

  const totalEstoque = estoque.length;
  const totalBenef = beneficiarios.length;
  const totalEventos = eventos.length;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/asa-logo.jpg"
              alt="ASA"
              className="h-9 w-9 rounded-lg object-contain"
              onError={(e) => (((e.currentTarget as HTMLImageElement).style.display = "none"))}
            />
            <div>
              <div className="text-lg font-bold text-slate-900">ASA</div>
              <div className="text-xs text-slate-600">
                {emailDisplay} • <Badge>{isAdmin ? "admin" : roleDisplay}</Badge>{" "}
                {!canEdit ? <Badge>somente leitura</Badge> : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAll}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white font-semibold px-3 py-2 hover:bg-slate-50"
              title="Recarregar dados"
            >
              {dataLoading ? <Loader2 className="animate-spin" size={18} /> : <Settings size={18} />}
              Atualizar
            </button>

            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white font-semibold px-4 py-2"
            >
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="bg-white border border-slate-200 rounded-2xl p-3 h-fit">
          <div className="px-2 pb-3 flex items-center gap-2">
            <img
              src="/asa-logo.jpg"
              alt="ASA"
              className="h-9 w-9 rounded-lg object-contain"
              onError={(e) => (((e.currentTarget as HTMLImageElement).style.display = "none"))}
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
              active={view === "beneficiarios"}
              icon={<Users size={18} />}
              label="Beneficiários"
              onClick={() => setView("beneficiarios")}
            />
            <SidebarButton
              active={view === "cestas"}
              icon={<Boxes size={18} />}
              label="Cestas"
              onClick={() => setView("cestas")}
            />
            {isAdmin ? (
              <SidebarButton
                active={view === "usuarios"}
                icon={<Settings size={18} />}
                label="Usuários (info)"
                onClick={() => setView("usuarios")}
              />
            ) : null}
          </div>
        </aside>

        <section className="space-y-4">
          {dataErr ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
              <div className="font-bold flex items-center gap-2">
                <AlertTriangle size={18} /> Erro
              </div>
              <div className="text-sm mt-1">{dataErr}</div>
              <div className="text-xs mt-2 text-red-800">
                Dica: isso geralmente é RLS bloqueando, tabela/view não existe, ou variáveis do Supabase erradas.
              </div>
            </div>
          ) : null}

          {view === "dashboard" && (
            <Card title="Dashboard">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs text-slate-600">Itens em estoque</div>
                  <div className="text-2xl font-bold text-slate-900">{totalEstoque}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs text-slate-600">Beneficiários</div>
                  <div className="text-2xl font-bold text-slate-900">{totalBenef}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs text-slate-600">Eventos</div>
                  <div className="text-2xl font-bold text-slate-900">{totalEventos}</div>
                </div>
              </div>

              {(alertValidade.length > 0 || alertMinimo.length > 0) ? (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="font-bold text-red-900">⚠️ Próximos do vencimento (7 dias)</div>
                    {alertValidade.length === 0 ? (
                      <div className="text-sm text-red-800 mt-2">Nenhum.</div>
                    ) : (
                      <ul className="mt-2 text-sm text-red-800 space-y-1">
                        {alertValidade.slice(0, 8).map((a) => (
                          <li key={a.id}>
                            <b>{a.nome}</b> • {prettyCat(a.categoria)} • vence em <b>{a.validade}</b> ({a.dias_para_vencer} dias)
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="font-bold text-amber-900">📉 Abaixo do mínimo</div>
                    {alertMinimo.length === 0 ? (
                      <div className="text-sm text-amber-900 mt-2">Nenhum.</div>
                    ) : (
                      <ul className="mt-2 text-sm text-amber-900 space-y-1">
                        {alertMinimo.slice(0, 8).map((a) => (
                          <li key={a.id}>
                            <b>{a.nome}</b> • {prettyCat(a.categoria)} • qtd {a.quantidade} / mín {a.minimo} (faltam {a.falta_para_minimo})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-600">
                  Se as views <b>alertas_validade</b> e <b>alertas_minimo</b> ainda não existirem no Supabase, os alertas aparecem vazios.
                </div>
              )}
            </Card>
          )}

          {view === "estoque" && (
            <Card
              title="Estoque"
              right={
                <div className="flex items-center gap-2">
                  {!canEdit ? <Badge>somente leitura</Badge> : null}
                  {canEdit ? (
                    <button
                      onClick={openNewItem}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white font-semibold px-3 py-2"
                    >
                      <Plus size={18} /> Criar item
                    </button>
                  ) : null}
                </div>
              }
            >
              <div className="text-sm text-slate-600 mb-3">
                Categorias: alimentos (perecível / não perecível), vestimenta (masc / fem / infantil), higiene, móveis, outros.
              </div>

              <div className="overflow-auto border border-slate-200 rounded-xl">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr className="text-left">
                      <th className="p-2">Item</th>
                      <th className="p-2">Categoria</th>
                      <th className="p-2">Qtd</th>
                      <th className="p-2">Validade</th>
                      <th className="p-2">Mín</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Obs.</th>
                      <th className="p-2 w-[140px]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estoque.length === 0 ? (
                      <tr>
                        <td className="p-3 text-slate-600" colSpan={8}>
                          Nenhum item no estoque ainda. Clique em <b>Criar item</b>.
                        </td>
                      </tr>
                    ) : (
                      estoque.map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="p-2 font-medium text-slate-900">{it.nome ?? "-"}</td>
                          <td className="p-2">{prettyCat(it.categoria)}</td>
                          <td className="p-2">
                            {Number(it.quantidade ?? 0)} {it.unidade ?? "unidade"}
                          </td>
                          <td className="p-2">{it.validade ?? "-"}</td>
                          <td className="p-2">{it.minimo_alerta ?? 0}</td>
                          <td className="p-2">{it.status ?? "disponivel"}</td>
                          <td className="p-2">{it.observacoes ? it.observacoes.slice(0, 40) : "-"}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <button
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-lg border px-2 py-1",
                                  canEdit ? "border-slate-200 hover:bg-slate-50" : "border-slate-100 text-slate-300 cursor-not-allowed"
                                )}
                                onClick={() => (canEdit ? openEditItem(it) : null)}
                                disabled={!canEdit}
                                title="Editar"
                              >
                                <Pencil size={16} /> Editar
                              </button>
                              <button
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-lg border px-2 py-1",
                                  canEdit ? "border-red-200 text-red-700 hover:bg-red-50" : "border-slate-100 text-slate-300 cursor-not-allowed"
                                )}
                                onClick={() => (canEdit ? deleteItem(it.id) : null)}
                                disabled={!canEdit}
                                title="Excluir"
                              >
                                <Trash2 size={16} /> Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {itemModalOpen ? (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
                  <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-lg">
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <div className="font-bold text-slate-900">
                        {editingItem ? "Editar item" : "Criar item"}
                      </div>
                      <button
                        className="text-slate-600 hover:text-slate-900 px-2 py-1"
                        onClick={() => setItemModalOpen(false)}
                      >
                        Fechar
                      </button>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Nome</label>
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                          value={formItem.nome}
                          onChange={(e) => setFormItem((p: any) => ({ ...p, nome: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700">Categoria</label>
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                          value={formItem.categoria}
                          onChange={(e) => setFormItem((p: any) => ({ ...p, categoria: e.target.value }))}
                        >
                          <option value="alimento_perecivel">Alimento (Perecível)</option>
                          <option value="alimento_nao_perecivel">Alimento (Não perecível)</option>
                          <option value="higiene">Higiene</option>
                          <option value="roupa_masculina">Vestimenta (Masculino)</option>
                          <option value="roupa_feminina">Vestimenta (Feminino)</option>
                          <option value="roupa_infantil">Vestimenta (Infantil)</option>
                          <option value="movel">Móveis</option>
                          <option value="outros">Outros</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700">Quantidade</label>
                        <input
                          type="number"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                          value={formItem.quantidade}
                          onChange={(e) => setFormItem((p: any) => ({ ...p, quantidade: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700">Unidade</label>
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                          value={formItem.unidade}
                          onChange={(e) => setFormItem((p: any) => ({ ...p, unidade: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700">Validade (opcional)</label>
                        <input
                          type="date"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                          value={formItem.validade}
                          onChange={(e) => setFormItem((p: any) => ({ ...p, validade: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700">Mínimo p/ alerta</label>
                        <input
                          type="number"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                          value={formItem.minimo_alerta}
                          onChange={(e) => setFormItem((p: any) => ({ ...p, minimo_alerta: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700">Código de barras</label>
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                          value={formItem.codigo_barras}
                          onChange={(e) => setFormItem((p: any) => ({ ...p, codigo_barras: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700">Status</label>
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                          value={formItem.status}
                          onChange={(e) => setFormItem((p: any) => ({ ...p, status: e.target.value }))}
                        >
                          <option value="disponivel">Disponível</option>
                          <option value="reservado">Reservado</option>
                          <option value="indisponivel">Indisponível</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700">Observações</label>
                        <textarea
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                          rows={3}
                          value={formItem.observacoes}
                          onChange={(e) => setFormItem((p: any) => ({ ...p, observacoes: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
                      <button
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-semibold hover:bg-slate-50"
                        onClick={() => setItemModalOpen(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        disabled={dataLoading}
                        className="rounded-lg bg-slate-900 text-white px-4 py-2 font-semibold disabled:opacity-60"
                        onClick={saveItem}
                      >
                        {dataLoading ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </Card>
          )}

          {view === "beneficiarios" && (
            <Card title="Beneficiários" right={!canEdit ? <Badge>somente leitura</Badge> : null}>
              <div className="text-sm text-slate-600 mb-3">
                Esta aba já está ligada à tabela <b>public.beneficiarios</b>. (CRUD completo pode ser adicionado depois.)
              </div>

              <div className="overflow-auto border border-slate-200 rounded-xl">
                <table className="min-w-[700px] w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr className="text-left">
                      <th className="p-2">Nome</th>
                      <th className="p-2">Família</th>
                      <th className="p-2">Telefone</th>
                      <th className="p-2">Endereço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {beneficiarios.length === 0 ? (
                      <tr>
                        <td className="p-3 text-slate-600" colSpan={4}>
                          Nenhum beneficiário.
                        </td>
                      </tr>
                    ) : (
                      beneficiarios.map((b) => (
                        <tr key={b.id} className="border-t">
                          <td className="p-2 font-medium text-slate-900">{b.name}</td>
                          <td className="p-2">{b.familySize}</td>
                          <td className="p-2">{b.phone}</td>
                          <td className="p-2">{b.address}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {view === "eventos" && (
            <Card title="Eventos" right={!canEdit ? <Badge>somente leitura</Badge> : null}>
              <div className="text-sm text-slate-600 mb-3">
                Esta aba está ligada à tabela <b>public.eventos_entrega</b>. (CRUD completo pode ser adicionado depois.)
              </div>

              <div className="space-y-2">
                {eventos.length === 0 ? (
                  <div className="text-slate-600">Nenhum evento.</div>
                ) : (
                  eventos.map((ev) => (
                    <div key={ev.id} className="border border-slate-200 rounded-xl p-3">
                      <div className="font-semibold text-slate-900">{ev.title}</div>
                      <div className="text-xs text-slate-600">{ev.date}</div>
                      {ev.description ? <div className="text-sm text-slate-700 mt-1">{ev.description}</div> : null}
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          {view === "cestas" && (
            <Card title="Cestas">
              <div className="text-slate-700">
                Configuração de cestas usa a tabela <b>public.configuracoes</b> (keys: basket_config e assembled_baskets).
              </div>
              <div className="text-sm text-slate-600 mt-2">
                Se você quiser, eu ligo esta tela ao Supabase com edição de itens e baixa automática do estoque na entrega.
              </div>
            </Card>
          )}

          {view === "usuarios" && isAdmin && (
            <Card title="Usuários (admin)">
              <div className="text-sm text-slate-700">
                Seu SQL atual permite:
                <ul className="list-disc ml-5 mt-2 text-slate-700">
                  <li>Usuário ler/editar apenas o próprio profile (RLS).</li>
                  <li>O “admin” pelo email pode ser forçado no front via <b>VITE_ADMIN_EMAILS</b>.</li>
                </ul>
              </div>
              <div className="mt-3 text-sm text-slate-600">
                Para um painel de admin que muda roles de outros usuários, precisa de uma Function (service role) — não dá com anon key.
              </div>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
