/* Invoice & Project Financial Analysis - dashboard logic
   All figures are computed live from window.INVOICE_DATA (invoice-level records). */
"use strict";

const D = window.INVOICE_DATA;
const INV = D.invoices;
const SRC = D.source;
const META = D.meta;
const ASOF = META.asOfDate;
const PM = window.PM_DATA;

/* ---------------- formatters ---------------- */
const fmtMoney = n => "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMoney0 = n => "£" + Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 });
const fmtInt = n => Number(n || 0).toLocaleString("en-GB");
const fmtPct = n => (n == null || !isFinite(n)) ? "—" : Number(n).toFixed(1) + "%";
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const mLabel = ym => { const [y, m] = ym.split("-"); return MONTH_SHORT[+m - 1] + " " + y.slice(2); };
const fmtDur = min => { if (min == null) return "—"; const h = Math.floor(min / 60), m = Math.round(min % 60); return h + "h " + (m < 10 ? "0" : "") + m + "m"; };
const getRate = () => { const v = parseFloat(localStorage.getItem("devHourlyRate")); return isFinite(v) && v >= 0 ? v : PM.meta.hourlyRateDefault; };
const minToMoney = (min, rate) => (min / 60) * (rate ?? getRate());
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------------- chart setup ---------------- */
Chart.defaults.font.family = '"Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif';
Chart.defaults.font.size = 11.5;
Chart.defaults.color = "#475569";
Chart.defaults.plugins.legend.position = "bottom";
Chart.defaults.plugins.tooltip.callbacks = Chart.defaults.plugins.tooltip.callbacks || {};
const C = { blue: "#1e40af", teal: "#0d9488", indigo: "#4f46e5", green: "#15803d", red: "#b91c1c", amber: "#b45309", slate: "#64748b", lightblue: "#60a5fa" };
const charts = {};
function mkChart(id, cfg) {
  if (charts[id]) charts[id].destroy();
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = new Chart(el.getContext("2d"), cfg);
}
const moneyTick = v => "£" + Number(v).toLocaleString("en-GB");
function moneyTooltip() {
  return { callbacks: { label: ctx => (ctx.dataset.label ? ctx.dataset.label + ": " : "") + fmtMoney(ctx.parsed.y ?? ctx.parsed.x ?? ctx.parsed) } };
}

/* ---------------- filter state ---------------- */
const state = { year: "All", month: "All", client: "All", project: "All", service: "All", payStatus: "All", status: "All" };

function filtered() {
  return INV.filter(i =>
    (state.year === "All" || i.year === +state.year) &&
    (state.month === "All" || i.month === state.month) &&
    (state.client === "All" || i.client === state.client) &&
    (state.project === "All" || i.project === state.project) &&
    (state.service === "All" || i.service === state.service) &&
    (state.payStatus === "All" || i.payStatus === state.payStatus) &&
    (state.status === "All" || i.status === state.status)
  );
}

const FILTER_KEY = { "f-year": "year", "f-month": "month", "f-client": "client", "f-project": "project", "f-service": "service", "f-paystatus": "payStatus", "f-status": "status" };
function fillSelect(id, values, labels) {
  const sel = document.getElementById(id);
  const key = FILTER_KEY[id];
  sel.innerHTML = "";
  values.forEach((v, ix) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = labels ? labels[ix] : v;
    sel.appendChild(o);
  });
  sel.value = state[key];
  sel.onchange = () => { state[key] = sel.value; renderAll(); };
}

function initFilters() {
  const years = [...new Set(INV.map(i => i.year))].sort();
  const months = [...new Set(INV.map(i => i.month))].sort();
  const clients = [...new Set(INV.map(i => i.client))].sort();
  const projects = [...new Set(INV.map(i => i.project))].sort();
  const services = [...new Set(INV.map(i => i.service))].sort();
  fillSelect("f-year", ["All", ...years]);
  fillSelect("f-month", ["All", ...months], ["All", ...months.map(mLabel)]);
  fillSelect("f-client", ["All", ...clients]);
  fillSelect("f-project", ["All", ...projects]);
  fillSelect("f-service", ["All", ...services]);
  fillSelect("f-paystatus", ["All", "Paid", "Unpaid"]);
  fillSelect("f-status", ["All", "Closed", "Overdue", "Open"]);
  document.getElementById("f-reset").onclick = () => {
    Object.keys(state).forEach(k => state[k] = "All");
    ["f-year", "f-month", "f-client", "f-project", "f-service", "f-paystatus", "f-status"].forEach(id => document.getElementById(id).value = "All");
    renderAll();
  };
}

