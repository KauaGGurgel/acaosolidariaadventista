import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const isSupabaseConfigured = () => !!supabase;

type Beneficiario = {
  id: string;
  name: string;
  familySize: number;
  address?: string | null;
  phone?: string | null;
  notes?: string | null;
  lastBasketDate?: string | null;
  created_at?: string;
};

type EstoqueItem = {
  id: string;
  name: string;
  quantity: number;
  unit: "kg" | "unidade" | "litro" | "pacote" | string;
  category: "alimento" | "higiene" | "vestuario" | string;
  minThreshold: number;
  created_at?: string;
};

type EventoEntrega = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  description?: string | null;
  created_at?: string;
};

function uid() {
  return crypto.randomUUID();
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
    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-xs border border-slate-200">
      {children}
    </span>
  );
}

export default function App() {
  // ---------------- AUTH ----------------
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const adminEmails = useMemo(
    () =>
      (import.meta.env.VITE_ADMIN_EMAILS || "")
        .split(",")
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean),
    []
  );

  const isAuthorized = useMemo(() => {
    if (!isSupabaseConfigured()) return true;
    if (!session) return false;
    if (adminEmails.length === 0) return true; // se não configurar, qualquer logado vira admin
    const userEmail = String(session.user?.email || "").toLowerCase();
    return !!userEmail && adminEmails.includes(userEmail);
  }, [adminEmails, session]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!supabase) {
      setAuthError(
        "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Netlify e faça redeploy."
      );
      return;
    }

    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthBusy(false);

    if (error) setAuthError(error.message);
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  // ---------------- NAV ----------------
  type Tab = "dashboard" | "beneficiarios" | "estoque" | "entregas";
  const [tab, setTab] = useState<Tab>("dashboard");

  // ---------------- DATA ----------------
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [eventos, setEventos] = useState<EventoEntrega[]>([]);

  const [loadingData, setLoadingData] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAll = async () => {
    setErrorMsg(null);
    if (!supabase) return;

    setLoadingData(true);
    const [b, e, ev] = await Promise.all([
      supabase.from("beneficiarios").select("*").order("created_at", { ascending: false }),
      supabase.from("estoque").select("*").order("created_at", { ascending: false }),
      supabase.from("eventos_entrega").select("*").order("created_at", { ascending: false }),
    ]);
    setLoadingData(false);

    if (b.error) return setErrorMsg(b.error.message);
    if (e.error) return setErrorMsg(e.error.message);
    if (ev.error) return setErrorMsg(ev.error.message);

    setBeneficiarios((b.data || []) as Beneficiario[]);
    setEstoque((e.data || []) as EstoqueItem[]);
    setEventos((ev.data || []) as EventoEntrega[]);
  };

  useEffect(() => {
    if (!supabase || !session) return;
    loadAll();
  }, [session]);

  // ---------------- FORMS ----------------
  // Beneficiarios
  const [bName, setBName] = useState("");
  const [bFamilySize, setBFamilySize] = useState<number>(1);
  const [bAddress, setBAddress] = useState("");
  const [bPhone, setBPhone] = useState("");
  const [bNotes, setBNotes] = useState("");

  const addBeneficiario = async () => {
    setErrorMsg(null);
    if (!supabase) return;
    if (!bName.trim()) return setErrorMsg("Informe o nome do beneficiário.");

    const payload: Beneficiario = {
      id: uid(),
      name: bName.trim(),
      familySize: Number(bFamilySize || 1),
      address: bAddress.trim() || null,
      phone: bPhone.trim() || null,
      notes: bNotes.trim() || null,
      lastBasketDate: null,
    };

    const { error } = await supabase.from("beneficiarios").insert(payload as any);
    if (error) return setErrorMsg(error.message);

    setBName("");
    setBFamilySize(1);
    setBAddress("");
    setBPhone("");
    setBNotes("");
    await loadAll();
  };

  const delBeneficiario = async (id: string) => {
    setErrorMsg(null);
    if (!supabase) return;
    const { error } = await supabase.from("beneficiarios").delete().eq("id", id);
    if (error) return setErrorMsg(error.message);
    await loadAll();
  };

  // Estoque
  const [iName, setIName] = useState("");
  const [iQty, setIQty] = useState<number>(0);
  const [iUnit, setIUnit] = useState<string>("kg");
  const [iCategory, setICategory] = useState<string>("alimento");
  const [iMin, setIMin] = useState<number>(0);

  const addItem = async () => {
    setErrorMsg(null);
    if (!supabase) return;
    if (!iName.trim()) return setErrorMsg("Informe o nome do item.");

    const payload: EstoqueItem = {
      id: uid(),
      name: iName.trim(),
      quantity: Number(iQty || 0),
      unit: iUnit as any,
      category: iCategory as any,
      minThreshold: Number(iMin || 0),
    };

    const { error } = await supabase.from("estoque").insert(payload as any);
    if (error) return setErrorMsg(error.message);

    setIName("");
    setIQty(0);
    setIUnit("kg");
    setICategory("alimento");
    setIMin(0);
    await loadAll();
  };

  const delItem = async (id: string) => {
    setErrorMsg(null);
    if (!supabase) return;
    const { error } = await supabase.from("estoque").delete().eq("id", id);
    if (error) return setErrorMsg(error.message);
    await loadAll();
  };

  // Eventos
  const [evTitle, setEvTitle] = useState("");
  const [evDate, setEvDate] = useState("");
  const [evDesc, setEvDesc] = useState("");

  const addEvento = async () => {
    setErrorMsg(null);
    if (!supabase) return;
    if (!evTitle.trim()) return setErrorMsg("Informe o título do evento.");
    if (!evDate.trim()) return setErrorMsg("Informe a data (YYYY-MM-DD).");

    const payload: EventoEntrega = {
      id: uid(),
      title: evTitle.trim(),
      date: evDate.trim(),
      description: evDesc.trim() || null,
    };

    const { error } = await supabase.from("eventos_entrega").insert(payload as any);
    if (error) return setErrorMsg(error.message);

    setEvTitle("");
    setEvDate("");
    setEvDesc("");
    await loadAll();
  };

  const delEvento = async (id: string) => {
    setErrorMsg(null);
    if (!supabase) return;
    const { error } = await supabase.from("eventos_entrega").delete().eq("id", id);
    if (error) return setErrorMsg(error.message);
    await loadAll();
  };

  // ---------------- UI STATES ----------------
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (isSupabaseConfigured() && !session) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">Entrar</h1>
          <p className="text-slate-600 mt-1">
            Faça login para acessar o painel.
          </p>

          <form onSubmit={login} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">E-mail</label>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Senha</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {authError && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-3 py-2 text-sm">
                {authError}
              </div>
            )}

            <button
              disabled={authBusy}
              className="w-full rounded-lg bg-slate-900 text-white font-semibold py-2 disabled:opacity-60"
            >
              {authBusy ? "Entrando..." : "Entrar"}
            </button>

            <div className="text-xs text-slate-500">
              Admins: defina <span className="font-mono">VITE_ADMIN_EMAILS</span> no Netlify (separado por vírgula).
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ---------------- LAYOUT ----------------
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-slate-900">Sistema ASA</div>
            <div className="text-sm text-slate-600 flex gap-2 items-center">
              <span>Logado como</span>
              <span className="font-medium">{String(session?.user?.email || "")}</span>
              {isAuthorized ? <Badge>Admin</Badge> : <Badge>Somente leitura</Badge>}
              {loadingData ? <span className="ml-2">• carregando…</span> : null}
            </div>
          </div>

          <button
            onClick={logout}
            className="rounded-lg bg-slate-900 text-white font-semibold px-4 py-2"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2">
          {([
            ["dashboard", "Dashboard"],
            ["beneficiarios", "Beneficiários"],
            ["estoque", "Estoque"],
            ["entregas", "Entregas"],
          ] as Array<[Tab, string]>).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg border ${
                tab === key
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white border-slate-200 text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}

          <button
            onClick={loadAll}
            className="ml-auto px-4 py-2 rounded-lg border bg-white border-slate-200"
          >
            Recarregar
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-800 px-3 py-2 text-sm">
            {errorMsg}
          </div>
        )}

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card title="Beneficiários">
              <div className="text-3xl font-bold">{beneficiarios.length}</div>
              <div className="text-sm text-slate-600 mt-1">famílias cadastradas</div>
            </Card>
            <Card title="Itens no estoque">
              <div className="text-3xl font-bold">{estoque.length}</div>
              <div className="text-sm text-slate-600 mt-1">produtos cadastrados</div>
            </Card>
            <Card title="Entregas">
              <div className="text-3xl font-bold">{eventos.length}</div>
              <div className="text-sm text-slate-600 mt-1">eventos registrados</div>
            </Card>

            <div className="md:col-span-3">
              <Card
                title="Alertas de estoque (abaixo do mínimo)"
                right={<Badge>minThreshold</Badge>}
              >
                {estoque.filter((i) => Number(i.quantity) < Number(i.minThreshold)).length === 0 ? (
                  <div className="text-slate-600">Nenhum item abaixo do mínimo.</div>
                ) : (
                  <div className="space-y-2">
                    {estoque
                      .filter((i) => Number(i.quantity) < Number(i.minThreshold))
                      .map((i) => (
                        <div
                          key={i.id}
                          className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2 bg-slate-50"
                        >
                          <div>
                            <div className="font-semibold">{i.name}</div>
                            <div className="text-sm text-slate-600">
                              {i.quantity} {i.unit} • mínimo {i.minThreshold}
                            </div>
                          </div>
                          <Badge>{i.category}</Badge>
                        </div>
                      ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* BENEFICIÁRIOS */}
        {tab === "beneficiarios" && (
          <div className="mt-6 grid grid-cols-1 gap-4">
            {isAuthorized && (
              <Card title="Cadastrar beneficiário">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-slate-600">Nome</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={bName}
                      onChange={(e) => setBName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-600">Tamanho da família</label>
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={bFamilySize}
                      onChange={(e) => setBFamilySize(Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-600">Endereço</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={bAddress}
                      onChange={(e) => setBAddress(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-600">Telefone</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={bPhone}
                      onChange={(e) => setBPhone(e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm text-slate-600">Observações</label>
                    <textarea
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={bNotes}
                      onChange={(e) => setBNotes(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  onClick={addBeneficiario}
                  className="mt-4 rounded-lg bg-slate-900 text-white font-semibold px-4 py-2"
                >
                  Salvar
                </button>
              </Card>
            )}

            <Card title={`Lista (${beneficiarios.length})`}>
              {beneficiarios.length === 0 ? (
                <div className="text-slate-600">Nenhum beneficiário cadastrado.</div>
              ) : (
                <div className="space-y-2">
                  {beneficiarios.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-start justify-between gap-4 border border-slate-200 rounded-xl px-3 py-2"
                    >
                      <div>
                        <div className="font-semibold">{b.name}</div>
                        <div className="text-sm text-slate-600">
                          Família: {b.familySize || 1} • {b.phone || "Sem telefone"} •{" "}
                          {b.address || "Sem endereço"}
                        </div>
                        {b.notes ? <div className="text-sm mt-1">{b.notes}</div> : null}
                      </div>

                      {isAuthorized ? (
                        <button
                          onClick={() => delBeneficiario(b.id)}
                          className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm"
                        >
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ESTOQUE */}
        {tab === "estoque" && (
          <div className="mt-6 grid grid-cols-1 gap-4">
            {isAuthorized && (
              <Card title="Cadastrar item de estoque">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-slate-600">Nome</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={iName}
                      onChange={(e) => setIName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-600">Quantidade</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={iQty}
                      onChange={(e) => setIQty(Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-600">Unidade</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={iUnit}
                      onChange={(e) => setIUnit(e.target.value)}
                    >
                      <option value="kg">kg</option>
                      <option value="unidade">unidade</option>
                      <option value="litro">litro</option>
                      <option value="pacote">pacote</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-slate-600">Categoria</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={iCategory}
                      onChange={(e) => setICategory(e.target.value)}
                    >
                      <option value="alimento">alimento</option>
                      <option value="higiene">higiene</option>
                      <option value="vestuario">vestuário</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-slate-600">Mínimo (alerta)</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={iMin}
                      onChange={(e) => setIMin(Number(e.target.value))}
                    />
                  </div>
                </div>

                <button
                  onClick={addItem}
                  className="mt-4 rounded-lg bg-slate-900 text-white font-semibold px-4 py-2"
                >
                  Salvar
                </button>
              </Card>
            )}

            <Card title={`Lista (${estoque.length})`}>
              {estoque.length === 0 ? (
                <div className="text-slate-600">Nenhum item cadastrado.</div>
              ) : (
                <div className="space-y-2">
                  {estoque.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-start justify-between gap-4 border border-slate-200 rounded-xl px-3 py-2"
                    >
                      <div>
                        <div className="font-semibold">{i.name}</div>
                        <div className="text-sm text-slate-600">
                          {i.quantity} {i.unit} • {i.category} • mínimo {i.minThreshold}
                        </div>
                      </div>

                      {isAuthorized ? (
                        <button
                          onClick={() => delItem(i.id)}
                          className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm"
                        >
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ENTREGAS */}
        {tab === "entregas" && (
          <div className="mt-6 grid grid-cols-1 gap-4">
            {isAuthorized && (
              <Card title="Cadastrar evento de entrega">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-slate-600">Título</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={evTitle}
                      onChange={(e) => setEvTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-600">Data (YYYY-MM-DD)</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={evDate}
                      onChange={(e) => setEvDate(e.target.value)}
                      placeholder="2026-01-29"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm text-slate-600">Descrição</label>
                    <textarea
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={evDesc}
                      onChange={(e) => setEvDesc(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  onClick={addEvento}
                  className="mt-4 rounded-lg bg-slate-900 text-white font-semibold px-4 py-2"
                >
                  Salvar
                </button>
              </Card>
            )}

            <Card title={`Eventos (${eventos.length})`}>
              {eventos.length === 0 ? (
                <div className="text-slate-600">Nenhum evento cadastrado.</div>
              ) : (
                <div className="space-y-2">
                  {eventos.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between gap-4 border border-slate-200 rounded-xl px-3 py-2"
                    >
                      <div>
                        <div className="font-semibold">{ev.title}</div>
                        <div className="text-sm text-slate-600">{ev.date}</div>
                        {ev.description ? <div className="text-sm mt-1">{ev.description}</div> : null}
                      </div>

                      {isAuthorized ? (
                        <button
                          onClick={() => delEvento(ev.id)}
                          className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm"
                        >
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
