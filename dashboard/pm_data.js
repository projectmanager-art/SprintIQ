/* Project-management (WorkGrid) delivery/effort layer.
   Source: WorkGrid "Project Detail Dashboard" screenshot captured 2026-08-19 (8 projects = full dataset, confirmed by management).
   Durations stored in MINUTES internally; displayed as "536h 53m".
   Client mapping confirmed by management:
     AMEN SHOES, FOOTWEAR DEPOT - 1, CATESBY ENGLAND -> Patrick Shoes Limited
     Nomads Clothing, Nomads Saige, Nomads Trade Website, NWT -> NOMADS CLOTHING LIMITED
     Silver Street London -> SUPERHOUSE (UK) LIMITED
   invoiceProject links to the derived invoice-layer project where a reliable name match exists. */
window.PM_DATA = {
  meta: {
    source: "WorkGrid Project Detail Dashboard (screenshot, 2026-08-19)",
    hourlyRateDefault: 10,
    currency: "GBP",
    notes: [
      "Per-project 'Total Workload' and named team members are not available in the source (avatar-only). Team size = 5 overall.",
      "Sum of per-project actual hours (536h 51m) differs from the reported Total Logged Time (536h 53m) by 2 minutes - flagged in the Data Quality report.",
      "Actual logged hours are not available per month, so monthly effort trends cannot be produced from this source.",
      "Effort hours are never added to invoice amounts; the two layers are linked only for comparison via client + project."
    ]
  },
  capacity: { team: 5, estimatedMin: 22070, workloadMin: 24157, loggedMin: 32213 },
  projects: [
    { name: "AMEN SHOES",           client: "Patrick Shoes Limited",       service: "Development", start: "2026-01-24", end: "2026-12-31", status: "Not Started", taskPct: 58, bugs: "0/0", estMin: 600,   actMin: 1509,  teamBadge: "+1", invoiceProject: null,                                      matchStatus: "Unmatched",          matchNote: "No invoice identified for this project. Client has older paid web-development invoices (2023-2026) that predate this project's start." },
    { name: "CATESBY ENGLAND",      client: "Patrick Shoes Limited",       service: "Development", start: "2026-01-21", end: "2027-12-31", status: "In Progress", taskPct: 77, bugs: "0/0", estMin: 2400,  actMin: 5578,  teamBadge: "+2", invoiceProject: "Catesby England - SEO (Monthly Retainer)", matchStatus: "Matched",            matchNote: "Name matches the 'Monthly - Catesby England' recurring invoice line billed to Patrick Shoes Limited." },
    { name: "FOOTWEAR DEPOT - 1",   client: "Patrick Shoes Limited",       service: "Development", start: "2026-02-11", end: "2026-08-31", status: "In Progress", taskPct: 33, bugs: "0/0", estMin: 2400,  actMin: 691,   teamBadge: "",   invoiceProject: null,                                      matchStatus: "Unmatched",          matchNote: "No invoice identified for this project." },
    { name: "Nomads Clothing",      client: "NOMADS CLOTHING LIMITED",     service: "Development", start: "2026-05-14", end: "2026-09-30", status: "Complete",    taskPct: 94, bugs: "0/0", estMin: 480,   actMin: 1802,  teamBadge: "",   invoiceProject: null,                                      matchStatus: "Needs Verification", matchNote: "Client has web-development invoices (Feb 2025, May 2026); the May 2026 invoice overlaps this project's timeframe - confirm whether it covers this work or Nomads Trade Website." },
    { name: "Nomads Saige",         client: "NOMADS CLOTHING LIMITED",     service: "Development", start: "2026-04-02", end: "2026-06-05", status: "In Progress", taskPct: 65, bugs: "0/0", estMin: 1920,  actMin: 4023,  teamBadge: "+1", invoiceProject: null,                                      matchStatus: "Unmatched",          matchNote: "No invoice identified for this project." },
    { name: "Nomads Trade Website", client: "NOMADS CLOTHING LIMITED",     service: "Development", start: "2025-10-14", end: "",           status: "Complete",    taskPct: 97, bugs: "0/1", estMin: 4070,  actMin: 5096,  teamBadge: "+1", invoiceProject: "NOMADS CLOTHING LIMITED - Web Development", matchStatus: "Matched",           matchNote: "Matches the client's web-development invoices (Feb 2025 and May 2026), both fully paid." },
    { name: "NWT",                  client: "NOMADS CLOTHING LIMITED",     service: "Development", start: "2026-01-21", end: "2026-12-31", status: "In Progress", taskPct: 59, bugs: "0/0", estMin: 4800,  actMin: 8657,  teamBadge: "+2", invoiceProject: null,                                      matchStatus: "Unmatched",          matchNote: "No invoice identified for this project. Largest single consumer of logged hours (144h 17m)." },
    { name: "Silver Street London", client: "SUPERHOUSE (UK) LIMITED",     service: "Development", start: "2026-04-06", end: "2026-12-31", status: "In Progress", taskPct: 60, bugs: "0/0", estMin: 5400,  actMin: 4855,  teamBadge: "+2", invoiceProject: null,                                      matchStatus: "Unmatched",          matchNote: "No invoice identified for this project. Client's only web-development invoice (Apr 2024) predates this project's start by ~2 years." }
  ]
};