/* ---------------- aggregation helpers ---------------- */
function agg(list) {
  const a = { count: list.length, gross: 0, net: 0, tax: 0, paid: 0, outstanding: 0, clients: new Set(), projects: new Set(), paidCount: 0, unpaidCount: 0 };
  list.forEach(i => {
    a.gross += i.gross; a.net += i.net; a.tax += i.tax; a.paid += i.paid; a.outstanding += i.outstanding;
    a.clients.add(i.client); a.projects.add(i.project);
    if (i.payStatus === "Paid") a.paidCount++; else a.unpaidCount++;
  });
  a.collectionPct = a.gross ? (a.paid / a.gross) * 100 : null;
  a.outstandingPct = a.gross ? (a.outstanding / a.gross) * 100 : null;
  return a;
}
const groupBy = (list, key) => {
  const m = new Map();
  list.forEach(i => { const k = typeof key === "function" ? key(i) : i[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(i); });
  return m;
};
const sum = (list, f) => list.reduce((t, i) => t + f(i), 0);

/* ---------------- sortable table builder ---------------- */
function makeTable(elId, cols, rows, opts = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  el._sort = el._sort || { key: null, dir: 1 };
  const st = el._sort;
  if (st.key) {
    const col = cols.find(c => c.key === st.key);
    rows = [...rows].sort((a, b) => {
      let va = typeof col.key === "function" ? col.key(a) : a[col.key];
      let vb = typeof col.key === "function" ? col.key(b) : b[col.key];
      if (va == null) return 1; if (vb == null) return -1;
      if (typeof va === "string") return st.dir * va.localeCompare(vb);
      return st.dir * (va - vb);
    });
  }
  let html = "<table><thead><tr>";
  cols.forEach((c, ix) => {
    const arr = st.key === c.key ? `<span class="arr">${st.dir === 1 ? "▲" : "▼"}</span>` : "";
    html += `<th data-ix="${ix}" class="${c.num ? "num" : ""}">${esc(c.label)}${arr}</th>`;
  });
  html += "</tr></thead><tbody>";
  if (!rows.length) html += `<tr><td colspan="${cols.length}" class="mut">No records match the current filters.</td></tr>`;
  rows.forEach(r => {
    html += `<tr class="${opts.rowClass ? opts.rowClass(r) : ""}">`;
    cols.forEach(c => {
      const v = typeof c.key === "function" ? c.key(r) : r[c.key];
      html += `<td class="${c.num ? "num" : ""}">${c.fmt ? c.fmt(v, r) : esc(v)}</td>`;
    });
    html += "</tr>";
  });
  if (opts.footer) {
    html += "<tfoot><tr style='font-weight:700;background:#f8fafc'>";
    cols.forEach(c => { html += `<td class="${c.num ? "num" : ""}">${c.fmt && opts.footer[c.key] !== undefined && typeof c.key === "string" ? c.fmt(opts.footer[c.key]) : (typeof c.key === "string" && opts.footer[c.key] !== undefined ? esc(opts.footer[c.key]) : "")}</td>`; });
    html += "</tr></tfoot>";
  }
  html += "</tbody></table>";
  el.innerHTML = html;
  el.querySelectorAll("th").forEach(th => th.onclick = () => {
    const c = cols[+th.dataset.ix];
    if (st.key === c.key) st.dir *= -1; else { st.key = c.key; st.dir = c.num ? -1 : 1; }
    makeTable(elId, cols, rows, opts);
  });
}

const pillPay = v => `<span class="pill ${v === "Paid" ? "paid" : "unpaid"}">${v}</span>`;
const pillStatus = v => `<span class="pill ${String(v).toLowerCase()}">${v}</span>`;
const pillSvc = v => `<span class="pill ${v === "SEO" ? "seo" : v === "Development" ? "dev" : ""}">${v}</span>`;

/* ================= SECTION 1 - EXEC SUMMARY ================= */
function renderExec(f) {
  const a = agg(f);
  const byYear = groupBy(f, "year");
  const yearAgg = [...byYear.entries()].map(([y, l]) => ({ y, ...agg(l) })).sort((x, y) => x.y - y.y);
  const topYear = yearAgg.length ? yearAgg.reduce((m, c) => c.gross > m.gross ? c : m) : null;
  const bySvc = groupBy(f, "service");
  const svcAgg = [...bySvc.entries()].map(([s, l]) => ({ s, ...agg(l) }));
  const topSvc = svcAgg.length ? svcAgg.reduce((m, c) => c.gross > m.gross ? c : m) : null;
  const byClient = groupBy(f, "client");
  const cliAgg = [...byClient.entries()].map(([c, l]) => ({ c, ...agg(l) }));
  const topCli = cliAgg.length ? cliAgg.reduce((m, c) => c.gross > m.gross ? c : m) : null;
  const topCliOut = cliAgg.length ? cliAgg.reduce((m, c) => c.outstanding > m.outstanding ? c : m) : null;
  const unpaid = f.filter(i => i.outstanding > 0);
  const overdue = unpaid.filter(i => i.status === "Overdue");
  const oldest = unpaid.length ? unpaid.reduce((m, c) => (c.ageDays ?? -1) > (m.ageDays ?? -1) ? c : m) : null;
  const multiYearClients = [...groupBy(INV, "client").entries()].filter(([, l]) => new Set(l.map(i => i.year)).size > 1).length;
  const seoA = agg(f.filter(i => i.service === "SEO"));
  const devA = agg(f.filter(i => i.service === "Development"));
  const concentration = a.gross && topCli ? (topCli.gross / a.gross) * 100 : 0;

  const kpis = [
    { lbl: "Total Projects", val: fmtInt(a.projects.size), hint: "derived projects" },
    { lbl: "Total Clients", val: fmtInt(a.clients.size) },
    { lbl: "Total Invoices", val: fmtInt(a.count) },
    { lbl: "Total Invoiced", val: fmtMoney(a.gross), hint: "incl. VAT" },
    { lbl: "Total Received", val: fmtMoney(a.paid), cls: "good" },
    { lbl: "Total Outstanding", val: fmtMoney(a.outstanding), cls: a.outstanding > 0 ? "bad" : "" },
    { lbl: "Collection Rate", val: fmtPct(a.collectionPct), cls: a.collectionPct >= 90 ? "good" : a.collectionPct >= 75 ? "warn" : "bad" },
    { lbl: "Overdue / Pending", val: fmtInt(a.unpaidCount) + " inv", hint: fmtMoney(a.outstanding) + " · " + fmtPct(a.outstandingPct), cls: a.unpaidCount > 0 ? "warn" : "good" },
  ];
  document.getElementById("kpi-main").innerHTML = kpis.map(k =>
    `<div class="kpi ${k.cls || ""}"><div class="lbl">${k.lbl}</div><div class="val">${k.val}</div>${k.hint ? `<div class="hint">${k.hint}</div>` : ""}</div>`).join("");

  document.getElementById("exec-position").innerHTML = [
    `Total projects (derived): <b>${fmtInt(a.projects.size)}</b> across <b>${fmtInt(a.clients.size)}</b> clients`,
    `Total invoices raised: <b>${fmtInt(a.count)}</b>`,
    `Total invoiced: <b>${fmtMoney(a.gross)}</b> (net ${fmtMoney(a.net)} + VAT ${fmtMoney(a.tax)})`,
    `Total received: <b>${fmtMoney(a.paid)}</b>`,
    `Total outstanding: <b>${fmtMoney(a.outstanding)}</b>`,
    `Collection rate: <b>${fmtPct(a.collectionPct)}</b>`
  ].map(x => `<li>${x}</li>`).join("");

  const findings = [];
  if (topYear) findings.push(`${topYear.y} generated the highest invoiced revenue: <b>${fmtMoney(topYear.gross)}</b> across ${topYear.count} invoices.`);
  if (topSvc) findings.push(`${topSvc.s} is the largest service line with <b>${fmtMoney(topSvc.gross)}</b> invoiced (${fmtPct(topSvc.gross / a.gross * 100)} of total).`);
  if (topCli) findings.push(`${esc(topCli.c)} is the top client by revenue at <b>${fmtMoney(topCli.gross)}</b>.`);
  if (seoA.gross || devA.gross) findings.push(`SEO: <b>${fmtMoney(seoA.gross)}</b> (${fmtInt(seoA.count)} inv) vs Development: <b>${fmtMoney(devA.gross)}</b> (${fmtInt(devA.count)} inv).`);
  findings.push(`${fmtInt(multiYearClients)} of ${fmtInt(agg(INV).clients.size)} clients appear across multiple years (repeat business).`);
  document.getElementById("exec-findings").innerHTML = findings.map(x => `<li>${x}</li>`).join("");

  const risks = [];
  if (a.outstanding > 0) risks.push(`<b>${fmtMoney(a.outstanding)}</b> remains outstanding (${fmtPct(a.outstandingPct)} of invoiced value).`);
  if (overdue.length) risks.push(`<b>${fmtInt(overdue.length)}</b> invoices totalling <b>${fmtMoney(sum(overdue, i => i.outstanding))}</b> are past their due date.`);
  if (oldest) risks.push(`Oldest unpaid invoice: <b>${esc(oldest.id)}</b> (${esc(oldest.client)}, ${fmtMoney(oldest.outstanding)}) – ${oldest.overdueDays} days past due.`);
  if (topCliOut && topCliOut.outstanding > 0) risks.push(`${esc(topCliOut.c)} carries the highest unpaid exposure: <b>${fmtMoney(topCliOut.outstanding)}</b>.`);
  if (concentration > 50) risks.push(`Revenue concentration risk: ${esc(topCli.c)} accounts for ${fmtPct(concentration)} of invoiced value.`);
  document.getElementById("exec-risks").innerHTML = (risks.length ? risks : ["No outstanding balances in the filtered dataset."]).map(x => `<li>${x}</li>`).join("");

  const actions = [];
  if (topCliOut && topCliOut.outstanding > 0) actions.push(`Follow up with <b>${esc(topCliOut.c)}</b> on their outstanding balance of ${fmtMoney(topCliOut.outstanding)}.`);
  if (oldest) actions.push(`Review the oldest unpaid invoices (see Outstanding &amp; Ageing – Top 10) and escalate those ${oldest.overdueDays > 90 ? "90+ days past due" : "past due"}.`);
  const flaggedCount = INV.filter(i => i.flags.some(fl => !fl.startsWith("Multi-line"))).length;
  if (flaggedCount) {
    const ow = INV.filter(i => i.status === "Overdue" && i.lastPaymentDate);
    actions.push(`Validate the ${fmtInt(flaggedCount)} flagged records in the Data Quality section${ow.length ? ` (incl. invoice ${ow.map(i => i.id).join(", ")} marked Overdue with a payment date)` : ""}.`);
  }
  actions.push(`Review service-level collection performance (SEO ${fmtPct(seoA.collectionPct)} vs Development ${fmtPct(devA.collectionPct)}).`);
  const latestMonth = INV.reduce((m, i) => i.month > m ? i.month : m, "");
  if (latestMonth) actions.push(`Continue monitoring monthly outstanding trends, especially the latest invoice run (${mLabel(latestMonth)}).`);
  document.getElementById("exec-actions").innerHTML = actions.map(x => `<li>${x}</li>`).join("");
}

/* ================= SECTION 2 - FINANCIAL OVERVIEW ================= */
function renderFin(f) {
  const a = agg(f);
  const kpis = [
    { lbl: "Net Invoiced (ex-VAT)", val: fmtMoney(a.net) },
    { lbl: "VAT (20%)", val: fmtMoney(a.tax) },
    { lbl: "Gross Invoiced", val: fmtMoney(a.gross) },
    { lbl: "Collected", val: fmtMoney(a.paid), cls: "good" },
    { lbl: "Outstanding", val: fmtMoney(a.outstanding), cls: a.outstanding > 0 ? "bad" : "" },
    { lbl: "Avg Invoice Value", val: fmtMoney(a.count ? a.gross / a.count : 0) },
  ];
  document.getElementById("kpi-fin").innerHTML = kpis.map(k =>
    `<div class="kpi ${k.cls || ""}"><div class="lbl">${k.lbl}</div><div class="val">${k.val}</div></div>`).join("");

  mkChart("ch-fin-bar", {
    type: "bar",
    data: { labels: ["Invoiced (gross)", "Collected", "Outstanding"], datasets: [{ data: [a.gross, a.paid, a.outstanding], backgroundColor: [C.blue, C.green, C.red], borderRadius: 6 }] },
    options: { plugins: { legend: { display: false }, tooltip: moneyTooltip() }, scales: { y: { ticks: { callback: moneyTick } } } }
  });

  const cats = [
    { label: "Fully Paid (Closed)", list: f.filter(i => i.status === "Closed") },
    { label: "Unpaid – Overdue", list: f.filter(i => i.status === "Overdue") },
    { label: "Unpaid – Open (not yet due)", list: f.filter(i => i.status === "Open") },
  ];
  makeTable("tbl-status", [
    { key: "label", label: "Invoice Category" },
    { key: "n", label: "Count", num: true, fmt: fmtInt },
    { key: "gross", label: "Value", num: true, fmt: fmtMoney },
    { key: "share", label: "% of Value", num: true, fmt: fmtPct },
  ], cats.map(c => ({ label: c.label, n: c.list.length, gross: sum(c.list, i => i.gross), share: a.gross ? sum(c.list, i => i.gross) / a.gross * 100 : 0 })),
  { footer: { label: "Total", n: a.count, gross: a.gross, share: 100 } });
}

/* ================= SECTION 3 - YEAR-WISE ================= */
function yearRows(f) {
  const byYear = groupBy(f, "year");
  // first appearance of each project/client within the filtered set
  const firstProjYear = new Map(), firstCliYear = new Map();
  [...f].sort((a, b) => a.date.localeCompare(b.date)).forEach(i => {
    if (!firstProjYear.has(i.project)) firstProjYear.set(i.project, i.year);
    if (!firstCliYear.has(i.client)) firstCliYear.set(i.client, i.year);
  });
  return [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([y, l], ix, arr) => {
    const a = agg(l);
    const prev = ix > 0 ? agg(arr[ix - 1][1]) : null;
    return {
      year: y, projects: a.projects.size, newProjects: [...firstProjYear.values()].filter(v => v === y).length,
      clients: a.clients.size, newClients: [...firstCliYear.values()].filter(v => v === y).length,
      invoices: a.count, gross: a.gross, paid: a.paid, outstanding: a.outstanding,
      collectionPct: a.collectionPct, avgInv: a.count ? a.gross / a.count : 0,
      yoyGross: prev && prev.gross ? ((a.gross - prev.gross) / prev.gross) * 100 : null,
      yoyPaid: prev && prev.paid ? ((a.paid - prev.paid) / prev.paid) * 100 : null,
    };
  });
}
const yoyFmt = v => v == null ? '<span class="mut">—</span>' : `<span class="${v >= 0 ? "pos" : "neg"}">${v >= 0 ? "+" : ""}${v.toFixed(1)}%</span>`;

function renderYear(f) {
  const rows = yearRows(f);
  makeTable("tbl-year", [
    { key: "year", label: "Year" },
    { key: "projects", label: "Projects", num: true, fmt: fmtInt },
    { key: "newProjects", label: "New Projects", num: true, fmt: fmtInt },
    { key: "clients", label: "Clients", num: true, fmt: fmtInt },
    { key: "newClients", label: "New Clients", num: true, fmt: fmtInt },
    { key: "invoices", label: "Invoices", num: true, fmt: fmtInt },
    { key: "gross", label: "Invoiced", num: true, fmt: fmtMoney },
    { key: "paid", label: "Collected (cohort)", num: true, fmt: fmtMoney },
    { key: "outstanding", label: "Outstanding", num: true, fmt: fmtMoney },
    { key: "collectionPct", label: "Collection %", num: true, fmt: fmtPct },
    { key: "avgInv", label: "Avg Invoice", num: true, fmt: fmtMoney },
    { key: "yoyGross", label: "YoY Invoiced", num: true, fmt: yoyFmt },
    { key: "yoyPaid", label: "YoY Collected", num: true, fmt: yoyFmt },
  ], rows);

  const labels = rows.map(r => String(r.year));
  mkChart("ch-year-rev", {
    type: "bar",
    data: { labels, datasets: [
      { label: "Invoiced", data: rows.map(r => r.gross), backgroundColor: C.blue, borderRadius: 4 },
      { label: "Collected", data: rows.map(r => r.paid), backgroundColor: C.green, borderRadius: 4 },
      { label: "Outstanding", data: rows.map(r => r.outstanding), backgroundColor: C.red, borderRadius: 4 },
    ] },
    options: { plugins: { tooltip: moneyTooltip() }, scales: { y: { ticks: { callback: moneyTick } } } }
  });
  mkChart("ch-year-col", {
    type: "line",
    data: { labels, datasets: [{ label: "Collection %", data: rows.map(r => r.collectionPct), borderColor: C.green, backgroundColor: "rgba(21,128,61,.12)", fill: true, tension: .3, pointRadius: 4 }] },
    options: { plugins: { tooltip: { callbacks: { label: c => fmtPct(c.parsed.y) } } }, scales: { y: { min: 0, max: 105, ticks: { callback: v => v + "%" } } } }
  });
  mkChart("ch-year-vol", {
    type: "bar",
    data: { labels, datasets: [
      { label: "Invoices Raised", data: rows.map(r => r.invoices), backgroundColor: C.lightblue, borderRadius: 4 },
      { label: "New Projects", data: rows.map(r => r.newProjects), backgroundColor: C.amber, borderRadius: 4 },
    ] },
    options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
  mkChart("ch-year-yoy", {
    type: "bar",
    data: { labels, datasets: [
      { label: "Invoiced YoY %", data: rows.map(r => r.yoyGross), backgroundColor: C.blue, borderRadius: 4 },
      { label: "Collected YoY %", data: rows.map(r => r.yoyPaid), backgroundColor: C.green, borderRadius: 4 },
    ] },
    options: { plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ": " + (c.parsed.y == null ? "—" : c.parsed.y.toFixed(1) + "%") } } }, scales: { y: { ticks: { callback: v => v + "%" } } } }
  });
}

