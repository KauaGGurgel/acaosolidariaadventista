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
  history?: any;
};

type EstoqueItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  minThreshold: number;
};

function uid() {
  // compatível com navegadores modernos
  return crypto.randomUUID();
}

export default function App() {
  // ------------------ AUTH ------------------
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

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
    if (adminEmails.length === 0) return !!session; // se não definir admins, qualquer logado vira "autorizado"
    const userEmail = String(session?.user?.email || "").toLowerCase();
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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
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

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  // ------------------ UI STATE ------------------
  const [tab, setTab] = useState<"beneficiarios" | "estoque">("beneficiarios");

  // ------------------ DATA: Beneficiarios ------------------
  const [benefLoading, setBenefLoading] = useState(false);
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [benefError, setBenefError] = useState<string | null>(null);

  const [bName, setBName] = useState("");
  const [bFamilySize, setBFamilySize] = useState<number>(1);
  const [bAddress, setBAddress] = useState("");
  const [bPhone, setBPhone] = useState("");
  const [bNotes, setBNotes] = useState("");

  const loadBeneficiarios = async () => {
    setBenefError(null);
    if (!supabase) return;
    setBenefLoading(true);
    const { data, error } = await supabase
      .from("beneficiarios")
      .select("*")
      .order("created_at", { ascending: false });

    setBenefLoading(false);
    if (error) {
      setBenefError(error.message);
      return;
    }
    setBeneficiarios((data || []) as Beneficiario[]);
  };

  const addBeneficiario = async () => {
    if (!supabase) return;
    setBenefError(null);

    const payload: Beneficiario = {
      id: uid(),
      name: bName.trim(),
      familySize: Number(bFamilySize || 1),
      address: bAddress.trim() || null,
      phone: bPhone.trim() || null,
      notes: bNotes.trim() || null,
      lastBasketDate: null,
      history: [],
    };

    if (!payload.name) {
      setBenefError("Informe o nome do beneficiário.");
      return;
    }

    const { error } = await supabase.from("beneficiarios").insert(payload as any);
    if (error) {
      setBenefError(error.message);
      return;
    }

    setBName("");
    setBFamilySize(1);
    setBAddress("");
    setBPhone("");
    setBNotes("");
    await loadBeneficiarios();
  };

  const deleteBeneficiario = async (id: string) => {
    if (!supabase) return;
    setBenefError(null);
    const { error } = await supabase.from("beneficiarios").delete().eq("id", id);
    if (error) {
      setBenefError(error.message);
      return;
    }
    await loadBeneficiarios();
  };

  // ------------------ DATA: Estoque ------------------
  const [estLoading, setEstLoading] = useState(false);
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [estError, setEstError] = useState<string | null>(null);

  const [eName, setEName] = useState("");
  const [eQty, setEQty] = useState<number>(0);
  const [eUnit, setEUnit] = useState("kg");
  const [eCategory, setECategory] = useState("alimento");
  const [eMin, setEMin] = useState<number>(0);

  const loadEstoque = async () => {
    setEstError(null);
    if (!supabase) return;
    setEstLoading(true);
    const { data, error } = await supabase
      .from("estoque")
      .select("*")
      .order("created_at", { ascending: false });

    setEstLoading(false);
    if (error) {
      setEstError(error.message);
      return;
    }
    setEstoque((data || []) as EstoqueItem[]);
  };

  const addEstoque = async () => {
    if (!supabase) return;
    setEstError(null);

    const payload: EstoqueItem = {
      id: uid(),
      name: eName.trim(),
      quantity: Number(eQty || 0),
      unit: eUnit,
      category: eCategory,
      minThreshold: Number(eMin || 0),
    };

    if (!payload.name) {
      setEstError("Informe o nome do item.");
      return;
    }

    const { error } = await supabase.from("estoque").insert(payload as any);
    if (error) {
      setEstError(error.message);
      return;
    }

    setEName("");
    setEQty(0);
    setEUnit("kg");
    setECategory("alimento");
    setEMin(0);
    await loadEstoque();
  };

  const deleteEstoque = async (id: string) => {
    if (!supabase) return;
    setEstError(null);
    const { error } = await supabase.from("estoque").delete().eq("id", id);
    if (error) {
      setEstError(error.message);
      return;
    }
    await loadEstoque();
  };

  // ------------------ Load on login ------------------
  useEffect(() => {
    if (!supabase || !session) return;
    loadBeneficiarios();
    loadEstoque();
  }, [session]);

  // ------------------ Screens ------------------
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
        <div className="w-full max-w-md bg-white rounded-2xl shadow p-6">
          <h1 className="text-2xl font-bold text-slate-900">Entrar</h1>
          <p className="text-slate-600 mt-1">
            Acesso restrito. Faça login para alterar dados e alimentos.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </div>

            {authError && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-3 py-2 text-sm">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full rounded-lg bg-blue-700 text-white font-semibold py-2 disabled:opacity-60"
            >
              {authBusy ? "Entrando..." : "Entrar"}
            </button>

            <div className="text-xs text-slate-500">
              Admins: defina <span className="font-mono">VITE_ADMIN_EMAILS</span> no Netlify.
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (isSupabaseConfigured() && session && !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow p-6">
          <h1 className="text-2xl font-bold text-slate-900">Acesso negado</h1>
          <p className="text-slate-700 mt-2">
            Você está logado como{" "}
            <span className="font-semibold">{String(session.user?.email || "")}</span>, mas não está na lista de
            administradores.
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 rounded-lg bg-slate-900 text-white font-semibold px-4 py-2"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-slate-900">Sistema ASA</div>
            <div className="text-sm text-slate-600">
              Logado como <span className="font-medium">{String(session.user?.email || "")}</span>
              {isAuthorized ? "" : " (somente leitura)"}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-slate-900 text-white font-semibold px-4 py-2"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("beneficiarios")}
            className={`px-4 py-2 rounded-lg border ${
              tab === "beneficiarios" ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200"
            }`}
          >
            Beneficiários
          </button>
          <button
            onClick={() => setTab("estoque")}
            className={`px-4 py-2 rounded-lg border ${
              tab === "estoque" ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200"
            }`}
          >
            Estoque
          </button>
        </div>

        {tab === "beneficiarios" ? (
          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Beneficiários</h2>
              <button
                onClick={loadBeneficiarios}
                className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white"
              >
                Recarregar
              </button>
            </div>

            {benefError && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-800 px-3 py-2 text-sm">
                {benefError}
              </div>
            )}

            {isAuthorized && (
              <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4">
                <div className="font-semibold">Adicionar beneficiário</div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={bFamilySize}
                      onChange={(e) => setBFamilySize(Number(e.target.value))}
                      min={1}
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
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={bNotes}
                      onChange={(e) => setBNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                <button
                  onClick={addBeneficiario}
                  className="mt-4 rounded-lg bg-blue-700 text-white font-semibold px-4 py-2"
                >
                  Salvar
                </button>
              </div>
            )}

            <div className="mt-4 bg-white border border-slate-200 rounded-xl">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="font-semibold">Lista</div>
                {benefLoading && <div className="text-sm text-slate-600">Carregando…</div>}
              </div>

              <div className="divide-y divide-slate-200">
                {beneficiarios.length === 0 && (
                  <div className="p-4 text-slate-600">Nenhum beneficiário cadastrado.</div>
                )}

                {beneficiarios.map((b) => (
                  <div key={b.id} className="p-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">{b.name}</div>
                      <div className="text-sm text-slate-600">
                        Família: {b.familySize || 1} • {b.phone || "Sem telefone"} • {b.address || "Sem endereço"}
                      </div>
                      {b.notes ? <div className="text-sm text-slate-700 mt-1">{b.notes}</div> : null}
                    </div>

                    {isAuthorized ? (
                      <button
                        onClick={() => deleteBeneficiario(b.id)}
                        className="text-sm rounded-lg border border-red-200 text-red-700 px-3 py-2 bg-red-50"
                      >
                        Excluir
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Estoque</h2>
              <button
                onClick={loadEstoque}
                className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white"
              >
                Recarregar
              </button>
            </div>

            {estError && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-800 px-3 py-2 text-sm">
                {estError}
              </div>
            )}

            {isAuthorized && (
              <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4">
                <div className="font-semibold">Adicionar item</div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-slate-600">Nome</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={eName}
                      onChange={(e) => setEName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-600">Quantidade</label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={eQty}
                      onChange={(e) => setEQty(Number(e.target.value))}
                      min={0}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-600">Unidade</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={eUnit}
                      onChange={(e) => setEUnit(e.target.value)}
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
                      value={eCategory}
                      onChange={(e) => setECategory(e.target.value)}
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
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={eMin}
                      onChange={(e) => setEMin(Number(e.target.value))}
                      min={0}
                    />
                  </div>
                </div>

                <button
                  onClick={addEstoque}
                  className="mt-4 rounded-lg bg-blue-700 text-white font-semibold px-4 py-2"
                >
                  Salvar
                </button>
              </div>
            )}

            <div className="mt-4 bg-white border border-slate-200 rounded-xl">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="font-semibold">Lista</div>
                {estLoading && <div className="text-sm text-slate-600">Carregando…</div>}
              </div>

              <div className="divide-y divide-slate-200">
                {estoque.length === 0 && (
                  <div className="p-4 text-slate-600">Nenhum item cadastrado.</div>
                )}

                {estoque.map((i) => (
                  <div key={i.id} className="p-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">{i.name}</div>
                      <div className="text-sm text-slate-600">
                        {i.quantity} {i.unit} • {i.category} • mínimo {i.minThreshold}
                      </div>
                    </div>

                    {isAuthorized ? (
                      <button
                        onClick={() => deleteEstoque(i.id)}
                        className="text-sm rounded-lg border border-red-200 text-red-700 px-3 py-2 bg-red-50"
                      >
                        Excluir
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
