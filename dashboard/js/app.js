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

    this.activeAnalysis = window.SprintAnalytics.analyzeSprint(filteredSprint, window.SprintIQConfig.get());

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
      const owners = Array.from(new Set(allTasks.map(t => t.owner).filter(Boolean))).sort();
      ownerSelect.innerHTML = '<option value="">All Employees</option>' + owners.map(o => `<option value="${o}" ${o === currentVal ? 'selected' : ''}>${o}</option>`).join('');
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
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = link.getAttribute('data-view');
        this.switchView(targetView);
      });
    });

    // Hamburger Sidebar Toggle
    const sidebar = document.getElementById('app-sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
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
        const text = `SPRINT RETROSPECTIVE: ${this.activeAnalysis.sprint.name}\n\n` +
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

    if (btnOpen) btnOpen.addEventListener('click', () => modal.classList.add('active'));
    [btnClose, btnCancel].forEach(b => {
      if (b) b.addEventListener('click', () => modal.classList.remove('active'));
    });

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
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

    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => {
        if (!this.currentParser) return;
        const { tasks, validation } = this.currentParser.extractTasks();
        if (tasks.length === 0) {
          alert('No valid tasks could be extracted from this file.');
          return;
        }

        const newSprint = {
          id: `sprint-${Date.now()}`,
          name: `Imported Sprint (${new Date().toLocaleDateString()})`,
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date().toISOString().slice(0, 10),
          status: 'Active',
          description: `Uploaded from file with ${tasks.length} deliverables.`,
          tasks: tasks
        };

        this.sprints.unshift(newSprint);
        this.saveCustomSprints();
        this.renderSprintSelector();
        this.switchSprint(newSprint.id);
        modal.classList.remove('active');
        this.showToast(`Successfully imported ${tasks.length} tasks!`);
      });
    }
  }

  async handleFileSelected(file) {
    const mappingSection = document.getElementById('upload-mapping-section');
    const fileNameEl = document.getElementById('upload-file-name');
    const btnConfirm = document.getElementById('modal-upload-confirm');
    const valBox = document.getElementById('upload-validation-box');

    try {
      this.currentParser = new window.SprintParser();
      await this.currentParser.parseFile(file);

      if (fileNameEl) fileNameEl.textContent = `${file.name} (${this.currentParser.rawRows.length} rows)`;
      if (mappingSection) mappingSection.style.display = 'flex';

      // Populate Mapping Dropdowns
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

      this.refreshValidationSummary();
      if (btnConfirm) btnConfirm.removeAttribute('disabled');
    } catch (err) {
      alert(`Error reading file: ${err.message}`);
    }
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
    const { metrics, employees, workload, priorities, projects, retrospective } = this.activeAnalysis;

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
    document.getElementById('kpi-team-avg').textContent = `Avg Effort: ${(metrics.totalAct / (metrics.teamSize || 1)).toFixed(1)}h / employee`;

    document.getElementById('kpi-imbalance-score').textContent = `${workload.imbalanceScore}%`;
    document.getElementById('kpi-imbalance-subtext').textContent = workload.imbalanceScore <= 25 ? 'Healthy Team Load Balance' : 'Concentrated Capacity Strain';

    // Render Charts
    window.SprintCharts.renderTaskStatusDonut('chart-overview-status', metrics);
    window.SprintCharts.renderEmployeeWorkloadBar('chart-overview-workload', employees);
    window.SprintCharts.renderPriorityChart('chart-overview-priority', priorities);
    window.SprintCharts.renderProjectChart('chart-overview-projects', projects);
  }

  /**
   * Render View 2: Sprint Analysis
   */
  renderSprintAnalysis() {
    const { priorities, sprint } = this.activeAnalysis;

    const highPrio = priorities.find(p => p.priority === 'High') || { completedCount: 0, taskCount: 0 };
    document.getElementById('analysis-high-delivered').textContent = `${highPrio.completedCount} / ${highPrio.taskCount}`;

    const overrunTasks = (sprint.tasks || []).filter(t => t.act > t.est * 1.2);
    document.getElementById('analysis-overrun-count').textContent = overrunTasks.length;

    const ontimeTasks = (sprint.tasks || []).filter(t => t.act <= t.est * 1.05);
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
              <div class="emp-name-title">${e.name}</div>
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
    document.getElementById('modal-emp-name').innerHTML = `<i data-lucide="user" style="color: var(--accent-red);"></i> ${emp.name} — Performance Intelligence`;
    
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
    const { workload, employees } = this.activeAnalysis;

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
    const { retrospective } = this.activeAnalysis;

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

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.SprintIQ = new SprintIQApp();
});