/* ================= SECTION 4 - SEO VS DEV ================= */
function renderSvc(f) {
  const bySvc = groupBy(f, "service");
  const rows = [...bySvc.entries()].sort((a, b) => sum(b[1], i => i.gross) - sum(a[1], i => i.gross)).map(([s, l]) => {
    const a = agg(l);
    return { service: s, projects: a.projects.size, invoices: a.count, gross: a.gross, paid: a.paid, outstanding: a.outstanding, collectionPct: a.collectionPct, avgInv: a.count ? a.gross / a.count : 0 };
  });
  makeTable("tbl-svc", [
    { key: "service", label: "Service", fmt: pillSvc },
    { key: "projects", label: "Projects", num: true, fmt: fmtInt },
    { key: "invoices", label: "Invoices", num: true, fmt: fmtInt },
    { key: "gross", label: "Invoice Value", num: true, fmt: fmtMoney },
    { key: "paid", label: "Paid", num: true, fmt: fmtMoney },
    { key: "outstanding", label: "Outstanding", num: true, fmt: fmtMoney },
    { key: "collectionPct", label: "Collection %", num: true, fmt: fmtPct },
    { key: "avgInv", label: "Avg Invoice", num: true, fmt: fmtMoney },
  ], rows, { footer: { service: "Total", projects: agg(f).projects.size, invoices: f.length, gross: sum(rows, r => r.gross), paid: sum(rows, r => r.paid), outstanding: sum(rows, r => r.outstanding) } });

  const svcColor = s => s === "SEO" ? C.teal : s === "Development" ? C.indigo : C.slate;
  mkChart("ch-svc-rev", {
    type: "doughnut",
    data: { labels: rows.map(r => r.service), datasets: [{ data: rows.map(r => r.gross), backgroundColor: rows.map(r => svcColor(r.service)) }] },
    options: { plugins: { tooltip: { callbacks: { label: c => c.label + ": " + fmtMoney(c.parsed) } } } }
  });
  mkChart("ch-svc-out", {
    type: "doughnut",
    data: { labels: rows.map(r => r.service), datasets: [{ data: rows.map(r => r.outstanding), backgroundColor: rows.map(r => svcColor(r.service)) }] },
    options: { plugins: { tooltip: { callbacks: { label: c => c.label + ": " + fmtMoney(c.parsed) } } } }
  });

  // year x service
  const years = [...new Set(f.map(i => i.year))].sort();
  const svcs = rows.map(r => r.service);
  const ds = svcs.map(s => ({ label: s, data: years.map(y => sum(f.filter(i => i.year === y && i.service === s), i => i.gross)), backgroundColor: svcColor(s), borderRadius: 4 }));
  mkChart("ch-svc-year", { type: "bar", data: { labels: years.map(String), datasets: ds }, options: { plugins: { tooltip: moneyTooltip() }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: moneyTick } } } } });
  const ds2 = svcs.map(s => ({ label: s, data: years.map(y => sum(f.filter(i => i.year === y && i.service === s), i => i.outstanding)), borderColor: svcColor(s), backgroundColor: "transparent", tension: .3, pointRadius: 4 }));
  mkChart("ch-svc-outyear", { type: "line", data: { labels: years.map(String), datasets: ds2 }, options: { plugins: { tooltip: moneyTooltip() }, scales: { y: { ticks: { callback: moneyTick } } } } });
}

/* ================= SECTION 5 - CLIENT ANALYSIS ================= */
function renderClients(f) {
  const byClient = groupBy(f, "client");
  const rows = [...byClient.entries()].map(([c, l]) => {
    const a = agg(l);
    const lastInv = l.reduce((m, i) => i.date > m ? i.date : m, "");
    const pays = l.filter(i => i.lastPaymentDate);
    const lastPay = pays.length ? pays.reduce((m, i) => i.lastPaymentDate > m ? i.lastPaymentDate : m, "") : "";
    return { client: c, projects: a.projects.size, invoices: a.count, gross: a.gross, paid: a.paid, outstanding: a.outstanding, collectionPct: a.collectionPct, lastInv, lastPay: lastPay || "—", avgInv: a.count ? a.gross / a.count : 0 };
  });
  makeTable("tbl-client", [
    { key: "client", label: "Client" },
    { key: "projects", label: "Projects", num: true, fmt: fmtInt },
    { key: "invoices", label: "Invoices", num: true, fmt: fmtInt },
    { key: "gross", label: "Invoiced", num: true, fmt: fmtMoney },
    { key: "paid", label: "Paid", num: true, fmt: fmtMoney },
    { key: "outstanding", label: "Outstanding", num: true, fmt: v => v > 0 ? `<span class="neg">${fmtMoney(v)}</span>` : fmtMoney(v) },
    { key: "collectionPct", label: "Collection %", num: true, fmt: fmtPct },
    { key: "lastInv", label: "Last Invoice" },
    { key: "lastPay", label: "Last Payment" },
    { key: "avgInv", label: "Avg Invoice", num: true, fmt: fmtMoney },
  ], rows, { rowClass: r => r.outstanding > 0 ? "hl-out" : "" });

  const byRev = [...rows].sort((a, b) => b.gross - a.gross).slice(0, 10);
  const byOut = [...rows].filter(r => r.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 10);
  const byPaid = [...rows].sort((a, b) => b.paid - a.paid).slice(0, 10);
  const hbar = (id, data, label) => mkChart(id, {
    type: "bar",
    data: { labels: data.map(r => r.client), datasets: [{ label, data: data.map(r => r[label]), backgroundColor: C.blue, borderRadius: 4 }] },
    options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtMoney(c.parsed.x) } } }, scales: { x: { ticks: { callback: moneyTick } } } }
  });
  hbar("ch-client-rev", byRev, "gross");
  mkChart("ch-client-out", {
    type: "bar",
    data: { labels: byOut.map(r => r.client), datasets: [{ data: byOut.map(r => r.outstanding), backgroundColor: C.red, borderRadius: 4 }] },
    options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtMoney(c.parsed.x) } } }, scales: { x: { ticks: { callback: moneyTick } } } }
  });
  hbar("ch-client-paid", byPaid, "paid");

  makeTable("tbl-client-exposure", [
    { key: "client", label: "Client" },
    { key: "outstanding", label: "Outstanding", num: true, fmt: v => `<span class="neg">${fmtMoney(v)}</span>` },
    { key: "overdueInv", label: "Unpaid Invoices", num: true, fmt: fmtInt },
    { key: "oldest", label: "Oldest Unpaid", fmt: v => v || '<span class="mut">—</span>' },
    { key: "maxOverdueDays", label: "Days Past Due", num: true, fmt: v => v == null ? '<span class="mut">—</span>' : `<span class="${v > 90 ? "neg" : ""}">${v}</span>` },
  ], byOut.map(r => {
    const l = f.filter(i => i.client === r.client && i.outstanding > 0);
    const oldest = l.reduce((m, i) => (i.overdueDays ?? -1) > (m.overdueDays ?? -1) ? i : m, l[0]);
    return { client: r.client, outstanding: r.outstanding, overdueInv: l.length, oldest: oldest ? oldest.date : null, maxOverdueDays: oldest ? oldest.overdueDays : null };
  }));
}

/* ================= SECTION 6 - PROJECT ANALYSIS ================= */
function renderProjects(f) {
  const byProj = groupBy(f, "project");
  const rows = [...byProj.entries()].map(([p, l]) => {
    const a = agg(l);
    const firstYear = Math.min(...l.map(i => i.year));
    const status = a.outstanding === 0 ? "Fully Collected" : (a.paid === 0 ? "Fully Outstanding" : "Partially Outstanding");
    const multi = l.length > 1;
    return { project: p, client: l[0].client, service: l[0].service, firstYear, invoices: a.count, gross: a.gross, paid: a.paid, outstanding: a.outstanding, status, multi };
  });
  makeTable("tbl-project", [
    { key: "project", label: "Project" },
    { key: "client", label: "Client" },
    { key: "service", label: "Service", fmt: pillSvc },
    { key: "firstYear", label: "First Invoice Year", num: true },
    { key: "invoices", label: "Invoices", num: true, fmt: fmtInt },
    { key: "gross", label: "Invoiced", num: true, fmt: fmtMoney },
    { key: "paid", label: "Paid", num: true, fmt: fmtMoney },
    { key: "outstanding", label: "Outstanding", num: true, fmt: v => v > 0 ? `<span class="neg">${fmtMoney(v)}</span>` : fmtMoney(v) },
    { key: "status", label: "Status", fmt: v => `<span class="pill ${v === "Fully Collected" ? "paid" : v === "Fully Outstanding" ? "unpaid" : "review"}">${v}</span>` },
  ], rows, { rowClass: r => r.outstanding > 0 ? "hl-out" : "" });

  const byVal = [...rows].sort((a, b) => b.gross - a.gross);
  mkChart("ch-proj-val", {
    type: "bar",
    data: { labels: byVal.map(r => r.project), datasets: [
      { label: "Collected", data: byVal.map(r => r.paid), backgroundColor: C.green, borderRadius: 3 },
      { label: "Outstanding", data: byVal.map(r => r.outstanding), backgroundColor: C.red, borderRadius: 3 },
    ] },
    options: { indexAxis: "y", plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ": " + fmtMoney(c.parsed.x) } } }, scales: { x: { stacked: true, ticks: { callback: moneyTick } }, y: { stacked: true, ticks: { autoSkip: false, font: { size: 10 } } } } }
  });
  const svcProj = groupBy(rows, "service");
  mkChart("ch-proj-svc", {
    type: "doughnut",
    data: { labels: [...svcProj.keys()], datasets: [{ data: [...svcProj.values()].map(l => l.length), backgroundColor: [...svcProj.keys()].map(s => s === "SEO" ? C.teal : s === "Development" ? C.indigo : C.slate) }] },
    options: { plugins: { tooltip: { callbacks: { label: c => c.label + ": " + c.parsed + " projects" } } } }
  });
}

