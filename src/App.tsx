import { useEffect, useMemo, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Users,
  Package,
  CalendarDays,
  Boxes,
  FileDown,
  Printer,
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
type ViewKey =
  | "dashboard"
  | "estoque"
  | "eventos"
  | "beneficiarios"
  | "cestas"
  | "relatorios"
  | "usuarios";

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

type BasketConfigItem = {
  estoque_id: string; // uuid
  nome: string;
  quantidade: number; // por cesta
  unidade: string;
};

type BasketConfig = {
  name: string;
  items: BasketConfigItem[];
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
const [basketConfig, setBasketConfig] = useState<BasketConfig>({ name: "Cesta Básica Padrão", items: [] });
  const [assembledBaskets, setAssembledBaskets] = useState<number>(0);

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


// Configurações (cestas + contador)
const cfg = await supabase
  .from("configuracoes")
  .select("key,value")
  .in("key", ["basket_config", "assembled_baskets"]);

if (!cfg.error && cfg.data) {
  const basketRow = (cfg.data as any[]).find((r) => r.key === "basket_config");
  if (basketRow?.value) {
    const v = basketRow.value as any;
    if (v && typeof v === "object") {
      setBasketConfig({
        name: String(v.name ?? "Cesta Básica Padrão"),
        items: Array.isArray(v.items)
          ? v.items.map((it: any) => ({
              estoque_id: String(it.estoque_id ?? it.id ?? ""),
              nome: String(it.nome ?? it.name ?? ""),
              quantidade: Number(it.quantidade ?? it.quantity ?? 0),
              unidade: String(it.unidade ?? it.unit ?? "unidade"),
            }))
          : [],
      });
    }
  }

  const assembledRow = (cfg.data as any[]).find((r) => r.key === "assembled_baskets");
  if (assembledRow) {
    const raw = (assembledRow as any).value;
    const num = typeof raw === "number" ? raw : Number(raw ?? 0);
    setAssembledBaskets(Number.isFinite(num) ? num : 0);
  }
}

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

            <SidebarButton
              active={view === "relatorios"}
              icon={<FileDown size={18} />}
              label="Relatórios"
              onClick={() => setView("relatorios")}
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
            <CestasManager
              canEdit={canEdit}
              inventory={inventory}
              basketConfig={basketConfig}
              setBasketConfig={setBasketConfig}
              assembledBaskets={assembledBaskets}
              setAssembledBaskets={setAssembledBaskets}
              onReload={loadAll}
            />
          )}
          {view === "relatorios" && (
            <Relatorios
              estoque={estoque}
              beneficiarios={beneficiarios}
              assembledBaskets={assembledBaskets}
              alertasValidade={alertValidade}
              alertasMinimo={alertMinimo}
            />
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

function fmtDateBR(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR");
}

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


function CestasManager({
  canEdit,
  inventory,
  basketConfig,
  setBasketConfig,
  assembledBaskets,
  setAssembledBaskets,
  onReload,
}: {
  canEdit: boolean;
  inventory: EstoqueItem[];
  basketConfig: BasketConfig;
  setBasketConfig: (v: BasketConfig) => void;
  assembledBaskets: number;
  setAssembledBaskets: (v: number) => void;
  onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [newItemId, setNewItemId] = useState<string>("");
  const [newItemQtd, setNewItemQtd] = useState<number>(1);
  const [qtdCestas, setQtdCestas] = useState<number>(1);

  const inventorySorted = useMemo(() => {
    return [...inventory].sort((a, b) =>
      String(a.nome ?? "").localeCompare(String(b.nome ?? ""))
    );
  }, [inventory]);

  const invById = useMemo(() => {
    const m = new Map<string, EstoqueItem>();
    for (const it of inventory) m.set(it.id, it);
    return m;
  }, [inventory]);

  const addItem = () => {
    setErr(null);
    setOk(null);
    if (!newItemId) return;

    const inv = invById.get(newItemId);
    if (!inv) return;

    const already = basketConfig.items.some((x) => x.estoque_id === newItemId);
    if (already) {
      setErr("Este item já está na configuração da cesta.");
      return;
    }

    setBasketConfig({
      ...basketConfig,
      items: [
        ...basketConfig.items,
        {
          estoque_id: inv.id,
          nome: String(inv.nome ?? "Item"),
          quantidade: Number(newItemQtd || 1),
          unidade: String(inv.unidade || "unidade"),
        },
      ],
    });

    setNewItemId("");
    setNewItemQtd(1);
  };

  const updateItemQtd = (id: string, qtd: number) => {
    setBasketConfig({
      ...basketConfig,
      items: basketConfig.items.map((it) =>
        it.estoque_id === id ? { ...it, quantidade: Number(qtd) } : it
      ),
    });
  };

  const removeItem = (id: string) => {
    setBasketConfig({
      ...basketConfig,
      items: basketConfig.items.filter((it) => it.estoque_id !== id),
    });
  };

  const saveConfig = async () => {
    setErr(null);
    setOk(null);
    if (!supabase) return;

    setBusy(true);
    const { error } = await supabase
      .from("configuracoes")
      .upsert([{ key: "basket_config", value: basketConfig }], { onConflict: "key" });
    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }
    setOk("Configuração salva.");
  };

  const registerBasket = async () => {
    setErr(null);
    setOk(null);
    if (!supabase) return;
    if (!canEdit) {
      setErr("Você está em modo somente leitura.");
      return;
    }

    const n = Math.max(1, Number(qtdCestas || 1));
    if (basketConfig.items.length === 0) {
      setErr("Configure pelo menos 1 item na cesta antes de registrar.");
      return;
    }

    // Validação: estoque suficiente
    const needed: Array<{ id: string; nome: string; need: number; have: number }> = [];
    for (const it of basketConfig.items) {
      const inv = invById.get(it.estoque_id);
      const have = Number(inv?.quantidade ?? 0);
      const need = Number(it.quantidade ?? 0) * n;
      needed.push({ id: it.estoque_id, nome: it.nome, need, have });
    }
    const insufficient = needed.filter((x) => x.have < x.need);
    if (insufficient.length > 0) {
      setErr(
        "Estoque insuficiente para: " +
          insufficient.map((x) => `${x.nome} (precisa ${x.need}, tem ${x.have})`).join(", ")
      );
      return;
    }

    setBusy(true);

    // Baixa automática (decrementa estoque)
    for (const it of needed) {
      const inv = invById.get(it.id);
      const current = Number(inv?.quantidade ?? 0);
      const next = current - it.need;

      const { error } = await supabase
        .from("estoque")
        .update({ quantidade: next, quantity: next })
        .eq("id", it.id);

      if (error) {
        setBusy(false);
        setErr("Erro ao dar baixa no item: " + it.nome + " — " + error.message);
        return;
      }
    }

    // Atualiza contador de cestas montadas
    const newCount = assembledBaskets + n;
    const { error: cfgErr } = await supabase
      .from("configuracoes")
      .upsert([{ key: "assembled_baskets", value: newCount }], { onConflict: "key" });

    setBusy(false);

    if (cfgErr) {
      setErr("Baixa feita, mas falhou ao atualizar contador: " + cfgErr.message);
      return;
    }

    setAssembledBaskets(newCount);
    setOk(`Cesta registrada! Baixa automática aplicada (${n}x).`);
    await onReload();
  };

  return (
    <div className="space-y-4">
      <Card title="Cestas Básicas" right={<Badge>{assembledBaskets} cestas montadas</Badge>}>
        <div className="text-slate-700">
          Configure os itens da cesta e, ao registrar uma cesta, o sistema dá baixa automática no estoque.
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {err}
          </div>
        )}
        {ok && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {ok}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nome da cesta</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={basketConfig.name}
              onChange={(e) => setBasketConfig({ ...basketConfig, name: e.target.value })}
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={saveConfig}
              disabled={!canEdit || busy}
              className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Salvando..." : "Salvar configuração"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_120px]">
          <div>
            <label className="block text-sm font-medium text-slate-700">Adicionar item do estoque</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={newItemId}
              onChange={(e) => setNewItemId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {inventorySorted.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome ?? "(sem nome)"} — {i.quantidade} {i.unidade}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Qtd / cesta</label>
            <input
              type="number"
              min={0}
              step={1}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={newItemQtd}
              onChange={(e) => setNewItemQtd(Number(e.target.value))}
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={addItem}
              disabled={!canEdit || busy || !newItemId}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold hover:bg-slate-50 disabled:opacity-60"
            >
              Adicionar
            </button>
          </div>
        </div>

        <div className="mt-4">
          {basketConfig.items.length === 0 ? (
            <div className="text-slate-600">Nenhum item configurado ainda.</div>
          ) : (
            <div className="space-y-2">
              {basketConfig.items.map((it) => {
                const inv = invById.get(it.estoque_id);
                return (
                  <div
                    key={it.estoque_id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 px-3 py-2 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{it.nome}</div>
                      <div className="text-xs text-slate-600">
                        Estoque: {Number(inv?.quantidade ?? 0)} {String(inv?.unidade ?? "unidade")}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1"
                        value={it.quantidade}
                        onChange={(e) => updateItemQtd(it.estoque_id, Number(e.target.value))}
                        disabled={!canEdit || busy}
                      />
                      <span className="text-sm text-slate-600">{it.unidade}</span>
                      <button
                        onClick={() => removeItem(it.estoque_id)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
                        disabled={!canEdit || busy}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full md:w-56">
            <label className="block text-sm font-medium text-slate-700">Quantidade de cestas</label>
            <input
              type="number"
              min={1}
              step={1}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={qtdCestas}
              onChange={(e) => setQtdCestas(Number(e.target.value))}
              disabled={!canEdit || busy}
            />
          </div>

          <button
            onClick={registerBasket}
            disabled={!canEdit || busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Processando..." : "Registrar cesta e dar baixa"}
          </button>
        </div>
      </Card>
    </div>
  );
}

function Relatorios({
  estoque,
  beneficiarios,
  assembledBaskets,
  alertasValidade,
  alertasMinimo,
}: {
  estoque: EstoqueItem[];
  beneficiarios: Beneficiario[];
  assembledBaskets: number;
  alertasValidade: AlertValidade[];
  alertasMinimo: AlertMinimo[];
}) {
  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  const [rangeStart, setRangeStart] = useState<string>(() => monthStart.toISOString().slice(0, 10));
  const [rangeEnd, setRangeEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const inRange = (iso?: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const start = new Date(rangeStart + "T00:00:00");
    const end = new Date(rangeEnd + "T23:59:59");
    return d >= start && d <= end;
  };

  const estoqueNoPeriodo = useMemo(
    () => estoque.filter((i) => inRange(i.created_at ?? null)),
    [estoque, rangeStart, rangeEnd]
  );

  const beneficiariosNoPeriodo = useMemo(
    () => beneficiarios.filter((b) => inRange(b.created_at ?? null)),
    [beneficiarios, rangeStart, rangeEnd]
  );

  const sumByCategorias = useMemo(() => {
    const by: Record<string, number> = {};
    for (const it of estoque) {
      const cat = it.categoria || "outros";
      const q = Number(it.quantidade || 0);
      by[cat] = (by[cat] || 0) + (Number.isFinite(q) ? q : 0);
    }
    return by;
  }, [estoque]);

  const totalItensNoPeriodo = useMemo(() => {
    let total = 0;
    for (const it of estoqueNoPeriodo) total += Number(it.quantidade || 0);
    return total;
  }, [estoqueNoPeriodo]);

  const roupasAtual = useMemo(() => {
    const cats = new Set(["roupa_masculina", "roupa_feminina", "roupa_infantil"]);
    return estoque
      .filter((i) => cats.has(i.categoria || ""))
      .reduce((acc, i) => acc + Number(i.quantidade || 0), 0);
  }, [estoque]);

  const alimentosAtual = useMemo(() => {
    const cats = new Set(["alimento_perecivel", "alimento_nao_perecivel"]);
    return estoque
      .filter((i) => cats.has(i.categoria || ""))
      .reduce((acc, i) => acc + Number(i.quantidade || 0), 0);
  }, [estoque]);

  const printReport = () => {
    const html = document.getElementById("asa-report")?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Relatório ASA</title>
      <style>
        body{font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding:24px; color:#0f172a;}
        h1{font-size:20px;margin:0 0 8px;}
        h2{font-size:14px;margin:18px 0 8px;}
        table{width:100%; border-collapse:collapse; margin-top:8px;}
        th,td{border:1px solid #e2e8f0; padding:8px; font-size:12px; text-align:left;}
        th{background:#f1f5f9;}
        .muted{color:#475569; font-size:12px;}
        .pill{display:inline-block; padding:2px 8px; border:1px solid #e2e8f0; border-radius:999px; background:#f8fafc; font-size:12px; margin-right:6px;}
      </style>
    </head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const downloadCSV = () => {
    const lines: string[] = [];
    lines.push(["Relatório ASA"].join(","));
    lines.push([`Período: ${rangeStart} até ${rangeEnd}`].join(","));
    lines.push([""].join(","));
    lines.push(["Resumo"].join(","));
    lines.push(["Cestas montadas (configuracoes.assembled_baskets)", String(assembledBaskets)].join(","));
    lines.push(["Beneficiários cadastrados no período", String(beneficiariosNoPeriodo.length)].join(","));
    lines.push(["Itens lançados no período (soma de quantidade)", String(totalItensNoPeriodo)].join(","));
    lines.push(["Estoque atual - alimentos (soma)", String(alimentosAtual)].join(","));
    lines.push(["Estoque atual - roupas (soma)", String(roupasAtual)].join(","));
    lines.push([""].join(","));
    lines.push(["Estoque por categoria (atual)", "Quantidade"].join(","));
    Object.entries(sumByCategorias)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([k, v]) => lines.push([k, String(v)].join(",")));
    lines.push([""].join(","));
    lines.push(["Alertas - validade (<=7 dias)", "Dias para vencer"].join(","));
    alertasValidade.forEach((a) => lines.push([a.nome, String(a.dias_para_vencer ?? "")].join(",")));
    lines.push([""].join(","));
    lines.push(["Alertas - mínimo", "Falta p/ mínimo"].join(","));
    alertasMinimo.forEach((a) => lines.push([a.nome, String(a.falta_para_minimo ?? "")].join(",")));

    downloadTextFile(`relatorio-asa-${rangeStart}-a-${rangeEnd}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  };

  return (
    <Card
      title="Relatórios"
      right={
        <div className="flex items-center gap-2">
          <button
            onClick={printReport}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            <Printer size={16} />
            Imprimir
          </button>
          <button
            onClick={downloadCSV}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm"
          >
            <FileDown size={16} />
            Baixar CSV
          </button>
        </div>
      }
    >
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div>
          <div className="text-sm font-medium text-slate-700">Início</div>
          <input
            type="date"
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
          />
        </div>
        <div>
          <div className="text-sm font-medium text-slate-700">Fim</div>
          <input
            type="date"
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
          />
        </div>
        <div className="text-sm text-slate-600 md:pb-2">
          Dica: por padrão, o período começa no <b>1º dia do mês</b>.
        </div>
      </div>

      <div id="asa-report" className="mt-4">
        <h1 className="font-bold">Relatório ASA</h1>
        <div className="muted">Período: {fmtDateBR(rangeStart)} até {fmtDateBR(rangeEnd)}</div>

        <h2 className="font-semibold mt-4">Resumo</h2>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="pill">Cestas montadas: <b>{assembledBaskets}</b></span>
          <span className="pill">Beneficiários no período: <b>{beneficiariosNoPeriodo.length}</b></span>
          <span className="pill">Itens lançados no período (soma): <b>{totalItensNoPeriodo}</b></span>
          <span className="pill">Estoque atual (alimentos): <b>{alimentosAtual}</b></span>
          <span className="pill">Estoque atual (roupas): <b>{roupasAtual}</b></span>
        </div>

        <h2 className="font-semibold">Estoque por categoria (atual)</h2>
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(sumByCategorias)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
          </tbody>
        </table>

        <h2 className="font-semibold">Beneficiários cadastrados no período</h2>
        {beneficiariosNoPeriodo.length === 0 ? (
          <div className="text-sm text-slate-600 mt-2">Nenhum cadastro no período.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tamanho da família</th>
                <th>Telefone</th>
                <th>Endereço</th>
              </tr>
            </thead>
            <tbody>
              {beneficiariosNoPeriodo.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{b.familySize}</td>
                  <td>{b.phone}</td>
                  <td>{b.address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2 className="font-semibold">Alertas</h2>
        <div className="text-sm text-slate-600 mt-2">
          {alertasValidade.length === 0 && alertasMinimo.length === 0
            ? "Nenhum alerta no momento."
            : "Itens com validade próxima e/ou abaixo do mínimo."}
        </div>

        {alertasValidade.length > 0 && (
          <>
            <h2 className="font-semibold">Validade (até 7 dias)</h2>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Categoria</th>
                  <th>Validade</th>
                  <th>Dias p/ vencer</th>
                </tr>
              </thead>
              <tbody>
                {alertasValidade.map((a) => (
                  <tr key={a.id}>
                    <td>{a.nome}</td>
                    <td>{a.categoria}</td>
                    <td>{fmtDateBR(a.validade ?? null)}</td>
                    <td>{a.dias_para_vencer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {alertasMinimo.length > 0 && (
          <>
            <h2 className="font-semibold">Abaixo do mínimo</h2>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Categoria</th>
                  <th>Quantidade</th>
                  <th>Mínimo</th>
                  <th>Falta</th>
                </tr>
              </thead>
              <tbody>
                {alertasMinimo.map((a) => (
                  <tr key={a.id}>
                    <td>{a.nome}</td>
                    <td>{a.categoria}</td>
                    <td>{a.quantidade}</td>
                    <td>{a.minimo}</td>
                    <td>{a.falta_para_minimo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </Card>
  );
}
