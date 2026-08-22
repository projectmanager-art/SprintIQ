/**
 * SprintIQ - Configuration & Settings Engine
 * Manages configurable RAG thresholds, scoring weights, workload definitions, and persistence.
 */

const SPRINTIQ_DEFAULT_CONFIG = {
  appName: 'SprintIQ',
  tagline: 'Turn Sprint Data into Management Intelligence',
  version: '2.4.0 Enterprise',
  
  // RAG Score Thresholds (0 - 100)
  ragThresholds: {
    greenMin: 85,    // 85 - 100: Green (Healthy)
    amberMin: 65,    // 65 - 84: Amber (Attention Required)
    // < 65: Red (Management Intervention)
  },

  // Overall Sprint RAG Thresholds (Percentages)
  sprintRag: {
    completionGreen: 90, // >= 90%
    completionAmber: 70, // 70 - 89%
    efficiencyGreenMin: 85, // 85% - 115%
    efficiencyGreenMax: 115,
    maxBlockedAllowed: 1,
    maxSevereOverrunTasks: 2
  },

  // Scoring Dimension Weights (must sum to 100%)
  scoringWeights: {
    delivery: 30,    // Task completion rate
    effort: 25,      // Est vs Act efficiency & variance control
    priority: 20,    // Success on High/Critical items
    workload: 15,    // Balanced distribution vs team
    risk: 10         // Penalty for blocked/overdue/overrun items
  },

  // Workload Classification Thresholds (Relative to Team Average Hours)
  workloadThresholds: {
    underloadedRatio: 0.70, // < 70% of team avg -> Underloaded
    overloadedRatio: 1.30   // > 130% of team avg -> Overloaded
    // Between 70% and 130% -> Balanced
  },

  // Task Variance & Efficiency Thresholds
  taskVariance: {
    acceptableVariancePct: 15, // <= 15% overrun is Green
    moderateVariancePct: 35,   // 16% - 35% overrun is Amber
    criticalVariancePct: 35    // > 35% overrun is Red
  },

  // Report Default Metadata
  reportDefaults: {
    companyName: 'Software & Web Development PMO',
    department: 'Digital Delivery & Engineering',
    preparedBy: 'Lead Project Manager',
    reportTitle: 'Executive Sprint Retrospective & RAG Report',
    logoUrl: '',
    selectedSections: {
      cover: true,
      executiveSummary: true,
      kpis: true,
      overallRag: true,
      sprintPerformance: true,
      workload: true,
      employeeRag: true,
      employeeCards: true,
      projectAnalysis: true,
      riskRegister: true,
      estimationAccuracy: true,
      whatWentWell: true,
      whatDidNotGoWell: true,
      recommendations: true,
      nextSprintActions: true
    }
  }
};

class ConfigManager {
  constructor() {
    this.storageKey = 'sprintiq_config_v2';
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return this.deepMerge(JSON.parse(JSON.stringify(SPRINTIQ_DEFAULT_CONFIG)), parsed);
      }
    } catch (e) {
      console.warn('Could not read config from localStorage, using defaults.', e);
    }
    return JSON.parse(JSON.stringify(SPRINTIQ_DEFAULT_CONFIG));
  }

  saveConfig(newConfig) {
    try {
      this.config = this.deepMerge(this.config, newConfig);
      localStorage.setItem(this.storageKey, JSON.stringify(this.config));
      return true;
    } catch (e) {
      console.error('Failed to save config to localStorage:', e);
      return false;
    }
  }

  resetConfig() {
    this.config = JSON.parse(JSON.stringify(SPRINTIQ_DEFAULT_CONFIG));
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {}
    return this.config;
  }

  get() {
    return this.config;
  }

  deepMerge(target, source) {
    for (const key of Object.keys(source)) {
      if (source[key] instanceof Object && !Array.isArray(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        this.deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
    return target;
  }
}

window.SprintIQConfig = new ConfigManager();
