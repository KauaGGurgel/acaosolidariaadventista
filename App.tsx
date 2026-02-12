// =========================
// RELATÓRIOS (INÍCIO DO MÊS -> HOJE) + CSV + IMPRESSÃO
// =========================

type ReportRange = { start: string; end: string };

type ReportSummary = {
  range: ReportRange;
  generatedAt: string;

  // Estoque atual (snapshot)
  stockNow: {
    alimentos_perecivel: number;
    alimentos_nao_perecivel: number;
    higiene: number;
    vest_masculina: number;
    vest_feminina: number;
    vest_infantil: number;
    outros: number;
    total: number;
  };

  // Entradas no período (somatório por categoria)
  stockEntriesPeriod: {
    alimentos_perecivel: number;
    alimentos_nao_perecivel: number;
    higiene: number;
    vest_masculina: number;
    vest_feminina: number;
    vest_infantil: number;
    outros: number;
    total: number;
  };

  beneficiaries: {
    total: number;
    createdInPeriod: number;
  };

  baskets: {
    assembledTotal: number; // configuracoes.assembled_baskets
  };

  alerts: {
    validade: Array<{ id: string; nome: string; categoria: string; validade: string | null; dias_para_vencer: number | null }>;
    minimo: Array<{ id: string; nome: string; categoria: string; quantidade: number; minimo: number; falta_para_minimo: number }>;
  };
};

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfCurrentMonthISO() {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function todayISO() {
  return toISODate(new Date());
}

function safeNumber(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

// Mapeia categorias do banco (PT/EN) para os grupos do relatório
function normalizeCategory(raw: any): string {
  const v = String(raw ?? "").toLowerCase().trim();

  // Se você usa valores fixos tipo 'alimento_perecivel', etc:
  if (v.includes("alimento_perecivel") || v.includes("perecivel")) return "alimentos_perecivel";
  if (v.includes("alimento_nao_perecivel") || v.includes("nao_perecivel") || v.includes("não perecível") || v.includes("nao perecível")) return "alimentos_nao_perecivel";
  if (v.includes("higiene")) return "higiene";

  if (v.includes("roupa_masculina") || v.includes("mascul")) return "vest_masculina";
  if (v.includes("roupa_feminina") || v.includes("femin")) return "vest_feminina";
  if (v.includes("roupa_infantil") || v.includes("infant")) return "vest_infantil";

  // Se sobrar, vai em "outros"
  return "outros";
}

function emptyBuckets() {
  return {
    alimentos_perecivel: 0,
    alimentos_nao_perecivel: 0,
    higiene: 0,
    vest_masculina: 0,
    vest_feminina: 0,
    vest_infantil: 0,
    outros: 0,
    total: 0,
  };
}

function sumBuckets(b: ReturnType<typeof emptyBuckets>) {
  b.total =
    b.alimentos_perecivel +
    b.alimentos_nao_perecivel +
    b.higiene +
    b.vest_masculina +
    b.vest_feminina +
    b.vest_infantil +
    b.outros;
  return b;
}

function bucketsToCSVRows(title: string, b: ReturnType<typeof emptyBuckets>) {
  return [
    [title, ""],
    ["Categoria", "Quantidade"],
    ["Alimentos (perecível)", String(b.alimentos_perecivel)],
    ["Alimentos (não perecível)", String(b.alimentos_nao_perecivel)],
    ["Higiene", String(b.higiene)],
    ["Vestimenta (masculino)", String(b.vest_masculina)],
    ["Vestimenta (feminino)", String(b.vest_feminina)],
    ["Vestimenta (infantil)", String(b.vest_infantil)],
    ["Outros", String(b.outros)],
    ["TOTAL", String(b.total)],
    ["", ""],
  ];
}

function csvEscape(s: string) {
  const needs = /[",\n]/.test(s);
  const out = s.replace(/"/g, '""');
  return needs ? `"${out}"` : out;
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function openPrintWindow(html: string) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  // dá um “respiro” pra renderizar
  setTimeout(() => w.print(), 250);
}

async function fetchReportFromSupabase(range: ReportRange): Promise<ReportSummary> {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const generatedAt = new Date().toISOString();

  // 1) Estoque atual (snapshot)
  // Busca só as colunas que precisamos (PT/EN)
  const { data: stockRows, error: stockErr } = await supabase
    .from("estoque")
    .select("id, quantidade, quantity, categoria, category")
    .limit(5000);

  if (stockErr) throw new Error(stockErr.message);

  const stockNow = emptyBuckets();
  for (const r of stockRows ?? []) {
    const cat = normalizeCategory((r as any).categoria ?? (r as any).category);
    const qty = safeNumber((r as any).quantidade ?? (r as any).quantity ?? 0);
    (stockNow as any)[cat] += qty;
  }
  sumBuckets(stockNow);

  // 2) Entradas no período (usa data_entrada se existir; senão tenta created_at)
  const { data: entriesRows, error: entriesErr } = await supabase
    .from("estoque")
    .select("id, quantidade, quantity, categoria, category, data_entrada, created_at")
    .gte("data_entrada", range.start)
    .lte("data_entrada", range.end)
    .limit(5000);

  // se sua tabela não tiver data_entrada por algum motivo, tenta fallback por created_at
  let entries = entriesRows;
  if (entriesErr) {
    const { data: entriesFallback, error: entriesFallbackErr } = await supabase
      .from("estoque")
      .select("id, quantidade, quantity, categoria, category, created_at")
      .gte("created_at", `${range.start}T00:00:00.000Z`)
      .lte("created_at", `${range.end}T23:59:59.999Z`)
      .limit(5000);

    if (entriesFallbackErr) throw new Error(entriesFallbackErr.message);
    entries = entriesFallback ?? [];
  }

  const stockEntriesPeriod = emptyBuckets();
  for (const r of entries ?? []) {
    const cat = normalizeCategory((r as any).categoria ?? (r as any).category);
    const qty = safeNumber((r as any).quantidade ?? (r as any).quantity ?? 0);
    (stockEntriesPeriod as any)[cat] += qty;
  }
  sumBuckets(stockEntriesPeriod);

  // 3) Beneficiários (total + criados no período)
  const { count: benTotal, error: benTotalErr } = await supabase
    .from("beneficiarios")
    .select("id", { count: "exact", head: true });

  if (benTotalErr) throw new Error(benTotalErr.message);

  const { count: benPeriod, error: benPeriodErr } = await supabase
    .from("beneficiarios")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${range.start}T00:00:00.000Z`)
    .lte("created_at", `${range.end}T23:59:59.999Z`);

  if (benPeriodErr) throw new Error(benPeriodErr.message);

  // 4) Cestas feitas (configuracoes)
  const { data: cfgRow, error: cfgErr } = await supabase
    .from("configuracoes")
    .select("key,value")
    .eq("key", "assembled_baskets")
    .maybeSingle();

  if (cfgErr) throw new Error(cfgErr.message);
  const assembledTotal = safeNumber((cfgRow as any)?.value ?? 0);

  // 5) Alertas (views)
  const { data: validadeRows, error: valErr } = await supabase
    .from("alertas_validade")
    .select("id,nome,categoria,validade,dias_para_vencer")
    .order("dias_para_vencer", { ascending: true })
    .limit(50);

  if (valErr) {
    // se a view não existir, não quebra o relatório
    // (você pode remover este try se preferir)
  }

  const { data: minimoRows, error: minErr } = await supabase
    .from("alertas_minimo")
    .select("id,nome,categoria,quantidade,minimo,falta_para_minimo")
    .order("falta_para_minimo", { ascending: false })
    .limit(50);

  if (minErr) {
    // idem: não quebra
  }

  return {
    range,
    generatedAt,
    stockNow,
    stockEntriesPeriod,
    beneficiaries: {
      total: safeNumber(benTotal),
      createdInPeriod: safeNumber(benPeriod),
    },
    baskets: { assembledTotal },
    alerts: {
      validade:
        (validadeRows as any[] | null)?.map((x) => ({
          id: String(x.id),
          nome: String(x.nome ?? ""),
          categoria: String(x.categoria ?? ""),
          validade: x.validade ? String(x.validade) : null,
          dias_para_vencer: x.dias_para_vencer === null ? null : Number(x.dias_para_vencer),
        })) ?? [],
      minimo:
        (minimoRows as any[] | null)?.map((x) => ({
          id: String(x.id),
          nome: String(x.nome ?? ""),
          categoria: String(x.categoria ?? ""),
          quantidade: safeNumber(x.quantidade),
          minimo: safeNumber(x.minimo),
          falta_para_minimo: safeNumber(x.falta_para_minimo),
        })) ?? [],
    },
  };
}

// UI do relatório (simples, plugável na sua aba)
function Relatorios() {
  const [range, setRange] = useState<ReportRange>({
    start: startOfCurrentMonthISO(),
    end: todayISO(),
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ReportSummary | null>(null);

  const run = async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await fetchReportFromSupabase(range);
      setData(r);
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao gerar relatório.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const doCSV = () => {
    if (!data) return;

    const rows: string[][] = [];

    rows.push(["Relatório ASA", ""]);
    rows.push(["Período (início)", data.range.start]);
    rows.push(["Período (fim)", data.range.end]);
    rows.push(["Gerado em (UTC)", data.generatedAt]);
    rows.push(["", ""]);

    rows.push(...bucketsToCSVRows("Estoque atual (snapshot)", data.stockNow));
    rows.push(...bucketsToCSVRows("Entradas no período", data.stockEntriesPeriod));

    rows.push(["Beneficiários", ""]);
    rows.push(["Total", String(data.beneficiaries.total)]);
    rows.push(["Cadastrados no período", String(data.beneficiaries.createdInPeriod)]);
    rows.push(["", ""]);

    rows.push(["Cestas", ""]);
    rows.push(["Cestas feitas (total)", String(data.baskets.assembledTotal)]);
    rows.push(["", ""]);

    rows.push(["Alertas - Validade (até 50)", ""]);
    rows.push(["Nome", "Vence em"]);
    for (const a of data.alerts.validade) {
      rows.push([a.nome, a.validade ?? ""]);
    }
    rows.push(["", ""]);

    rows.push(["Alertas - Mínimo (até 50)", ""]);
    rows.push(["Nome", "Qtd", "Mínimo", "Falta"]);
    for (const a of data.alerts.minimo) {
      rows.push([a.nome, String(a.quantidade), String(a.minimo), String(a.falta_para_minimo)]);
    }

    downloadCSV(`relatorio-asa-${data.range.start}-a-${data.range.end}.csv`, rows);
  };

  const doPrint = () => {
    if (!data) return;

    const style = `
      <style>
        body{ font-family: Arial, sans-serif; padding: 24px; color:#111;}
        h1{ font-size:18px; margin:0 0 8px;}
        h2{ font-size:14px; margin:20px 0 8px;}
        .muted{ color:#555; font-size:12px;}
        table{ width:100%; border-collapse: collapse; margin-top:8px;}
        th, td{ border:1px solid #ddd; padding:8px; font-size:12px; }
        th{ background:#f5f5f5; text-align:left;}
        .grid{ display:grid; grid-template-columns: 1fr 1fr; gap:12px;}
        .card{ border:1px solid #ddd; border-radius: 10px; padding: 12px;}
        @media print { .no-print { display:none; } }
      </style>
    `;

    const bucketTable = (title: string, b: any) => `
      <div class="card">
        <h2>${title}</h2>
        <table>
          <tr><th>Categoria</th><th>Quantidade</th></tr>
          <tr><td>Alimentos (perecível)</td><td>${b.alimentos_perecivel}</td></tr>
          <tr><td>Alimentos (não perecível)</td><td>${b.alimentos_nao_perecivel}</td></tr>
          <tr><td>Higiene</td><td>${b.higiene}</td></tr>
          <tr><td>Vestimenta (masculino)</td><td>${b.vest_masculina}</td></tr>
          <tr><td>Vestimenta (feminino)</td><td>${b.vest_feminina}</td></tr>
          <tr><td>Vestimenta (infantil)</td><td>${b.vest_infantil}</td></tr>
          <tr><td>Outros</td><td>${b.outros}</td></tr>
          <tr><th>TOTAL</th><th>${b.total}</th></tr>
        </table>
      </div>
    `;

    const validadeList = data.alerts.validade
      .map((a) => `<tr><td>${a.nome}</td><td>${a.categoria ?? ""}</td><td>${a.validade ?? ""}</td><td>${a.dias_para_vencer ?? ""}</td></tr>`)
      .join("");

    const minimoList = data.alerts.minimo
      .map((a) => `<tr><td>${a.nome}</td><td>${a.categoria ?? ""}</td><td>${a.quantidade}</td><td>${a.minimo}</td><td>${a.falta_para_minimo}</td></tr>`)
      .join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          ${style}
          <title>Relatório ASA</title>
        </head>
        <body>
          <h1>Relatório ASA</h1>
          <div class="muted">Período: ${data.range.start} até ${data.range.end} • Gerado em: ${data.generatedAt}</div>

          <div class="grid">
            ${bucketTable("Estoque atual (snapshot)", data.stockNow)}
            ${bucketTable("Entradas no período", data.stockEntriesPeriod)}
          </div>

          <div class="grid">
            <div class="card">
              <h2>Beneficiários</h2>
              <table>
                <tr><th>Total</th><td>${data.beneficiaries.total}</td></tr>
                <tr><th>Cadastrados no período</th><td>${data.beneficiaries.createdInPeriod}</td></tr>
              </table>
            </div>

            <div class="card">
              <h2>Cestas</h2>
              <table>
                <tr><th>Cestas feitas (total)</th><td>${data.baskets.assembledTotal}</td></tr>
              </table>
            </div>
          </div>

          <h2>Alertas de validade (até 50)</h2>
          <table>
            <tr><th>Item</th><th>Categoria</th><th>Validade</th><th>Dias p/ vencer</th></tr>
            ${validadeList || "<tr><td colspan='4'>Sem alertas</td></tr>"}
          </table>

          <h2>Alertas de mínimo (até 50)</h2>
          <table>
            <tr><th>Item</th><th>Categoria</th><th>Qtd</th><th>Mínimo</th><th>Falta</th></tr>
            ${minimoList || "<tr><td colspan='5'>Sem alertas</td></tr>"}
          </table>
        </body>
      </html>
    `;

    openPrintWindow(html);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Período do relatório</div>
            <div className="text-xs text-slate-600">Padrão: do início do mês até hoje</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-end sm:ml-auto">
            <div>
              <label className="block text-xs text-slate-600">Início</label>
              <input
                type="date"
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={range.start}
                onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600">Fim</label>
              <input
                type="date"
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={range.end}
                onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
              />
            </div>

            <button
              onClick={run}
              disabled={loading}
              className="rounded-lg bg-slate-900 text-white font-semibold px-4 py-2 disabled:opacity-60"
            >
              {loading ? "Gerando..." : "Gerar relatório"}
            </button>

            <button
              onClick={doPrint}
              disabled={!data}
              className="rounded-lg border border-slate-300 bg-white font-semibold px-4 py-2 disabled:opacity-60"
            >
              Imprimir
            </button>

            <button
              onClick={doCSV}
              disabled={!data}
              className="rounded-lg border border-slate-300 bg-white font-semibold px-4 py-2 disabled:opacity-60"
            >
              Baixar CSV
            </button>
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 text-red-800 px-3 py-2 text-sm">
            {err}
          </div>
        )}
      </div>

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="font-semibold text-slate-900">Estoque atual (snapshot)</div>
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <div>Alimentos (perecível): <b>{data.stockNow.alimentos_perecivel}</b></div>
              <div>Alimentos (não perecível): <b>{data.stockNow.alimentos_nao_perecivel}</b></div>
              <div>Higiene: <b>{data.stockNow.higiene}</b></div>
              <div>Vestimenta (masc/fem/inf): <b>{data.stockNow.vest_masculina + data.stockNow.vest_feminina + data.stockNow.vest_infantil}</b></div>
              <div>Outros: <b>{data.stockNow.outros}</b></div>
              <div className="pt-2">TOTAL: <b>{data.stockNow.total}</b></div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="font-semibold text-slate-900">Entradas no período</div>
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <div>Alimentos (perecível): <b>{data.stockEntriesPeriod.alimentos_perecivel}</b></div>
              <div>Alimentos (não perecível): <b>{data.stockEntriesPeriod.alimentos_nao_perecivel}</b></div>
              <div>Higiene: <b>{data.stockEntriesPeriod.higiene}</b></div>
              <div>Vestimenta (masc/fem/inf): <b>{data.stockEntriesPeriod.vest_masculina + data.stockEntriesPeriod.vest_feminina + data.stockEntriesPeriod.vest_infantil}</b></div>
              <div>Outros: <b>{data.stockEntriesPeriod.outros}</b></div>
              <div className="pt-2">TOTAL: <b>{data.stockEntriesPeriod.total}</b></div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="font-semibold text-slate-900">Beneficiários</div>
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <div>Total: <b>{data.beneficiaries.total}</b></div>
              <div>Cadastrados no período: <b>{data.beneficiaries.createdInPeriod}</b></div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="font-semibold text-slate-900">Cestas</div>
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <div>Cestas feitas (total): <b>{data.baskets.assembledTotal}</b></div>
              <div className="text-xs text-slate-500 mt-2">
                (Lido de <code>configuracoes</code> → <code>assembled_baskets</code>)
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 lg:col-span-2">
            <div className="font-semibold text-slate-900">Alertas</div>

            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">⚠️ Validade (até 50)</div>
                {data.alerts.validade.length === 0 ? (
                  <div className="text-sm text-slate-600 mt-2">Sem alertas.</div>
                ) : (
                  <ul className="mt-2 text-sm text-slate-700 list-disc pl-5 space-y-1">
                    {data.alerts.validade.map((a) => (
                      <li key={a.id}>
                        <b>{a.nome}</b> — {a.validade ?? "-"} ({a.dias_para_vencer ?? "-"} dias)
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-800">⚠️ Abaixo do mínimo (até 50)</div>
                {data.alerts.minimo.length === 0 ? (
                  <div className="text-sm text-slate-600 mt-2">Sem alertas.</div>
                ) : (
                  <ul className="mt-2 text-sm text-slate-700 list-disc pl-5 space-y-1">
                    {data.alerts.minimo.map((a) => (
                      <li key={a.id}>
                        <b>{a.nome}</b> — qtd {a.quantidade} / mín {a.minimo} (falta {a.falta_para_minimo})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-500 mt-3">
              (Se as views <code>alertas_validade</code> e <code>alertas_minimo</code> não existirem, essa parte pode ficar vazia.)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
