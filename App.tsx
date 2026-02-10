import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Package,
  AlertTriangle,
  LogOut,
  Loader2,
} from "lucide-react";

/* =====================
   Supabase
===================== */
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

/* =====================
   Types
===================== */
type EstoqueItem = {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  validade: string | null;
  status_conservacao: string | null;
};

type View = "dashboard" | "estoque";

/* =====================
   App
===================== */
export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("dashboard");

  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);

  /* Auth */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  /* Dados */
  const carregarEstoque = async () => {
    const { data } = await supabase.from("estoque").select("*").order("nome");
    setEstoque((data as EstoqueItem[]) || []);
  };

  const carregarAlertas = async () => {
    const { data } = await supabase.from("alertas_validade").select("*");
    setAlertas(data || []);
  };

  useEffect(() => {
    if (session) {
      carregarEstoque();
      carregarAlertas();
    }
  }, [session]);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  /* Loading */
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  /* Login */
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl shadow w-full max-w-sm">
          <h1 className="text-xl font-bold mb-4">Sistema ASA</h1>
          <Auth />
        </div>
      </div>
    );
  }

  /* App */
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r p-4 space-y-2">
        <h2 className="font-bold text-lg mb-4">ASA</h2>

        <button
          onClick={() => setView("dashboard")}
          className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-100"
        >
          <LayoutDashboard size={18} /> Dashboard
        </button>

        <button
          onClick={() => setView("estoque")}
          className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-100"
        >
          <Package size={18} /> Estoque
        </button>

        <button
          onClick={logout}
          className="mt-6 w-full flex items-center gap-2 p-2 rounded bg-slate-900 text-white"
        >
          <LogOut size={18} /> Sair
        </button>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 p-6 space-y-6">
        {view === "dashboard" && (
          <>
            <h1 className="text-2xl font-bold">Dashboard</h1>

            {alertas.length > 0 && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4">
                <h3 className="font-bold text-red-800 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  Itens próximos do vencimento
                </h3>
                <ul className="mt-2 text-sm text-red-700 list-disc ml-5">
                  {alertas.map((a) => (
                    <li key={a.id}>
                      {a.nome} – vence em {a.validade}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Stat title="Itens no estoque" value={estoque.length} />
              <Stat title="Alertas ativos" value={alertas.length} danger />
            </div>
          </>
        )}

        {view === "estoque" && (
          <>
            <h1 className="text-2xl font-bold">Estoque</h1>

            <table className="w-full border border-slate-200 rounded-lg">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">Item</th>
                  <th className="p-2">Categoria</th>
                  <th className="p-2">Quantidade</th>
                  <th className="p-2">Validade</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {estoque.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-2">{item.nome}</td>
                    <td className="p-2">{item.categoria}</td>
                    <td className="p-2">
                      {item.quantidade} {item.unidade}
                    </td>
                    <td className="p-2">{item.validade ?? "-"}</td>
                    <td className="p-2">
                      {item.status_conservacao ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </main>
    </div>
  );
}

/* =====================
   Components
===================== */
function Stat({
  title,
  value,
  danger,
}: {
  title: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        danger
          ? "bg-red-50 border-red-300 text-red-800"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="text-sm">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(error.message);
  };

  return (
    <div className="space-y-3">
      <input
        className="w-full border rounded p-2"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full border rounded p-2"
        type="password"
        placeholder="Senha"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <div className="text-sm text-red-600">{error}</div>}
      <button
        onClick={login}
        className="w-full bg-slate-900 text-white rounded p-2"
      >
        Entrar
      </button>
    </div>
  );
}