/* ================= SECTION 7 - INVOICE & PAYMENT ================= */
function renderPay(f) {
  const paid = f.filter(i => i.paid > 0);
  const withDates = paid.filter(i => i.lastPaymentDate && i.daysToPay != null);
  const avgPay = paid.length ? sum(paid, i => i.paid) / paid.length : 0;
  const avgDtp = withDates.length ? sum(withDates, i => i.daysToPay) / withDates.length : null;
  const fastest = withDates.length ? Math.min(...withDates.map(i => i.daysToPay)) : null;
  const slowest = withDates.length ? Math.max(...withDates.map(i => i.daysToPay)) : null;
  const kpis = [
    { lbl: "Payments Received", val: fmtMoney(sum(paid, i => i.paid)), cls: "good" },
    { lbl: "Payment Transactions", val: fmtInt(withDates.length), hint: "paid invoices with a payment date" },
    { lbl: "Avg Payment", val: fmtMoney(avgPay) },
    { lbl: "Avg Days to Payment", val: avgDtp == null ? "—" : avgDtp.toFixed(1) + " days" },
    { lbl: "Fastest Payment", val: fastest == null ? "—" : fastest + " days" },
    { lbl: "Longest Payment", val: slowest == null ? "—" : slowest + " days", cls: slowest > 60 ? "warn" : "" },
  ];
  document.getElementById("kpi-pay").innerHTML = kpis.map(k =>
    `<div class="kpi ${k.cls || ""}"><div class="lbl">${k.lbl}</div><div class="val">${k.val}</div>${k.hint ? `<div class="hint">${k.hint}</div>` : ""}</div>`).join("");

  const stat = groupBy(f, "status");
  const statLabels = [...stat.keys()];
  const statColor = s => s === "Closed" ? C.green : s === "Overdue" ? C.red : C.amber;
  mkChart("ch-status-count", {
    type: "doughnut",
    data: { labels: statLabels, datasets: [{ data: statLabels.map(s => stat.get(s).length), backgroundColor: statLabels.map(statColor) }] },
    options: { plugins: { tooltip: { callbacks: { label: c => c.label + ": " + c.parsed + " invoices" } } } }
  });
  mkChart("ch-status-val", {
    type: "doughnut",
    data: { labels: statLabels, datasets: [{ data: statLabels.map(s => sum(stat.get(s), i => i.gross)), backgroundColor: statLabels.map(statColor) }] },
    options: { plugins: { tooltip: { callbacks: { label: c => c.label + ": " + fmtMoney(c.parsed) } } } }
  });

  const buckets = [{ l: "0–30 days", min: 0, max: 30 }, { l: "31–60", min: 31, max: 60 }, { l: "61–90", min: 61, max: 90 }, { l: "91–180", min: 91, max: 180 }, { l: "181+", min: 181, max: Infinity }];
  const bdata = buckets.map(b => withDates.filter(i => i.daysToPay >= b.min && i.daysToPay <= b.max).length);
  mkChart("ch-dtp", {
    type: "bar",
    data: { labels: buckets.map(b => b.l), datasets: [{ data: bdata, backgroundColor: C.blue, borderRadius: 4 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + " invoices" } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });

  const payMonths = [...new Set(withDates.map(i => i.payMonth).filter(Boolean))].sort();
  const pmData = payMonths.map(m => sum(withDates.filter(i => i.payMonth === m), i => i.paid));
  mkChart("ch-pay-month", {
    type: "line",
    data: { labels: payMonths.map(mLabel), datasets: [{ label: "Payments Received", data: pmData, borderColor: C.green, backgroundColor: "rgba(21,128,61,.12)", fill: true, tension: .3, pointRadius: 2 }] },
    options: { plugins: { tooltip: moneyTooltip() }, scales: { y: { ticks: { callback: moneyTick } } } }
  });
  const payYears = [...new Set(withDates.map(i => i.payYear))].sort();
  mkChart("ch-pay-year", {
    type: "bar",
    data: { labels: payYears.map(String), datasets: [{ data: payYears.map(y => sum(withDates.filter(i => i.payYear === y), i => i.paid)), backgroundColor: C.green, borderRadius: 4 }] },
    options: { plugins: { legend: { display: false }, tooltip: moneyTooltip() }, scales: { y: { ticks: { callback: moneyTick } } } }
  });
  const paySvc = groupBy(paid, "service");
  const psLabels = [...paySvc.keys()];
  mkChart("ch-pay-svc", {
    type: "doughnut",
    data: { labels: psLabels, datasets: [{ data: psLabels.map(s => sum(paySvc.get(s), i => i.paid)), backgroundColor: psLabels.map(s => s === "SEO" ? C.teal : s === "Development" ? C.indigo : C.slate) }] },
    options: { plugins: { tooltip: { callbacks: { label: c => c.label + ": " + fmtMoney(c.parsed) } } } }
  });
}

/* ================= SECTION 8 - OUTSTANDING & AGEING ================= */
function renderAge(f) {
  const out = f.filter(i => i.outstanding > 0);
  const buckets = [
    { l: "Not yet due", test: i => (i.overdueDays ?? 0) <= 0 },
    { l: "1–30 days", test: i => i.overdueDays >= 1 && i.overdueDays <= 30 },
    { l: "31–60 days", test: i => i.overdueDays >= 31 && i.overdueDays <= 60 },
    { l: "61–90 days", test: i => i.overdueDays >= 61 && i.overdueDays <= 90 },
    { l: "91–180 days", test: i => i.overdueDays >= 91 && i.overdueDays <= 180 },
    { l: "181–365 days", test: i => i.overdueDays >= 181 && i.overdueDays <= 365 },
    { l: "365+ days", test: i => i.overdueDays >= 366 },
  ];
  const totalOut = sum(out, i => i.outstanding);
  const rows = buckets.map(b => {
    const l = out.filter(b.test);
    return { bucket: b.l, n: l.length, amount: sum(l, i => i.outstanding), share: totalOut ? sum(l, i => i.outstanding) / totalOut * 100 : 0 };
  });
  makeTable("tbl-ageing", [
    { key: "bucket", label: "Ageing Bucket (days past due)" },
    { key: "n", label: "Invoices", num: true, fmt: fmtInt },
    { key: "amount", label: "Outstanding", num: true, fmt: fmtMoney },
    { key: "share", label: "% of Total Outstanding", num: true, fmt: fmtPct },
  ], rows, { footer: { bucket: "Total", n: out.length, amount: totalOut, share: 100 }, rowClass: r => r.amount > 0 && r.bucket !== "Not yet due" ? "hl-out" : "" });

  mkChart("ch-age-amt", {
    type: "bar",
    data: { labels: rows.map(r => r.bucket), datasets: [{ data: rows.map(r => r.amount), backgroundColor: rows.map((_, ix) => ["#64748b", "#fbbf24", "#f59e0b", "#f97316", "#dc2626", "#991b1b", "#7f1d1d"][ix]), borderRadius: 4 }] },
    options: { plugins: { legend: { display: false }, tooltip: moneyTooltip() }, scales: { y: { ticks: { callback: moneyTick } } } }
  });
  mkChart("ch-age-cnt", {
    type: "bar",
    data: { labels: rows.map(r => r.bucket), datasets: [{ data: rows.map(r => r.n), backgroundColor: C.slate, borderRadius: 4 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + " invoices" } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });

  const oldest = [...out].sort((a, b) => (b.overdueDays ?? -1) - (a.overdueDays ?? -1)).slice(0, 10);
  makeTable("tbl-oldest", [
    { key: "client", label: "Client" },
    { key: "project", label: "Project" },
    { key: "id", label: "Invoice ID" },
    { key: "date", label: "Invoice Date" },
    { key: "gross", label: "Invoice Amount", num: true, fmt: fmtMoney },
    { key: "paid", label: "Paid", num: true, fmt: fmtMoney },
    { key: "outstanding", label: "Outstanding", num: true, fmt: v => `<span class="neg">${fmtMoney(v)}</span>` },
    { key: "overdueDays", label: "Days Past Due", num: true, fmt: v => v == null ? "—" : `<span class="${v > 90 ? "neg" : ""}">${v}</span>` },
    { key: "service", label: "Service", fmt: pillSvc },
  ], oldest, { rowClass: () => "hl-out" });
}

/* ================= SECTION 9 - MONTHLY TRENDS ================= */
function renderMonth(f) {
  const allMonths = [];
  if (INV.length) {
    const min = INV.reduce((m, i) => i.month < m ? i.month : m, INV[0].month);
    const max = INV.reduce((m, i) => i.month > m ? i.month : m, INV[0].month);
    let [y, m] = min.split("-").map(Number);
    const [ey, em] = max.split("-").map(Number);
    while (y < ey || (y === ey && m <= em)) {
      allMonths.push(`${y}-${String(m).padStart(2, "0")}`);
      m++; if (m > 12) { m = 1; y++; }
    }
  }
  const rows = allMonths.map(mo => {
    const l = f.filter(i => i.month === mo);
    const pay = f.filter(i => i.payMonth === mo && i.paid > 0);
    return { month: mo, gross: sum(l, i => i.gross), received: sum(pay, i => i.paid), outstanding: sum(l, i => i.outstanding), invoices: l.length, projects: new Set(l.map(i => i.project)).size };
  });
  const labels = rows.map(r => mLabel(r.month));
  mkChart("ch-month-main", {
    type: "bar",
    data: { labels, datasets: [
      { type: "bar", label: "Invoiced", data: rows.map(r => r.gross), backgroundColor: C.lightblue, borderRadius: 3 },
      { type: "bar", label: "Payments Received", data: rows.map(r => r.received), backgroundColor: C.green, borderRadius: 3 },
      { type: "line", label: "Outstanding Generated", data: rows.map(r => r.outstanding), borderColor: C.red, backgroundColor: "transparent", tension: .3, pointRadius: 3 },
    ] },
    options: { plugins: { tooltip: moneyTooltip() }, scales: { y: { ticks: { callback: moneyTick } } } }
  });
  mkChart("ch-month-cnt", {
    type: "bar",
    data: { labels, datasets: [{ data: rows.map(r => r.invoices), backgroundColor: C.blue, borderRadius: 3 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + " invoices" } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
  makeTable("tbl-month", [
    { key: "month", label: "Month", fmt: mLabel },
    { key: "invoices", label: "Invoices", num: true, fmt: fmtInt },
    { key: "projects", label: "Active Projects", num: true, fmt: fmtInt },
    { key: "gross", label: "Invoiced", num: true, fmt: fmtMoney },
    { key: "received", label: "Payments Recvd", num: true, fmt: fmtMoney },
    { key: "outstanding", label: "Outstanding Generated", num: true, fmt: v => v > 0 ? `<span class="neg">${fmtMoney(v)}</span>` : fmtMoney(v) },
  ], [...rows].reverse());
}

/* ================= SECTION 10 - REPEAT BUSINESS ================= */
function renderRepeat(f) {
  const byClient = groupBy(f, "client");
  const rows = [...byClient.entries()].map(([c, l]) => {
    const years = [...new Set(l.map(i => i.year))].sort();
    const recurring = l.filter(i => i.recurrence).length;
    return { client: c, years: years.join(", "), nYears: years.length, projects: new Set(l.map(i => i.project)).size, invoices: l.length, recurring, gross: sum(l, i => i.gross) };
  });
  const repeat = rows.filter(r => r.invoices > 1).length;
  const multiYear = rows.filter(r => r.nYears > 1).length;
  const avgProj = rows.length ? sum(rows, r => r.projects) / rows.length : 0;
  const kpis = [
    { lbl: "Clients", val: fmtInt(rows.length) },
    { lbl: "Repeat Clients (>1 invoice)", val: fmtInt(repeat) },
    { lbl: "Active Across Multiple Years", val: fmtInt(multiYear) },
    { lbl: "Avg Projects / Client", val: avgProj.toFixed(1) },
  ];
  document.getElementById("kpi-repeat").innerHTML = kpis.map(k =>
    `<div class="kpi"><div class="lbl">${k.lbl}</div><div class="val">${k.val}</div></div>`).join("");

  makeTable("tbl-repeat", [
    { key: "client", label: "Client" },
    { key: "years", label: "Years Active" },
    { key: "nYears", label: "# Years", num: true, fmt: fmtInt },
    { key: "projects", label: "Projects", num: true, fmt: fmtInt },
    { key: "invoices", label: "Invoices", num: true, fmt: fmtInt },
    { key: "recurring", label: "Recurring (retainer)", num: true, fmt: fmtInt },
    { key: "gross", label: "Total Invoiced", num: true, fmt: fmtMoney },
  ], rows);

  const yr = groupBy(f, "year");
  const years = [...yr.keys()].sort();
  const firstCli = new Map(), firstProj = new Map();
  [...f].sort((a, b) => a.date.localeCompare(b.date)).forEach(i => {
    if (!firstCli.has(i.client)) firstCli.set(i.client, i.year);
    if (!firstProj.has(i.project)) firstProj.set(i.project, i.year);
  });
  mkChart("ch-repeat", {
    type: "bar",
    data: { labels: years.map(String), datasets: [
      { label: "New Clients", data: years.map(y => [...firstCli.values()].filter(v => v === y).length), backgroundColor: C.teal, borderRadius: 4 },
      { label: "New Projects", data: years.map(y => [...firstProj.values()].filter(v => v === y).length), backgroundColor: C.amber, borderRadius: 4 },
    ] },
    options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}

/* ================= SECTION 11 - DATA QUALITY ================= */
function renderDQ() {
  const multiLine = INV.filter(i => i.lineCount > 1);
  const noAttention = INV.filter(i => !i.attention);
  const overdueWithPay = INV.filter(i => i.status === "Overdue" && i.lastPaymentDate);
  const catesby = INV.filter(i => /catesby/i.test(i.recurrence));
  const lineMismatch = INV.filter(i => i.flags.some(fl => fl.startsWith("Line items sum")));
  const noDates = INV.filter(i => !i.date || !i.dueDate);
  const unclassified = INV.filter(i => i.service === "Unclassified" || i.service === "Other" || i.service === "Mixed");
  const negative = INV.filter(i => i.gross < 0 || i.outstanding < 0);
  const dupIds = SRC.rawRows - SRC.uniqueInvoices;

  const summary = [
    { check: "Raw rows in Excel export", detail: `${SRC.rawRows} rows → ${SRC.uniqueInvoices} unique invoices. ${dupIds} extra rows are additional line items of multi-line invoices (deduplicated by Invoice ID).`, severity: "Info" },
    { check: "Duplicate invoice numbers", detail: `${multiLine.length} invoices appear on multiple rows (one row per line item). Header amounts repeat per row and are counted once.`, severity: "Info" },
    { check: "Missing invoice numbers / dates / amounts", detail: noDates.length ? `${noDates.length} invoices affected` : "None detected", severity: noDates.length ? "Issue" : "OK" },
    { check: "Invalid / negative amounts", detail: negative.length ? `${negative.length} invoices affected` : "None detected", severity: negative.length ? "Issue" : "OK" },
    { check: "Invoice amount lower than amount paid", detail: "Not detectable – source has no amount-paid column; payment is inferred from status.", severity: "Info" },
    { check: "Missing Billing Attention contact", detail: `${noAttention.length} invoices (mostly SUPERHOUSE (UK) LIMITED)`, severity: noAttention.length ? "Issue" : "OK" },
    { check: "Overdue status with a Last Payment Date", detail: overdueWithPay.length ? overdueWithPay.map(i => i.id).join(", ") + " – contradictory record, needs review" : "None detected", severity: overdueWithPay.length ? "Issue" : "OK" },
    { check: "Client / project name mismatch (Catesby England)", detail: `${catesby.length} invoices billed to Patrick Shoes Limited carry recurrence 'Monthly - Catesby England' – treated as a separate project.`, severity: catesby.length ? "Issue" : "OK" },
    { check: "Line items do not sum to SubTotal", detail: lineMismatch.length ? lineMismatch.map(i => i.id).join(", ") : "None detected", severity: lineMismatch.length ? "Issue" : "OK" },
    { check: "Unclassified / mixed services", detail: unclassified.length ? unclassified.map(i => i.id).join(", ") : "None – all invoices classify as SEO or Development", severity: unclassified.length ? "Issue" : "OK" },
    { check: "Inconsistent client names", detail: "4 distinct customer names; spellings are consistent (no merges required).", severity: "OK" },
    { check: "Inconsistent Payment Terms labels", detail: "Early invoices have a blank label, later ones 'Net 5' / descriptive text – terms value is consistently 5 days.", severity: "Info" },
    { check: "Partially-paid invoices", detail: "Not detectable – no amount-paid column exists in the source.", severity: "Info" },
  ];

  const flagged = INV.filter(i => i.flags.some(fl => !fl.startsWith("Multi-line")));
  makeTable("tbl-dq-detail", [
    { key: "id", label: "Invoice ID" },
    { key: "date", label: "Date" },
    { key: "client", label: "Client" },
    { key: "gross", label: "Amount", num: true, fmt: fmtMoney },
    { key: "status", label: "Status", fmt: pillStatus },
    { key: "flags", label: "Issue(s)", fmt: v => esc(v.filter(fl => !fl.startsWith("Multi-line")).join("; ")) },
  ], flagged);

  // --- development (PM) data checks ---
  const pmRows = effortRows();
  const pmMissing = PM.projects.filter(p => !p.name || !p.client || p.estMin == null || p.actMin == null);
  const pmZero = PM.projects.filter(p => p.actMin === 0);
  const pmNeg = PM.projects.filter(p => p.actMin < 0 || p.estMin < 0);
  const pmOver = pmRows.filter(r => r.varPct != null && r.varPct > 25);
  const pmUnmatched = pmRows.filter(r => !r.invoiceProject && r.matchStatus !== "Needs Verification");
  const pmVerify = pmRows.filter(r => r.matchStatus === "Needs Verification");
  const pmAnomaly = PM.projects.filter(p => (p.status === "Not Started" && (p.taskPct > 0 || p.actMin > 0)) || (p.status === "Complete" && p.taskPct < 100));
  const invProjectsNoPM = [...groupBy(INV, "project").keys()].filter(ip => !PM.projects.some(p => p.invoiceProject === ip));
  const loggedDelta = PM.capacity.loggedMin - sum(PM.projects, p => p.actMin);
  const devChecks = [
    { check: "DEV: Missing project name / client / hours", detail: pmMissing.length ? pmMissing.map(p => p.name).join(", ") : "None detected", severity: pmMissing.length ? "Issue" : "OK" },
    { check: "DEV: Zero or negative hours", detail: (pmZero.length + pmNeg.length) ? [...pmZero, ...pmNeg].map(p => p.name).join(", ") : "None detected", severity: (pmZero.length + pmNeg.length) ? "Issue" : "OK" },
    { check: "DEV: Actual hours significantly over estimate (>25%)", detail: pmOver.map(r => `${r.name} (+${r.varPct.toFixed(0)}%)`).join("; "), severity: pmOver.length ? "Issue" : "OK" },
    { check: "DEV: Duplicate projects", detail: "None detected (8 unique project names)", severity: "OK" },
    { check: "DEV: PM projects without invoice records", detail: pmUnmatched.map(r => r.name).join("; ") + (pmVerify.length ? `; needs verification: ${pmVerify.map(r => r.name).join("; ")}` : ""), severity: "Issue" },
    { check: "DEV: Invoice projects without PM records", detail: `${invProjectsNoPM.length} invoice-layer projects have no WorkGrid record (expected for SEO retainers): ${invProjectsNoPM.join("; ")}`, severity: "Info" },
    { check: "DEV: Status vs task% anomalies", detail: pmAnomaly.map(p => `${p.name} ('${p.status}' at ${p.taskPct}%${p.actMin > 0 && p.status === "Not Started" ? ", " + fmtDur(p.actMin) + " logged" : ""})`).join("; "), severity: pmAnomaly.length ? "Issue" : "OK" },
    { check: "DEV: Logged-time reconciliation", detail: `Sum of per-project actual hours (${fmtDur(sum(PM.projects, p => p.actMin))}) vs reported Total Logged Time (${fmtDur(PM.capacity.loggedMin)}): ${loggedDelta === 0 ? "match" : Math.abs(loggedDelta) + "m difference (source rounding)"}`, severity: loggedDelta === 0 ? "OK" : "Info" },
    { check: "DEV: Per-project workload / named team members", detail: "Not available in the WorkGrid source (avatars only). Team analysis shown at team level (5 members).", severity: "Info" },
    { check: "DEV: Monthly effort distribution", detail: "Logged hours are not dated per month in the source, so monthly effort trends cannot be produced.", severity: "Info" },
  ];
  summary.push(...devChecks);
  makeTable("tbl-dq-summary", [
    { key: "check", label: "Check" },
    { key: "detail", label: "Result", fmt: esc },
    { key: "severity", label: "Severity", fmt: v => `<span class="pill ${v === "OK" ? "paid" : v === "Info" ? "open" : "unpaid"}">${v}</span>` },
  ], summary);

  document.getElementById("assumptions").innerHTML = [...META.assumptions, ...PM.meta.notes].map(a => `<li>${esc(a)}</li>`).join("");
}

/* ================= SECTION 12 - DETAILED INVOICES ================= */
let invSearch = "";
function renderDetail(f) {
  const q = invSearch.trim().toLowerCase();
  const list = q ? f.filter(i => [i.id, i.client, i.project, i.service, i.status, i.recurrence, i.attention].join(" ").toLowerCase().includes(q)) : f;
  document.getElementById("inv-count").textContent = `${fmtInt(list.length)} of ${fmtInt(INV.length)} invoices · total ${fmtMoney(sum(list, i => i.gross))} · outstanding ${fmtMoney(sum(list, i => i.outstanding))}`;
  makeTable("tbl-invoices", [
    { key: "id", label: "Invoice ID" },
    { key: "date", label: "Invoice Date" },
    { key: "dueDate", label: "Due Date" },
    { key: "client", label: "Client" },
    { key: "project", label: "Project" },
    { key: "service", label: "Service", fmt: pillSvc },
    { key: "net", label: "Net", num: true, fmt: fmtMoney },
    { key: "tax", label: "VAT", num: true, fmt: fmtMoney },
    { key: "gross", label: "Total", num: true, fmt: fmtMoney },
    { key: "paid", label: "Paid", num: true, fmt: fmtMoney },
    { key: "outstanding", label: "Outstanding", num: true, fmt: v => v > 0 ? `<span class="neg">${fmtMoney(v)}</span>` : fmtMoney(v) },
    { key: "status", label: "Status", fmt: pillStatus },
    { key: "payStatus", label: "Payment", fmt: pillPay },
    { key: "lastPaymentDate", label: "Last Payment", fmt: v => v || '<span class="mut">—</span>' },
    { key: "daysToPay", label: "Days to Pay", num: true, fmt: v => v == null ? '<span class="mut">—</span>' : v },
    { key: "overdueDays", label: "Days Past Due", num: true, fmt: v => v == null ? '<span class="mut">—</span>' : `<span class="${v > 90 ? "neg" : ""}">${v}</span>` },
    { key: "flags", label: "Flags", fmt: v => v.filter(fl => !fl.startsWith("Multi-line")).length ? `<span class="pill review">Review</span>` : "" },
  ], list, { rowClass: r => r.outstanding > 0 ? "hl-out" : "" });
}

/* ================= SECTION 13 - VALIDATION ================= */
function renderRecon() {
  const a = agg(INV);
  const seoA = agg(INV.filter(i => i.service === "SEO"));
  const devA = agg(INV.filter(i => i.service === "Development"));
  const rows = [
    { metric: "Raw data rows (Excel)", src: SRC.rawRows, dash: "147 line-item rows → deduplicated", money: false },
    { metric: "Total Invoices (unique Invoice IDs)", src: SRC.uniqueInvoices, dash: a.count, money: false },
    { metric: "Total Invoice Value – gross incl. VAT", src: SRC.uniqueInvoiceGross, dash: a.gross, money: true },
    { metric: "Total Invoice Value – net ex-VAT", src: SRC.uniqueInvoiceNet, dash: a.net, money: true },
    { metric: "Total VAT", src: SRC.uniqueInvoiceTax, dash: a.tax, money: true },
    { metric: "Total Paid (Closed invoices)", src: SRC.paidTotal, dash: a.paid, money: true },
    { metric: "Total Outstanding (Open + Overdue)", src: SRC.outstandingTotal, dash: a.outstanding, money: true },
    { metric: "Total Clients", src: SRC.uniqueClients, dash: a.clients.size, money: false },
    { metric: "Total Projects (derived)", src: SRC.derivedProjects, dash: a.projects.size, money: false },
    { metric: "SEO Invoice Value", src: sum(INV.filter(i => i.service === "SEO"), i => i.gross), dash: seoA.gross, money: true },
    { metric: "Development Invoice Value", src: sum(INV.filter(i => i.service === "Development"), i => i.gross), dash: devA.gross, money: true },
  ];
  const pmRows = effortRows();
  const pmEst = sum(pmRows, r => r.estMin), pmAct = sum(pmRows, r => r.actMin);
  const pmReconRows = [
    { metric: "PM: Development projects", src: PM.projects.length, dash: pmRows.length },
    { metric: "PM: Total estimated hours", src: fmtDur(PM.capacity.estimatedMin), dash: fmtDur(pmEst) },
    { metric: "PM: Total workload (team-level)", src: fmtDur(PM.capacity.workloadMin), dash: "per-project workload not available in source" },
    { metric: "PM: Total actual logged hours", src: fmtDur(PM.capacity.loggedMin) + " (reported)", dash: fmtDur(pmAct) + " (sum of projects)", diffText: "−2m (source rounding)" },
    { metric: "PM: Unbilled effort hours", src: "—", dash: fmtDur(sum(pmRows, r => r.unbilledMin)) },
    { metric: "PM: Unpaid (invoiced) effort hours", src: "—", dash: fmtDur(sum(pmRows, r => r.unpaidMin)) },
  ];
  rows.push(...pmReconRows);
  makeTable("tbl-recon", [
    { key: "metric", label: "Metric" },
    { key: "src", label: "Source (Excel / WorkGrid)", num: true, fmt: (v, r) => typeof v === "string" ? esc(v) : r.money ? fmtMoney(v) : fmtInt(v) },
    { key: "dash", label: "Dashboard", num: true, fmt: (v, r) => typeof v === "string" ? esc(v) : r.money ? fmtMoney(v) : fmtInt(v) },
    { key: "diff", label: "Difference", num: true, fmt: (v, r) => r.diffText ? `<span class="neg">${esc(r.diffText)}</span>` : (typeof v === "string" ? '<span class="mut">n/a</span>' : `<span class="${Math.abs(v) < 0.005 ? "pos" : "neg"}">${r.money ? fmtMoney(v) : fmtInt(v)}</span>`) },
  ], rows.map(r => ({ ...r, diff: r.diffText ? "n/a" : (typeof r.dash === "string" || typeof r.src === "string" ? "n/a" : (Math.abs(r.dash - r.src) < 0.005 ? 0 : r.dash - r.src)) })));
  document.getElementById("recon-note").innerHTML =
    `Note: summing the Excel 'Total' column across all ${SRC.rawRows} raw rows gives <b>${fmtMoney(SRC.rawGrossSumAllRows)}</b>, which double-counts multi-line invoices. ` +
    `The correct source figure is the sum over the ${SRC.uniqueInvoices} unique Invoice IDs: <b>${fmtMoney(SRC.uniqueInvoiceGross)}</b> — this is what the dashboard reconciles against. ` +
    `All dashboard figures are computed live from the invoice-level dataset; no hardcoded totals are used.`;
}

/* ================= EFFORT LAYER (WorkGrid PM data) ================= */
function effortRows() {
  const rate = getRate();
  return PM.projects.map(p => {
    const fin = p.invoiceProject ? agg(INV.filter(i => i.project === p.invoiceProject)) : null;
    const hasFin = fin && fin.gross > 0;
    let scenario;
    if (hasFin) {
      if (fin.outstanding === 0) scenario = "Paid";
      else if (fin.paid > 0) scenario = "Partially Paid";
      else scenario = "Invoiced - Outstanding";
    } else if (p.matchStatus === "Needs Verification") scenario = "Needs Verification";
    else scenario = "Unbilled";
    const paidFrac = hasFin ? fin.paid / fin.gross : 0;
    const billedMin = hasFin ? p.actMin : 0;
    const paidMin = scenario === "Paid" ? p.actMin : (hasFin ? Math.round(p.actMin * paidFrac) : 0);
    const unbilledMin = scenario === "Unbilled" ? p.actMin : 0;
    const verifyMin = scenario === "Needs Verification" ? p.actMin : 0;
    const unpaidMin = billedMin - paidMin;
    const varMin = p.actMin - p.estMin;
    const varPct = p.estMin ? (varMin / p.estMin) * 100 : null;
    const effValue = minToMoney(p.actMin, rate);
    return {
      ...p, fin, scenario, billedMin, paidMin, unbilledMin, verifyMin, unpaidMin,
      varMin, varPct, effValue,
      unbilledValue: minToMoney(unbilledMin, rate),
      unpaidValue: minToMoney(unpaidMin, rate),
      invGross: hasFin ? fin.gross : 0, invPaid: hasFin ? fin.paid : 0, invOut: hasFin ? fin.outstanding : 0,
      invCount: hasFin ? fin.count : 0,
      recoveryPct: effValue > 0 && hasFin ? (fin.paid / effValue) * 100 : null,
      year: p.start ? +p.start.slice(0, 4) : null,
    };
  });
}
const pillScenario = v => `<span class="pill ${v === "Paid" ? "paid" : v === "Unbilled" ? "open" : v === "Needs Verification" ? "review" : "unpaid"}">${v}</span>`;
const pillPMStatus = v => `<span class="pill ${v === "Complete" ? "paid" : v === "In Progress" ? "open" : v === "Delayed" ? "unpaid" : "review"}">${v}</span>`;

/* ---- Section 7: effort KPIs, table, status, attention ---- */
const effState = { client: "All", status: "All", scenario: "All", year: "All", q: "" };

function renderEffortKPIs(rows) {
  const rate = getRate();
  const estMin = sum(rows, r => r.estMin), actMin = sum(rows, r => r.actMin);
  const overMin = actMin - estMin;
  const paid = sum(rows, r => r.invPaid), out = sum(rows, r => r.invOut);
  const unbilledMin = sum(rows, r => r.unbilledMin), unpaidMin = sum(rows, r => r.unpaidMin), verifyMin = sum(rows, r => r.verifyMin);
  const kpis = [
    { lbl: "Development Projects", val: fmtInt(rows.length) },
    { lbl: "Estimated Hours", val: fmtDur(estMin) },
    { lbl: "Total Workload", val: fmtDur(PM.capacity.workloadMin), hint: "team-level, per-project unavailable" },
    { lbl: "Actual Logged Hours", val: fmtDur(actMin), hint: "reported total: " + fmtDur(PM.capacity.loggedMin) },
    { lbl: "Effort Overrun", val: (overMin >= 0 ? "+" : "−") + fmtDur(Math.abs(overMin)), hint: (estMin ? (overMin / estMin * 100).toFixed(1) : "—") + "% over estimate", cls: overMin > 0 ? "warn" : "good" },
    { lbl: "Paid Against Development", val: fmtMoney(paid), cls: "good" },
    { lbl: "Outstanding Against Development", val: fmtMoney(out), cls: out > 0 ? "bad" : "" },
    { lbl: "Unbilled Effort", val: fmtDur(unbilledMin), hint: "≈ " + fmtMoney(minToMoney(unbilledMin, rate)) + " @ £" + rate + "/hr", cls: unbilledMin > 0 ? "warn" : "" },
    { lbl: "Unpaid Effort (invoiced)", val: fmtDur(unpaidMin), hint: "≈ " + fmtMoney(minToMoney(unpaidMin, rate)) + " @ £" + rate + "/hr", cls: unpaidMin > 0 ? "bad" : "" },
    { lbl: "Needs Verification", val: fmtDur(verifyMin), hint: "ambiguous project-invoice match" },
  ];
  document.getElementById("kpi-effort").innerHTML = kpis.map(k =>
    `<div class="kpi ${k.cls || ""}"><div class="lbl">${k.lbl}</div><div class="val">${k.val}</div>${k.hint ? `<div class="hint">${k.hint}</div>` : ""}</div>`).join("");
}

function renderEffortTable() {
  const rows = effortRows().filter(r =>
    (effState.client === "All" || r.client === effState.client) &&
    (effState.status === "All" || r.status === effState.status) &&
    (effState.scenario === "All" || r.scenario === effState.scenario) &&
    (effState.year === "All" || r.year === +effState.year) &&
    (!effState.q || (r.name + " " + r.client).toLowerCase().includes(effState.q))
  );
  document.getElementById("eff-count").textContent = `${rows.length} of ${PM.projects.length} projects · ${fmtDur(sum(rows, r => r.actMin))} logged`;
  renderEffortKPIs(rows);
  makeTable("tbl-effort", [
    { key: "name", label: "Project" },
    { key: "client", label: "Client" },
    { key: "service", label: "Service", fmt: pillSvc },
    { key: "status", label: "Status", fmt: pillPMStatus },
    { key: "estMin", label: "Est. Hours", num: true, fmt: fmtDur },
    { key: "workload", label: "Workload", num: true, fmt: () => '<span class="mut">n/a</span>' },
    { key: "actMin", label: "Actual Hours", num: true, fmt: fmtDur },
    { key: "varMin", label: "Variance", num: true, fmt: (v, r) => `<span class="${v > 0 ? "neg" : "pos"}">${v >= 0 ? "+" : "−"}${fmtDur(Math.abs(v))} (${r.varPct == null ? "—" : (r.varPct >= 0 ? "+" : "") + r.varPct.toFixed(0) + "%"})</span>` },
    { key: "taskPct", label: "Task %", num: true, fmt: v => v + "%" },
    { key: "invGross", label: "Invoice Value", num: true, fmt: v => v ? fmtMoney(v) : '<span class="mut">—</span>' },
    { key: "invPaid", label: "Paid", num: true, fmt: v => v ? fmtMoney(v) : '<span class="mut">—</span>' },
    { key: "invOut", label: "Outstanding", num: true, fmt: v => v ? `<span class="neg">${fmtMoney(v)}</span>` : '<span class="mut">—</span>' },
    { key: "unbilledMin", label: "Unbilled Effort", num: true, fmt: (v, r) => v ? `<span class="neg">${fmtDur(v)}</span>` : (r.verifyMin ? '<span class="mut">verify</span>' : "—") },
    { key: "effValue", label: "Effort Value", num: true, fmt: v => fmtMoney(v) },
    { key: "scenario", label: "Payment Status", fmt: pillScenario },
  ], rows, { rowClass: r => (r.scenario === "Unbilled" || r.invOut > 0) ? "hl-out" : "" });
}

function renderPMStatus(rows) {
  const byStatus = groupBy(rows, "status");
  const order = ["Complete", "In Progress", "Delayed", "Not Started"];
  const list = order.filter(s => byStatus.has(s)).map(s => {
    const l = byStatus.get(s);
    return { status: s, n: l.length, est: sum(l, r => r.estMin), act: sum(l, r => r.actMin), gross: sum(l, r => r.invGross), paid: sum(l, r => r.invPaid), out: sum(l, r => r.invOut) };
  });
  makeTable("tbl-pmstatus", [
    { key: "status", label: "Project Status", fmt: pillPMStatus },
    { key: "n", label: "Projects", num: true, fmt: fmtInt },
    { key: "est", label: "Est. Hours", num: true, fmt: fmtDur },
    { key: "act", label: "Actual Hours", num: true, fmt: fmtDur },
    { key: "gross", label: "Invoice Value", num: true, fmt: fmtMoney },
    { key: "paid", label: "Paid", num: true, fmt: fmtMoney },
    { key: "out", label: "Outstanding", num: true, fmt: fmtMoney },
  ], list, { footer: { status: "Total", n: rows.length, est: sum(rows, r => r.estMin), act: sum(rows, r => r.actMin), gross: sum(rows, r => r.invGross), paid: sum(rows, r => r.invPaid), out: sum(rows, r => r.invOut) } });
}

function renderAttention(rows) {
  const rate = getRate();
  const items = [];
  rows.filter(r => r.scenario === "Partially Paid" || r.scenario === "Invoiced - Outstanding").forEach(r =>
    items.push(`<b>High unpaid exposure:</b> ${esc(r.name)} (${esc(r.client)}) has consumed <b>${fmtDur(r.actMin)}</b> of effort. ${fmtMoney(r.invGross)} invoiced, ${fmtMoney(r.invPaid)} received, <b>${fmtMoney(r.invOut)} outstanding</b>.`));
  rows.filter(r => r.scenario === "Unbilled" && r.actMin > 0).sort((a, b) => b.actMin - a.actMin).forEach(r =>
    items.push(`<b>High unbilled effort:</b> ${esc(r.name)} (${esc(r.client)}) – <b>${fmtDur(r.actMin)}</b> logged (&asymp; ${fmtMoney(r.unbilledValue)} @ £${rate}/hr) with no corresponding invoice identified.`));
  rows.filter(r => r.varPct != null && r.varPct > 25).sort((a, b) => b.varPct - a.varPct).forEach(r =>
    items.push(`<b>Effort overrun:</b> ${esc(r.name)} – actual ${fmtDur(r.actMin)} vs estimated ${fmtDur(r.estMin)} (<b>+${r.varPct.toFixed(0)}%</b>).`));
  rows.filter(r => r.status === "Complete" && (r.invOut > 0 || r.scenario === "Unbilled" || r.scenario === "Needs Verification")).forEach(r =>
    items.push(`<b>Completed but unresolved financially:</b> ${esc(r.name)} is marked Complete (${r.taskPct}% tasks) but payment status is '${r.scenario}'.`));
  rows.filter(r => r.scenario === "Needs Verification").forEach(r =>
    items.push(`<b>Needs verification:</b> ${esc(r.name)} – ${esc(r.matchNote)}`));
  const longRun = rows.filter(r => r.status === "In Progress" && r.varPct > 50);
  longRun.forEach(r => items.push(`<b>Long-running / over-consuming:</b> ${esc(r.name)} is In Progress and already ${r.varPct.toFixed(0)}% over its estimated hours.`));
  document.getElementById("attention-list").innerHTML = items.length
    ? items.map(i => `<li style="margin-bottom:8px;font-size:12.5px">${i}</li>`).join("")
    : '<li class="mut">No attention items detected.</li>';
}

/* ---- Section 8: revenue vs delivered effort ---- */
function renderRecovery(rows) {
  const rate = getRate();
  const actMin = sum(rows, r => r.actMin), billedMin = sum(rows, r => r.billedMin), paidMin = sum(rows, r => r.paidMin);
  const unbilledMin = sum(rows, r => r.unbilledMin), unpaidMin = sum(rows, r => r.unpaidMin), verifyMin = sum(rows, r => r.verifyMin);
  const unrecMin = unpaidMin + unbilledMin;
  const kpis = [
    { lbl: "Unpaid Invoiced Effort", val: fmtDur(unpaidMin), hint: "≈ " + fmtMoney(minToMoney(unpaidMin, rate)), cls: unpaidMin > 0 ? "bad" : "" },
    { lbl: "Unbilled Delivered Effort", val: fmtDur(unbilledMin), hint: "≈ " + fmtMoney(minToMoney(unbilledMin, rate)), cls: unbilledMin > 0 ? "warn" : "" },
    { lbl: "Total Unrecovered Effort", val: fmtDur(unrecMin), hint: "≈ " + fmtMoney(minToMoney(unrecMin, rate)) + " @ £" + rate + "/hr", cls: unrecMin > 0 ? "bad" : "" },
    { lbl: "Awaiting Verification", val: fmtDur(verifyMin), hint: "not counted as unbilled" },
  ];
  document.getElementById("kpi-recovery").innerHTML = kpis.map(k =>
    `<div class="kpi ${k.cls || ""}"><div class="lbl">${k.lbl}</div><div class="val">${k.val}</div><div class="hint">${k.hint}</div></div>`).join("");

  const funnel = { labels: ["Delivered", "Billed (invoice identified)", "Paid"], v: [actMin, billedMin, paidMin] };
  mkChart("ch-funnel", {
    type: "bar",
    data: { labels: funnel.labels, datasets: [{ data: funnel.v.map(m => minToMoney(m, rate)), backgroundColor: [C.blue, C.amber, C.green], borderRadius: 6 }] },
    options: { plugins: { legend: { display: false }, tooltip: moneyTooltip() }, scales: { y: { ticks: { callback: moneyTick } } } }
  });
  mkChart("ch-funnel-hrs", {
    type: "bar",
    data: { labels: funnel.labels, datasets: [{ data: funnel.v.map(m => +(m / 60).toFixed(1)), backgroundColor: [C.blue, C.amber, C.green], borderRadius: 6 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtDur(Math.round(c.parsed.y * 60)) } } }, scales: { y: { ticks: { callback: v => v + "h" } } } }
  });
}

function renderMatrix(rows) {
  const rate = getRate();
  makeTable("tbl-matrix", [
    { key: "name", label: "Project" },
    { key: "actMin", label: "Actual Effort", num: true, fmt: fmtDur },
    { key: "effValue", label: "Effort Value", num: true, fmt: v => fmtMoney(v) },
    { key: "invGross", label: "Invoice Raised", num: true, fmt: v => v ? fmtMoney(v) : '<span class="mut">—</span>' },
    { key: "invPaid", label: "Paid", num: true, fmt: v => v ? fmtMoney(v) : '<span class="mut">—</span>' },
    { key: "invOut", label: "Outstanding", num: true, fmt: v => v ? `<span class="neg">${fmtMoney(v)}</span>` : '<span class="mut">—</span>' },
    { key: "unbilledValue", label: "Unbilled", num: true, fmt: v => v ? `<span class="neg">${fmtMoney(v)}</span>` : '<span class="mut">—</span>' },
    { key: "recoveryPct", label: "Recovery %", num: true, fmt: v => v == null ? '<span class="mut">—</span>' : fmtPct(v) },
  ], [...rows].sort((a, b) => b.actMin - a.actMin));
  void rate;
}

function renderExposure(rows) {
  const list = rows.map(r => ({ ...r, exposure: r.invOut + r.unbilledValue })).sort((a, b) => b.exposure - a.exposure).slice(0, 10);
  makeTable("tbl-exposure", [
    { key: "name", label: "Project" },
    { key: "client", label: "Client" },
    { key: "actMin", label: "Actual Hours", num: true, fmt: fmtDur },
    { key: "invGross", label: "Invoice Amount", num: true, fmt: v => v ? fmtMoney(v) : '<span class="mut">—</span>' },
    { key: "invPaid", label: "Paid", num: true, fmt: v => v ? fmtMoney(v) : '<span class="mut">—</span>' },
    { key: "invOut", label: "Outstanding", num: true, fmt: v => v ? `<span class="neg">${fmtMoney(v)}</span>` : '<span class="mut">—</span>' },
    { key: "unbilledValue", label: "Unbilled Value", num: true, fmt: v => v ? `<span class="neg">${fmtMoney(v)}</span>` : '<span class="mut">—</span>' },
    { key: "exposure", label: "Total Exposure", num: true, fmt: v => `<b class="${v > 0 ? "neg" : ""}">${fmtMoney(v)}</b>` },
  ], list, { rowClass: r => r.exposure > 0 ? "hl-out" : "" });
}

/* ---- Section 9: effort vs estimate ---- */
function renderEstAct(rows) {
  const byVar = [...rows].sort((a, b) => b.varMin - a.varMin);
  mkChart("ch-est-act", {
    type: "bar",
    data: { labels: byVar.map(r => r.name), datasets: [
      { label: "Estimated", data: byVar.map(r => +(r.estMin / 60).toFixed(1)), backgroundColor: C.slate, borderRadius: 3 },
      { label: "Actual", data: byVar.map(r => +(r.actMin / 60).toFixed(1)), backgroundColor: byVar.map(r => r.varMin > 0 ? C.red : C.green), borderRadius: 3 },
    ] },
    options: { indexAxis: "y", plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ": " + fmtDur(Math.round(c.parsed.x * 60)) } } }, scales: { x: { ticks: { callback: v => v + "h" } }, y: { ticks: { autoSkip: false, font: { size: 10 } } } } }
  });

  makeTable("tbl-overrun", [
    { key: "name", label: "Project" },
    { key: "estMin", label: "Est. Hours", num: true, fmt: fmtDur },
    { key: "actMin", label: "Actual Hours", num: true, fmt: fmtDur },
    { key: "varMin", label: "Variance", num: true, fmt: v => `<span class="${v > 0 ? "neg" : "pos"}">${v >= 0 ? "+" : "−"}${fmtDur(Math.abs(v))}</span>` },
    { key: "varPct", label: "Variance %", num: true, fmt: v => v == null ? "—" : `<span class="${v > 0 ? "neg" : "pos"}">${v >= 0 ? "+" : ""}${v.toFixed(1)}%</span>` },
    { key: "invGross", label: "Invoice Value", num: true, fmt: v => v ? fmtMoney(v) : '<span class="mut">—</span>' },
    { key: "invPaid", label: "Paid", num: true, fmt: v => v ? fmtMoney(v) : '<span class="mut">—</span>' },
    { key: "invOut", label: "Outstanding", num: true, fmt: v => v ? `<span class="neg">${fmtMoney(v)}</span>` : '<span class="mut">—</span>' },
  ], byVar.slice(0, 10), { rowClass: r => r.varMin > 0 ? "hl-out" : "" });

  const byYear = groupBy(rows, "year");
  const years = [...byYear.keys()].sort();
  const yrRows = years.map(y => {
    const l = byYear.get(y);
    return { year: y, n: l.length, est: sum(l, r => r.estMin), act: sum(l, r => r.actMin), gross: sum(l, r => r.invGross), paid: sum(l, r => r.invPaid), out: sum(l, r => r.invOut), unbilled: sum(l, r => r.unbilledMin) };
  });
  mkChart("ch-eff-year", {
    type: "bar",
    data: { labels: years.map(String), datasets: [
      { label: "Estimated", data: yrRows.map(r => +(r.est / 60).toFixed(1)), backgroundColor: C.slate, borderRadius: 4 },
      { label: "Actual", data: yrRows.map(r => +(r.act / 60).toFixed(1)), backgroundColor: C.indigo, borderRadius: 4 },
    ] },
    options: { plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ": " + fmtDur(Math.round(c.parsed.y * 60)) } } }, scales: { y: { ticks: { callback: v => v + "h" } } } }
  });
  makeTable("tbl-eff-year", [
    { key: "year", label: "Year (project start)" },
    { key: "n", label: "Projects", num: true, fmt: fmtInt },
    { key: "est", label: "Est. Hours", num: true, fmt: fmtDur },
    { key: "act", label: "Actual Hours", num: true, fmt: fmtDur },
    { key: "gross", label: "Invoice Value", num: true, fmt: fmtMoney },
    { key: "paid", label: "Paid", num: true, fmt: fmtMoney },
    { key: "out", label: "Outstanding", num: true, fmt: fmtMoney },
    { key: "unbilled", label: "Unbilled Effort", num: true, fmt: v => v ? `<span class="neg">${fmtDur(v)}</span>` : "—" },
  ], yrRows);
}

/* ---- Section 10: team ---- */
function renderTeam(rows) {
  const cap = PM.capacity;
  const kpis = [
    { lbl: "Team Size", val: fmtInt(cap.team) },
    { lbl: "Total Workload", val: fmtDur(cap.workloadMin) },
    { lbl: "Total Logged Time", val: fmtDur(cap.loggedMin) },
    { lbl: "Logged vs Workload", val: ((cap.loggedMin / cap.workloadMin) * 100).toFixed(1) + "%", hint: fmtDur(cap.loggedMin - cap.workloadMin) + " above planned workload", cls: "warn" },
    { lbl: "Avg Actual / Project", val: fmtDur(Math.round(sum(rows, r => r.actMin) / rows.length)) },
  ];
  document.getElementById("kpi-team").innerHTML = kpis.map(k =>
    `<div class="kpi ${k.cls || ""}"><div class="lbl">${k.lbl}</div><div class="val">${k.val}</div>${k.hint ? `<div class="hint">${k.hint}</div>` : ""}</div>`).join("");
  mkChart("ch-capacity", {
    type: "bar",
    data: { labels: ["Project Estimated Time", "Total Workload", "Total Logged Time"], datasets: [{ data: [cap.estimatedMin / 60, cap.workloadMin / 60, cap.loggedMin / 60].map(v => +v.toFixed(1)), backgroundColor: [C.slate, C.amber, C.indigo], borderRadius: 6 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtDur(Math.round(c.parsed.y * 60)) } } }, scales: { y: { ticks: { callback: v => v + "h" } } } }
  });
}

/* ---- Section 11: PM-to-invoice reconciliation ---- */
function renderPMRecon(rows) {
  makeTable("tbl-pmrecon", [
    { key: "name", label: "Project" },
    { key: "client", label: "Client" },
    { key: "pm", label: "PM Data Found", fmt: () => '<span class="pill paid">Yes</span>' },
    { key: "invCount", label: "Invoice Found", fmt: (v, r) => v ? `<span class="pill paid">Yes (${v})</span>` : '<span class="pill unpaid">No</span>' },
    { key: "invPaid", label: "Payment Found", fmt: (v, r) => r.invCount ? (v > 0 ? `<span class="pill paid">${fmtMoney(v)}</span>` : '<span class="pill unpaid">None</span>') : '<span class="mut">n/a</span>' },
    { key: "matchStatus", label: "Match Confidence", fmt: v => `<span class="pill ${v === "Matched" ? "paid" : v === "Needs Verification" ? "review" : "unpaid"}">${v}</span>` },
    { key: "matchNote", label: "Notes / Action", fmt: esc },
  ], rows);
}

/* ---- Delivery KPIs in exec summary ---- */
function renderDeliveryKPIs() {
  const rows = effortRows();
  const rate = getRate();
  const estMin = sum(rows, r => r.estMin), actMin = sum(rows, r => r.actMin);
  const overMin = actMin - estMin;
  const unbilledMin = sum(rows, r => r.unbilledMin), unpaidMin = sum(rows, r => r.unpaidMin);
  const unrecMin = unpaidMin + unbilledMin;
  const kpis = [
    { lbl: "Dev Projects", val: fmtInt(rows.length), cls: "dev" },
    { lbl: "Estimated Hours", val: fmtDur(estMin) },
    { lbl: "Actual Hours", val: fmtDur(actMin) },
    { lbl: "Effort Overrun", val: "+" + fmtDur(overMin), hint: (overMin / estMin * 100).toFixed(1) + "% over", cls: "warn" },
    { lbl: "Unbilled Hours", val: fmtDur(unbilledMin), cls: unbilledMin > 0 ? "warn" : "" },
    { lbl: "Unpaid Hours (invoiced)", val: fmtDur(unpaidMin), cls: unpaidMin > 0 ? "bad" : "" },
    { lbl: "Unrecovered Effort Value", val: "≈ " + fmtMoney(minToMoney(unrecMin, rate)), hint: "@ £" + rate + "/hr configurable rate", cls: "bad" },
  ];
  document.getElementById("kpi-delivery").innerHTML = kpis.map(k =>
    `<div class="kpi ${k.cls || ""}"><div class="lbl">${k.lbl}</div><div class="val">${k.val}</div>${k.hint ? `<div class="hint">${k.hint}</div>` : ""}</div>`).join("");
}

/* ---- SEO vs Development enhanced comparison (spec 14) ---- */
function renderSvcCompare() {
  const rate = getRate();
  const rows = effortRows();
  const seoInv = INV.filter(i => i.service === "SEO");
  const devInv = INV.filter(i => i.service === "Development");
  const seoA = agg(seoInv), devA = agg(devInv);
  const devActMin = sum(rows, r => r.actMin);
  const devEffValue = minToMoney(devActMin, rate);
  const devPaidMatched = sum(rows, r => r.invPaid);
  const metrics = [
    { m: "Projects", seo: fmtInt(seoA.projects.size) + " (invoice layer)", dev: fmtInt(rows.length) + " (PM) / " + fmtInt(devA.projects.size) + " (invoice layer)" },
    { m: "Invoice Value", seo: fmtMoney(seoA.gross), dev: fmtMoney(devA.gross) },
    { m: "Paid", seo: fmtMoney(seoA.paid), dev: fmtMoney(devA.paid) },
    { m: "Outstanding", seo: fmtMoney(seoA.outstanding), dev: fmtMoney(devA.outstanding) },
    { m: "Actual Hours", seo: '<span class="mut">no PM data</span>', dev: fmtDur(devActMin) },
    { m: "Effort Value (@ £" + rate + "/hr)", seo: '<span class="mut">—</span>', dev: "≈ " + fmtMoney(devEffValue) },
    { m: "Collection %", seo: fmtPct(seoA.collectionPct), dev: fmtPct(devA.collectionPct) },
    { m: "Recovery % (paid vs effort value)", seo: '<span class="mut">—</span>', dev: fmtPct(devEffValue ? devPaidMatched / devEffValue * 100 : null) },
  ];
  makeTable("tbl-svc-effort", [
    { key: "m", label: "Metric" },
    { key: "seo", label: "SEO", fmt: v => v },
    { key: "dev", label: "Development", fmt: v => v },
  ], metrics);
}

function renderEffortAll() {
  const rows = effortRows();
  renderEffortTable();
  renderPMStatus(rows);
  renderAttention(rows);
  renderRecovery(rows);
  renderMatrix(rows);
  renderExposure(rows);
  renderEstAct(rows);
  renderTeam(rows);
  renderPMRecon(rows);
  renderDeliveryKPIs();
  renderSvcCompare();
}

/* ================= RENDER ALL ================= */
function renderAll() {
  const f = filtered();
  renderExec(f);
  renderFin(f);
  renderYear(f);
  renderSvc(f);
  renderClients(f);
  renderProjects(f);
  renderPay(f);
  renderAge(f);
  renderMonth(f);
  renderRepeat(f);
  renderDetail(f);
}

/* ================= INIT ================= */
(function init() {
  document.getElementById("asof").textContent = ASOF;
  document.getElementById("asof2").textContent = ASOF;
  document.getElementById("srcfile").textContent = META.sourceFile;
  document.getElementById("footer").textContent = `Generated ${META.generatedAt} · Source: ${META.sourceFile} · ${INV.length} unique invoices · All amounts GBP. Figures computed from the cleaned invoice-level dataset; see Section 11 for assumptions and data-quality notes.`;

  const navItems = [
    ["s-exec", "Executive Summary"], ["s-fin", "Financial Overview"], ["s-year", "Year-wise"],
    ["s-svc", "SEO vs Dev"], ["s-client", "Clients"], ["s-project", "Projects"],
    ["s-effort", "Dev Effort"], ["s-reveffort", "Revenue vs Effort"], ["s-overrun", "Overruns"],
    ["s-team", "Team"], ["s-pmrecon", "PM Reconciliation"],
    ["s-pay", "Payments"], ["s-age", "Ageing"], ["s-month", "Monthly Trends"],
    ["s-repeat", "Repeat Business"], ["s-dq", "Data Quality"], ["s-detail", "Invoice Data"], ["s-valid", "Validation"],
  ];
  document.getElementById("nav").innerHTML = navItems.map(([id, t]) => `<a href="#${id}">${t}</a>`).join("");

  initFilters();
  document.getElementById("inv-search").addEventListener("input", e => { invSearch = e.target.value; renderDetail(filtered()); });

  // effort-layer controls
  document.getElementById("pm-src").textContent = PM.meta.source;
  const rateInput = document.getElementById("hourly-rate");
  rateInput.value = getRate();
  rateInput.addEventListener("input", () => {
    const v = parseFloat(rateInput.value);
    if (isFinite(v) && v >= 0) localStorage.setItem("devHourlyRate", v);
    renderEffortAll();
  });
  const effFill = (id, vals) => {
    const sel = document.getElementById(id);
    sel.innerHTML = vals.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    sel.onchange = () => { effState[id.replace("eff-", "")] = sel.value; renderEffortTable(); };
  };
  effFill("eff-client", ["All", ...new Set(PM.projects.map(p => p.client))]);
  effFill("eff-status", ["All", ...new Set(PM.projects.map(p => p.status))]);
  effFill("eff-scenario", ["All", "Paid", "Partially Paid", "Invoiced - Outstanding", "Unbilled", "Needs Verification"]);
  effFill("eff-year", ["All", ...new Set(PM.projects.map(p => p.start ? p.start.slice(0, 4) : null).filter(Boolean))]);
  document.getElementById("eff-search").addEventListener("input", e => { effState.q = e.target.value.trim().toLowerCase(); renderEffortTable(); });

  renderAll();
  renderEffortAll();
  renderDQ();
  renderRecon();
})();
