/**
 * SprintIQ - Google Sheets Import Adapter
 *
 * Fetches a Google Sheet CSV (via the local server proxy), scans for the
 * "Team Capacity Planning" and "Ongoing Sprint" sections, extracts the sprint
 * team and tasks, then normalizes them into the same sprint object used by the
 * existing Excel/CSV pipeline.
 *
 * This is a SOURCE ADAPTER only. All analysis, RAG, capacity/utilization and
 * report generation continue to use the existing SprintAnalytics engine.
 */

class GoogleSheetParser {
  constructor() {
    this.rawRows = [];
    this.title = '';
    this.subtitle = '';
    this.team = [];
    this.tasks = [];
    this.sections = [];
    this.errors = [];
  }

  /**
   * Entry point: parse a raw 2D array (rows of cells) from a Google Sheet.
   */
  parseGrid(rows) {
    this.rawRows = (rows || []).map(r => Array.isArray(r) ? r : [r]);
    this.sections = this.findSections(this.rawRows);
    this.extractMetadata(this.rawRows, this.sections);
    this.parseTeamCapacity();
    this.parseOngoingSprint();
    return this;
  }

  findSections(rows) {
    const sections = [];
    const sectionKeywords = {
      'team capacity': 'team',
      'ongoing sprint': 'sprint',
      'sprint backlog': 'sprint',
      'sprint tasks': 'sprint'
    };

    rows.forEach((row, idx) => {
      const line = row.map(c => String(c || '').trim().toLowerCase()).join(' ');
      if (line.includes('total') || line.includes('summary') || line.length === 0) return;
      Object.keys(sectionKeywords).forEach(key => {
        if (line.includes(key)) {
          sections.push({ type: sectionKeywords[key], startRow: idx, name: row.map(c => String(c || '').trim()).filter(Boolean).join(' ') });
        }
      });
    });
    return sections;
  }

  extractMetadata(rows, sections) {
    // First few non-empty rows before any section are usually title / subtitle
    const firstSectionStart = sections.length > 0 ? sections[0].startRow : rows.length;
    const headerLines = [];
    for (let i = 0; i < Math.min(8, firstSectionStart); i++) {
      const line = rows[i].map(c => String(c || '').trim()).filter(Boolean).join(' ');
      if (line) headerLines.push(line);
    }

    if (headerLines.length > 0) {
      this.title = headerLines[0];
      this.subtitle = headerLines.slice(1).join(' — ');
    }

    const combined = `${this.title} ${this.subtitle}`;
    const dateMatch = combined.match(/(\d{1,2})\/(\d{1,2})(?:\s*[–-]\s*(\d{1,2})\/(\d{1,2}))?/);
    if (dateMatch) {
      const d1 = this.parseDateDM(dateMatch[1], dateMatch[2]);
      const d2 = this.parseDateDM(dateMatch[3] || dateMatch[1], dateMatch[4] || dateMatch[2]);
      this.startDate = d1 ? d1.toISOString().slice(0, 10) : '';
      this.endDate = d2 ? d2.toISOString().slice(0, 10) : '';
    }
  }

  parseDateDM(day, month) {
    const now = new Date();
    const y = now.getFullYear();
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    if (!d || !m || m > 12) return null;
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return null;
    return date;
  }

