import { useEffect, useMemo, useState } from "react";
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
  Plus,
  Trash2,
  Save,
  Pencil,
  RefreshCw,
} from "lucide-react";

/**
 * Sistema ASA — App.tsx (todas as abas ligadas ao Supabase)
 * - Tabelas usadas (schema public):
 *   - beneficiarios
 *   - estoque
 *   - eventos_entrega
 *   - configuracoes
 *   - profiles (para roles)
 *   - mensagens (opcional — SQL sugerido no final desta mensagem)
 */

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

type DeliveryRecord = { date: string; note?: string };

type Person = {
  id: string;
  name: string;
  familySize: number;
  address: string;
  phone: string;
  lastBasketDate?: string | null;
  notes?: string | null;
  history?: DeliveryRecord[];
};

type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: "kg" | "unidade" | "litro" | "pacote";
  category: "alimento" | "higiene" | "vestuario";
  minThreshold: number;
};

type DeliveryEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  description?: string | null;
};

type BasketItemConfig = { itemId: string; quantityRequired: number };
type BasketConfig = { name: string; items: BasketItemConfig[] };

type Profile = {
  id: string;
  email: string | null;
  role: Role;
};

type MessageRow = {
  id: string;
  author_email: string | null;
  content: string;
  created_at: string;
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

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date" | "email" | "password";
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <input
        type={type}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <select
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const cls =
    variant === "primary"
      ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
      : variant === "danger"
      ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
      : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-60",
        cls
      )}
    >
      {children}
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
      id: data.id as string,
      email: (data.email as string | null) ?? user.email ?? null,
      role: (data.role as Role) ?? "viewer",
    };
  }

  // fallback: tenta criar (se RLS bloquear, segue como viewer)
  const email = user.email ?? null;
  const { error: insErr } = await supabase
    .from("profiles")
    .insert({ id: user.id, email, role: "viewer" });

  if (insErr) return { id: user.id, email, role: "viewer" };
  return { id: user.id, email, role: "viewer" };
}

