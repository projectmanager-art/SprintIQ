/**
 * SprintIQ - Application Master Controller
 * Handles application lifecycle, UI views, event bindings, modals, filters, and rendering.
 */

class SprintIQApp {
  constructor() {
    this.sprints = [];
    this.activeSprintId = null;
    this.activeAnalysis = null;
    this.currentView = 'view-overview';
    this.filters = {
      owner: '',
      project: '',
      priority: '',
      status: '',
      rag: '',
      search: ''
    };
    this.currentParser = null;
    this.currentSprint = null;
    this.importMode = 'file'; // 'file' | 'gsheet'
    this.importState = 'idle'; // 'idle' | 'fetched'
    this.importMeta = { source: '', fileName: '', sheetName: '', spreadsheetId: '' };
    this.empViewMode = 'cards'; // 'cards' | 'table'
    this.taskPage = 1;
    this.tasksPerPage = 10;
    this.projectPage = 1;
    this.projectsPerPage = 10;

    this.init();
  }

  async init() {
    this.loadInitialSprints();
    this.bindEvents();
    this.renderSprintSelector();
    this.switchSprint(this.sprints[0].id);
    this.initIcons();
    this.initStaggeredNav();
  }

  initStaggeredNav() {
    // Set stagger index for animated hamburger navigation links
    document.querySelectorAll('.nav-link').forEach((link, i) => {
      link.style.setProperty('--i', i);
    });
  }

  initIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }


  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i data-lucide="${type === 'success' ? 'check-circle' : (type === 'warning' ? 'alert-circle' : 'x-circle')}"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    this.initIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  loadInitialSprints() {
    try {
      const saved = localStorage.getItem('sprintiq_custom_sprints');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.sprints = parsed;
          return;
        }
      }
    } catch (e) {}

    // Fallback to sample sprints
    this.sprints = window.SprintIQSampleData.getSampleSprints();
  }

  saveCustomSprints() {
    try {
      localStorage.setItem('sprintiq_custom_sprints', JSON.stringify(this.sprints));
    } catch (e) {}
  }

  renderSprintSelector() {
    const select = document.getElementById('active-sprint-select');
    if (!select) return;

    select.innerHTML = '';
    this.sprints.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      if (s.id === this.activeSprintId) opt.selected = true;
      select.appendChild(opt);
    });
  }

  switchSprint(sprintId) {
    const sprint = this.sprints.find(s => s.id === sprintId) || this.sprints[0];
    if (!sprint) return;

    this.activeSprintId = sprint.id;
    
    // Update sidebar indicator
    const sidebarLabel = document.getElementById('sidebar-sprint-name');
    if (sidebarLabel) sidebarLabel.textContent = sprint.name;

    // Reset filters
    this.resetFilters(false);

    // Run Analytics
    this.runAnalysis();
    this.renderActiveView();
  }

  runAnalysis() {
    this.taskPage = 1; // Reset pagination when filters or sprint data changes
    this.projectPage = 1;

    const sprint = this.sprints.find(s => s.id === this.activeSprintId);
    if (!sprint) return;

    // Apply global filter on sprint tasks
    let filteredTasks = [...(sprint.tasks || [])];

    if (this.filters.owner) {
      filteredTasks = filteredTasks.filter(t => t.owner === this.filters.owner);
    }
    if (this.filters.priority) {
      filteredTasks = filteredTasks.filter(t => (t.priority || '').toLowerCase() === this.filters.priority.toLowerCase());
    }
    if (this.filters.status) {
      filteredTasks = filteredTasks.filter(t => (t.status || '').toLowerCase() === this.filters.status.toLowerCase());
    }
    if (this.filters.search) {
      const q = this.filters.search.toLowerCase();
      filteredTasks = filteredTasks.filter(t => 
        (t.item || '').toLowerCase().includes(q) ||
        (t.owner || '').toLowerCase().includes(q)
      );
    }

    const filteredSprint = {
      ...sprint,
      tasks: filteredTasks
    };

    this.analysisVersion = Date.now();
    this.activeAnalysis = window.SprintAnalytics.analyzeSprint(filteredSprint, window.SprintIQConfig.get(), this.analysisVersion);

    if (this.activeAnalysis && this.activeAnalysis.retrospective) {
      if (this.activeAnalysis.retrospective.__analysisVersion !== this.analysisVersion) {
        this.activeAnalysis.retrospective.__validationStatus = 'FAILED';
        this.activeAnalysis.retrospective.__validationErrors = ['Retrospective analysisVersion is stale or does not match.'];
      }
    }

    // Update filter dropdown options based on master sprint tasks
    this.populateFilterDropdowns(sprint.tasks || []);

    // Update match count badge
    const countBadge = document.getElementById('filtered-count-badge');
    if (countBadge) {
      countBadge.textContent = `Showing ${filteredTasks.length} of ${(sprint.tasks || []).length} tasks`;
    }
  }

  populateFilterDropdowns(allTasks) {
    const ownerSelect = document.getElementById('filter-owner');
    const projectSelect = document.getElementById('filter-project');

    if (ownerSelect) {
      const currentVal = ownerSelect.value;
      const team = window.SprintIQTeam;
      const owners = Array.from(new Set(allTasks.map(t => t.owner).filter(Boolean))).sort();
      ownerSelect.innerHTML = '<option value="">All Employees</option>' + owners.map(o => {
        const profile = team ? team.resolve(o) : null;
        const displayName = profile ? profile.employee_name : o;
        const designation = profile ? profile.designation : 'Unlisted Resource';
        const label = `${displayName} — ${designation}`;
        return `<option value="${o}" ${o === currentVal ? 'selected' : ''}>${label}</option>`;
      }).join('');
    }

    if (projectSelect) {
      const currentVal = projectSelect.value;
      const projects = Array.from(new Set(allTasks.map(t => {
        const item = t.item || '';
        return item.includes('|') ? item.split('|')[0].trim() : (item.includes('-') ? item.split('-')[0].trim() : 'General');
      }))).sort();
      projectSelect.innerHTML = '<option value="">All Projects</option>' + projects.map(p => `<option value="${p}" ${p === currentVal ? 'selected' : ''}>${p}</option>`).join('');
    }
  }

  resetFilters(reAnalyze = true) {
    this.filters = {
      owner: '',
      project: '',
      priority: '',
      status: '',
      rag: '',
      search: ''
    };

    ['filter-owner', 'filter-project', 'filter-priority', 'filter-status', 'filter-rag', 'global-search-input'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    if (reAnalyze) {
      this.runAnalysis();
      this.renderActiveView();
    }
  }

  bindEvents() {
    // Navigation Links
    const sidebar = document.getElementById('app-sidebar');
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = link.getAttribute('data-view');
        this.switchView(targetView);
        if (sidebar && window.innerWidth <= 768) {
          sidebar.classList.remove('open');
        }
      });
    });

    // Mobile Sidebar Toggle
    const mobileToggle = document.getElementById('mobile-nav-toggle');
    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    // Sprint Select
    const sprintSelect = document.getElementById('active-sprint-select');
    if (sprintSelect) {
      sprintSelect.addEventListener('change', (e) => {
        this.switchSprint(e.target.value);
      });
    }

    // Filter Change Events
    const filterIds = ['filter-owner', 'filter-project', 'filter-priority', 'filter-status', 'filter-rag'];
    filterIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          this.filters.owner = document.getElementById('filter-owner').value;
          this.filters.priority = document.getElementById('filter-priority').value;
          this.filters.status = document.getElementById('filter-status').value;
          this.runAnalysis();
          this.renderActiveView();
        });
      }
    });

    // Global Search
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value.trim();
        this.runAnalysis();
        this.renderActiveView();
      });
    }

    // Reset Filters Button
    const btnReset = document.getElementById('btn-reset-filters');
    if (btnReset) {
      btnReset.addEventListener('click', () => this.resetFilters(true));
    }

    // Toggle Employee Cards / Table View
    const btnToggleEmp = document.getElementById('btn-toggle-emp-view');
    if (btnToggleEmp) {
      btnToggleEmp.addEventListener('click', () => {
        this.empViewMode = this.empViewMode === 'cards' ? 'table' : 'cards';
        this.renderEmployeeRAG();
      });
    }

    // Upload Modal Bindings
    this.bindUploadModalEvents();

    // Export Action Bindings
    this.bindExportEvents();

    // Settings Bindings
    this.bindSettingsEvents();

    // Retrospective Copy Binding
    const btnCopyRetro = document.getElementById('btn-copy-retro');
    if (btnCopyRetro) {
      btnCopyRetro.addEventListener('click', () => {
        if (!this.activeAnalysis) return;
        const sm = this.activeAnalysis.leadership.scrumMaster;
        const text = `SPRINT RETROSPECTIVE: ${this.activeAnalysis.sprint.name}\n\n` +
          `SPRINT LEADERSHIP:\nScrum Master: ${sm ? sm.name : 'Not assigned'}${sm ? `\nDesignation: ${sm.designation}` : ''}\n\n` +
          `OVERALL HEALTH: ${this.activeAnalysis.metrics.rag} (Score: ${this.activeAnalysis.metrics.ragScore}/100)\n\n` +
          `EXECUTIVE SUMMARY:\n${this.activeAnalysis.retrospective.summary}\n\n` +
          `WHAT WENT WELL:\n${this.activeAnalysis.retrospective.whatWentWell.map(w => `- ${w}`).join('\n')}\n\n` +
          `WHAT DID NOT GO WELL:\n${this.activeAnalysis.retrospective.whatDidNotGoWell.map(w => `- ${w}`).join('\n')}\n\n` +
          `NEXT SPRINT ACTIONS:\n${this.activeAnalysis.retrospective.nextSprintActions.map(a => `- [${a.priority}] ${a.action} (${a.owner}) -> ${a.outcome}`).join('\n')}`;
        
        navigator.clipboard.writeText(text).then(() => {
          this.showToast('Retrospective copied to clipboard!');
        });
      });
    }

    // Task Analysis Pagination Bindings
    const btnTaskPrev = document.getElementById('btn-task-prev');
    const btnTaskNext = document.getElementById('btn-task-next');

    if (btnTaskPrev) {
      btnTaskPrev.addEventListener('click', () => {
        if (this.taskPage > 1) {
          this.taskPage--;
          this.renderTaskAnalysis();
          this.initIcons();
        }
      });
    }

    if (btnTaskNext) {
      btnTaskNext.addEventListener('click', () => {
        if (!this.activeAnalysis) return;
        const { sprint } = this.activeAnalysis;
        const totalPages = Math.ceil(((sprint.tasks || []).length) / this.tasksPerPage) || 1;
        if (this.taskPage < totalPages) {
          this.taskPage++;
          this.renderTaskAnalysis();
          this.initIcons();
        }
      });
    }

    // Project / Clients Pagination Bindings
    const btnProjectPrev = document.getElementById('btn-project-prev');
    const btnProjectNext = document.getElementById('btn-project-next');

    if (btnProjectPrev) {
      btnProjectPrev.addEventListener('click', () => {
        if (this.projectPage > 1) {
          this.projectPage--;
          this.renderProjects();
          this.initIcons();
        }
      });
    }

    if (btnProjectNext) {
      btnProjectNext.addEventListener('click', () => {
        if (!this.activeAnalysis) return;
        const { projects } = this.activeAnalysis;
        const totalPages = Math.ceil((projects || []).length / this.projectsPerPage) || 1;
        if (this.projectPage < totalPages) {
          this.projectPage++;
          this.renderProjects();
          this.initIcons();
        }
      });
    }

    // Employee Modal Close Bindings
    const modalEmp = document.getElementById('modal-employee-detail');
    const closeEmpBtn1 = document.getElementById('modal-emp-close');
    const closeEmpBtn2 = document.getElementById('modal-emp-close-btn');
    [closeEmpBtn1, closeEmpBtn2].forEach(btn => {
      if (btn) btn.addEventListener('click', () => modalEmp.classList.remove('active'));
    });
  }

  bindUploadModalEvents() {
    const modal = document.getElementById('modal-upload');
    const btnOpen = document.getElementById('btn-open-upload');
    const btnClose = document.getElementById('modal-upload-close');
    const btnCancel = document.getElementById('modal-upload-cancel');
    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('upload-file-input');
    const btnConfirm = document.getElementById('modal-upload-confirm');
    const gUrlInput = document.getElementById('gsheet-url-input');
    const btnClearFile = document.getElementById('btn-clear-file');

    if (btnOpen) btnOpen.addEventListener('click', () => {
      modal.classList.add('active');
      this.resetUploadModal();
    });
    [btnClose, btnCancel].forEach(b => {
      if (b) b.addEventListener('click', () => {
        modal.classList.remove('active');
        this.resetUploadModal();
      });
    });

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', (e) => {
        if (e.target.id === 'btn-clear-file') return;
        fileInput.click();
      });
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          this.handleFileSelected(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleFileSelected(e.target.files[0]);
        }
      });
    }

    if (gUrlInput) {
      gUrlInput.addEventListener('input', () => {
        this.setImportMode('gsheet');
        this.setGSheetError('');
      });
      gUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleConfirmImport();
        }
      });
    }

    if (btnClearFile) {
      btnClearFile.addEventListener('click', (e) => {
        e.stopPropagation();
        this.resetUploadModal();
      });
    }

    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => this.handleConfirmImport());
    }
  }

  setConfirmButton(label) {
    const btn = document.getElementById('modal-upload-confirm');
    if (!btn) return;
    btn.textContent = label;
    this.initIcons();
  }

  resetUploadModal() {
    this.importMode = 'file';
    this.importState = 'idle';
    this.importMeta = { source: '', fileName: '', sheetName: '', spreadsheetId: '' };
    this.currentParser = null;
    this.currentSprint = null;
    this.setConfirmButton('Confirm & Analyze Sprint');

    const fileInput = document.getElementById('upload-file-input');
    const gUrlInput = document.getElementById('gsheet-url-input');
    const labels = document.getElementById('dropzone-labels');
    const selectedName = document.getElementById('selected-file-name');
    const btnClearFile = document.getElementById('btn-clear-file');
    const gError = document.getElementById('gsheet-error');
    const gSelection = document.getElementById('gsheet-sheet-selection');
    const loading = document.getElementById('upload-loading');
    const sourceInd = document.getElementById('upload-source-indicator');
    const mappingSection = document.getElementById('upload-mapping-section');
    const valBox = document.getElementById('upload-validation-box');
    const preview = document.getElementById('gsheet-preview');
    const btnConfirm = document.getElementById('modal-upload-confirm');

    if (fileInput) fileInput.value = '';
    if (gUrlInput) gUrlInput.value = '';
    if (labels) labels.style.display = 'block';
    if (selectedName) { selectedName.textContent = ''; selectedName.style.display = 'none'; }
    if (btnClearFile) btnClearFile.style.display = 'none';
    if (gError) { gError.textContent = ''; gError.style.display = 'none'; }
    if (gSelection) gSelection.style.display = 'none';
    if (loading) loading.style.display = 'none';
    if (sourceInd) sourceInd.style.display = 'none';
    if (mappingSection) mappingSection.style.display = 'none';
    if (valBox) valBox.innerHTML = 'Checking data integrity...';
    if (preview) preview.style.display = 'none';
    if (btnConfirm) btnConfirm.setAttribute('disabled', 'true');
  }

  setImportMode(mode) {
    this.importMode = mode;
    const fileInput = document.getElementById('upload-file-input');
    const gUrlInput = document.getElementById('gsheet-url-input');
    const selectedName = document.getElementById('selected-file-name');
    const sourceText = document.getElementById('upload-source-text');
    const sourceInd = document.getElementById('upload-source-indicator');

    if (mode === 'file') {
      if (gUrlInput) { gUrlInput.value = ''; gUrlInput.disabled = false; }
      if (sourceText) sourceText.textContent = 'Using local file';
    } else {
      if (fileInput) fileInput.value = '';
      if (selectedName) selectedName.style.display = 'none';
      if (sourceText) sourceText.textContent = 'Using Google Sheet';
    }
    if (sourceInd) sourceInd.style.display = 'flex';
  }

  setGSheetError(msg) {
    const el = document.getElementById('gsheet-error');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  }

  setLoading(show, text = 'Fetching Google Sheet...') {
    const el = document.getElementById('upload-loading');
    const btnConfirm = document.getElementById('modal-upload-confirm');
    if (el) {
      el.style.display = show ? 'flex' : 'none';
      const txt = document.getElementById('upload-loading-text');
      if (txt) txt.innerHTML = String(text).replace(/\n/g, '<br>');
    }
    if (btnConfirm) {
      if (show) btnConfirm.setAttribute('disabled', 'true');
      else if (this.currentParser || this.currentSprint) btnConfirm.removeAttribute('disabled');
    }
  }

  async handleFileSelected(file) {
    const mappingSection = document.getElementById('upload-mapping-section');
    const labels = document.getElementById('dropzone-labels');
    const selectedName = document.getElementById('selected-file-name');
    const btnClearFile = document.getElementById('btn-clear-file');
    const gUrlInput = document.getElementById('gsheet-url-input');
    const btnConfirm = document.getElementById('modal-upload-confirm');

    this.setImportMode('file');
    this.importMeta = { source: 'Excel/CSV', fileName: file.name, sheetName: '', spreadsheetId: '' };

    try {
      this.currentParser = new window.SprintParser();
      await this.currentParser.parseFile(file);

      if (labels) labels.style.display = 'none';
      if (selectedName) {
        selectedName.textContent = `\u2713 ${file.name} (${this.currentParser.rawRows.length} rows)`;
        selectedName.style.display = 'block';
      }
      if (btnClearFile) btnClearFile.style.display = 'inline-flex';
      if (gUrlInput) gUrlInput.value = '';
      if (mappingSection) mappingSection.style.display = 'flex';

      this.populateMappingDropdowns();
      this.refreshValidationSummary();
      if (btnConfirm) btnConfirm.removeAttribute('disabled');
    } catch (err) {
      this.setImportMode('file');
      this.setGSheetError(`Error reading file: ${err.message}`);
    }
  }

  populateMappingDropdowns() {
    const mappingSection = document.getElementById('upload-mapping-section');
    if (!this.currentParser) return;
    const headers = this.currentParser.detectedHeaders;
    const populateSelect = (selectId, selectedIdx) => {
      const select = document.getElementById(selectId);
      if (!select) return;
      select.innerHTML = '<option value="-1">-- Unmapped --</option>' + headers.map((h, i) => `<option value="${i}" ${i === selectedIdx ? 'selected' : ''}>${h}</option>`).join('');
      select.addEventListener('change', () => {
        const field = selectId.replace('map-col-', '');
        this.currentParser.setMapping(field, select.value);
        this.refreshValidationSummary();
      });
    };

    populateSelect('map-col-item', this.currentParser.columnMapping.item);
    populateSelect('map-col-owner', this.currentParser.columnMapping.owner);
    populateSelect('map-col-priority', this.currentParser.columnMapping.priority);
    populateSelect('map-col-est', this.currentParser.columnMapping.est);
    populateSelect('map-col-act', this.currentParser.columnMapping.act);
    populateSelect('map-col-status', this.currentParser.columnMapping.status);
    if (mappingSection) mappingSection.style.display = 'flex';
  }

  extractGoogleSheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  extractGoogleGid(url) {
    const match = url.match(/[#&?]gid=([0-9]+)/);
    return match ? match[1] : null;
  }

  async handleConfirmImport() {
    if (this.importMode === 'gsheet') {
      const gUrlInput = document.getElementById('gsheet-url-input');
      const url = (gUrlInput ? gUrlInput.value.trim() : '');
      if (!url) {
        this.setGSheetError('Please enter a Google Sheets URL.');
        return;
      }
      const id = this.extractGoogleSheetId(url);
      if (!id) {
        this.setGSheetError('Please enter a valid Google Sheets URL.');
        return;
      }

      if (this.importState === 'fetched' && this.currentSprint) {
        this.finalizeImport();
        return;
      }

      this.setGSheetError('');
      await this.fetchGoogleSheet(id, url);
      return;
    }

    if (!this.currentParser) return;
    this.finalizeImport();
  }

  async fetchGoogleSheet(id, url) {
    const gid = this.extractGoogleGid(url);

    if (!gid) {
      // Multi-sheet: ask the server for available sheets
      this.setLoading(true, 'Listing available sheets...');
      try {
        const listResp = await fetch(`/api/sheets/list?id=${encodeURIComponent(id)}`);
        const listData = await listResp.json();
        if (!listData.ok) throw new Error(listData.error || 'Unable to list sheets.');

        if (listData.sheets && listData.sheets.length > 1) {
          this.renderSheetSelection(id, listData.sheets);
          this.setLoading(false);
          return;
        }
        // Single/default sheet
        const defaultGid = (listData.sheets && listData.sheets[0] && listData.sheets[0].gid) || '0';
        const title = (listData.sheets && listData.sheets[0] && listData.sheets[0].title) || 'Sheet1';
        await this.exportGoogleSheet(id, defaultGid, title);
      } catch (err) {
        this.setLoading(false);
        this.setGSheetError(this.userFriendlyGSheetError(err.message));
      }
      return;
    }

    // gid in URL: import that specific sheet
    await this.exportGoogleSheet(id, gid, 'Selected Sheet');
  }

  userFriendlyGSheetError(raw) {
    const r = String(raw).toLowerCase();
    if (r.includes('404') || r.includes('not found')) return 'Google Sheet not found. Please check the URL and try again.';
    if (r.includes('403') || r.includes('access') || r.includes('unauthorized') || r.includes('forbidden'))
      return 'SprintIQ cannot access this Google Sheet. Please make sure the sheet is accessible to SprintIQ or shared as "Anyone with the link can view".';
    if (r.includes('network') || r.includes('fetch')) return 'Unable to fetch the Google Sheet right now. Please try again.';
    if (r.includes('empty')) return 'The selected Google Sheet does not contain sprint data.';
    if (r.includes('structure') || r.includes('identify') || r.includes('missing')) return 'We found the Google Sheet, but could not identify the SprintIQ sprint planning structure.';
    return `Unable to fetch the Google Sheet. ${raw}`;
  }

  renderSheetSelection(id, sheets) {
    const el = document.getElementById('gsheet-sheet-selection');
    const opts = document.getElementById('gsheet-sheet-options');
    if (!el || !opts) return;
    opts.innerHTML = sheets.map((s, i) => `
      <label class="gsheet-sheet-option" data-gid="${s.gid}">
        <input type="radio" name="gsheet-sheet" value="${s.gid}" ${i === 0 ? 'checked' : ''}>
        <span>${s.title}</span>
      </label>
    `).join('');
    el.style.display = 'block';

    opts.querySelectorAll('input[type="radio"]').forEach(rb => {
      rb.addEventListener('change', () => {
        const selectedGid = rb.value;
        const title = rb.parentElement.querySelector('span').textContent;
        this.exportGoogleSheet(id, selectedGid, title);
      });
    });
  }

  async exportGoogleSheet(id, gid, sheetName) {
    this.setLoading(true, 'Fetching Google Sheet...\nConnecting to spreadsheet');
    try {
      this.setLoading(true, 'Fetching Google Sheet...\nReading sprint planning data');
      const resp = await fetch(`/api/sheets/export?id=${encodeURIComponent(id)}&gid=${encodeURIComponent(gid || '0')}`);
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'Unable to fetch sheet.');

      this.setLoading(true, 'Fetching Google Sheet...\nValidating sprint records');
      const sp = new window.SprintParser();
      sp.parseCsvText(data.csv, 'Google Sheet');

      const gs = new window.GoogleSheetParser();
      gs.parseGrid(sp.rawRows);

      if (gs.errors && gs.errors.length > 0) {
        throw new Error(gs.errors.join(' '));
      }
      if (gs.tasks.length === 0) {
        throw new Error('The selected sheet does not contain any sprint task data.');
      }

      this.setLoading(true, 'Fetching Google Sheet...\nPreparing sprint analysis');
      this.currentSprint = window.GoogleSheetAdapter.toSprint(gs, data.id, sheetName);
      this.importMeta = {
        source: 'Google Sheets',
        fileName: '',
        sheetName: sheetName,
        spreadsheetId: data.id || '********'
      };

      this.renderGoogleSheetPreview(this.currentSprint);
      this.importState = 'fetched';
      this.setLoading(false);
      this.setGSheetError('');
      this.setConfirmButton('Analyze Sprint');

      const gSelection = document.getElementById('gsheet-sheet-selection');
      if (gSelection) gSelection.style.display = 'none';
      const btnConfirm = document.getElementById('modal-upload-confirm');
      if (btnConfirm) btnConfirm.removeAttribute('disabled');
    } catch (err) {
      this.setLoading(false);
      this.setGSheetError(this.userFriendlyGSheetError(err.message));
    }
  }

  renderGoogleSheetPreview(sprint) {
    const preview = document.getElementById('gsheet-preview');
    const body = document.getElementById('gsheet-preview-body');
    const cap = sprint.capacity || {};
    if (!preview || !body) return;

    const deliveryCount = (sprint.gsheetTeam || []).filter(m => m.isDeliveryResource).length;
    const leadershipCount = (sprint.gsheetTeam || []).filter(m => !m.isDeliveryResource).length;
    const sm = (sprint.gsheetTeam || []).find(m => m.isScrumMaster);

    const rows = [
      ['Sprint', sprint.name],
      ['Dates', `${sprint.startDate} to ${sprint.endDate}`],
      ['Team Members', (sprint.gsheetTeam || []).length],
      ['Delivery Resources', deliveryCount],
      ['Sprint Leadership', leadershipCount],
      ['Scrum Master', sm ? `${sm.name} — ${sm.designation}` : '—'],
      ['Sprint Tasks', sprint.tasks.length],
      ['Total Capacity', `${cap.totalCapacity}h`],
      ['Total Estimated Work', `${cap.totalAllocated}h`],
      ['Remaining Capacity', `${cap.remainingCapacity}h`],
      ['Source', 'Google Sheets'],
      ['Sheet Name', sprint.importSheetName],
      ['Last Synced', new Date(sprint.importedAt).toLocaleString()]
    ];

    body.innerHTML = rows.map(([k, v]) => `
      <div class="gsheet-preview-row">
        <span class="gsheet-preview-key">${k}</span>
        <span class="gsheet-preview-value">${v}</span>
      </div>
    `).join('');

    preview.style.display = 'block';
    this.initIcons();
  }

  finalizeImport() {
    const modal = document.getElementById('modal-upload');

    // Google Sheets path: the sprint object was already built during preview
    if (this.importMode === 'gsheet' && this.currentSprint) {
      this.sprints.unshift(this.currentSprint);
      this.saveCustomSprints();
      this.renderSprintSelector();
      this.switchSprint(this.currentSprint.id);
      modal.classList.remove('active');
      this.resetUploadModal();
      this.showToast(`Successfully imported ${this.currentSprint.tasks.length} tasks!`);
      return;
    }

    // Local Excel / CSV path
    if (!this.currentParser) return;
    const { tasks, validation } = this.currentParser.extractTasks();
    if (tasks.length === 0) {
      this.setGSheetError('No valid sprint tasks could be extracted. Please check the required columns (Item, Owner, Est, Act, Status, Priority).');
      return;
    }

    const meta = this.importMeta;
    const descParts = [
      `${meta.source || 'File'} import with ${tasks.length} deliverables.`
    ];
    if (meta.fileName) descParts.push(`File: ${meta.fileName}`);
    if (meta.sheetName) descParts.push(`Sheet: ${meta.sheetName}`);
    if (meta.spreadsheetId) descParts.push(`Spreadsheet ID: ${meta.spreadsheetId}`);

    const newSprint = {
      id: `sprint-${Date.now()}`,
      name: `Imported Sprint (${new Date().toLocaleDateString()})`,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      status: 'Active',
      description: descParts.join(' '),
      importSource: meta.source,
      importSheetName: meta.sheetName,
      importSpreadsheetId: meta.spreadsheetId,
      importedAt: new Date().toISOString(),
      tasks: tasks
    };

    this.sprints.unshift(newSprint);
    this.saveCustomSprints();
    this.renderSprintSelector();
    this.switchSprint(newSprint.id);
    modal.classList.remove('active');
    this.resetUploadModal();
    this.showToast(`Successfully imported ${tasks.length} tasks!`);
  }

  refreshValidationSummary() {
    const valBox = document.getElementById('upload-validation-box');
    if (!valBox || !this.currentParser) return;

    const { tasks, validation } = this.currentParser.extractTasks();
    const warnings = validation.warningRows.length;
    valBox.innerHTML = `
      <div style="font-weight: 700; color: ${warnings > 0 ? 'var(--rag-amber)' : 'var(--rag-green)'};">
        ${tasks.length} valid deliverables recognized across ${validation.totalRows} sheet rows.
      </div>
      <div style="margin-top: 4px; font-size: 11.5px;">
        ${warnings > 0 ? `⚠️ ${warnings} warnings detected (duplicates / missing fields). These are auto-handled.` : '✓ Clean dataset. Zero formatting warnings detected.'}
      </div>
    `;
  }

  bindExportEvents() {
    const getMeta = () => ({
      companyName: document.getElementById('report-meta-company')?.value || 'Software & Web PMO',
      department: document.getElementById('report-meta-dept')?.value || 'Digital Delivery',
      preparedBy: document.getElementById('report-meta-author')?.value || 'Project Manager',
      reportTitle: document.getElementById('report-meta-title')?.value || 'Executive Sprint Retrospective & RAG Report'
    });

    const exportPdf = () => {
      if (this.activeAnalysis) {
        window.SprintExporter.exportPDF(this.activeAnalysis, getMeta());
        this.showToast('Management PDF Report downloaded!');
      }
    };

    const exportExcel = () => {
      if (this.activeAnalysis) {
        window.SprintExporter.exportExcel(this.activeAnalysis, getMeta());
        this.showToast('Multi-Sheet Excel Report downloaded!');
      }
    };

    const exportPPTX = () => {
      if (this.activeAnalysis) {
        window.SprintExporter.exportPPTX(this.activeAnalysis, getMeta());
        this.showToast('Executive PowerPoint Presentation downloaded!');
      }
    };

    document.getElementById('btn-quick-export-pdf')?.addEventListener('click', exportPdf);
    document.getElementById('btn-quick-export-excel')?.addEventListener('click', exportExcel);
    document.getElementById('btn-quick-export-pptx')?.addEventListener('click', exportPPTX);

    document.getElementById('btn-generate-pdf-full')?.addEventListener('click', exportPdf);
    document.getElementById('btn-generate-excel-full')?.addEventListener('click', exportExcel);
    document.getElementById('btn-generate-pptx-full')?.addEventListener('click', exportPPTX);
  }

  bindSettingsEvents() {
    const btnSave = document.getElementById('btn-save-settings');
    const btnReset = document.getElementById('btn-reset-settings');

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const wDel = parseInt(document.getElementById('weight-delivery').value, 10) || 30;
        const wEff = parseInt(document.getElementById('weight-effort').value, 10) || 25;
        const wPrio = parseInt(document.getElementById('weight-priority').value, 10) || 20;
        const wWl = parseInt(document.getElementById('weight-workload').value, 10) || 15;
        const wRisk = parseInt(document.getElementById('weight-risk').value, 10) || 10;

        const sum = wDel + wEff + wPrio + wWl + wRisk;
        if (sum !== 100) {
          alert(`Weights must sum to 100%. Current sum: ${sum}%`);
          return;
        }

        const greenMin = parseInt(document.getElementById('rag-green-min').value, 10) || 85;
        const amberMin = parseInt(document.getElementById('rag-amber-min').value, 10) || 65;

        window.SprintIQConfig.saveConfig({
          scoringWeights: { delivery: wDel, effort: wEff, priority: wPrio, workload: wWl, risk: wRisk },
          ragThresholds: { greenMin, amberMin }
        });

        this.showToast('Configuration saved successfully!');
        this.runAnalysis();
        this.renderActiveView();
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        window.SprintIQConfig.resetConfig();
        this.showToast('Settings reset to defaults.');
        this.runAnalysis();
        this.renderActiveView();
      });
    }
  }

  switchView(viewId) {
    window.SprintIQLoader.show(3000);

    this.currentView = viewId;

    // Update Sidebar active state
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('data-view') === viewId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Hide all view panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.style.display = 'none';
    });

    // Show target view panel
    const targetPanel = document.getElementById(viewId);
    if (targetPanel) {
      targetPanel.style.display = 'block';
    }

    this.renderActiveView();
    this.initIcons();
  }

  renderActiveView() {
    if (!this.activeAnalysis) return;

    if (this.currentView === 'view-overview') {
      this.renderOverview();
    } else if (this.currentView === 'view-sprint-analysis') {
      this.renderSprintAnalysis();
    } else if (this.currentView === 'view-team') {
      this.renderTeamRoles();
    } else if (this.currentView === 'view-employee-rag') {
      this.renderEmployeeRAG();
    } else if (this.currentView === 'view-workload') {
      this.renderWorkload();
    } else if (this.currentView === 'view-task-analysis') {
      this.renderTaskAnalysis();
    } else if (this.currentView === 'view-projects') {
      this.renderProjects();
    } else if (this.currentView === 'view-risks') {
      this.renderRisks();
    } else if (this.currentView === 'view-retrospective') {
      this.renderRetrospective();
    } else if (this.currentView === 'view-comparison') {
      this.renderComparison();
    }

    this.initIcons();
  }

  /**
   * Render View 1: Overview Dashboard
   */
  renderOverview() {
    const { metrics, employees, workload, priorities, projects, retrospective, leadership } = this.activeAnalysis;

    // Sprint Leadership strip (management layer, excluded from delivery metrics)
    const leadStrip = document.getElementById('overview-leadership-strip');
    if (leadStrip) {
      leadStrip.innerHTML = this.leadershipStripHtml(leadership, 'Leadership effort is excluded from delivery capacity & utilization.');
    }

    // Executive Banner
    const badgeEl = document.getElementById('overview-rag-badge');
    if (badgeEl) {
      badgeEl.className = `banner-badge badge-${metrics.rag.toLowerCase()}`;
      badgeEl.textContent = `SPRINT RAG: ${metrics.rag} (Score: ${metrics.ragScore}/100)`;
    }

    const execTextEl = document.getElementById('overview-executive-text');
    if (execTextEl) {
      execTextEl.textContent = retrospective.summary || '';
    }

    // Top KPIs
    document.getElementById('kpi-total-tasks').textContent = metrics.totalTasks;
    document.getElementById('kpi-tasks-breakdown').textContent = `${metrics.completed} Completed · ${metrics.inProgress} In Progress · ${metrics.blocked} Blocked`;
    
    const compEl = document.getElementById('kpi-completion-pct');
    compEl.textContent = `${metrics.completionPct}%`;
    compEl.style.color = metrics.completionPct >= 90 ? 'var(--rag-green)' : (metrics.completionPct >= 70 ? 'var(--rag-amber)' : 'var(--accent-red)');

    document.getElementById('kpi-actual-hours').textContent = `${metrics.totalAct}h`;
    document.getElementById('kpi-est-hours').textContent = `Planned: ${metrics.totalEst}h (${metrics.variance >= 0 ? '+' : ''}${metrics.variance}h net variance)`;

    const effEl = document.getElementById('kpi-efficiency-pct');
    effEl.textContent = `${metrics.efficiencyPct}%`;
    effEl.style.color = metrics.efficiencyPct >= 85 && metrics.efficiencyPct <= 115 ? 'var(--rag-green)' : 'var(--rag-amber)';

    document.getElementById('kpi-team-size').textContent = metrics.teamSize;
    document.getElementById('kpi-team-avg').textContent = `Avg Effort: ${(metrics.totalAct / (metrics.teamSize || 1)).toFixed(1)}h / delivery resource`;

    document.getElementById('kpi-imbalance-score').textContent = `${workload.imbalanceScore}%`;
    document.getElementById('kpi-imbalance-subtext').textContent = workload.imbalanceScore <= 25 ? 'Healthy Team Load Balance' : 'Concentrated Capacity Strain';

    // Render Charts
    window.SprintCharts.renderTaskStatusDonut('chart-overview-status', metrics);
    window.SprintCharts.renderEmployeeWorkloadBar('chart-overview-workload', employees);
    window.SprintCharts.renderPriorityChart('chart-overview-priority', priorities);
    window.SprintCharts.renderProjectChart('chart-overview-projects', projects);
  }

  /**
   * Shared renderer for a person row (Delivery Team / Sprint Leadership lists)
   */
  personRow(person, isLeadership) {
    const badge = person.roleBadge
      ? `<span class="role-badge ${isLeadership ? 'role-badge-leadership' : ''}">${person.roleBadge}</span>`
      : '';
    const extra = isLeadership
      ? `${person.resourceType} · ${person.taskCount || 0} activities (${person.actHours || 0}h, excluded from capacity)`
      : `${person.sprintRole} · ${person.resourceType}`;

    return `
      <div class="team-role-row ${isLeadership ? 'is-leadership' : ''}">
        <div>
          <div class="team-role-name">${person.name}</div>
          <div class="team-role-meta">${extra}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="role-badge">${person.designation}</span>
          ${badge}
        </div>
      </div>
    `;
  }

  /**
   * Sprint leadership summary line reused across Overview / Workload / Retro
   */
  leadershipStripHtml(leadership, contextNote) {
    const sm = leadership.scrumMaster;
    const parts = [];

    if (sm) {
      parts.push(`<span><strong>Scrum Master:</strong> ${sm.name} <span class="role-badge role-badge-leadership">SCRUM MASTER</span></span>`);
      parts.push(`<span><strong>Designation:</strong> ${sm.designation}</span>`);
    } else {
      parts.push(`<span><strong>Scrum Master:</strong> Not assigned</span>`);
    }

    const others = leadership.members.filter(m => !m.isScrumMaster);
    if (others.length > 0) {
      parts.push(`<span><strong>Leadership:</strong> ${others.map(m => `${m.name} (${m.designation})`).join(', ')}</span>`);
    }
    if (contextNote) parts.push(`<span style="color: var(--text-muted);">${contextNote}</span>`);

    return parts.join('');
  }

  /**
   * Render View 2B: Team / Resources & Sprint Roles
   */
  renderTeamRoles() {
    const { leadership, employees } = this.activeAnalysis;
    const excluded = leadership.excludedFromCapacity;

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText('team-delivery-count', leadership.deliveryRoster.length);
    setText('team-leadership-count', leadership.members.length);
    setText('team-excluded-hours', `${excluded.actHours}h`);
    setText('team-excluded-tasks', `${excluded.taskCount} leadership activities logged`);
    setText('team-leadership-subtext', `Excluded from capacity · ${employees.length} scored delivery resources`);

    const sm = leadership.scrumMaster;
    setText('team-scrum-master-name', sm ? sm.name : '—');
    setText('team-scrum-master-designation', `Designation: ${sm ? sm.designation : '—'}`);

    // Delivery Team list (active sprint contributors first, then remaining roster)
    const deliveryList = document.getElementById('team-delivery-list');
    if (deliveryList) {
      deliveryList.innerHTML = leadership.deliveryRoster.map(p => this.personRow(p, false)).join('');
    }

    const leadershipList = document.getElementById('team-leadership-list');
    if (leadershipList) {
      leadershipList.innerHTML = leadership.members.length > 0
        ? leadership.members.map(p => this.personRow(p, true)).join('')
        : '<span style="color: var(--text-muted);">No sprint leadership roles configured</span>';
    }

    const tbody = document.querySelector('#team-roster-table tbody');
    if (tbody) {
      const rows = leadership.deliveryRoster.concat(leadership.members);
      tbody.innerHTML = rows.map(p => `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.designation}</td>
          <td>${p.isScrumMaster ? `${p.sprintRole} <span class="role-badge role-badge-leadership">SCRUM MASTER</span>` : p.sprintRole}</td>
          <td>${p.resourceType}</td>
          <td><span class="badge-${p.isDeliveryResource ? 'green' : 'amber'}">${p.isDeliveryResource ? 'Yes' : 'No'}</span></td>
          <td>${p.isScrumMaster ? '<span class="badge-red">Yes</span>' : 'No'}</td>
        </tr>
      `).join('');
    }
  }

  /**
   * Render View 2: Sprint Analysis
   */
  renderSprintAnalysis() {
    const { priorities, deliveryTasks } = this.activeAnalysis;

    const highPrio = priorities.find(p => p.priority === 'High') || { completedCount: 0, taskCount: 0 };
    document.getElementById('analysis-high-delivered').textContent = `${highPrio.completedCount} / ${highPrio.taskCount}`;

    const overrunTasks = (deliveryTasks || []).filter(t => t.act > t.est * 1.2);
    document.getElementById('analysis-overrun-count').textContent = overrunTasks.length;

    const ontimeTasks = (deliveryTasks || []).filter(t => t.act <= t.est * 1.05);
    document.getElementById('analysis-ontime-count').textContent = ontimeTasks.length;

    const tbody = document.querySelector('#priority-analysis-table tbody');
    if (tbody) {
      tbody.innerHTML = priorities.map(p => `
        <tr>
          <td><span class="badge-priority-${p.priority === 'High' ? 'high' : (p.priority === 'Medium' ? 'med' : 'low')}">${p.priority}</span></td>
          <td>${p.taskCount}</td>
          <td>${p.completedCount}</td>
          <td><strong>${p.completionPct}%</strong></td>
          <td>${p.estHours}h</td>
          <td>${p.actHours}h</td>
          <td style="color: ${p.variance > 0 ? 'var(--accent-red)' : 'var(--rag-green)'};">${p.variance >= 0 ? '+' : ''}${p.variance}h</td>
          <td>${p.variancePct >= 0 ? '+' : ''}${p.variancePct}%</td>
        </tr>
      `).join('');
    }
  }

  /**
   * Render View 3: Employee RAG
   */
  renderEmployeeRAG() {
    const { employees } = this.activeAnalysis;
    const cardsContainer = document.getElementById('emp-cards-container');
    const tableContainer = document.getElementById('emp-table-container');

    if (this.empViewMode === 'cards') {
      cardsContainer.style.display = 'grid';
      tableContainer.style.display = 'none';

      cardsContainer.innerHTML = employees.map(e => `
        <div class="emp-card" data-emp-name="${e.name}">
          <div class="emp-card-header">
            <div>
              <div class="emp-name-title">
                ${e.name}
                <span class="role-badge">${e.designation}</span>
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                ${e.workloadStatus} · ${e.workloadPct}% Team Share
              </div>
            </div>
            <div class="emp-score-badge badge-${e.rag.toLowerCase()}">
              ${e.rag} (${e.score})
            </div>
          </div>

          <div class="emp-stat-row">
            <div>
              <div class="emp-stat-val">${e.completed} / ${e.totalAssigned}</div>
              <div class="emp-stat-lbl">Tasks Done</div>
            </div>
            <div>
              <div class="emp-stat-val" style="color: ${e.variance > 0 ? 'var(--accent-red)' : 'var(--rag-green)'};">
                ${e.variance >= 0 ? '+' : ''}${e.variance}h
              </div>
              <div class="emp-stat-lbl">Variance</div>
            </div>
            <div>
              <div class="emp-stat-val">${e.efficiencyPct}%</div>
              <div class="emp-stat-lbl">Efficiency</div>
            </div>
          </div>

          <div class="emp-observation-snippet">
            ${e.observation}
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button class="btn btn-secondary btn-sm btn-open-emp-detail" data-emp-name="${e.name}">
              <i data-lucide="external-link"></i> View Full Analytics
            </button>
          </div>
        </div>
      `).join('');

      // Bind card click triggers
      document.querySelectorAll('.btn-open-emp-detail').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const name = btn.getAttribute('data-emp-name');
          this.openEmployeeDetailModal(name);
        });
      });
      document.querySelectorAll('.emp-card').forEach(card => {
        card.addEventListener('click', () => {
          const name = card.getAttribute('data-emp-name');
          this.openEmployeeDetailModal(name);
        });
      });

    } else {
      cardsContainer.style.display = 'none';
      tableContainer.style.display = 'block';

      const tbody = document.querySelector('#emp-matrix-table tbody');
      if (tbody) {
        tbody.innerHTML = employees.map(e => `
          <tr>
            <td><strong>${e.name}</strong></td>
            <td><span class="role-badge">${e.designation}</span></td>
            <td><span class="banner-badge badge-${e.rag.toLowerCase()}">${e.rag}</span></td>
            <td><strong>${e.score}</strong></td>
            <td>${e.totalAssigned}</td>
            <td>${e.completed}</td>
            <td>${e.inProgress} / ${e.blocked}</td>
            <td><strong>${e.completionPct}%</strong></td>
            <td>${e.estHours}h</td>
            <td>${e.actHours}h</td>
            <td style="color: ${e.variance > 0 ? 'var(--accent-red)' : 'var(--rag-green)'};">${e.variance >= 0 ? '+' : ''}${e.variance}h</td>
            <td>${e.efficiencyPct}%</td>
            <td>${e.workloadStatus}</td>
            <td>
              <button class="btn btn-secondary btn-sm btn-open-emp-detail" data-emp-name="${e.name}">
                Inspect
              </button>
            </td>
          </tr>
        `).join('');

        document.querySelectorAll('.btn-open-emp-detail').forEach(btn => {
          btn.addEventListener('click', () => {
            const name = btn.getAttribute('data-emp-name');
            this.openEmployeeDetailModal(name);
          });
        });
      }
    }
  }

  openEmployeeDetailModal(empName) {
    const emp = this.activeAnalysis.employees.find(e => e.name === empName);
    if (!emp) return;

    const modal = document.getElementById('modal-employee-detail');
    document.getElementById('modal-emp-name').innerHTML = `<i data-lucide="user" style="color: var(--accent-red);"></i> ${emp.name} <span class="role-badge">${emp.designation}</span> — Performance Intelligence`;
    
    const ragPill = document.getElementById('modal-emp-rag-pill');
    ragPill.className = `banner-badge badge-${emp.rag.toLowerCase()}`;
    ragPill.textContent = `${emp.rag} (Score: ${emp.score}/100)`;

    document.getElementById('modal-emp-workload-tag').textContent = `${emp.workloadStatus} Workload · ${emp.actHours}h Logged (${emp.workloadPct}% of team total)`;
    document.getElementById('modal-emp-tasks-stat').textContent = `${emp.completed} / ${emp.totalAssigned} (${emp.completionPct}%)`;
    document.getElementById('modal-emp-eff-stat').textContent = `${emp.efficiencyPct}%`;
    document.getElementById('modal-emp-var-stat').textContent = `${emp.variance >= 0 ? '+' : ''}${emp.variance}h`;

    document.getElementById('modal-emp-observation').textContent = emp.observation;
    document.getElementById('modal-emp-recommendation').textContent = emp.recommendation;

    // Render Employee Task Breakdown
    const tbody = document.querySelector('#modal-emp-tasks-table tbody');
    if (tbody) {
      tbody.innerHTML = emp.tasks.map(t => {
        const v = Math.round(((t.act || 0) - (t.est || 0)) * 10) / 10;
        return `
          <tr>
            <td>${t.item}</td>
            <td><span class="badge-priority-${(t.priority || 'medium').toLowerCase() === 'high' ? 'high' : 'med'}">${t.priority}</span></td>
            <td>${t.est}h</td>
            <td>${t.act}h</td>
            <td style="color: ${v > 0 ? 'var(--accent-red)' : 'var(--rag-green)'};">${v >= 0 ? '+' : ''}${v}h</td>
            <td><span class="badge-${t.status.toLowerCase() === 'completed' ? 'green' : (t.status.toLowerCase() === 'blocked' ? 'red' : 'amber')}">${t.status}</span></td>
          </tr>
        `;
      }).join('');
    }

    // Render Employee Detail Chart
    window.SprintCharts.renderEmployeeDetailChart('chart-employee-tasks', emp);

    modal.classList.add('active');
    this.initIcons();
  }

  /**
   * Render View 4: Workload
   */
  renderWorkload() {
    const { workload, employees, leadership } = this.activeAnalysis;

    const scopeNote = document.getElementById('workload-scope-note');
    if (scopeNote) {
      const ex = leadership.excludedFromCapacity;
      scopeNote.innerHTML = this.leadershipStripHtml(
        leadership,
        `Capacity scope: ${employees.length} delivery resources. Excluded from capacity: ${ex.headcount} leadership resource(s), ${ex.actHours}h.`
      );
    }

    document.getElementById('wl-total-hours').textContent = `${workload.totalHours}h`;
    document.getElementById('wl-avg-hours').textContent = `${workload.avgHours}h`;
    document.getElementById('wl-max-hours').textContent = `${workload.maxHours}h`;
    document.getElementById('wl-max-owner').textContent = `Max: ${workload.maxEmployee}`;
    document.getElementById('wl-imbalance-pct').textContent = `${workload.imbalanceScore}%`;

    const renderEmpList = (targetId, list) => {
      const el = document.getElementById(targetId);
      if (!el) return;
      if (list.length === 0) {
        el.innerHTML = '<span style="color: var(--text-muted);">None in this category</span>';
        return;
      }
      el.innerHTML = list.map(e => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
          <strong>${e.name}</strong>
          <span>${e.actHours}h (${e.workloadPct}%)</span>
        </div>
      `).join('');
    };

    renderEmpList('wl-underloaded-list', workload.underloadedList);
    renderEmpList('wl-balanced-list', workload.balancedList);
    renderEmpList('wl-overloaded-list', workload.overloadedList);

    window.SprintCharts.renderEmployeeWorkloadBar('chart-workload-detailed', employees);
  }

  /**
   * Render View 5: Task Analysis
   */
  renderTaskAnalysis() {
    const { sprint } = this.activeAnalysis;
    const tbody = document.querySelector('#task-analysis-table tbody');
    if (!tbody) return;

    const tasks = (sprint.tasks || []);
    const totalTasks = tasks.length;
    const totalPages = Math.ceil(totalTasks / this.tasksPerPage) || 1;
    this.taskPage = Math.max(1, Math.min(this.taskPage, totalPages));

    const start = (this.taskPage - 1) * this.tasksPerPage;
    const paginatedTasks = tasks.slice(start, start + this.tasksPerPage);

    // Update header count and page info
    const countEl = document.getElementById('task-table-count');
    if (countEl) countEl.textContent = `${totalTasks} deliverables · Page ${this.taskPage} of ${totalPages}`;

    tbody.innerHTML = paginatedTasks.map((t, idx) => {
      const v = Math.round(((t.act || 0) - (t.est || 0)) * 10) / 10;
      const vp = t.est > 0 ? Math.round((v / t.est) * 100) : 0;
      const isBlocked = (t.status || '').toLowerCase() === 'blocked';
      const isOverrun = v >= 3 && vp > 30;
      const displayId = t.id || (start + idx + 1);

      return `
        <tr>
          <td>${displayId}</td>
          <td><strong>${t.item}</strong></td>
          <td><span class="badge-priority-${(t.priority || 'medium').toLowerCase() === 'high' ? 'high' : ((t.priority || '').toLowerCase() === 'low' ? 'low' : 'med')}">${t.priority}</span></td>
          <td>${t.owner}</td>
          <td>${t.est}h</td>
          <td>${t.act}h</td>
          <td style="color: ${v > 0 ? 'var(--accent-red)' : 'var(--rag-green)'};">${v >= 0 ? '+' : ''}${v}h</td>
          <td>${vp >= 0 ? '+' : ''}${vp}%</td>
          <td><span class="banner-badge badge-${t.status.toLowerCase() === 'completed' ? 'green' : (isBlocked ? 'red' : 'amber')}">${t.status}</span></td>
          <td>${isBlocked ? '<span style="color: var(--accent-red); font-weight: 700;">Blocked Alert</span>' : (isOverrun ? '<span style="color: var(--rag-amber);">Effort Overrun</span>' : 'Healthy')}</td>
        </tr>
      `;
    }).join('');

    // Update pagination controls
    const paginationBar = document.getElementById('task-pagination-bar');
    const infoEl = document.getElementById('task-pagination-info');
    const btnPrev = document.getElementById('btn-task-prev');
    const btnNext = document.getElementById('btn-task-next');

    if (paginationBar) paginationBar.style.display = totalPages > 1 ? 'flex' : 'none';
    if (infoEl) infoEl.textContent = `Page ${this.taskPage} of ${totalPages}`;
    if (btnPrev) btnPrev.disabled = this.taskPage <= 1;
    if (btnNext) btnNext.disabled = this.taskPage >= totalPages;
  }

  /**
   * Render View 6: Projects
   */
  renderProjects() {
    const { projects } = this.activeAnalysis;
    const tbody = document.querySelector('#projects-table tbody');
    if (!tbody) return;

    const totalProjects = projects.length;
    const totalPages = Math.ceil(totalProjects / this.projectsPerPage) || 1;
    this.projectPage = Math.max(1, Math.min(this.projectPage, totalPages));

    const start = (this.projectPage - 1) * this.projectsPerPage;
    const paginatedProjects = projects.slice(start, start + this.projectsPerPage);

    tbody.innerHTML = paginatedProjects.map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${p.taskCount}</td>
        <td>${p.completedCount}</td>
        <td><strong>${p.completionPct}%</strong></td>
        <td>${p.estHours}h</td>
        <td>${p.actHours}h</td>
        <td style="color: ${p.variance > 0 ? 'var(--accent-red)' : 'var(--rag-green)'};">${p.variance >= 0 ? '+' : ''}${p.variance}h</td>
        <td><span class="banner-badge badge-${p.rag.toLowerCase()}">${p.rag}</span></td>
        <td style="font-size: 12px; color: var(--text-secondary);">${p.assignedOwners.join(', ')}</td>
      </tr>
    `).join('');

    const paginationBar = document.getElementById('project-pagination-bar');
    const infoEl = document.getElementById('project-pagination-info');
    const btnPrev = document.getElementById('btn-project-prev');
    const btnNext = document.getElementById('btn-project-next');

    if (paginationBar) paginationBar.style.display = totalPages > 1 ? 'flex' : 'none';
    if (infoEl) infoEl.textContent = `Page ${this.projectPage} of ${totalPages}`;
    if (btnPrev) btnPrev.disabled = this.projectPage <= 1;
    if (btnNext) btnNext.disabled = this.projectPage >= totalPages;
  }

  /**
   * Render View 7: Risks
   */
  renderRisks() {
    const { risks } = this.activeAnalysis;
    const tbody = document.querySelector('#risks-table tbody');
    if (!tbody) return;

    tbody.innerHTML = risks.map(r => `
      <tr>
        <td><strong>${r.id}</strong></td>
        <td>${r.type}</td>
        <td><strong>${r.task}</strong></td>
        <td>${r.owner}</td>
        <td><span class="badge-priority-${(r.priority || 'medium').toLowerCase() === 'high' ? 'high' : 'med'}">${r.priority}</span></td>
        <td>${r.impact}</td>
        <td><span style="color: ${r.severity === 'Critical' ? 'var(--accent-red)' : 'var(--rag-amber)'}; font-weight: 700;">${r.severity}</span></td>
        <td><span class="banner-badge badge-${r.rag.toLowerCase()}">${r.rag}</span></td>
        <td style="font-size: 12.5px; color: var(--text-secondary);">${r.action}</td>
      </tr>
    `).join('');
  }

  /**
   * Render View 8: Retrospective
   */
  renderRetrospective() {
    const { retrospective, leadership } = this.activeAnalysis;

    const panel = document.getElementById('view-retrospective');
    const isStale = this.analysisVersion && retrospective.__analysisVersion !== this.analysisVersion;
    const isInvalid = !retrospective.__validationStatus || retrospective.__validationStatus !== 'PASSED' || isStale;

    const existing = panel ? panel.querySelector('.retro-validation-error') : null;
    if (existing) existing.remove();
    const card = panel ? panel.querySelector('.card') : null;
    if (card) card.style.removeProperty('display');

    if (isInvalid) {
      const errors = (retrospective.__validationErrors || []).map(e => `<li>${e}</li>`).join('');
      const staleNote = isStale ? '<p><strong>Analysis version mismatch:</strong> Retrospective is stale. Re-run analysis.</p>' : '';
      const banner = document.createElement('div');
      banner.className = 'retro-validation-error';
      banner.style.cssText = 'background: var(--accent-red); color: #fff; padding: 16px 20px; border-radius: 8px; margin: 0 0 16px 0; font-size: 13px; line-height: 1.5;';
      banner.innerHTML = `
        <h4 style="margin: 0 0 8px 0; font-size: 14px;"><i data-lucide="alert-octagon"></i> Retrospective Validation Failed</h4>
        ${staleNote}
        ${errors ? `<ul style="margin: 0; padding-left: 18px;">${errors}</ul>` : '<p>The generated retrospective did not pass validation or is stale and cannot be displayed.</p>'}
      `;
      if (panel) panel.insertBefore(banner, panel.firstChild);
      if (card) card.style.display = 'none';
      this.initIcons();
      return;
    }

    const leadBox = document.getElementById('retro-leadership-box');
    if (leadBox) {
      leadBox.innerHTML = this.leadershipStripHtml(
        leadership,
        `Retrospective owner: ${retrospective.retrospectiveOwner}. Delivery metrics below cover delivery resources only.`
      );
    }

    document.getElementById('retro-summary-text').textContent = retrospective.summary || '';

    const renderList = (elementId, items, iconName, color) => {
      const el = document.getElementById(elementId);
      if (!el) return;
      el.innerHTML = items.map(item => `
        <li class="retro-item">
          <i data-lucide="${iconName}" style="color: ${color};"></i>
          <span>${item}</span>
        </li>
      `).join('');
    };

    renderList('retro-went-well-list', retrospective.whatWentWell, 'check', 'var(--rag-green)');
    renderList('retro-not-well-list', retrospective.whatDidNotGoWell, 'alert-triangle', 'var(--accent-red)');
    renderList('retro-achievements-list', retrospective.keyAchievements, 'award', 'var(--rag-amber)');
    renderList('retro-recommendations-list', retrospective.recommendations, 'arrow-right', 'var(--accent-red)');

    const tbody = document.querySelector('#retro-actions-table tbody');
    if (tbody) {
      tbody.innerHTML = (retrospective.nextSprintActions || []).map(a => `
        <tr>
          <td><strong>${a.action}</strong></td>
          <td>${a.owner}</td>
          <td><span class="badge-priority-${a.priority.toLowerCase() === 'high' ? 'high' : 'med'}">${a.priority}</span></td>
          <td style="color: var(--text-secondary);">${a.outcome}</td>
        </tr>
      `).join('');
    }
  }

  /**
   * Render View 9: Comparison
   */
  renderComparison() {
    // Analyze all sprints
    const sprintHistory = this.sprints.map(s => {
      return {
        id: s.id,
        name: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
        status: s.status,
        metrics: window.SprintAnalytics.calculateSprintMetrics(s.tasks || [], window.SprintIQConfig.get())
      };
    });

    // Render Trend Chart
    window.SprintCharts.renderSprintTrendChart('chart-sprint-trend', sprintHistory);

    // Render Comparison Table
    const tbody = document.querySelector('#comparison-matrix-table tbody');
    if (tbody) {
      tbody.innerHTML = sprintHistory.map(s => `
        <tr>
          <td><strong>${s.name}</strong></td>
          <td>${s.startDate} to ${s.endDate}</td>
          <td><span class="banner-badge ${s.status === 'Active' ? 'badge-green' : 'badge-amber'}">${s.status}</span></td>
          <td><span class="banner-badge badge-${s.metrics.rag.toLowerCase()}">${s.metrics.rag}</span></td>
          <td>${s.metrics.totalTasks}</td>
          <td><strong>${s.metrics.completionPct}%</strong></td>
          <td>${s.metrics.totalEst}h</td>
          <td>${s.metrics.totalAct}h</td>
          <td style="color: ${s.metrics.variance > 0 ? 'var(--accent-red)' : 'var(--rag-green)'};">${s.metrics.variance >= 0 ? '+' : ''}${s.metrics.variance}h</td>
          <td>${s.metrics.efficiencyPct}%</td>
        </tr>
      `).join('');
    }
  }
}