  parseTeamCapacity() {
    const section = this.sections.find(s => s.type === 'team');
    if (!section) {
      this.errors.push('Team Capacity Planning section not found.');
      return;
    }

    const rows = this.rawRows.slice(section.startRow + 1);
    const { headerRow, dataRows } = this.findHeaderAndData(rows, [
      { key: 'member', names: ['member', 'name', 'employee', 'resource', 'person'] },
      { key: 'role', names: ['role', 'designation', 'position', 'job title'] },
      { key: 'workingDays', names: ['working days', 'days', 'working'] },
      { key: 'leaveDays', names: ['leave', 'leave (days)', 'leave days'] },
      { key: 'hoursPerDay', names: ['hrs', 'hours', 'hours per day', 'daily hours'] },
      { key: 'capacityHours', names: ['capacity (hrs)', 'capacity', 'capacity (hours)', 'total'] }
    ]);

    if (!headerRow) {
      this.errors.push('Could not identify Team Capacity Planning columns.');
      return;
    }

    dataRows.forEach(row => {
      const name = this.cell(row, headerRow.member);
      if (!name || this.isTotalRow(row)) return;

      const role = this.cell(row, headerRow.role) || 'Team Member';
      const workingDays = this.num(row, headerRow.workingDays);
      const leaveDays = this.num(row, headerRow.leaveDays);
      const hoursPerDay = this.num(row, headerRow.hoursPerDay);
      const capacityHours = this.num(row, headerRow.capacityHours);

      this.team.push({
        name,
        role,
        workingDays,
        leaveDays,
        hoursPerDay,
        capacityHours
      });
    });
  }

  parseOngoingSprint() {
    const section = this.sections.find(s => s.type === 'sprint');
    if (!section) {
      this.errors.push('Ongoing Sprint / Sprint Backlog section not found.');
      return;
    }

    const rows = this.rawRows.slice(section.startRow + 1);
    const { headerRow, dataRows } = this.findHeaderAndData(rows, [
      { key: 'number', names: ['#', 'no', 'no.', 'id', 'task', 'task number'] },
      { key: 'item', names: ['item', 'task', 'summary', 'description', 'title', 'activity'] },
      { key: 'priority', names: ['priority', 'prio', 'severity'] },
      { key: 'owners', names: ['owner(s)', 'owner', 'owners', 'assignee', 'assignees', 'resource', 'developer'] },
      { key: 'est', names: ['est', 'est.', 'est. (hrs)', 'estimated', 'estimate', 'planned'] },
      { key: 'status', names: ['status', 'state', 'stage', 'progress'] }
    ]);

    if (!headerRow) {
      this.errors.push('Could not identify Ongoing Sprint columns.');
      return;
    }

    dataRows.forEach(row => {
      const item = this.cell(row, headerRow.item);
      if (!item || this.isTotalRow(row)) return;

      const number = this.cell(row, headerRow.number) || '';
      const priority = SprintParser.normalizePriority(this.cell(row, headerRow.priority));
      const owners = this.parseOwners(this.cell(row, headerRow.owners));
      const est = SprintParser.normalizeHours(this.cell(row, headerRow.est));
      const status = SprintParser.normalizeStatus(this.cell(row, headerRow.status));

      // Actual hours are not provided in a planning sheet; default to 0
      const act = 0;

      this.tasks.push({
        id: number ? String(number).trim() : String(this.tasks.length + 1),
        item: item,
        priority,
        owner: owners[0] || 'Unassigned',
        owners,
        est,
        act,
        status,
        sourceRow: row
      });
    });
  }

  findHeaderAndData(rows, expected) {
    let headerRow = null;
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const candidate = rows[i];
      if (!candidate || candidate.every(c => !String(c || '').trim())) continue;
      const mapping = this.matchHeader(candidate, expected);
      if (mapping && Object.keys(mapping).length >= 3) {
        headerRow = mapping;
        headerIdx = i;
        break;
      }
    }
    if (!headerRow) return { headerRow: null, dataRows: [] };

