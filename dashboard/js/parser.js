/**
 * SprintIQ - File Parser & Data Normalizer
 * Reads XLSX, XLS, CSV files, normalizes flexible hour formats, validates records, and maps columns.
 */

class SprintParser {
  constructor() {
    this.rawWorksheet = null;
    this.rawRows = [];
    this.detectedHeaders = [];
    this.columnMapping = {
      id: -1,
      item: -1,
      priority: -1,
      owner: -1,
      est: -1,
      act: -1,
      status: -1
    };
    this.validationReport = {
      totalRows: 0,
      validRows: 0,
      warningRows: [],
      duplicateRows: [],
      missingFields: 0
    };
  }

  /**
   * Universal hour normalizer.
   * Handles: '16h', '2 hr 30 min', '1 hr', '90 min', '2.5h', '3h 15m', '45m', '02:30', '1.75', 18, etc.
   * Returns decimal number of hours, or 0 if unparseable.
   */
  static normalizeHours(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') {
      return isNaN(val) ? 0 : Math.round(val * 100) / 100;
    }

    let str = String(val).trim().toLowerCase();
    if (!str) return 0;

    // Direct decimal number (e.g., '14.5' or '14,5')
    if (/^[-+]?\d+([.,]\d+)?$/.test(str)) {
      const parsed = parseFloat(str.replace(',', '.'));
      return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
    }

    // HH:MM format (e.g. '02:30' or '2:15')
    const timeMatch = str.match(/^(\d+):(\d{1,2})$/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      return Math.round((h + m / 60) * 100) / 100;
    }

    let totalHours = 0;
    let matchedAny = false;

    // Pattern for hours: '2h', '2 hrs', '2.5 hours', '2 hr'
    const hrMatch = str.match(/(\d+(?:[.,]\d+)?)\s*(?:hrs?|hours?|h)(?:\b|\d|\s|$)/i);
    if (hrMatch) {
      totalHours += parseFloat(hrMatch[1].replace(',', '.'));
      matchedAny = true;
    }

    // Pattern for minutes: '30m', '30 mins', '90 min', '45 minutes'
    const minMatch = str.match(/(\d+(?:[.,]\d+)?)\s*(?:mins?|minutes?|m)(?:\b|\d|\s|$)/i);
    if (minMatch) {
      const mins = parseFloat(minMatch[1].replace(',', '.'));
      totalHours += mins / 60;
      matchedAny = true;
    }

    // Pattern like '2d' (days -> 8h/day standard if specified)
    const dayMatch = str.match(/(\d+(?:[.,]\d+)?)\s*(?:days?|d)(?:\b|\s|$)/i);
    if (dayMatch && !hrMatch && !minMatch) {
      totalHours += parseFloat(dayMatch[1].replace(',', '.')) * 8;
      matchedAny = true;
    }

    if (!matchedAny) {
      // Fallback: extract first valid floating number
      const fallbackNum = str.match(/[-+]?\d+(?:[.,]\d+)?/);
      if (fallbackNum) {
        totalHours = parseFloat(fallbackNum[0].replace(',', '.'));
      }
    }

