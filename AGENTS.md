# Invoice Analysis Dashboard

Interactive management dashboard built from `C:\Users\Sandeep_fastranking\Desktop\Invoice Analysis..xlsx` (Sheet1, 147 raw rows → 125 unique invoices).

## Run

- Serve `dashboard/` over HTTP (required for correct rendering; a tiny server is provided):
  - `powershell -ExecutionPolicy Bypass -File server.ps1` → http://localhost:8765/
- All data is embedded in `dashboard/data.js`; charts use vendored Chart.js (`dashboard/vendor/chart.umd.min.js`). Works offline.

## Two analytical layers (never mixed)

- **Invoice layer** — `dashboard/data.js` (from Excel). Invoice/paid/outstanding figures come only from here.
- **Effort layer** — `dashboard/pm_data.js` (from the WorkGrid "Project Detail Dashboard" screenshot, 8 projects, management-confirmed client mapping). Durations stored in minutes, displayed as `536h 53m`. Linked to invoices only via `invoiceProject` (reliable name matches: Catesby England, Nomads Trade Website); others are `Unmatched` (unbilled) or `Needs Verification` — never assumed paid/unpaid.
- The hourly effort rate is management-configurable in the dashboard UI (default £10/hr, persisted in localStorage). Effort value is an indicator, never added to invoice totals.

## Data pipeline (regenerate after Excel changes)

1. `powershell -ExecutionPolicy Bypass -File dump_xlsx.ps1 -Dump` — parses the xlsx (zip/XML, no Excel needed; reads `source.xlsx`, a copy of the original) and writes `extracted/Sheet1.csv`.
2. `powershell -ExecutionPolicy Bypass -File process_data.ps1` — deduplicates by Invoice ID, classifies service/project, derives paid/outstanding, writes `dashboard/data.js` including independent source totals for reconciliation.
3. `powershell -ExecutionPolicy Bypass -File expected_values.ps1` — prints independently computed check values used by the filter tests.

## Verify

- Open `dashboard/test.html` in a browser (via the local server): it runs 34 automated assertions (invoice-layer KPIs/filters/search/sort, effort-layer KPIs, rate configurability, effort filters, PM reconciliation, data-quality checks) and prints PASS/FAIL into `#test-results`.
- Headless check: `msedge --headless=new --dump-dom "http://localhost:8765/test.html"` (use a fresh `--user-data-dir` and allow ~1-2 min; virtual-time-budget can stall rendering).
- Dashboard section 13 shows the live reconciliation of source-Excel totals vs dashboard-computed totals; all differences must be 0.

## Key modelling decisions (also shown in dashboard Section 11)

- Multi-line invoices repeat header amounts per line-item row → dedupe by Invoice ID.
- No amount-paid column → payment inferred from Invoice Status (Closed = paid in full at Last Payment Date; Open/Overdue = unpaid). Partial payments not detectable.
- Projects derived from Item Name + Recurrence Name (SEO monthly retainers per client; `Monthly - Catesby England` billed to Patrick Shoes Limited = separate project; Web Development = one-off project per client).
- Invoice Value = gross Total (incl. 20% VAT). Currency GBP. Ageing = days past due date as of 2026-08-19.