    const dataRows = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(c => !String(c || '').trim())) continue;
      if (this.isTotalRow(row)) continue;
      if (this.isSectionHeader(row)) break;
      dataRows.push(row);
    }
    return { headerRow, dataRows };
  }

  matchHeader(row, expected) {
    const mapping = {};
    const used = new Set();
    const normalized = row.map((c, idx) => ({ idx, val: String(c || '').trim().toLowerCase().replace(/[\s_.()-]/g, '') }));

    expected.forEach(field => {
      normalized.forEach(n => {
        if (mapping[field.key] !== undefined) return;
        for (const name of field.names) {
          const nameNorm = name.toLowerCase().replace(/[\s_.()-]/g, '');
          if (used.has(n.idx)) continue;
          if (n.val === nameNorm || n.val.includes(nameNorm) || (nameNorm.length > 2 && nameNorm.includes(n.val))) {
            mapping[field.key] = n.idx;
            used.add(n.idx);
            break;
          }
        }
      });
    });
    return mapping;
  }

  isTotalRow(row) {
    const line = row.map(c => String(c || '').trim().toLowerCase()).join(' ');
    return line.includes('total') || line.includes('capacity') && line.includes('team');
  }

  isSectionHeader(row) {
    const line = row.map(c => String(c || '').trim().toLowerCase()).join(' ');
    const keywords = ['team capacity', 'ongoing sprint', 'sprint backlog', 'sprint tasks', 'notes', 'appendix'];
    return keywords.some(k => line.includes(k));
  }

  cell(row, idx) {
    if (idx === undefined || idx === -1 || !row) return '';
    return String(row[idx] || '').trim();
  }

  num(row, idx) {
    const v = this.cell(row, idx);
    if (v === '') return 0;
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  parseOwners(val) {
    if (!val) return [];
    return String(val)
      .split(/[,\/|&;]+/)
      .map(s => s.trim())
      .filter(s => s);
  }
}

class GoogleSheetAdapter {
  static toSprint(parsed, spreadsheetId = '', sheetName = '') {
    const team = parsed.team || [];
    const tasks = parsed.tasks || [];

    const totalCapacity = team.reduce((s, m) => s + m.capacityHours, 0);
    const totalAllocated = tasks.reduce((s, t) => s + t.est, 0);
    const totalActual = tasks.reduce((s, t) => s + t.act, 0);
    const deliveryTeam = team.filter(m => {
      const profile = window.SprintIQTeam ? window.SprintIQTeam.resolve(m.name) : null;
      return profile ? profile.is_delivery_resource : true;
    });

    const name = parsed.title
      ? `${parsed.title}${parsed.subtitle ? ' — ' + parsed.subtitle : ''}`
      : `Imported Sprint (${new Date().toLocaleDateString()})`;

    return {
      id: `sprint-${Date.now()}`,
      name,
      startDate: parsed.startDate || new Date().toISOString().slice(0, 10),
      endDate: parsed.endDate || new Date().toISOString().slice(0, 10),
      status: 'Active',
      description: `Imported from Google Sheets. ${team.length} team members, ${tasks.length} tasks.`,
      importSource: 'Google Sheets',
      importSheetName: sheetName,
      importSpreadsheetId: spreadsheetId,
      importedAt: new Date().toISOString(),
      tasks: tasks,
      gsheetTeam: team.map(m => {
        const profile = window.SprintIQTeam ? window.SprintIQTeam.resolve(m.name) : null;
        return {
          ...m,
          designation: profile ? profile.designation : m.role,
          sprintRole: profile ? profile.sprint_role : 'Team Member',
          resourceType: profile ? profile.resource_type : 'Delivery',
          isDeliveryResource: profile ? profile.is_delivery_resource : true,
          isScrumMaster: profile ? profile.is_scrum_master : false
        };
      }),
      capacity: {
        totalCapacity: Math.round(totalCapacity * 10) / 10,
        totalAllocated: Math.round(totalAllocated * 10) / 10,
        totalActual: Math.round(totalActual * 10) / 10,
        remainingCapacity: Math.round((totalCapacity - totalAllocated) * 10) / 10,
        deliveryCapacity: deliveryTeam.reduce((s, m) => s + m.capacityHours, 0),
        teamSize: team.length,
        deliveryTeamSize: deliveryTeam.length
      }
    };
  }
}

window.GoogleSheetParser = GoogleSheetParser;
window.GoogleSheetAdapter = GoogleSheetAdapter;