    return isNaN(totalHours) ? 0 : Math.round(totalHours * 100) / 100;
  }

  /**
   * Normalizes Priority strings to High | Medium | Low
   */
  static normalizePriority(val) {
    if (!val) return 'Medium';
    const s = String(val).trim().toLowerCase();
    if (s.includes('crit') || s.includes('urg') || s.includes('high') || s.includes('p1') || s.includes('p0')) return 'High';
    if (s.includes('low') || s.includes('minor') || s.includes('p3') || s.includes('p4')) return 'Low';
    return 'Medium';
  }

  /**
   * Normalizes Status strings to standard Sprint statuses: Completed | In Progress | Pending | Blocked | Cancelled
   */
  static normalizeStatus(val) {
    if (!val) return 'Pending';
    const s = String(val).trim().toLowerCase();
    if (s.includes('done') || s.includes('comp') || s.includes('close') || s.includes('finish') || s.includes('resolved')) return 'Completed';
    if (s.includes('prog') || s.includes('wip') || s.includes('dev') || s.includes('doing') || s.includes('active')) return 'In Progress';
    if (s.includes('block') || s.includes('hold') || s.includes('stuck') || s.includes('impediment')) return 'Blocked';
    if (s.includes('canc') || s.includes('drop') || s.includes('reject') || s.includes('obsolete')) return 'Cancelled';
    return 'Pending';
  }

  /**
   * Parse an ArrayBuffer / Binary String / File using SheetJS
   */
  async parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          this._readWorkbook(data, file.name);
          resolve(this);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Parse CSV text (e.g. from a Google Sheets export) into the same 2D grid.
   */
  parseCsvText(csvText, sourceName = 'Google Sheet') {
    const bytes = new TextEncoder().encode(csvText);
    this._readWorkbook(bytes, sourceName);
    return this;
  }

  _readWorkbook(bytes, sourceName) {
    const workbook = XLSX.read(bytes, { type: 'array', cellDates: true, cellNF: false });
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('The uploaded file contains no data.');
    }
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const raw2D = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!raw2D || raw2D.length === 0) {
      throw new Error('The imported sheet contains no data.');
    }

    this.processRawGrid(raw2D, sourceName);
    return this;
  }

  /**
   * Process 2D Array of rows, identify header row and initial mapping
   */
  processRawGrid(grid, fileName) {
    this.rawRows = grid;
    let headerRowIdx = -1;
    let bestScore = 0;

    // Inspect first 15 rows to find the one with the highest header keyword match
    for (let r = 0; r < Math.min(15, grid.length); r++) {
      const row = grid[r];
      if (!Array.isArray(row)) continue;
      let score = 0;
      const joined = row.map(c => String(c).toLowerCase()).join(' ');

      if (joined.includes('item') || joined.includes('task') || joined.includes('activity') || joined.includes('summary')) score += 3;
      if (joined.includes('owner') || joined.includes('assignee') || joined.includes('resource') || joined.includes('dev')) score += 3;
      if (joined.includes('est') || joined.includes('planned') || joined.includes('estimate')) score += 2;
      if (joined.includes('act') || joined.includes('spent') || joined.includes('effort')) score += 2;
      if (joined.includes('status') || joined.includes('state') || joined.includes('stage')) score += 2;
      if (joined.includes('prio') || joined.includes('severity') || joined.includes('urgency')) score += 2;
      if (joined.includes('#') || joined.includes('id') || joined.includes('no')) score += 1;

      if (score > bestScore) {
        bestScore = score;
        headerRowIdx = r;
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0;
    }

    this.headerRowIndex = headerRowIdx;
    this.detectedHeaders = (grid[headerRowIdx] || []).map((h, idx) => {
      const str = String(h).trim();
      return str || `Column ${idx + 1}`;
    });

    this.autoDetectColumns();
  }

  /**
   * Auto-map columns based on header strings
   */
  autoDetectColumns() {
    this.columnMapping = {
      id: -1,
      item: -1,
      priority: -1,
      owner: -1,
      est: -1,
      act: -1,
      status: -1
    };

    this.detectedHeaders.forEach((header, colIdx) => {
      const h = header.toLowerCase().replace(/[\s_.-]/g, '');
      
      // ID
      if (this.columnMapping.id === -1 && (h === '#' || h === 'id' || h === 'taskid' || h === 'no' || h === 'sno' || h === 'itemno')) {
        this.columnMapping.id = colIdx;
      }
      // Item / Task Name
      else if (this.columnMapping.item === -1 && (h.includes('item') || h.includes('task') || h.includes('activity') || h.includes('summary') || h.includes('description') || h.includes('title') || h.includes('name'))) {
        this.columnMapping.item = colIdx;
      }
      // Priority
      else if (this.columnMapping.priority === -1 && (h.includes('prior') || h.includes('severity') || h.includes('urgency') || h.includes('prio'))) {
        this.columnMapping.priority = colIdx;
      }
      // Owner(s)
      else if (this.columnMapping.owner === -1 && (h.includes('owner') || h.includes('assignee') || h.includes('resource') || h.includes('employee') || h.includes('person') || h.includes('dev') || h.includes('member'))) {
        this.columnMapping.owner = colIdx;
      }
      // Estimated Hours
      else if (this.columnMapping.est === -1 && (h.includes('est') || h.includes('plan') || h.includes('budget') || h.includes('target') || h.includes('quoted'))) {
        this.columnMapping.est = colIdx;
      }
      // Actual Hours
      else if (this.columnMapping.act === -1 && (h.includes('act') || h.includes('spent') || h.includes('time') || h.includes('effort') || h.includes('logged') || h.includes('consumed'))) {
        this.columnMapping.act = colIdx;
      }
      // Status
      else if (this.columnMapping.status === -1 && (h.includes('stat') || h.includes('state') || h.includes('stage') || h.includes('progress') || h.includes('condition'))) {
        this.columnMapping.status = colIdx;
      }
    });

    // Fallbacks if not detected
    if (this.columnMapping.item === -1 && this.detectedHeaders.length > 1) {
      this.columnMapping.item = 1;
    }
  }

  /**
   * Updates user-selected column mappings
   */
  setMapping(field, colIdx) {
    this.columnMapping[field] = parseInt(colIdx, 10);
  }

  /**
   * Validate and extract structured tasks based on current column mapping
   */
  extractTasks() {
    const tasks = [];
    const seenItems = new Map();
    const warnings = [];
    let missingFieldsCount = 0;

    const dataRows = this.rawRows.slice(this.headerRowIndex + 1);

    dataRows.forEach((row, rowIdx) => {
      if (!row || row.every(cell => cell === '' || cell === null || cell === undefined)) {
        return; // skip completely empty rows
      }

      const rawId = this.columnMapping.id !== -1 ? row[this.columnMapping.id] : null;
      const rawItem = this.columnMapping.item !== -1 ? row[this.columnMapping.item] : '';
      const rawPriority = this.columnMapping.priority !== -1 ? row[this.columnMapping.priority] : 'Medium';
      const rawOwner = this.columnMapping.owner !== -1 ? row[this.columnMapping.owner] : 'Unassigned';
      const rawEst = this.columnMapping.est !== -1 ? row[this.columnMapping.est] : 0;
      const rawAct = this.columnMapping.act !== -1 ? row[this.columnMapping.act] : 0;
      const rawStatus = this.columnMapping.status !== -1 ? row[this.columnMapping.status] : 'Pending';

      const itemStr = String(rawItem || '').trim();
      if (!itemStr) {
        warnings.push({ row: rowIdx + 1, message: 'Row skipped: Task/Item description is empty.' });
        return;
      }

      const ownerStr = String(rawOwner || '').trim() || 'Unassigned';
      if (ownerStr === 'Unassigned') missingFieldsCount++;

      const estHours = SprintParser.normalizeHours(rawEst);
      const actHours = SprintParser.normalizeHours(rawAct);
      const priority = SprintParser.normalizePriority(rawPriority);
      const status = SprintParser.normalizeStatus(rawStatus);

      // Check for duplicate items
      const itemKey = `${itemStr.toLowerCase()}__${ownerStr.toLowerCase()}`;
      let isDuplicate = false;
      if (seenItems.has(itemKey)) {
        isDuplicate = true;
        warnings.push({
          row: rowIdx + 1,
          type: 'duplicate',
          message: `Duplicate task detected: "${itemStr}" assigned to ${ownerStr}.`
        });
      } else {
        seenItems.set(itemKey, true);
      }

      // Check hour anomalies
      if (estHours === 0 && actHours === 0) {
        warnings.push({
          row: rowIdx + 1,
          type: 'zero_hours',
          message: `Task "${itemStr}" has 0 estimated and 0 actual hours.`
        });
      }

      tasks.push({
        id: rawId ? String(rawId).trim() : String(tasks.length + 1),
        item: itemStr,
        priority: priority,
        owner: ownerStr,
        est: estHours,
        act: actHours,
        status: status,
        rawEst: rawEst,
        rawAct: rawAct,
        isDuplicate: isDuplicate
      });
    });

    this.validationReport = {
      totalRows: dataRows.length,
      validRows: tasks.length,
      warningRows: warnings,
      duplicateRows: warnings.filter(w => w.type === 'duplicate'),
      missingFields: missingFieldsCount
    };

    return { tasks, validation: this.validationReport };
  }
}

window.SprintParser = SprintParser;
