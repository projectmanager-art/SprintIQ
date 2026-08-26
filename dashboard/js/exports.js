/**
 * SprintIQ - Management-Grade Export & Reporting Engine
 *
 * Re-exports management-grade Excel, PDF and PowerPoint reports from a
 * normalized sprint `analysis` object.  Uses:
 *   - window.XLSX       (SheetJS, xlsx.full.min.js) for .xlsx
 *   - window.jspdf.jsPDF (jsPDF, jspdf.umd.min.js) for .pdf
 *   - window.PptxGenJS  (pptxgen.bundle.js) for .pptx
 *
 * Public API preserved:
 *   SprintExporter.exportExcel(analysis, customMeta)
 *   SprintExporter.exportPDF(analysis, customMeta)
 *   SprintExporter.exportPPT(analysis, customMeta)   // canonical
 *   SprintExporter.exportPPTX(...)                    // app.js alias
 */
'use strict';

const RAG_MAP = {
  GREEN: { fill: '22C55E', text: 'FFFFFF' },
  G: { fill: '22C55E', text: 'FFFFFF' },
  AMBER: { fill: 'EAB308', text: 'FFFFFF' },
  A: { fill: 'EAB308', text: 'FFFFFF' },
  YELLOW: { fill: 'EAB308', text: 'FFFFFF' },
  Y: { fill: 'EAB308', text: 'FFFFFF' },
  RED: { fill: 'DC2626', text: 'FFFFFF' },
  R: { fill: 'DC2626', text: 'FFFFFF' }
};

/**
 * Normalizes the raw analysis object into structured report sections used by
 * all three renderers (Excel, PDF, PPT).
 */
class ReportDataModel {
  constructor(analysis) {
    this.analysis = analysis || {};
    this.sprint = this.analysis.sprint || {};
    this.metrics = this.analysis.metrics || {};
    this.employees = this.analysis.employees || [];
    this.workload = this.analysis.workload || {};
    this.projects = this.analysis.projects || [];
    this.priorities = this.analysis.priorities || [];
    this.risks = this.analysis.risks || [];
    this.retrospective = this.analysis.retrospective || {};
    this.leadership = this.analysis.leadership || { members: [], deliveryRoster: [], scrumMaster: null, excludedFromCapacity: { headcount: 0, taskCount: 0, estHours: 0, actHours: 0 } };
  }

  static now() { return new Date().toLocaleDateString(); }

  get safeSprintName() {
    return (this.sprint.name || 'Sprint_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  get duration() { return `${this.sprint.startDate || 'N/A'} to ${this.sprint.endDate || 'N/A'}`; }
  get rag() { return (this.metrics.rag || 'N/A').toUpperCase(); }
  get ragScore() { return this.metrics.ragScore ?? 'N/A'; }
  get summary() { return this.retrospective.summary || 'No executive summary available.'; }

  meta(customMeta = {}) {
    return {
      title: customMeta.reportTitle || `Sprint Retrospective & RAG Report`,
      company: customMeta.companyName || 'PMO Team',
      preparedBy: customMeta.preparedBy || 'Project Manager',
      department: customMeta.department || 'Digital Delivery',
      date: ReportDataModel.now()
    };
  }

  filenames() {
    const base = this.safeSprintName;
    return {
      excel: `SprintIQ_Report_${base}.xlsx`,
      pdf: `SprintIQ_Report_${base}.pdf`,
      ppt: `SprintIQ_Presentation_${base}.pptx`
    };
  }

  ragColor(value) {
    const c = String(value || '').toUpperCase();
    return RAG_MAP[c] || { fill: '2A2E3D', text: 'F8FAFC' };
  }

  kpiList() {
    const m = this.metrics;
    return [
      { label: 'Total Tasks', value: m.totalTasks ?? 0 },
      { label: 'Completed', value: m.completed ?? 0 },
      { label: 'In Progress', value: m.inProgress ?? 0 },
      { label: 'Pending', value: m.pending ?? 0 },
      { label: 'Blocked', value: m.blocked ?? 0 },
      { label: 'Completion %', value: m.completionPct ?? 0 },
      { label: 'Total Est Hours', value: m.totalEst ?? 0 },
      { label: 'Total Act Hours', value: m.totalAct ?? 0 },
      { label: 'Variance (h)', value: m.variance ?? 0 },
      { label: 'Efficiency %', value: m.efficiencyPct ?? 0 },
      { label: 'RAG Score', value: m.ragScore ?? 0 },
      { label: 'Team Size', value: m.teamSize ?? 0 }
    ];
  }

  taskRows() {
    return (this.sprint.tasks || []).map((t, i) => {
      const est = Number(t.est) || 0;
      const act = Number(t.act) || 0;
      const variance = act - est;
      const variancePct = est > 0 ? variance / est : 0;
      let risk = 'Normal';
      const status = String(t.status || '').toLowerCase();
      if (status === 'blocked') risk = 'BLOCKED';
      else if (variance >= 4 && variancePct > 0.35) risk = 'SEVERE OVERRUN';
      else if (variance > 0) risk = 'OVERRUN';
      return {
        idx: i + 1,
        item: t.item || '',
        priority: t.priority || '',
        owner: t.owner || '',
        est,
        act,
        variance,
        variancePct,
        status: t.status || '',
        risk
      };
    });
  }

  employeeRows() { return this.employees; }

  /** Sprint leadership (non-delivery resources) - reported separately */
  leadershipRows() { return this.leadership.members || []; }

  /** Full people directory: delivery resources followed by sprint leadership */
  rosterRows() {
    return (this.leadership.deliveryRoster || []).concat(this.leadership.members || []);
  }

  get scrumMaster() { return this.leadership.scrumMaster || null; }
  get scrumMasterName() { return this.scrumMaster ? this.scrumMaster.name : 'Not assigned'; }
  get scrumMasterDesignation() { return this.scrumMaster ? this.scrumMaster.designation : 'N/A'; }

  projectRows() { return this.projects; }
  priorityRows() { return this.priorities; }
  riskRows() { return this.risks; }

  wellRows() {
    return this.retrospective.whatWentWell || [];
  }

  didntRows() {
    return this.retrospective.whatDidntGoWell || this.retrospective.whatDidNotGoWell || [];
  }

  learningRows() { return this.retrospective.keyLearnings || []; }
  improvementRows() { return this.retrospective.improvements || []; }
  retroRiskRows() { return this.retrospective.risks || []; }
  actionRows() { return this.retrospective.nextSprintActions || []; }

  topRisks(limit = 5) { return this.risks.slice(0, limit); }
}

/* ------------------------------------------------------------------
 * Excel / XLSX helpers
 * ------------------------------------------------------------------ */
function _X(v, style, t, z) {
  if (v === undefined || v === null) v = '';
  const cell = { v, s: style || {} };
  if (t) cell.t = t;
  if (z) cell.z = z;
  return cell;
}

const BASE_STYLE = {
  border: {
    top: { style: 'thin', color: { rgb: '334155' } },
    left: { style: 'thin', color: { rgb: '334155' } },
    right: { style: 'thin', color: { rgb: '334155' } },
    bottom: { style: 'thin', color: { rgb: '334155' } }
  },
  alignment: { vertical: 'center', wrapText: true }
};

const HEADER_STYLE = Object.assign({}, BASE_STYLE, {
  font: { bold: true, color: { rgb: 'F8FAFC' }, sz: 11 },
  fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
});

function X(v, style, t, z) {
  return _X(v, Object.assign({}, BASE_STYLE, style || {}), t, z);
}

function H(v) { return X(v, HEADER_STYLE); }

function RAG(v) {
  const rc = (new ReportDataModel({})).ragColor(v);
  return X(v, {
    fill: { patternType: 'solid', fgColor: { rgb: rc.fill } },
    font: { bold: true, color: { rgb: rc.text } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
  });
}

function Pct(v) {
  let n = (typeof v === 'number') ? v : parseFloat(String(v).replace('%', ''));
  if (isNaN(n)) n = 0;
  return X(n / 100, { alignment: { horizontal: 'right' } }, 'n', '0.0%');
}

function Num(v, fmt) {
  let n = (typeof v === 'number') ? v : parseFloat(v);
  if (isNaN(n)) n = 0;
  return X(n, { alignment: { horizontal: 'right' } }, 'n', fmt || '0.0');
}

function Hrs(v) { return Num(v, '0.0"h"'); }
function VarHrs(v) { return Num(v, '+0.0"h";-0.0"h";0.0"h"'); }

function autoWidth(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const widths = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    let max = 0;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ c, r })];
      const txt = cell ? (cell.w || String(cell.v || '')) : '';
      const len = txt.length;
      if (len > max) max = len;
    }
    widths.push({ wch: Math.min(70, Math.max(10, max + 2)) });
  }
  ws['!cols'] = widths;
}

