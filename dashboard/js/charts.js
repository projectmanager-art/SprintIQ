/**
 * SprintIQ - Interactive Charts Engine
 * Builds responsive, dark-themed charts with Red + Black + Dark Graphite styling.
 */

class SprintCharts {
  constructor() {
    this.instances = {};

    // Apply Afacad as the global default font for all Chart.js canvases
    if (window.Chart) {
      Chart.defaults.font.family = "'Afacad', system-ui, sans-serif";
      Chart.defaults.color = '#94a3b8';
      Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
    }

    this.colors = {
      primaryRed: '#e63946',
      accentRed: '#ff4d6d',
      darkRed: '#a4161a',
      lightRed: '#ff758f',
      green: '#2ec4b6',
      amber: '#ffb703',
      red: '#e63946',
      graphiteDark: '#12141a',
      graphiteCard: '#1a1d26',
      graphiteBorder: '#2a2e3d',
      textPrimary: '#f8fafc',
      textMuted: '#94a3b8',
      chartPalette: [
        '#e63946', '#2ec4b6', '#ffb703', '#4361ee', '#7209b7',
        '#f72585', '#4cc9f0', '#06d6a0', '#118ab2', '#073b4c'
      ]
    };
  }

  destroyChart(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  }

  destroyAll() {
    Object.keys(this.instances).forEach(id => this.destroyChart(id));
  }

  getDefaultOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: this.colors.textMuted,
            font: { family: 'Afacad, system-ui, sans-serif', size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#161922',
          titleColor: '#ffffff',
          bodyColor: '#e2e8f0',
          borderColor: '#2a2e3d',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6
        }
      },
      scales: {
        x: {
          ticks: { color: this.colors.textMuted, font: { size: 11 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          ticks: { color: this.colors.textMuted, font: { size: 11 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    };
  }

  /**
   * Render Sprint Task Status Donut Chart
   */
  renderTaskStatusDonut(canvasId, metrics) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'In Progress', 'Pending', 'Blocked', 'Cancelled'],
        datasets: [{
          data: [metrics.completed, metrics.inProgress, metrics.pending, metrics.blocked, metrics.cancelled],
          backgroundColor: ['#2ec4b6', '#4361ee', '#ffb703', '#e63946', '#64748b'],
          borderColor: '#12141a',
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: this.colors.textMuted, boxWidth: 12, padding: 12 }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw} tasks (${Math.round((ctx.raw / (metrics.totalTasks || 1)) * 100)}%)`
            }
          }
        },
        cutout: '72%'
      }
    });
  }

  /**
   * Render Employee Workload Est vs Act Bar Chart
   */
  renderEmployeeWorkloadBar(canvasId, employees) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = employees.map(e => e.name);
    const estData = employees.map(e => e.estHours);
    const actData = employees.map(e => e.actHours);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Estimated (hrs)',
            data: estData,
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            borderColor: 'rgba(255, 255, 255, 0.4)',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Actual Spent (hrs)',
            data: actData,
            backgroundColor: employees.map(e => {
              if (e.rag === 'GREEN') return 'rgba(46, 196, 182, 0.85)';
              if (e.rag === 'AMBER') return 'rgba(255, 183, 3, 0.85)';
              return 'rgba(230, 57, 70, 0.85)';
            }),
            borderColor: employees.map(e => e.rag === 'GREEN' ? '#2ec4b6' : (e.rag === 'AMBER' ? '#ffb703' : '#e63946')),
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        ...this.getDefaultOptions(),
        plugins: {
          ...this.getDefaultOptions().plugins,
          legend: { position: 'top', labels: { color: this.colors.textMuted } }
        }
      }
    });
  }

  /**
   * Render Priority vs Hours Chart
   */
  renderPriorityChart(canvasId, priorityData) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = priorityData.map(p => p.priority);
    const est = priorityData.map(p => p.estHours);
    const act = priorityData.map(p => p.actHours);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Est (hrs)',
            data: est,
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 4
          },
          {
            label: 'Act (hrs)',
            data: act,
            backgroundColor: ['#e63946', '#ffb703', '#2ec4b6'],
            borderRadius: 4
          }
        ]
      },
      options: {
        ...this.getDefaultOptions(),
        plugins: {
          ...this.getDefaultOptions().plugins,
          legend: { position: 'top', labels: { color: this.colors.textMuted } }
        }
      }
    });
  }

  /**
   * Render Project Workload Horizontal Bar Chart
   */
  renderProjectChart(canvasId, projects) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const topProjects = projects.slice(0, 8);
    const labels = topProjects.map(p => p.name.length > 20 ? p.name.slice(0, 18) + '...' : p.name);
    const actData = topProjects.map(p => p.actHours);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Actual Effort (hrs)',
          data: actData,
          backgroundColor: topProjects.map(p => p.rag === 'GREEN' ? '#2ec4b6' : (p.rag === 'AMBER' ? '#ffb703' : '#e63946')),
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        ...this.getDefaultOptions(),
        plugins: {
          ...this.getDefaultOptions().plugins,
          legend: { display: false }
        }
      }
    });
  }

  /**
   * Render Multi-Sprint Trend Comparison Chart
   */
  renderSprintTrendChart(canvasId, sprintHistory) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = sprintHistory.map(s => s.name.replace(/\(.*?\)/g, '').trim());
    const completionData = sprintHistory.map(s => s.metrics.completionPct);
    const efficiencyData = sprintHistory.map(s => s.metrics.efficiencyPct);
    const actHoursData = sprintHistory.map(s => s.metrics.totalAct);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Completion Rate (%)',
            data: completionData,
            borderColor: '#2ec4b6',
            backgroundColor: 'rgba(46, 196, 182, 0.1)',
            tension: 0.3,
            fill: true,
            yAxisID: 'y'
          },
          {
            label: 'Efficiency (%)',
            data: efficiencyData,
            borderColor: '#ffb703',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0.3,
            yAxisID: 'y'
          },
          {
            label: 'Total Actual Hours',
            data: actHoursData,
            borderColor: '#e63946',
            backgroundColor: 'transparent',
            tension: 0.3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: this.colors.textMuted } },
          tooltip: { ...this.getDefaultOptions().plugins.tooltip }
        },
        scales: {
          x: { ticks: { color: this.colors.textMuted }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
          y: {
            type: 'linear',
            position: 'left',
            min: 0,
            max: 120,
            ticks: { color: this.colors.textMuted, callback: (v) => `${v}%` },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y1: {
            type: 'linear',
            position: 'right',
            ticks: { color: '#e63946', callback: (v) => `${v}h` },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  /**
   * Render Drilldown Chart for individual employee
   */
  renderEmployeeDetailChart(canvasId, employee) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = employee.tasks.map(t => t.item.length > 22 ? t.item.slice(0, 20) + '...' : t.item);
    const est = employee.tasks.map(t => t.est);
    const act = employee.tasks.map(t => t.act);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Est (hrs)',
            data: est,
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 4
          },
          {
            label: 'Act (hrs)',
            data: act,
            backgroundColor: '#e63946',
            borderRadius: 4
          }
        ]
      },
      options: {
        ...this.getDefaultOptions(),
        plugins: {
          ...this.getDefaultOptions().plugins,
          legend: { position: 'top', labels: { color: this.colors.textMuted } }
        }
      }
    });
  }
}

window.SprintCharts = new SprintCharts();