function uid() {
  return crypto.randomUUID();
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

  // -------- Data --------
  const [people, setPeople] = useState<Person[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [basketConfig, setBasketConfig] = useState<BasketConfig>({
    name: "Cesta Básica Padrão",
    items: [],
  });
  const [assembledBaskets, setAssembledBaskets] = useState<number>(0);

  const [dataBusy, setDataBusy] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

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

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
  };

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

    setAuthTab("login");
    setAuthError(
      "Conta criada! Se o Supabase exigir confirmação por email, confirme e depois faça login."
    );
  };

  // -------- Fetch helpers --------
  const refreshAll = async () => {
    setDataError(null);
    if (!supabase) return;

    setDataBusy(true);
    try {
      // Beneficiários
      const p = await supabase.from("beneficiarios").select("*").order("created_at", { ascending: false });
      if (p.error) throw p.error;
      setPeople(
        (p.data || []).map((r: any) => ({
          id: String(r.id),
          name: String(r.name || ""),
          familySize: Number(r.familySize ?? 1),
          address: String(r.address || ""),
          phone: String(r.phone || ""),
          lastBasketDate: r.lastBasketDate ?? null,
          notes: r.notes ?? null,
          history: (r.history as DeliveryRecord[]) ?? [],
        }))
      );

      // Estoque
      const i = await supabase.from("estoque").select("*").order("created_at", { ascending: false });
      if (i.error) throw i.error;
      setInventory(
        (i.data || []).map((r: any) => ({
          id: String(r.id),
          name: String(r.name || ""),
          quantity: Number(r.quantity ?? 0),
          unit: (r.unit as InventoryItem["unit"]) ?? "unidade",
          category: (r.category as InventoryItem["category"]) ?? "alimento",
          minThreshold: Number(r.minThreshold ?? 0),
        }))
      );

      // Eventos
      const ev = await supabase.from("eventos_entrega").select("*").order("date", { ascending: true });
      if (ev.error) throw ev.error;
      setEvents(
        (ev.data || []).map((r: any) => ({
          id: String(r.id),
          title: String(r.title || ""),
          date: String(r.date || ""),
          description: r.description ?? null,
        }))
      );

      // Configurações (cestas)
      const cfg = await supabase.from("configuracoes").select("key,value").in("key", ["basket_config", "assembled_baskets"]);
      if (cfg.error) throw cfg.error;

      const map: Record<string, any> = {};
      (cfg.data || []).forEach((r: any) => (map[String(r.key)] = r.value));

      if (map.basket_config) {
        const bc = map.basket_config as BasketConfig;
        setBasketConfig({
          name: String(bc.name || "Cesta Básica Padrão"),
          items: Array.isArray(bc.items)
            ? bc.items.map((x: any) => ({
                itemId: String(x.itemId),
                quantityRequired: Number(x.quantityRequired ?? 0),
              }))
            : [],
        });
      } else {
        setBasketConfig({ name: "Cesta Básica Padrão", items: [] });
      }

      const ab = map.assembled_baskets;
      setAssembledBaskets(typeof ab === "number" ? ab : Number(ab ?? 0));

      // Mensagens (se existir tabela)
      const msg = await supabase.from("mensagens").select("*").order("created_at", { ascending: false });
      if (!msg.error) {
        setMessages(
          (msg.data || []).map((r: any) => ({
            id: String(r.id),
            author_email: (r.author_email as string | null) ?? null,
            content: String(r.content || ""),
            created_at: String(r.created_at || ""),
          }))
        );
      } else {
        // Se a tabela não existir, mantemos vazio sem quebrar o app.
        setMessages([]);
      }
    } catch (e: any) {
      setDataError(e?.message || "Erro ao carregar dados do Supabase.");
    } finally {
      setDataBusy(false);
    }
  };

  useEffect(() => {
    if (!supabase || !session) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // -------- Auth screens --------
  if (booting) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

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

          <form onSubmit={authTab === "login" ? doLogin : doSignup} className="mt-5 space-y-4">
            <Input label="E-mail" value={email} onChange={setEmail} type="email" />
            <Input label="Senha" value={password} onChange={setPassword} type="password" />
            {authError && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 text-sm">
                {authError}
              </div>
            )}
            <Button type="submit" disabled={authBusy}>
              {authBusy ? <Loader2 className="animate-spin" size={18} /> : null}
              {authTab === "login" ? "Entrar" : "Criar conta"}
            </Button>

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
              Permissões: novos usuários entram como <b>Somente visualizar</b>. Um admin pode
              promover para <b>Pode editar</b>.
            </div>
          </form>
        </div>
      </div>
    );
  }

  const emailDisplay = String(session?.user?.email || "");
  const roleDisplay = profile?.role ?? "viewer";

  const totalFamilies = people.length;
  const totalBeneficiaries = people.reduce((acc, p) => acc + (p.familySize || 0), 0);
  const lowStock = inventory.filter((it) => it.quantity <= it.minThreshold);

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
            <Button variant="secondary" onClick={refreshAll} disabled={dataBusy}>
              <RefreshCw size={16} />
              Atualizar
            </Button>
            <Button onClick={logout}>
              <LogOut size={18} />
              Sair
            </Button>
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
          {dataError && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 px-4 py-3">
              {dataError}
            </div>
          )}

          {view === "dashboard" && (
            <DashboardCard
              totalFamilies={totalFamilies}
              totalBeneficiaries={totalBeneficiaries}
              lowStock={lowStock}
              assembledBaskets={assembledBaskets}
            />
          )}

          {view === "beneficiarios" && (
            <BeneficiariosTab
              people={people}
              setPeople={setPeople}
              canEdit={canEdit}
              onError={setDataError}
            />
          )}

          {view === "estoque" && (
            <EstoqueTab
              inventory={inventory}
              setInventory={setInventory}
              canEdit={canEdit}
              onError={setDataError}
            />
          )}

          {view === "eventos" && (
            <EventosTab events={events} setEvents={setEvents} canEdit={canEdit} onError={setDataError} />
          )}

          {view === "mensagens" && (
            <MensagensTab
              messages={messages}
              setMessages={setMessages}
              canEdit={canEdit}
              userEmail={emailDisplay}
              onError={setDataError}
            />
          )}

          {view === "cestas" && (
            <CestasTab
              inventory={inventory}
              basketConfig={basketConfig}
              setBasketConfig={setBasketConfig}
              assembledBaskets={assembledBaskets}
              setAssembledBaskets={setAssembledBaskets}
              canEdit={canEdit}
              onError={setDataError}
            />
          )}

          {view === "assistente" && <AssistenteTab />}

          {view === "usuarios" && isAdmin && <UsersAdmin onRoleChanged={() => fetchMyProfile().then(setProfile)} />}
        </section>
      </main>
    </div>
  );
}