function finishSheet(ws, headerRows) {
  if (!ws) return;
  autoWidth(ws);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const lastCol = XLSX.utils.encode_col(range.e.c);
  if (headerRows && headerRows > 0) {
    ws['!freeze'] = { state: 'frozen', xSplit: 0, ySplit: headerRows, topLeftCell: `A${headerRows + 1}`, activePane: 'bottomLeft' };
    ws['!autofilter'] = { ref: `A1:${lastCol}${headerRows}` };
    ws['!rows'] = new Array(headerRows).fill(null).map(() => ({ hpt: 24 }));
  }
}

/* ------------------------------------------------------------------
 * SprintExporter
 * ------------------------------------------------------------------ */
class SprintExporter {
  /**
   * ----------------------------------------------------------------
   * Excel export
   * ----------------------------------------------------------------
   */
  static exportExcel(analysis, customMeta = {}) {
    if (!window.XLSX) {
      alert('Excel export library not ready.');
      return;
    }

    const XLSX = window.XLSX;
    const report = new ReportDataModel(analysis);
    const meta = report.meta(customMeta);
    const wb = XLSX.utils.book_new();

    const makeHeader = (txt) => H(txt);

    // 1. Executive Summary
    const wsSummary = XLSX.utils.aoa_to_sheet([
      [X('SprintIQ - Executive Summary', { font: { bold: true, sz: 16, color: { rgb: 'F8FAFC' } }, fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } } })],
      [makeHeader('Sprint Name'), X(report.sprint.name || 'N/A')],
      [makeHeader('Duration'), X(report.duration)],
      [makeHeader('Generated'), X(meta.date)],
      [makeHeader('Company'), X(meta.company)],
      [makeHeader('Prepared By'), X(meta.preparedBy)],
      [makeHeader('Scrum Master'), X(report.scrumMasterName)],
      [makeHeader('Scrum Master Designation'), X(report.scrumMasterDesignation)],
      [makeHeader('Overall RAG'), RAG(report.rag)],
      [makeHeader('RAG Score'), X(report.ragScore)],
      [makeHeader('Executive Summary'), X(report.summary, { alignment: { wrapText: true } })],
      [makeHeader('Top Risks')],
      [makeHeader('RAG'), makeHeader('ID'), makeHeader('Type'), makeHeader('Description')],
      ...report.topRisks(5).map(r => [RAG(r.rag), X(r.id), X(r.type), X(r.description)])
    ]);
    finishSheet(wsSummary, 0);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

    // 2. Sprint KPIs
    const kpi = report.kpiList();
    const kpiAoa = [[makeHeader('KPI'), makeHeader('Value'), makeHeader('KPI'), makeHeader('Value')]];
    for (let i = 0; i < kpi.length; i += 2) {
      const a = kpi[i];
      const b = kpi[i + 1];
      const row = [X(a.label), Num(a.value, a.label.includes('%') ? '0.0%' : '0.0')];
      if (b) {
        row.push(X(b.label));
        row.push(Num(b.value, b.label.includes('%') ? '0.0%' : '0.0'));
      }
      kpiAoa.push(row);
    }
    const wsKpi = XLSX.utils.aoa_to_sheet(kpiAoa);
    finishSheet(wsKpi, 1);
    XLSX.utils.book_append_sheet(wb, wsKpi, 'Sprint KPIs');

    // 2B. Team & Roles (designations, sprint roles, capacity eligibility)
    const rosterHeaders = ['Employee', 'Designation', 'Sprint Role', 'Resource Type', 'Delivery Resource', 'Scrum Master', 'Counted in Capacity'];
    const rosterAoa = [
      [X('Sprint Leadership', { font: { bold: true, color: { rgb: 'F8FAFC' } }, fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } } })],
      [makeHeader('Scrum Master'), X(report.scrumMasterName)],
      [makeHeader('Designation'), X(report.scrumMasterDesignation)],
      [makeHeader('Excluded Leadership Effort'), Hrs(report.leadership.excludedFromCapacity.actHours)],
      [],
      [X('Role & Designation Register', { font: { bold: true, color: { rgb: 'F8FAFC' } }, fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } } })],
      rosterHeaders.map(makeHeader),
      ...report.rosterRows().map(p => [
        X(p.name),
        X(p.designation),
        X(p.sprintRole),
        X(p.resourceType),
        X(p.isDeliveryResource ? 'Yes' : 'No'),
        X(p.isScrumMaster ? 'Yes' : 'No'),
        X(p.isDeliveryResource ? 'Yes' : 'No (management / non-billable)')
      ])
    ];
    const wsRoster = XLSX.utils.aoa_to_sheet(rosterAoa);
    finishSheet(wsRoster, 0);
    XLSX.utils.book_append_sheet(wb, wsRoster, 'Team & Roles');

    // 3. Delivery Team Performance
    const empHeaders = [
      'Employee', 'Designation', 'RAG', 'Score', 'Assigned', 'Completed', 'In Progress', 'Blocked',
      'Completion %', 'Est Hours', 'Act Hours', 'Variance (h)', 'Variance %',
      'Efficiency %', 'Workload %', 'Workload Status', 'Observation', 'Recommendation'
    ];
    const empAoa = [empHeaders.map(makeHeader)];
    empAoa.push(...report.employeeRows().map(e => [
      X(e.name),
      X(e.designation),
      RAG(e.rag),
      Num(e.score),
      Num(e.totalAssigned),
      Num(e.completed),
      Num(e.inProgress),
      Num(e.blocked),
      Pct(e.completionPct),
      Hrs(e.estHours),
      Hrs(e.actHours),
      VarHrs(e.variance),
      Pct(e.variancePct),
      Pct(e.efficiencyPct),
      Pct(e.workloadPct),
      X(e.workloadStatus),
      X(e.observation, { alignment: { wrapText: true } }),
      X(e.recommendation, { alignment: { wrapText: true } })
    ]));
    const wsEmp = XLSX.utils.aoa_to_sheet(empAoa);
    finishSheet(wsEmp, 1);
    XLSX.utils.book_append_sheet(wb, wsEmp, 'Delivery Team Performance');

    // 4. Task Details
    const taskHeaders = ['#', 'Task / Activity', 'Priority', 'Owner', 'Est (h)', 'Act (h)', 'Variance (h)', 'Variance %', 'Status', 'Risk Flag'];
    const taskAoa = [taskHeaders.map(makeHeader)];
    taskAoa.push(...report.taskRows().map(t => [
      Num(t.idx),
      X(t.item, { alignment: { wrapText: true } }),
      X(t.priority),
      X(t.owner),
      Hrs(t.est),
      Hrs(t.act),
      VarHrs(t.variance),
      Pct(t.variancePct * 100),
      X(t.status),
      X(t.risk)
    ]));
    const wsTasks = XLSX.utils.aoa_to_sheet(taskAoa);
    finishSheet(wsTasks, 1);
    XLSX.utils.book_append_sheet(wb, wsTasks, 'Task Details');

    // 5. Project/Client Breakdown
    const projHeaders = ['Project / Client', 'Tasks', 'Completed', 'Completion %', 'Est (h)', 'Act (h)', 'Variance (h)', 'RAG', 'Assigned Team'];
    const projAoa = [projHeaders.map(makeHeader)];
    projAoa.push(...report.projectRows().map(p => [
      X(p.name, { alignment: { wrapText: true } }),
      Num(p.taskCount),
      Num(p.completedCount),
      Pct(p.completionPct),
      Hrs(p.estHours),
      Hrs(p.actHours),
      VarHrs(p.variance),
      RAG(p.rag),
      X((p.assignedOwners || []).join(', '), { alignment: { wrapText: true } })
    ]));
    const wsProj = XLSX.utils.aoa_to_sheet(projAoa);
    finishSheet(wsProj, 1);
    // Sheet names cannot contain : \ / ? * [ ]
    XLSX.utils.book_append_sheet(wb, wsProj, 'Project & Client Breakdown');

    // 6. Effort Analysis
    const w = report.workload;
    const priorityRows = report.priorityRows();
    const effortAoa = [
      [X('Workload Summary', { font: { bold: true, color: { rgb: 'F8FAFC' } }, fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } } })],
      [makeHeader('Average Hours'), Hrs(w.avgHours)],
      [makeHeader('Imbalance Score'), Num(w.imbalanceScore)],
      [makeHeader('Underloaded'), X((w.underloadedList || []).join(', '))],
      [makeHeader('Balanced'), X((w.balancedList || []).join(', '))],
      [makeHeader('Overloaded'), X((w.overloadedList || []).join(', '))],
      [],
      [X('Effort by Priority', { font: { bold: true, color: { rgb: 'F8FAFC' } }, fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } } })],
      [makeHeader('Priority'), makeHeader('Count'), makeHeader('Est (h)'), makeHeader('Act (h)'), makeHeader('Variance (h)')],
      ...priorityRows.map(p => [
        X(p.name),
        Num(p.count),
        Hrs(p.estHours),
        Hrs(p.actHours),
        VarHrs(p.variance)
      ]),
      [],
      [X('Variance Note', { font: { bold: true, color: { rgb: 'F8FAFC' } }, fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } } })],
      [X('A chart can be generated in Excel from the priority/employee effort tables above.  Conditional RAG formatting is applied to status columns.', { alignment: { wrapText: true } })]
    ];
    const wsEffort = XLSX.utils.aoa_to_sheet(effortAoa);
    finishSheet(wsEffort, 0);
    XLSX.utils.book_append_sheet(wb, wsEffort, 'Effort Analysis');

    // 7. Retrospective
    const retroAoa = [
      [X('Sprint Retrospective', { font: { bold: true, color: { rgb: 'F8FAFC' } }, fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } } })],
      [makeHeader('Scrum Master'), X(`${report.scrumMasterName} (${report.scrumMasterDesignation})`)],
      [makeHeader('Summary'), X(report.summary, { alignment: { wrapText: true } })],
      [],
      [makeHeader('What Went Well')],
      ...report.wellRows().map(s => [X(`• ${s}`, { alignment: { wrapText: true } })]),
      [makeHeader('What Did Not Go Well')],
      ...report.didntRows().map(s => [X(`• ${s}`, { alignment: { wrapText: true } })]),
      [makeHeader('Key Learnings')],
      ...report.learningRows().map(s => [X(`• ${s}`, { alignment: { wrapText: true } })]),
      [makeHeader('Improvements')],
      ...report.improvementRows().map(s => [X(`• ${s}`, { alignment: { wrapText: true } })]),
      [makeHeader('Retrospective Risks')],
      ...report.retroRiskRows().map(s => [X(`• ${s}`, { alignment: { wrapText: true } })])
    ];
    const wsRetro = XLSX.utils.aoa_to_sheet(retroAoa);
    finishSheet(wsRetro, 0);
    XLSX.utils.book_append_sheet(wb, wsRetro, 'Retrospective');

    // 8. Action Items
    const actHeaders = ['Action Item', 'Owner', 'Priority', 'Expected Outcome'];
    const actAoa = [actHeaders.map(makeHeader)];
    actAoa.push(...report.actionRows().map(a => [
      X(a.action, { alignment: { wrapText: true } }),
      X(a.owner),
      X(a.priority),
      X(a.outcome, { alignment: { wrapText: true } })
    ]));
    const wsActions = XLSX.utils.aoa_to_sheet(actAoa);
    finishSheet(wsActions, 1);
    XLSX.utils.book_append_sheet(wb, wsActions, 'Action Items');

    // 9. Raw Data
    const rawHeaders = ['ID', 'Item', 'Priority', 'Owner', 'Est', 'Act', 'Status', 'Notes'];
    const rawAoa = [rawHeaders.map(makeHeader)];
    rawAoa.push(...(report.sprint.tasks || []).map(t => [
      X(t.id),
      X(t.item, { alignment: { wrapText: true } }),
      X(t.priority),
      X(t.owner),
      Num(t.est),
      Num(t.act),
      X(t.status),
      X(t.notes || '')
    ]));
    const wsRaw = XLSX.utils.aoa_to_sheet(rawAoa);
    finishSheet(wsRaw, 1);
    XLSX.utils.book_append_sheet(wb, wsRaw, 'Raw Data');

    XLSX.writeFile(wb, report.filenames().excel);
  }

  /**
   * ----------------------------------------------------------------
   * PDF export
   * ----------------------------------------------------------------
   */
  static exportPDF(analysis, customMeta = {}) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('PDF generation library not loaded.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const report = new ReportDataModel(analysis);
    const meta = report.meta(customMeta);

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const m = 36;
    const footerH = 22;
    const maxY = pageH - m - footerH;
    let y = m;

    function ragTextColor(v) {
      const c = String(v || '').toUpperCase();
      if (c === 'GREEN' || c === 'G') return [34, 197, 94];
      if (c === 'AMBER' || c === 'A' || c === 'YELLOW' || c === 'Y') return [234, 179, 8];
      if (c === 'RED' || c === 'R') return [220, 38, 38];
      return [248, 250, 252];
    }

    function drawPageBackground() {
      doc.setFillColor(18, 20, 26);
      doc.rect(0, 0, pageW, pageH, 'F');
    }

    function pageHeader(title) {
      drawPageBackground();
      doc.setFillColor(18, 20, 26);
      doc.rect(0, 0, pageW, 52, 'F');
      doc.setFillColor(230, 57, 70);
      doc.rect(0, 50, pageW, 3, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(248, 250, 252);
      doc.text('SprintIQ', m, 35);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(title || 'Management Report', m + 80, 35);

      doc.setFontSize(8);
      doc.text(`Generated: ${meta.date}`, pageW - m - 120, 35);
      y = 70;
    }

    function drawTableHeader(columns, startY) {
      const tableW = columns.reduce((a, c) => a + c.w, 0);
      doc.setFillColor(42, 46, 61);
      doc.rect(m, startY - 12, tableW, 18, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(248, 250, 252);
      let x = m;
      columns.forEach(col => {
        doc.text(col.header, x + 4, startY - 2);
        x += col.w;
      });
    }

    function drawTable(columns, rows, title) {
      const tableW = columns.reduce((a, c) => a + c.w, 0);
      const headerH = 18;
      const pad = 4;
      const lineH = 10;
      let curY = y + 16;

      if (curY + headerH + 24 > maxY) {
        doc.addPage();
        pageHeader(title);
        curY = y;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(248, 250, 252);
      doc.text(title, m, curY);
      curY += 16;

      drawTableHeader(columns, curY);
      curY += headerH;

      rows.forEach((row, i) => {
        const cells = row.map((v, idx) => {
          const txt = String(v ?? '');
          const w = Math.max(columns[idx].w - 2 * pad, 5);
          const lines = doc.splitTextToSize(txt, w);
          return { lines, txt };
        });
        const h = Math.max(headerH, Math.max.apply(null, cells.map(c => c.lines.length * lineH + pad)));

        if (curY + h > maxY) {
          doc.addPage();
          pageHeader(title);
          curY = y;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(248, 250, 252);
          doc.text(title, m, curY);
          curY += 16;
          drawTableHeader(columns, curY);
          curY += headerH;
        }

        const fill = i % 2 === 0 ? [18, 20, 26] : [26, 29, 38];
        doc.setFillColor(...fill);
        doc.rect(m, curY - pad, tableW, h, 'F');

        let x = m;
        cells.forEach((c, idx) => {
          const col = columns[idx];
          if (col.rag) {
            doc.setTextColor(...ragTextColor(c.txt));
            doc.setFont('helvetica', 'bold');
          } else {
            doc.setTextColor(248, 250, 252);
            doc.setFont('helvetica', 'normal');
          }
          doc.setFontSize(8);
          doc.text(c.lines, x + pad, curY, { align: col.align || 'left' });
          x += col.w;
        });

        curY += h;
      });

      y = curY + 12;
    }

    function bulletSection(title, items, color) {
      if (!items || items.length === 0) return;
      if (y + 40 > maxY) { doc.addPage(); pageHeader(title); }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...(color || [248, 250, 252]));
      doc.text(title, m, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      items.forEach(item => {
        const lines = doc.splitTextToSize(`• ${item}`, pageW - 2 * m);
        const h = lines.length * 11 + 4;
        if (y + h > maxY) { doc.addPage(); pageHeader(title); y = 70; }
        doc.text(lines, m, y);
        y += h;
      });
      y += 10;
    }

    // --- Cover ---
    drawPageBackground();
    doc.setFillColor(230, 57, 70);
    doc.rect(m, 220, 80, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(34);
    doc.setTextColor(248, 250, 252);
    doc.text(meta.title, m, 260);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(148, 163, 184);
    doc.text(`Sprint: ${report.sprint.name || 'N/A'}`, m, 290);
    doc.text(`Duration: ${report.duration}`, m, 310);
    doc.setFontSize(12);
    doc.text(`Scrum Master: ${report.scrumMasterName} (${report.scrumMasterDesignation})`, m, 335);
    doc.text(`Company: ${meta.company}  |  Prepared By: ${meta.preparedBy}`, m, 355);
    doc.text(`Generated: ${meta.date}`, m, 375);

    const rc = report.ragColor(report.rag);
    const rgb = rc.fill.match(/[0-9A-Fa-f]{2}/g).map(h => parseInt(h, 16));
    doc.setFillColor(...rgb);
    doc.roundedRect(m, 390, pageW - 2 * m, 44, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(`OVERALL SPRINT HEALTH: ${report.rag}  (Score: ${report.ragScore}/100)`, m + 12, 417);

    // --- Sprint Leadership (management layer, excluded from delivery metrics) ---
    doc.addPage();
    pageHeader('Sprint Leadership');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(248, 250, 252);
    doc.text('1. Sprint Leadership', m, y);
    y += 18;
    const leadLines = [
      ['Scrum Master', report.scrumMasterName],
      ['Designation', report.scrumMasterDesignation],
      ['Resource Type', report.scrumMaster ? report.scrumMaster.resourceType : 'N/A'],
      ['Excluded from Capacity', `${report.leadership.excludedFromCapacity.headcount} resource(s), ${report.leadership.excludedFromCapacity.actHours}h`]
    ];
    const otherLeads = report.leadershipRows().filter(l => !l.isScrumMaster);
    if (otherLeads.length > 0) {
      leadLines.push(['Other Leadership', otherLeads.map(l => `${l.name} (${l.designation})`).join(', ')]);
    }
    leadLines.forEach((row, i) => {
      doc.setFillColor(...(i % 2 === 0 ? [26, 29, 38] : [18, 20, 26]));
      doc.rect(m, y - 12, pageW - 2 * m, 18, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(148, 163, 184);
      doc.text(row[0], m + 6, y + 2);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(248, 250, 252);
      doc.text(String(row[1]), m + 180, y + 2);
      y += 20;
    });
    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Sprint leadership is management / non-billable effort and is excluded from all delivery capacity, utilization and RAG calculations below.', m, y, { maxWidth: pageW - 2 * m });
    y += 22;

    // --- Executive Summary ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(248, 250, 252);
    doc.text('2. Executive Management Summary', m, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225);
    const summaryLines = doc.splitTextToSize(report.summary, pageW - 2 * m);
    doc.text(summaryLines, m, y);
    y += summaryLines.length * 12 + 18;

    // --- Sprint Health ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(248, 250, 252);
    doc.text('3. Sprint Health', m, y);
    y += 18;
    const health = [
      ['Overall RAG', report.rag, 'RAG Score', `${report.ragScore}/100`],
      ['Completion', `${report.metrics.completionPct ?? 0}%`, 'Efficiency', `${report.metrics.efficiencyPct ?? 0}%`],
      ['Team Size', report.metrics.teamSize ?? 0, 'Imbalance', `${report.workload.imbalanceScore ?? 0}`],
      ['Total Tasks', report.metrics.totalTasks ?? 0, 'Blocked', report.metrics.blocked ?? 0]
    ];
    const hw = (pageW - 2 * m) / 4;
    health.forEach((row, i) => {
      const fill = i % 2 === 0 ? [26, 29, 38] : [18, 20, 26];
      doc.setFillColor(...fill);
      doc.rect(m, y - 12, pageW - 2 * m, 18, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(row[0], m + 6, y + 2);
      doc.text(row[2], m + hw * 2 + 6, y + 2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(248, 250, 252);
      doc.text(String(row[1]), m + hw + 6, y + 2);
      doc.text(String(row[3]), m + hw * 3 + 6, y + 2);
      y += 20;
    });
    y += 10;

    // --- KPIs ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(248, 250, 252);
    doc.text('4. Sprint KPIs', m, y);
    y += 18;
    const kpi = report.kpiList();
    const kpiA = [];
    for (let i = 0; i < kpi.length; i += 2) kpiA.push([kpi[i], kpi[i + 1]]);
    const kpiW = (pageW - 2 * m) / 4;
    kpiA.forEach((pair, i) => {
      const fill = i % 2 === 0 ? [26, 29, 38] : [18, 20, 26];
      doc.setFillColor(...fill);
      doc.rect(m, y - 12, pageW - 2 * m, 18, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(148, 163, 184);
      doc.text(pair[0].label, m + 6, y + 2);
      doc.text((pair[1] || {}).label, m + kpiW * 2 + 6, y + 2);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(248, 250, 252);
      doc.text(String(pair[0].value), m + kpiW + 6, y + 2);
      doc.text(String((pair[1] || {}).value || ''), m + kpiW * 3 + 6, y + 2);
      y += 20;
    });
    y += 10;

    // --- Delivery Team Performance table (delivery resources only) ---
    const empRows = report.employeeRows().map(e => [
      e.name,
      e.designation || '',
      e.rag,
      e.score,
      e.totalAssigned,
      e.completed,
      `${e.completionPct}%`,
      `${e.estHours}h`,
      `${e.actHours}h`,
      `${e.variance >= 0 ? '+' : ''}${e.variance}h`,
      `${e.efficiencyPct}%`,
      e.workloadStatus
    ]);
    const empCols = [
      { header: 'Employee', w: 78 },
      { header: 'Designation', w: 62 },
      { header: 'RAG', w: 34, rag: true },
      { header: 'Score', w: 32 },
      { header: 'Assign', w: 36 },
      { header: 'Done', w: 34 },
      { header: 'Comp %', w: 42 },
      { header: 'Est', w: 34 },
      { header: 'Act', w: 34 },
      { header: 'Var', w: 40 },
      { header: 'Eff %', w: 42 },
      { header: 'WLoad', w: 55 }
    ];
    drawTable(empCols, empRows, '5. Delivery Team Performance (RAG)');

    // --- Project/Client table ---
    const projRows = report.projectRows().map(p => [
      p.name,
      p.taskCount,
      p.completedCount,
      `${p.completionPct}%`,
      `${p.estHours}h`,
      `${p.actHours}h`,
      `${p.variance >= 0 ? '+' : ''}${p.variance}h`,
      p.rag,
      (p.assignedOwners || []).join(', ')
    ]);
    const projCols = [
      { header: 'Project / Client', w: 110 },
      { header: 'Tasks', w: 38 },
      { header: 'Done', w: 45 },
      { header: 'Comp %', w: 50 },
      { header: 'Est', w: 40 },
      { header: 'Act', w: 40 },
      { header: 'Var', w: 45 },
      { header: 'RAG', w: 38, rag: true },
      { header: 'Owners', w: 130 }
    ];
    drawTable(projCols, projRows, '6. Project / Client Breakdown');

    // --- Task table ---
    const taskRows = report.taskRows().map(t => [
      t.idx,
      t.item,
      t.priority,
      t.owner,
      `${t.est}h`,
      `${t.act}h`,
      `${t.variance >= 0 ? '+' : ''}${t.variance}h`,
      t.status
    ]);
    const taskCols = [
      { header: '#', w: 28 },
      { header: 'Task / Activity', w: 150 },
      { header: 'Priority', w: 45 },
      { header: 'Owner', w: 85 },
      { header: 'Est', w: 38 },
      { header: 'Act', w: 38 },
      { header: 'Var', w: 45 },
      { header: 'Status', w: 60 }
    ];
    drawTable(taskCols, taskRows, '7. Task Breakdown');

    // --- Effort Analysis ---
    if (y + 100 > maxY) { doc.addPage(); pageHeader('Effort Analysis'); }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(248, 250, 252);
    doc.text('8. Effort Analysis', m, y);
    y += 18;
    const w = report.workload;
    const effortLines = [
      `Average Hours: ${w.avgHours ?? 0}h`,
      `Imbalance Score: ${w.imbalanceScore ?? 0}`,
      `Underloaded: ${(w.underloadedList || []).join(', ') || 'None'}`,
      `Balanced: ${(w.balancedList || []).join(', ') || 'None'}`,
      `Overloaded: ${(w.overloadedList || []).join(', ') || 'None'}`
    ];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    effortLines.forEach(line => {
      const lines = doc.splitTextToSize(line, pageW - 2 * m);
      if (y + lines.length * 11 > maxY) { doc.addPage(); pageHeader('Effort Analysis'); y = 70; }
      doc.text(lines, m, y);
      y += lines.length * 12 + 4;
    });
    y += 10;

    // --- Retrospective ---
    doc.addPage();
    pageHeader('Retrospective');
    bulletSection('What Went Well', report.wellRows(), [34, 197, 94]);
    bulletSection('What Did Not Go Well', report.didntRows(), [220, 38, 38]);
    bulletSection('Key Learnings', report.learningRows());
    bulletSection('Improvements', report.improvementRows());
    bulletSection('Retrospective Risks', report.retroRiskRows(), [234, 179, 8]);

    // --- Risks ---
    const riskRows = report.riskRows().map(r => [
      r.id,
      r.type,
      r.task,
      r.owner,
      r.priority,
      r.severity,
      r.rag,
      r.action
    ]);
    const riskCols = [
      { header: 'ID', w: 45 },
      { header: 'Type', w: 70 },
      { header: 'Task', w: 100 },
      { header: 'Owner', w: 70 },
      { header: 'Priority', w: 50 },
      { header: 'Severity', w: 50 },
      { header: 'RAG', w: 40, rag: true },
      { header: 'Action', w: 95 }
    ];
    drawTable(riskCols, riskRows, '9. Risk Register');

    // --- Action Items ---
    const actionRows = report.actionRows().map(a => [
      a.action,
      a.owner,
      a.priority,
      a.outcome
    ]);
    const actionCols = [
      { header: 'Action Item', w: 180 },
      { header: 'Owner', w: 110 },
      { header: 'Priority', w: 80 },
      { header: 'Expected Outcome', w: 150 }
    ];
    drawTable(actionCols, actionRows, '10. Next Sprint Action Items');

    // --- Final Summary ---
    if (y + 80 > maxY) { doc.addPage(); pageHeader('Final Summary'); }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(248, 250, 252);
    doc.text('11. Final Summary', m, y);
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225);
    const final = `Sprint ${report.sprint.name || ''} completed with ${report.metrics.completionPct ?? 0}% task completion and ${report.metrics.efficiencyPct ?? 0}% efficiency. Overall health is ${report.rag} (${report.ragScore}/100). ${report.summary}`;
    const finalLines = doc.splitTextToSize(final, pageW - 2 * m);
    doc.text(finalLines, m, y);

    // --- Footer page numbers ---
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`SprintIQ | Page ${i} of ${totalPages}`, pageW / 2, pageH - 18, { align: 'center' });
    }

    doc.save(report.filenames().pdf);
  }

  /**
   * ----------------------------------------------------------------
   * PPT export
   * ----------------------------------------------------------------
   */
  static exportPPT(analysis, customMeta = {}) {
    if (!window.PptxGenJS) {
      alert('PowerPoint generator library not ready.');
      return;
    }

    const report = new ReportDataModel(analysis);
    const meta = report.meta(customMeta);
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.title = meta.title;
    pptx.author = meta.preparedBy;
    pptx.company = meta.company;

    const DARK = '12141A';
    const CARD = '1A1D26';
    const LIGHT = 'F8FAFC';
    const MUTED = '94A3B8';
    const RED = 'E63946';
    const GREEN = '2EC4B6';
    const AMBER = 'FFB703';

    function ragPptx(v) {
      const c = String(v || '').toUpperCase();
      if (c === 'GREEN' || c === 'G') return GREEN;
      if (c === 'AMBER' || c === 'A' || c === 'YELLOW' || c === 'Y') return AMBER;
      if (c === 'RED' || c === 'R') return RED;
      return LIGHT;
    }

    function chunk(arr, n) {
      const out = [];
      for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
      return out;
    }

    function newSlide(title) {
      const s = pptx.addSlide();
      s.background = { color: DARK };
      if (title) {
        s.addText(title, {
          x: 0.5, y: 0.35, w: 12.3, h: 0.55,
          fontSize: 22, bold: true, color: LIGHT
        });
      }
      return s;
    }

    function tableSlide(title, header, rows, colW, perSlide = 7) {
      const chunks = chunk(rows, perSlide);
      chunks.forEach((set, i) => {
        const t = chunks.length > 1 ? `${title} (${i + 1}/${chunks.length})` : title;
        const s = newSlide(t);
        const headerRow = header.map(h => ({ text: h, options: { bold: true, fill: '2A2E3D', color: LIGHT, align: 'center' } }));
        const data = set.map(r => r.map(cell => (typeof cell === 'object' ? cell : { text: String(cell), options: { color: LIGHT } })));
        s.addTable([headerRow, ...data], {
          x: 0.5, y: 1.2, w: 12.3, colW,
          fill: { color: DARK },
          color: LIGHT,
          fontSize: 9,
          border: { pt: 0.5, color: '2A2E3D' },
          valign: 'middle'
        });
      });
    }

    // 1. Cover
    const s1 = pptx.addSlide();
    s1.background = { color: DARK };
    s1.addText('SprintIQ', { x: 1, y: 1.8, w: 11.3, h: 1, fontSize: 48, bold: true, color: RED, fontFace: 'Arial Black' });
    s1.addText('Turn Sprint Data into Management Intelligence', { x: 1, y: 2.9, w: 11.3, h: 0.5, fontSize: 18, color: LIGHT });
    s1.addText(meta.title, { x: 1, y: 4.0, w: 11.3, h: 0.5, fontSize: 15, color: MUTED });
    s1.addText(`Sprint: ${report.sprint.name || 'N/A'}`, { x: 1, y: 4.7, w: 11.3, h: 0.4, fontSize: 13, color: MUTED });
    s1.addText(`Scrum Master: ${report.scrumMasterName} (${report.scrumMasterDesignation})`, { x: 1, y: 5.1, w: 11.3, h: 0.4, fontSize: 13, color: MUTED });
    s1.addText(`Company: ${meta.company}  |  Prepared By: ${meta.preparedBy}  |  Date: ${meta.date}`, { x: 1, y: 5.7, w: 11.3, h: 0.4, fontSize: 11, color: MUTED });

    // 2. Sprint Leadership (management layer - excluded from delivery metrics)
    const sLead = newSlide('Sprint Leadership');
    sLead.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 1.2, w: 6.0, h: 2.0, fill: { color: CARD }, line: { color: RED, width: 1.5 } });
    sLead.addText('SCRUM MASTER', { x: 0.75, y: 1.35, w: 5.5, h: 0.35, fontSize: 11, bold: true, color: RED });
    sLead.addText(report.scrumMasterName, { x: 0.75, y: 1.7, w: 5.5, h: 0.6, fontSize: 26, bold: true, color: LIGHT });
    sLead.addText(`Designation: ${report.scrumMasterDesignation}`, { x: 0.75, y: 2.35, w: 5.5, h: 0.4, fontSize: 13, color: MUTED });
    sLead.addText(`Resource Type: ${report.scrumMaster ? report.scrumMaster.resourceType : 'N/A'}`, { x: 0.75, y: 2.7, w: 5.5, h: 0.4, fontSize: 12, color: MUTED });

    sLead.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 6.8, y: 1.2, w: 6.0, h: 2.0, fill: { color: CARD } });
    sLead.addText('DELIVERY TEAM SCOPE', { x: 7.05, y: 1.35, w: 5.5, h: 0.35, fontSize: 11, bold: true, color: GREEN });
    sLead.addText(`${report.employeeRows().length} delivery resources scored`, { x: 7.05, y: 1.7, w: 5.5, h: 0.5, fontSize: 18, bold: true, color: LIGHT });
    sLead.addText(`Excluded from capacity: ${report.leadership.excludedFromCapacity.headcount} leadership resource(s), ${report.leadership.excludedFromCapacity.actHours}h`, {
      x: 7.05, y: 2.25, w: 5.5, h: 0.8, fontSize: 12, color: MUTED
    });

    const rosterPpt = report.rosterRows().map(p => [
      { text: p.name, options: { color: LIGHT } },
      { text: p.designation, options: { color: LIGHT } },
      { text: p.sprintRole, options: { color: p.isScrumMaster ? RED : LIGHT, bold: !!p.isScrumMaster } },
      { text: p.resourceType, options: { color: MUTED } },
      { text: p.isDeliveryResource ? 'Yes' : 'No', options: { color: p.isDeliveryResource ? GREEN : AMBER, bold: true } }
    ]);
    sLead.addText('Delivery resources drive all capacity, utilization, workload and RAG calculations. Sprint leadership is reported separately as management / non-billable effort.', {
      x: 0.5, y: 3.5, w: 12.3, h: 0.6, fontSize: 12, italic: true, color: MUTED
    });

    tableSlide('Team & Roles Register',
      ['Employee', 'Designation', 'Sprint Role', 'Resource Type', 'Delivery Resource'],
      rosterPpt,
      [2.4, 2.6, 2.4, 3.2, 1.7],
      10
    );

    // 3. Executive Summary
    const s2 = newSlide('Executive Summary');
    const rc = report.ragColor(report.rag);
    s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.5, y: 1.2, w: 12.3, h: 0.9,
      fill: { color: rc.fill }, line: { color: RED, width: 1.5 }
    });
    s2.addText(`OVERALL SPRINT HEALTH: ${report.rag}  (Score: ${report.ragScore}/100)  |  Completion: ${report.metrics.completionPct ?? 0}%  |  Efficiency: ${report.metrics.efficiencyPct ?? 0}%`, {
      x: 0.8, y: 1.35, w: 11.7, h: 0.6, fontSize: 15, bold: true, color: rc.text
    });
    s2.addText(report.summary, {
      x: 0.5, y: 2.4, w: 12.3, h: 4.0, fontSize: 12, color: LIGHT, lineSpacing: 18
    });

    // 3. Overall Health
    const s3 = newSlide('Overall Sprint Health');
    const healthCards = [
      ['RAG', report.rag, 'RAG Score', `${report.ragScore}/100`],
      ['Completion', `${report.metrics.completionPct ?? 0}%`, 'Efficiency', `${report.metrics.efficiencyPct ?? 0}%`],
      ['Total Tasks', report.metrics.totalTasks ?? 0, 'Blocked', report.metrics.blocked ?? 0],
      ['Est Hours', `${report.metrics.totalEst ?? 0}h`, 'Act Hours', `${report.metrics.totalAct ?? 0}h`]
    ];
    healthCards.forEach((card, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.8 + col * 6.0;
      const yy = 1.3 + row * 1.4;
      s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x, y: yy, w: 5.7, h: 1.2, fill: { color: CARD } });
      s3.addText(card[0], { x: x + 0.1, y: yy + 0.1, w: 2.7, h: 0.5, fontSize: 11, color: MUTED });
      s3.addText(String(card[1]), { x: x + 0.1, y: yy + 0.55, w: 2.7, h: 0.5, fontSize: 18, bold: true, color: RED });
      s3.addText(card[2], { x: x + 2.9, y: yy + 0.1, w: 2.7, h: 0.5, fontSize: 11, color: MUTED });
      s3.addText(String(card[3]), { x: x + 2.9, y: yy + 0.55, w: 2.7, h: 0.5, fontSize: 18, bold: true, color: RED });
    });

    // 4. KPIs
    const s4 = newSlide('Sprint KPIs');
    const kpi = report.kpiList();
    const kpiRows = [['Metric', 'Value']];
    kpi.forEach(k => kpiRows.push([k.label, String(k.value)]));
    s4.addTable(kpiRows, {
      x: 0.5, y: 1.2, w: 6, colW: [3.8, 2.0],
      color: LIGHT, fill: { color: DARK }, fontSize: 11,
      border: { pt: 0.5, color: '2A2E3D' },
      valign: 'middle'
    });

    // 5. Delivery Team Performance
    const empRows = report.employeeRows().map(e => [
      { text: e.name, options: { color: LIGHT } },
      { text: e.designation || '', options: { color: MUTED } },
      { text: e.rag, options: { bold: true, color: ragPptx(e.rag) } },
      { text: e.score, options: { color: LIGHT } },
      { text: e.totalAssigned, options: { color: LIGHT } },
      { text: e.completed, options: { color: LIGHT } },
      { text: `${e.completionPct}%`, options: { color: LIGHT } },
      { text: `${e.variance >= 0 ? '+' : ''}${e.variance}h`, options: { color: LIGHT } },
      { text: `${e.efficiencyPct}%`, options: { color: LIGHT } },
      { text: e.workloadStatus, options: { color: LIGHT } }
    ]);
    tableSlide('Delivery Team Performance (RAG)',
      ['Employee', 'Designation', 'RAG', 'Score', 'Assigned', 'Done', 'Comp %', 'Var', 'Eff %', 'WLoad'],
      empRows,
      [1.9, 1.7, 0.8, 0.8, 0.9, 0.8, 1.0, 1.0, 0.9, 1.5],
      7
    );

    // 6. Projects/Clients
    const projRows = report.projectRows().map(p => [
      { text: p.name, options: { color: LIGHT } },
      { text: p.taskCount, options: { color: LIGHT } },
      { text: p.completedCount, options: { color: LIGHT } },
      { text: `${p.completionPct}%`, options: { color: LIGHT } },
      { text: `${p.estHours}h`, options: { color: LIGHT } },
      { text: `${p.actHours}h`, options: { color: LIGHT } },
      { text: `${p.variance >= 0 ? '+' : ''}${p.variance}h`, options: { color: LIGHT } },
      { text: p.rag, options: { bold: true, color: ragPptx(p.rag) } },
      { text: (p.assignedOwners || []).join(', '), options: { color: LIGHT } }
    ]);
    tableSlide('Project / Client Breakdown',
      ['Project / Client', 'Tasks', 'Done', 'Comp %', 'Est', 'Act', 'Var', 'RAG', 'Owners'],
      projRows,
      [2.8, 0.7, 0.8, 0.9, 0.8, 0.8, 0.9, 0.7, 2.5],
      6
    );

    // 7. Task Breakdown
    const taskRows = report.taskRows().map(t => [
      { text: t.idx, options: { color: LIGHT } },
      { text: t.item, options: { color: LIGHT } },
      { text: t.priority, options: { color: LIGHT } },
      { text: t.owner, options: { color: LIGHT } },
      { text: `${t.est}h`, options: { color: LIGHT } },
      { text: `${t.act}h`, options: { color: LIGHT } },
      { text: `${t.variance >= 0 ? '+' : ''}${t.variance}h`, options: { color: LIGHT } },
      { text: t.status, options: { color: LIGHT } }
    ]);
    tableSlide('Task Breakdown',
      ['#', 'Task / Activity', 'Priority', 'Owner', 'Est', 'Act', 'Var', 'Status'],
      taskRows,
      [0.5, 3.8, 0.9, 1.8, 0.7, 0.7, 0.9, 1.0],
      9
    );

    // 8. Retrospective
    const s8a = newSlide('Retrospective: Wins & Learnings');
    function addBulletBox(slide, label, items, xx, yy, ww, hh) {
      slide.addText(label, { x: xx, y: yy, w: ww, h: 0.4, fontSize: 14, bold: true, color: LIGHT });
      const text = items.map(s => `• ${s}`).join('\n\n');
      slide.addText(text, {
        x: xx, y: yy + 0.45, w: ww, h: hh,
        fontSize: 10, color: LIGHT, lineSpacing: 18
      });
    }
    addBulletBox(s8a, 'What Went Well', report.wellRows(), 0.5, 1.2, 5.9, 5.0);
    addBulletBox(s8a, 'What Did Not Go Well', report.didntRows(), 6.7, 1.2, 5.9, 5.0);

    const s8b = newSlide('Retrospective: Learnings, Risks & Improvements');
    addBulletBox(s8b, 'Key Learnings', report.learningRows(), 0.5, 1.2, 3.8, 5.0);
    addBulletBox(s8b, 'Improvements', report.improvementRows(), 4.5, 1.2, 3.8, 5.0);
    addBulletBox(s8b, 'Retrospective Risks', report.retroRiskRows(), 8.5, 1.2, 4.0, 5.0);

    // 9. Action Items
    const actionRows = report.actionRows().map(a => [
      { text: a.action, options: { color: LIGHT } },
      { text: a.owner, options: { color: LIGHT } },
      { text: a.priority, options: { color: LIGHT } },
      { text: a.outcome, options: { color: LIGHT } }
    ]);
    tableSlide('Action Items',
      ['Action Item', 'Owner', 'Priority', 'Expected Outcome'],
      actionRows,
      [4.0, 1.5, 1.0, 4.0],
      8
    );

    // 10. Next Sprint
    const s10 = newSlide('Next Sprint Focus');
    const focus = [
      `Sprint ${report.sprint.name || ''} has an overall health of ${report.rag} (${report.ragScore}/100).`,
      `Completion rate is ${report.metrics.completionPct ?? 0}% and efficiency is ${report.metrics.efficiencyPct ?? 0}%.`,
      `${report.actionRows().length} action items are planned for the next sprint.`,
      `Key priorities: ${(report.priorities || []).map(p => p.name).join(', ') || 'None'}.`
    ];
    s10.addText(focus.join('\n\n'), { x: 0.5, y: 1.2, w: 12.3, h: 5.0, fontSize: 13, color: LIGHT, lineSpacing: 22 });

    // 11. Final
    const s11 = newSlide('Final Summary');
    s11.addText(report.summary, { x: 0.5, y: 1.2, w: 12.3, h: 4.5, fontSize: 13, color: LIGHT, lineSpacing: 22 });
    s11.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 6.0, w: 12.3, h: 0.9, fill: { color: RED } });
    s11.addText(`OVERALL HEALTH: ${report.rag} (${report.ragScore}/100)  |  Completion: ${report.metrics.completionPct ?? 0}%`, {
      x: 0.5, y: 6.15, w: 12.3, h: 0.6, fontSize: 16, bold: true, color: LIGHT, align: 'center'
    });

    pptx.writeFile({ fileName: report.filenames().ppt });
  }

  // app.js currently calls exportPPTX - keep this alias
  static exportPPTX(...args) {
    return this.exportPPT(...args);
  }
}

window.SprintExporter = SprintExporter;
