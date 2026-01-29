import React, { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Users,
  Package,
  HeartHandshake,
  Menu,
  X,
  Plus,
  Trash2,
  Edit2,
  Search,
  Phone,
  MapPin,
  Calendar,
  CheckCircle,
  Calculator,
  ArrowRight,
  Sparkles,
  BookOpen,
  Utensils,
  Loader2,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/* ============================================================================
   SUPABASE
============================================================================ */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

const isSupabaseConfigured = () => !!supabase;

/* ============================================================================
   TIPOS
============================================================================ */
interface Beneficiario {
  id: string;
  name: string;
  familySize: number;
  address?: string;
  phone?: string;
  notes?: string;
  lastBasketDate?: string;
}

/* ============================================================================
   APP
============================================================================ */
export default function App() {
  const [loading, setLoading] = useState(true);

  /* -------------------- AUTH -------------------- */
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  const isAuthorized =
    !isSupabaseConfigured()
      ? true
      : adminEmails.length === 0
      ? !!session
      : !!session?.user?.email &&
        adminEmails.includes(session.user.email.toLowerCase());

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, s) => setSession(s)
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!supabase) return;

    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setAuthBusy(false);

    if (error) setAuthError(error.message);
  };

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  /* -------------------- DATA -------------------- */
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);

  useEffect(() => {
    if (!supabase || !session) return;

    supabase
      .from("beneficiarios")
      .select("*")
      .then(({ data }) => {
        if (data) setBeneficiarios(data);
      });
  }, [session]);

  /* ============================================================================
     TELAS
============================================================================ */

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (isSupabaseConfigured() && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="bg-white rounded-xl shadow p-6 w-full max-w-md">
          <h1 className="text-2xl font-bold">Login</h1>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <input
              type="email"
              placeholder="Email"
              className="w-full border rounded p-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Senha"
              className="w-full border rounded p-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {authError && (
              <div className="text-red-600 text-sm">{authError}</div>
            )}

            <button
              disabled={authBusy}
              className="w-full bg-blue-600 text-white py-2 rounded"
            >
              {authBusy ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (isSupabaseConfigured() && session && !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-6 rounded shadow">
          <p className="mb-4">
            Você está logado como <b>{session.user.email}</b>, mas não tem
            permissão.
          </p>
          <button
            onClick={handleLogout}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  /* -------------------- APP PRINCIPAL -------------------- */
  return (
    <div className="p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">ASA – Gestão Solidária</h1>
        {session && (
          <button
            onClick={handleLogout}
            className="text-sm bg-gray-800 text-white px-3 py-1 rounded"
          >
            Sair
          </button>
        )}
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-2">Beneficiários</h2>

        <ul className="space-y-2">
          {beneficiarios.map((b) => (
            <li
              key={b.id}
              className="border rounded p-3 flex justify-between"
            >
              <span>
                {b.name} – {b.familySize} pessoas
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