function DashboardCard({
  totalFamilies,
  totalBeneficiaries,
  lowStock,
  assembledBaskets,
}: {
  totalFamilies: number;
  totalBeneficiaries: number;
  lowStock: InventoryItem[];
  assembledBaskets: number;
}) {
  return (
    <Card title="Visão Geral (Supabase)">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="border border-slate-200 rounded-xl p-3">
          <div className="text-xs text-slate-500">Famílias</div>
          <div className="text-2xl font-bold text-slate-900">{totalFamilies}</div>
        </div>
        <div className="border border-slate-200 rounded-xl p-3">
          <div className="text-xs text-slate-500">Pessoas (somatório)</div>
          <div className="text-2xl font-bold text-slate-900">{totalBeneficiaries}</div>
        </div>
        <div className="border border-slate-200 rounded-xl p-3">
          <div className="text-xs text-slate-500">Cestas montadas</div>
          <div className="text-2xl font-bold text-slate-900">{assembledBaskets}</div>
        </div>
        <div className="border border-slate-200 rounded-xl p-3">
          <div className="text-xs text-slate-500">Itens com baixo estoque</div>
          <div className="text-2xl font-bold text-slate-900">{lowStock.length}</div>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="mt-4">
          <div className="font-semibold text-slate-900 mb-2">Atenção (baixo estoque)</div>
          <div className="space-y-2">
            {lowStock.slice(0, 8).map((it) => (
              <div key={it.id} className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2">
                <div className="font-medium text-slate-900">{it.name}</div>
                <Badge>
                  {it.quantity} {it.unit} (mín {it.minThreshold})
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ===========================
   BENEFICIÁRIOS (CRUD)
   =========================== */
function BeneficiariosTab({
  people,
  setPeople,
  canEdit,
  onError,
}: {
  people: Person[];
  setPeople: React.Dispatch<React.SetStateAction<Person[]>>;
  canEdit: boolean;
  onError: (m: string | null) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Person>({
    id: "",
    name: "",
    familySize: 1,
    address: "",
    phone: "",
    lastBasketDate: "",
    notes: "",
    history: [],
  });

  const startNew = () => {
    setEditingId("NEW");
    setDraft({
      id: uid(),
      name: "",
      familySize: 1,
      address: "",
      phone: "",
      lastBasketDate: "",
      notes: "",
      history: [],
    });
  };

  const startEdit = (p: Person) => {
    setEditingId(p.id);
    setDraft({ ...p, lastBasketDate: p.lastBasketDate ?? "" });
  };

  const cancel = () => {
    setEditingId(null);
  };

  const save = async () => {
    onError(null);
    if (!supabase) return;

    const row = {
      id: draft.id,
      name: draft.name,
      familySize: Number(draft.familySize || 1),
      address: draft.address,
      phone: draft.phone,
      lastBasketDate: draft.lastBasketDate || null,
      notes: draft.notes || null,
      history: draft.history ?? [],
    };

    const { error } = await supabase.from("beneficiarios").upsert(row, { onConflict: "id" });
    if (error) {
      onError(error.message);
      return;
    }

    setPeople((prev) => {
      const exists = prev.some((x) => x.id === row.id);
      const next = exists ? prev.map((x) => (x.id === row.id ? (row as Person) : x)) : [row as Person, ...prev];
      return next;
    });
    setEditingId(null);
  };

  const remove = async (id: string) => {
    onError(null);
    if (!supabase) return;

    const { error } = await supabase.from("beneficiarios").delete().eq("id", id);
    if (error) {
      onError(error.message);
      return;
    }
    setPeople((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) setEditingId(null);
  };

  return (
    <Card
      title="Beneficiários"
      right={
        <div className="flex items-center gap-2">
          {!canEdit ? <Badge>somente leitura</Badge> : null}
          {canEdit && (
            <Button onClick={startNew}>
              <Plus size={16} /> Novo
            </Button>
          )}
        </div>
      }
    >
      {editingId && (
        <div className="mb-4 border border-slate-200 rounded-2xl p-4 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-slate-900">
              {editingId === "NEW" ? "Novo beneficiário" : "Editar beneficiário"}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={cancel}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={!canEdit || !draft.name.trim()}>
                <Save size={16} /> Salvar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Nome" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} disabled={!canEdit} />
            <Input
              label="Tamanho da família"
              type="number"
              value={String(draft.familySize)}
              onChange={(v) => setDraft((d) => ({ ...d, familySize: Number(v || 1) }))}
              disabled={!canEdit}
            />
            <Input label="Telefone" value={draft.phone} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} disabled={!canEdit} />
            <Input label="Endereço" value={draft.address} onChange={(v) => setDraft((d) => ({ ...d, address: v }))} disabled={!canEdit} />
            <Input
              label="Última cesta (YYYY-MM-DD)"
              value={String(draft.lastBasketDate || "")}
              onChange={(v) => setDraft((d) => ({ ...d, lastBasketDate: v }))}
              placeholder="2026-02-04"
              disabled={!canEdit}
            />
            <label className="block md:col-span-2">
              <div className="text-sm font-medium text-slate-700">Observações</div>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-60"
                value={String(draft.notes || "")}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                disabled={!canEdit}
                rows={3}
              />
            </label>
          </div>
        </div>
      )}

      {people.length === 0 ? (
        <div className="text-slate-600">Nenhum beneficiário encontrado.</div>
      ) : (
        <div className="space-y-2">
          {people.map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2">
              <div>
                <div className="font-semibold text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-600">
                  Família: {p.familySize} • {p.phone || "sem telefone"} • {p.address || "sem endereço"}
                </div>
                {p.lastBasketDate ? <div className="text-xs text-slate-500">Última cesta: {p.lastBasketDate}</div> : null}
              </div>

              <div className="flex items-center gap-2">
                {canEdit && (
                  <Button variant="secondary" onClick={() => startEdit(p)}>
                    <Pencil size={16} /> Editar
                  </Button>
                )}
                {canEdit && (
                  <Button variant="danger" onClick={() => remove(p.id)}>
                    <Trash2 size={16} /> Excluir
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ===========================
   ESTOQUE (CRUD)
   =========================== */
function EstoqueTab({
  inventory,
  setInventory,
  canEdit,
  onError,
}: {
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  canEdit: boolean;
  onError: (m: string | null) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<InventoryItem>({
    id: "",
    name: "",
    quantity: 0,
    unit: "unidade",
    category: "alimento",
    minThreshold: 10,
  });

  const startNew = () => {
    setEditingId("NEW");
    setDraft({
      id: uid(),
      name: "",
      quantity: 0,
      unit: "unidade",
      category: "alimento",
      minThreshold: 10,
    });
  };

  const startEdit = (it: InventoryItem) => {
    setEditingId(it.id);
    setDraft({ ...it });
  };

  const cancel = () => setEditingId(null);

  const save = async () => {
    onError(null);
    if (!supabase) return;

    const row = {
      id: draft.id,
      name: draft.name,
      quantity: Number(draft.quantity ?? 0),
      unit: draft.unit,
      category: draft.category,
      minThreshold: Number(draft.minThreshold ?? 0),
    };

    const { error } = await supabase.from("estoque").upsert(row, { onConflict: "id" });
    if (error) {
      onError(error.message);
      return;
    }

    setInventory((prev) => {
      const exists = prev.some((x) => x.id === row.id);
      const next = exists ? prev.map((x) => (x.id === row.id ? (row as InventoryItem) : x)) : [row as InventoryItem, ...prev];
      return next;
    });
    setEditingId(null);
  };

  const remove = async (id: string) => {
    onError(null);
    if (!supabase) return;

    const { error } = await supabase.from("estoque").delete().eq("id", id);
    if (error) {
      onError(error.message);
      return;
    }
    setInventory((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) setEditingId(null);
  };

  return (
    <Card
      title="Estoque"
      right={
        <div className="flex items-center gap-2">
          {!canEdit ? <Badge>somente leitura</Badge> : null}
          {canEdit && (
            <Button onClick={startNew}>
              <Plus size={16} /> Novo
            </Button>
          )}
        </div>
      }
    >
      {editingId && (
        <div className="mb-4 border border-slate-200 rounded-2xl p-4 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-slate-900">
              {editingId === "NEW" ? "Novo item" : "Editar item"}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={cancel}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={!canEdit || !draft.name.trim()}>
                <Save size={16} /> Salvar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Nome" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} disabled={!canEdit} />
            <Input
              label="Quantidade"
              type="number"
              value={String(draft.quantity)}
              onChange={(v) => setDraft((d) => ({ ...d, quantity: Number(v || 0) }))}
              disabled={!canEdit}
            />
            <Select
              label="Unidade"
              value={draft.unit}
              onChange={(v) => setDraft((d) => ({ ...d, unit: v as InventoryItem["unit"] }))}
              options={[
                { value: "kg", label: "kg" },
                { value: "unidade", label: "unidade" },
                { value: "litro", label: "litro" },
                { value: "pacote", label: "pacote" },
              ]}
              disabled={!canEdit}
            />
            <Select
              label="Categoria"
              value={draft.category}
              onChange={(v) => setDraft((d) => ({ ...d, category: v as InventoryItem["category"] }))}
              options={[
                { value: "alimento", label: "alimento" },
                { value: "higiene", label: "higiene" },
                { value: "vestuario", label: "vestuário" },
              ]}
              disabled={!canEdit}
            />
            <Input
              label="Mínimo (alerta)"
              type="number"
              value={String(draft.minThreshold)}
              onChange={(v) => setDraft((d) => ({ ...d, minThreshold: Number(v || 0) }))}
              disabled={!canEdit}
            />
          </div>
        </div>
      )}

      {inventory.length === 0 ? (
        <div className="text-slate-600">Nenhum item de estoque encontrado.</div>
      ) : (
        <div className="space-y-2">
          {inventory.map((it) => {
            const low = it.quantity <= it.minThreshold;
            return (
              <div key={it.id} className="flex items-start justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2">
                <div>
                  <div className="font-semibold text-slate-900">{it.name}</div>
                  <div className="text-xs text-slate-600">
                    {it.category} • {it.quantity} {it.unit} • mínimo {it.minThreshold}
                  </div>
                  {low ? <div className="text-xs text-red-700">Atenção: abaixo do mínimo</div> : null}
                </div>

                <div className="flex items-center gap-2">
                  {canEdit && (
                    <Button variant="secondary" onClick={() => startEdit(it)}>
                      <Pencil size={16} /> Editar
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="danger" onClick={() => remove(it.id)}>
                      <Trash2 size={16} /> Excluir
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ===========================
   EVENTOS (CRUD)
   =========================== */
function EventosTab({
  events,
  setEvents,
  canEdit,
  onError,
}: {
  events: DeliveryEvent[];
  setEvents: React.Dispatch<React.SetStateAction<DeliveryEvent[]>>;
  canEdit: boolean;
  onError: (m: string | null) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DeliveryEvent>({
    id: "",
    title: "",
    date: "",
    description: "",
  });

  const startNew = () => {
    setEditingId("NEW");
    setDraft({ id: uid(), title: "", date: "", description: "" });
  };

  const startEdit = (ev: DeliveryEvent) => {
    setEditingId(ev.id);
    setDraft({ ...ev, description: ev.description ?? "" });
  };

  const cancel = () => setEditingId(null);

  const save = async () => {
    onError(null);
    if (!supabase) return;

    const row = {
      id: draft.id,
      title: draft.title,
      date: draft.date,
      description: draft.description || null,
    };

    const { error } = await supabase.from("eventos_entrega").upsert(row, { onConflict: "id" });
    if (error) {
      onError(error.message);
      return;
    }

    setEvents((prev) => {
      const exists = prev.some((x) => x.id === row.id);
      const next = exists ? prev.map((x) => (x.id === row.id ? (row as DeliveryEvent) : x)) : [...prev, row as DeliveryEvent];
      // ordena por data
      next.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return next;
    });

    setEditingId(null);
  };

  const remove = async (id: string) => {
    onError(null);
    if (!supabase) return;

    const { error } = await supabase.from("eventos_entrega").delete().eq("id", id);
    if (error) {
      onError(error.message);
      return;
    }
    setEvents((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) setEditingId(null);
  };

  return (
    <Card
      title="Eventos / Entregas"
      right={
        <div className="flex items-center gap-2">
          {!canEdit ? <Badge>somente leitura</Badge> : null}
          {canEdit && (
            <Button onClick={startNew}>
              <Plus size={16} /> Novo
            </Button>
          )}
        </div>
      }
    >
      {editingId && (
        <div className="mb-4 border border-slate-200 rounded-2xl p-4 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-slate-900">
              {editingId === "NEW" ? "Novo evento" : "Editar evento"}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={cancel}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={!canEdit || !draft.title.trim() || !draft.date.trim()}>
                <Save size={16} /> Salvar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Título" value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} disabled={!canEdit} />
            <Input
              label="Data"
              type="date"
              value={draft.date}
              onChange={(v) => setDraft((d) => ({ ...d, date: v }))}
              disabled={!canEdit}
            />
            <label className="block md:col-span-2">
              <div className="text-sm font-medium text-slate-700">Descrição</div>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-60"
                value={String(draft.description || "")}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                disabled={!canEdit}
                rows={3}
              />
            </label>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="text-slate-600">Nenhum evento encontrado.</div>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-start justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2">
              <div>
                <div className="font-semibold text-slate-900">{ev.title}</div>
                <div className="text-xs text-slate-600">{ev.date}</div>
                {ev.description ? <div className="text-sm text-slate-700 mt-1">{ev.description}</div> : null}
              </div>

              <div className="flex items-center gap-2">
                {canEdit && (
                  <Button variant="secondary" onClick={() => startEdit(ev)}>
                    <Pencil size={16} /> Editar
                  </Button>
                )}
                {canEdit && (
                  <Button variant="danger" onClick={() => remove(ev.id)}>
                    <Trash2 size={16} /> Excluir
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ===========================
   MENSAGENS (CRUD simples)
   =========================== */
function MensagensTab({
  messages,
  setMessages,
  canEdit,
  userEmail,
  onError,
}: {
  messages: MessageRow[];
  setMessages: React.Dispatch<React.SetStateAction<MessageRow[]>>;
  canEdit: boolean;
  userEmail: string;
  onError: (m: string | null) => void;
}) {
  const [text, setText] = useState("");

  const send = async () => {
    onError(null);
    if (!supabase) return;

    if (!text.trim()) return;

    const row = {
      content: text.trim(),
      author_email: userEmail || null,
    };

    const { data, error } = await supabase.from("mensagens").insert(row).select("*").maybeSingle();
    if (error) {
      onError(
        "Falha ao enviar mensagem. Se você ainda não criou a tabela 'mensagens', crie com o SQL sugerido (veja abaixo). " +
          error.message
      );
      return;
    }

    if (data) {
      setMessages((prev) => [
        {
          id: String((data as any).id),
          author_email: (data as any).author_email ?? null,
          content: String((data as any).content || ""),
          created_at: String((data as any).created_at || ""),
        },
        ...prev,
      ]);
    }
    setText("");
  };

  return (
    <Card title="Mensagens">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-sm text-slate-600">
          {messages.length === 0 ? "Sem mensagens ainda." : `${messages.length} mensagem(ns)`}
        </div>
        {!canEdit ? <Badge>somente leitura</Badge> : null}
      </div>

      {canEdit && (
        <div className="border border-slate-200 rounded-2xl p-3 mb-4">
          <div className="text-sm font-semibold text-slate-900 mb-2">Nova mensagem</div>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva um aviso, pedido de doação, recado..."
          />
          <div className="mt-2 flex justify-end">
            <Button onClick={send} disabled={!text.trim()}>
              <Save size={16} /> Enviar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {messages.map((m) => (
          <div key={m.id} className="border border-slate-200 rounded-xl px-3 py-2">
            <div className="text-xs text-slate-500">
              {m.author_email ?? "usuário"} • {new Date(m.created_at).toLocaleString()}
            </div>
            <div className="text-slate-900">{m.content}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ===========================
   CESTAS (Configurações)
   =========================== */
function CestasTab({
  inventory,
  basketConfig,
  setBasketConfig,
  assembledBaskets,
  setAssembledBaskets,
  canEdit,
  onError,
}: {
  inventory: InventoryItem[];
  basketConfig: BasketConfig;
  setBasketConfig: React.Dispatch<React.SetStateAction<BasketConfig>>;
  assembledBaskets: number;
  setAssembledBaskets: React.Dispatch<React.SetStateAction<number>>;
  canEdit: boolean;
  onError: (m: string | null) => void;
}) {
  const [saving, setSaving] = useState(false);

  const saveConfig = async () => {
    onError(null);
    if (!supabase) return;

    setSaving(true);
    const { error } = await supabase.from("configuracoes").upsert(
      [
        { key: "basket_config", value: basketConfig },
        { key: "assembled_baskets", value: assembledBaskets },
      ],
      { onConflict: "key" }
    );
    setSaving(false);

    if (error) onError(error.message);
  };

  const addItem = () => {
    const first = inventory[0]?.id;
    if (!first) return;
    setBasketConfig((c) => ({
      ...c,
      items: [...c.items, { itemId: first, quantityRequired: 1 }],
    }));
  };

  const updateItem = (idx: number, patch: Partial<BasketItemConfig>) => {
    setBasketConfig((c) => ({
      ...c,
      items: c.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  };

  const removeItem = (idx: number) => {
    setBasketConfig((c) => ({
      ...c,
      items: c.items.filter((_, i) => i !== idx),
    }));
  };

  const itemName = (id: string) => inventory.find((x) => x.id === id)?.name ?? id;

  return (
    <Card
      title="Cestas Básicas"
      right={
        <div className="flex items-center gap-2">
          {!canEdit ? <Badge>somente leitura</Badge> : null}
          {canEdit && (
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Salvar
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label="Nome da cesta"
          value={basketConfig.name}
          onChange={(v) => setBasketConfig((c) => ({ ...c, name: v }))}
          disabled={!canEdit}
        />
        <Input
          label="Cestas montadas (número)"
          type="number"
          value={String(assembledBaskets)}
          onChange={(v) => setAssembledBaskets(Number(v || 0))}
          disabled={!canEdit}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="font-semibold text-slate-900">Itens da cesta</div>
        {canEdit && (
          <Button variant="secondary" onClick={addItem} disabled={inventory.length === 0}>
            <Plus size={16} /> Adicionar item
          </Button>
        )}
      </div>

      {inventory.length === 0 ? (
        <div className="text-slate-600 mt-2">
          Para configurar itens da cesta, primeiro cadastre itens no <b>Estoque</b>.
        </div>
      ) : basketConfig.items.length === 0 ? (
        <div className="text-slate-600 mt-2">Nenhum item configurado.</div>
      ) : (
        <div className="space-y-2 mt-2">
          {basketConfig.items.map((it, idx) => (
            <div key={`${it.itemId}-${idx}`} className="border border-slate-200 rounded-xl p-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <Select
                  label="Item"
                  value={it.itemId}
                  onChange={(v) => updateItem(idx, { itemId: v })}
                  options={inventory.map((x) => ({ value: x.id, label: x.name }))}
                  disabled={!canEdit}
                />
                <Input
                  label="Quantidade necessária"
                  type="number"
                  value={String(it.quantityRequired)}
                  onChange={(v) => updateItem(idx, { quantityRequired: Number(v || 0) })}
                  disabled={!canEdit}
                />
                <div className="flex justify-end">
                  {canEdit && (
                    <Button variant="danger" onClick={() => removeItem(idx)}>
                      <Trash2 size={16} /> Remover
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-600 mt-2">
                {itemName(it.itemId)} • precisa de {it.quantityRequired}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 text-xs text-slate-500">
        Esta aba salva em <b>configuracoes</b> as chaves: <b>basket_config</b> e <b>assembled_baskets</b>.
      </div>
    </Card>
  );
}

/* ===========================
   ASSISTENTE (placeholder)
   =========================== */
function AssistenteTab() {
  return (
    <Card title="Assistente (opcional)">
      <div className="text-slate-700">
        Para usar IA (Gemini), recomendo ativar via <b>Netlify Functions</b> (backend) para não expor sua API key.
      </div>
    </Card>
  );
}

/* ===========================
   ADMIN: USUÁRIOS / ROLES
   =========================== */
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
        <Button variant="secondary" onClick={load}>
          <RefreshCw size={16} /> Recarregar
        </Button>
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
                <div className="font-semibold text-slate-900">{u.email ?? "(sem email)"}</div>
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