// Page Loader Utility
window.SprintIQLoader = {
  anim: null,
  _hideTimer: null,
  _doneCallback: null,
  _isHiding: false,

  init() {
    const container = document.getElementById('lottie-loader');
    if (!container) return;

    if (typeof lottie === 'undefined') {
      container.innerHTML = '<img src="assets/loading.gif" style="width:100%;height:100%;object-fit:contain;" alt="Loading">';
      return;
    }

    this.anim = lottie.loadAnimation({
      container: container,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: 'assets/loading.json'
    });

    this.anim.addEventListener('data_failed', () => {
      container.innerHTML = '<img src="assets/loading.gif" style="width:100%;height:100%;object-fit:contain;" alt="Loading">';
    });
  },

  show(duration = 3000, onDone = null) {
    const loader = document.getElementById('page-loader');
    if (!loader) return;
    clearTimeout(this._hideTimer);
    this._doneCallback = onDone;
    this._isHiding = false;
    loader.classList.remove('fade-out');
    loader.style.removeProperty('display');
    loader.style.display = 'flex';
    if (this.anim && typeof this.anim.goToAndPlay === 'function') {
      this.anim.goToAndPlay(0, true);
    }
    this._hideTimer = setTimeout(() => this.hide(), duration);
  },

  hide() {
    const loader = document.getElementById('page-loader');
    if (!loader || this._isHiding) return;
    this._isHiding = true;
    loader.classList.add('fade-out');
    setTimeout(() => {
      loader.style.display = 'none';
      this._isHiding = false;
      if (typeof this._doneCallback === 'function') {
        this._doneCallback();
        this._doneCallback = null;
      }
    }, 600);
  }
};

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.SprintIQLoader.init();
  window.SprintIQLoader.show(3000, () => {
    document.body.classList.add('app-loaded');
    window.SprintIQ = new SprintIQApp();
  });
});
