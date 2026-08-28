/**
 * SprintIQ - Advanced Analytics, Scoring & Intelligence Engine
 * Calculates Sprint KPIs, Employee RAG scores, Workload, Project distributions,
 * Risk registers, AI-driven retrospective insights, and management recommendations.
 */

class SprintAnalytics {
  /**
   * Team / role registry accessor. Every delivery-resource decision goes
   * through here so no role is ever hard-coded in the calculation logic.
   */
  static team() {
    return window.SprintIQTeam;
  }

  /**
   * Tasks owned by employees where is_delivery_resource = true.
   * These are the ONLY tasks feeding capacity, utilization, workload and
   * employee performance calculations.
   */
  static deliveryTasks(tasks) {
    const team = this.team();
    if (!team) return tasks || [];
    return (tasks || []).filter(t => team.isDeliveryResource(t.owner));
  }

  /**
   * Tasks owned by non-delivery resources (sprint leadership / management).
   * Reported separately, never merged into delivery capacity.
   */
  static leadershipTasks(tasks) {
    const team = this.team();
    if (!team) return [];
    return (tasks || []).filter(t => !team.isDeliveryResource(t.owner));
  }

  /**
   * Main entry point to analyze a sprint with given tasks and config
   */
  static analyzeSprint(sprint, config = window.SprintIQConfig.get(), analysisVersion = null) {
    const allTasks = sprint.tasks || [];
    const tasks = this.deliveryTasks(allTasks);
    const excludedTasks = this.leadershipTasks(allTasks);

    const sprintMetrics = this.calculateSprintMetrics(tasks, config);
    const employeeMetrics = this.calculateEmployeeMetrics(tasks, config, sprintMetrics);
    const workloadMetrics = this.calculateWorkload(tasks, config, employeeMetrics);
    const projectMetrics = this.extractProjects(tasks);
    const priorityMetrics = this.calculatePriorityMetrics(tasks);
    const riskRegister = this.identifyRisks(tasks, config, employeeMetrics, sprintMetrics);
    const leadership = this.buildLeadership(excludedTasks);
    const executiveSummary = this.generateExecutiveSummary(sprint, sprintMetrics, employeeMetrics, riskRegister);
    const retrospective = this.generateValidatedRetrospective(sprint, sprintMetrics, employeeMetrics, riskRegister, projectMetrics, leadership, analysisVersion);

    return {
      sprint,
      deliveryTasks: tasks,
      excludedTasks,
      metrics: sprintMetrics,
      employees: employeeMetrics,
      leadership,
      workload: workloadMetrics,
      projects: projectMetrics,
      priorities: priorityMetrics,
      risks: riskRegister,
      executiveSummary,
      retrospective
    };
  }

  /**
   * Sprint Leadership Layer (non-delivery resources).
   * Visible in sprint overview, retrospective and management reports, but
   * fully excluded from every delivery capacity / performance metric.
   */
  static buildLeadership(excludedTasks = []) {
    const team = this.team();
    const roster = team ? team.leadership() : [];

    // Any non-delivery owner appearing in the sprint but missing from the roster
    const extras = [];
    excludedTasks.forEach(t => {
      const name = t.owner || 'Unassigned';
      if (!roster.some(r => r.employee_name === name) && !extras.some(r => r.employee_name === name)) {
        extras.push(team ? team.resolve(name) : { employee_name: name });
      }
    });

    const members = roster.concat(extras).map(r => {
      const own = excludedTasks.filter(t => (t.owner || '') === r.employee_name);
      const estHours = own.reduce((s, t) => s + (t.est || 0), 0);
      const actHours = own.reduce((s, t) => s + (t.act || 0), 0);
      return {
        name: r.employee_name,
        designation: r.designation,
        sprintRole: r.sprint_role,
        resourceType: r.resource_type,
        roleBadge: r.role_badge,
        isDeliveryResource: false,
        isScrumMaster: !!r.is_scrum_master,
        taskCount: own.length,
        estHours: Math.round(estHours * 10) / 10,
        actHours: Math.round(actHours * 10) / 10,
        tasks: own
      };
    });

    const scrumMaster = members.find(m => m.isScrumMaster) || null;
    const deliveryRoster = (team ? team.deliveryTeam() : []).map(r => ({
      name: r.employee_name,
      designation: r.designation,
      sprintRole: r.sprint_role,
      resourceType: r.resource_type,
      roleBadge: r.role_badge,
      isDeliveryResource: true,
      isScrumMaster: false
    }));

    return {
      scrumMaster,
      members,
      deliveryRoster,
      excludedFromCapacity: {
        headcount: members.length,
        taskCount: excludedTasks.length,
        estHours: Math.round(members.reduce((s, m) => s + m.estHours, 0) * 10) / 10,
        actHours: Math.round(members.reduce((s, m) => s + m.actHours, 0) * 10) / 10
      }
    };
  }

  /**
   * Overall Sprint KPIs & Global RAG Calculation
   * Only delivery resources contribute (is_delivery_resource = true).
   */
  static calculateSprintMetrics(allTasks, config) {
    const tasks = this.deliveryTasks(allTasks);
    const totalTasks = tasks.length;
    let completed = 0;
    let inProgress = 0;
    let pending = 0;
    let blocked = 0;
    let cancelled = 0;

    let totalEst = 0;
    let totalAct = 0;

    const ownersSet = new Set();

    tasks.forEach(t => {
      const st = (t.status || 'pending').toLowerCase();
      if (st === 'completed') completed++;
      else if (st === 'in progress' || st === 'in_progress') inProgress++;
      else if (st === 'blocked') blocked++;
      else if (st === 'cancelled') cancelled++;
      else pending++;

      totalEst += t.est || 0;
      totalAct += t.act || 0;

      if (t.owner && t.owner !== 'Unassigned') {
        ownersSet.add(t.owner);
      }
    });

    const activeTasksCount = totalTasks - cancelled;
    const completionPct = activeTasksCount > 0 ? (completed / activeTasksCount) * 100 : 0;
    const variance = totalAct - totalEst;
    const variancePct = totalEst > 0 ? (variance / totalEst) * 100 : 0;
    const efficiencyPct = totalAct > 0 ? (totalEst / totalAct) * 100 : (totalEst === 0 ? 100 : 0);

    // Calculate Overall Sprint RAG
    let rag = 'GREEN';
    let ragScore = 100;
    const ragReasons = [];

    // Deduct points based on completion
    if (completionPct < config.sprintRag.completionAmber) {
      ragScore -= 40;
      ragReasons.push(`Completion rate (${completionPct.toFixed(1)}%) is below critical threshold (${config.sprintRag.completionAmber}%).`);
    } else if (completionPct < config.sprintRag.completionGreen) {
      ragScore -= 20;
      ragReasons.push(`Completion rate (${completionPct.toFixed(1)}%) is below target (${config.sprintRag.completionGreen}%).`);
    }

    // Deduct points based on efficiency / variance
    if (efficiencyPct < config.sprintRag.efficiencyGreenMin) {
      ragScore -= 20;
      ragReasons.push(`Sprint efficiency (${efficiencyPct.toFixed(1)}%) indicates effort overrun (+${variance.toFixed(1)}h).`);
    }

    // Deduct points for blocked items
    if (blocked > config.sprintRag.maxBlockedAllowed) {
      ragScore -= 25;
      ragReasons.push(`${blocked} tasks are currently in Blocked status requiring unblocking.`);
    } else if (blocked > 0) {
      ragScore -= 10;
      ragReasons.push(`${blocked} task is blocked.`);
    }

    // Final Sprint RAG determination
    if (ragScore >= config.ragThresholds.greenMin) {
      rag = 'GREEN';
    } else if (ragScore >= config.ragThresholds.amberMin) {
      rag = 'AMBER';
    } else {
      rag = 'RED';
    }

    return {
      totalTasks,
      completed,
      inProgress,
      pending,
      blocked,
      cancelled,
      completionPct: Math.round(completionPct * 10) / 10,
      totalEst: Math.round(totalEst * 10) / 10,
      totalAct: Math.round(totalAct * 10) / 10,
      variance: Math.round(variance * 10) / 10,
      variancePct: Math.round(variancePct * 10) / 10,
      efficiencyPct: Math.round(efficiencyPct * 10) / 10,
      teamSize: ownersSet.size,
      rag,
      ragScore: Math.max(0, Math.min(100, Math.round(ragScore))),
      ragReasons
    };
  }

  /**
   * Employee-Wise Analytics & Transparent Scoring Engine
   * Scoped to delivery resources only; leadership roles are reported by
   * buildLeadership() and never scored here.
   */
  static calculateEmployeeMetrics(allTasks, config, sprintMetrics) {
    const tasks = this.deliveryTasks(allTasks);
    const empMap = new Map();

    tasks.forEach(t => {
      const rawOwner = t.owner || 'Unassigned';
      const profile = this.team() ? this.team().resolve(rawOwner) : null;
      const owner = profile ? profile.employee_name : rawOwner;
      if (!empMap.has(owner)) {
        empMap.set(owner, {
          name: owner,
          tasks: [],
          totalAssigned: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          blocked: 0,
          cancelled: 0,
          highCount: 0,
          medCount: 0,
          lowCount: 0,
          estHours: 0,
          actHours: 0
        });
      }

      const e = empMap.get(owner);
      e.tasks.push(t);
      e.totalAssigned++;

      const st = (t.status || 'pending').toLowerCase();
      if (st === 'completed') e.completed++;
      else if (st === 'in progress' || st === 'in_progress') e.inProgress++;
      else if (st === 'blocked') e.blocked++;
      else if (st === 'cancelled') e.cancelled++;
      else e.pending++;

      const p = (t.priority || 'medium').toLowerCase();
      if (p === 'high') e.highCount++;
      else if (p === 'low') e.lowCount++;
      else e.medCount++;

      e.estHours += t.est || 0;
      e.actHours += t.act || 0;
    });

    const employees = [];
    const teamTotalAct = sprintMetrics.totalAct || 1;
    const teamAvgAct = sprintMetrics.teamSize > 0 ? teamTotalAct / sprintMetrics.teamSize : teamTotalAct;

    empMap.forEach(e => {
      const activeCount = e.totalAssigned - e.cancelled;
      const completionPct = activeCount > 0 ? (e.completed / activeCount) * 100 : 0;
      const variance = e.actHours - e.estHours;
      const variancePct = e.estHours > 0 ? (variance / e.estHours) * 100 : 0;
      const efficiencyPct = e.actHours > 0 ? (e.estHours / e.actHours) * 100 : (e.estHours === 0 ? 100 : 0);
      const workloadPct = (e.actHours / teamTotalAct) * 100;

      // Workload classification
      let workloadStatus = 'Balanced';
      if (teamAvgAct > 0) {
        const ratio = e.actHours / teamAvgAct;
        if (ratio < config.workloadThresholds.underloadedRatio) {
          workloadStatus = 'Underloaded';
        } else if (ratio > config.workloadThresholds.overloadedRatio) {
          workloadStatus = 'Overloaded';
        }
      }

      // --- Transparent Multi-Dimension Scoring Engine (0 - 100) ---
      // Weights: Delivery (30), Effort (25), Priority (20), Workload (15), Risk (10)
      const w = config.scoringWeights;

      // 1. Delivery Score (0 - 100)
      const deliveryScore = Math.min(100, completionPct);

      // 2. Effort Score (0 - 100)
      // Ideal efficiency is around 90-110%. High efficiency is good, severe overrun is penalized.
      let effortScore = 100;
      if (variancePct > 35) effortScore = Math.max(30, 100 - (variancePct - 35) * 1.5);
      else if (variancePct > 15) effortScore = Math.max(70, 100 - (variancePct - 15) * 1.2);
      else if (variancePct < -50) effortScore = 90; // minor penalty if vastly under-estimated

      // 3. Priority Score (0 - 100)
      // Checks completed high priority items vs total high priority items
      let priorityScore = 100;
      const highTasks = e.tasks.filter(t => (t.priority || '').toLowerCase() === 'high');
      if (highTasks.length > 0) {
        const completedHigh = highTasks.filter(t => (t.status || '').toLowerCase() === 'completed').length;
        priorityScore = (completedHigh / highTasks.length) * 100;
      }

      // 4. Workload Score (0 - 100)
      // Overloaded or Underloaded receives a slight calibration adjustment
      let workloadScore = 95;
      if (workloadStatus === 'Overloaded') workloadScore = 80;
      else if (workloadStatus === 'Underloaded') workloadScore = 75;

      // 5. Risk Score (0 - 100)
      let riskScore = 100;
      if (e.blocked > 0) riskScore -= (e.blocked * 30);
      const highOverruns = e.tasks.filter(t => (t.act > t.est * 1.35) && (t.act - t.est >= 3)).length;
      if (highOverruns > 0) riskScore -= (highOverruns * 15);
      riskScore = Math.max(0, riskScore);

      // Weighted Total Score
      const totalScore = (
        (deliveryScore * w.delivery) +
        (effortScore * w.effort) +
        (priorityScore * w.priority) +
        (workloadScore * w.workload) +
        (riskScore * w.risk)
      ) / 100;

      const roundedScore = Math.round(Math.max(0, Math.min(100, totalScore)));

      // Assign RAG Status
      let rag = 'GREEN';
      if (roundedScore < config.ragThresholds.amberMin) {
        rag = 'RED';
      } else if (roundedScore < config.ragThresholds.greenMin) {
        rag = 'AMBER';
      }

      // Generate AI Insights & Observations
      const insights = this.generateEmployeeInsights({
        name: e.name,
        completed: e.completed,
        totalAssigned: e.totalAssigned,
        estHours: e.estHours,
        actHours: e.actHours,
        variance,
        variancePct,
        efficiencyPct,
        completionPct,
        blocked: e.blocked,
        inProgress: e.inProgress,
        highCount: e.highCount,
        tasks: e.tasks,
        workloadStatus,
        rag
      });

      const profile = this.team() ? this.team().resolve(e.name) : null;

      employees.push({
        name: e.name,
        designation: profile ? profile.designation : 'Unlisted Resource',
        sprintRole: profile ? profile.sprint_role : 'Team Member',
        resourceType: profile ? profile.resource_type : 'Delivery',
        roleBadge: profile ? profile.role_badge : null,
        isDeliveryResource: true,
        isScrumMaster: false,
        totalAssigned: e.totalAssigned,
        completed: e.completed,
        inProgress: e.inProgress,
        pending: e.pending,
        blocked: e.blocked,
        cancelled: e.cancelled,
        completionPct: Math.round(completionPct * 10) / 10,
        estHours: Math.round(e.estHours * 10) / 10,
        actHours: Math.round(e.actHours * 10) / 10,
        variance: Math.round(variance * 10) / 10,
        variancePct: Math.round(variancePct * 10) / 10,
        efficiencyPct: Math.round(efficiencyPct * 10) / 10,
        workloadPct: Math.round(workloadPct * 10) / 10,
        workloadStatus,
        highCount: e.highCount,
        medCount: e.medCount,
        lowCount: e.lowCount,
        score: roundedScore,
        scoreBreakdown: {
          delivery: Math.round(deliveryScore),
          effort: Math.round(effortScore),
          priority: Math.round(priorityScore),
          workload: Math.round(workloadScore),
          risk: Math.round(riskScore)
        },
        rag,
        observation: insights.observation,
        recommendation: insights.recommendation,
        topContributions: insights.topContributions,
        concerns: insights.concerns,
        tasks: e.tasks
      });
    });

    // Sort descending by score / active hours
    employees.sort((a, b) => b.score - a.score || b.actHours - a.actHours);
    return employees;
  }

  /**
   * Generates tailored, data-grounded AI observations and recommendations for an employee
   */
  static generateEmployeeInsights(emp) {
    let observation = '';
    let recommendation = '';
    const topContributions = [];
    const concerns = [];

    // Find top tasks delivered
    const completedTasks = emp.tasks.filter(t => (t.status || '').toLowerCase() === 'completed');
    completedTasks.sort((a, b) => (b.act || 0) - (a.act || 0));
    completedTasks.slice(0, 3).forEach(t => {
      topContributions.push(`${t.item} (${t.act}h logged)`);
    });

    // Identify specific task concerns
    emp.tasks.forEach(t => {
      const st = (t.status || '').toLowerCase();
      if (st === 'blocked') {
        concerns.push(`Blocked on "${t.item}" (${t.act}h logged, high priority blocker)`);
      } else if (t.act > t.est * 1.35 && (t.act - t.est >= 3)) {
        concerns.push(`Effort overrun on "${t.item}" (${t.act}h actual vs ${t.est}h estimated, +${Math.round((t.act - t.est) * 10) / 10}h)`);
      }
    });

    // Build Observation
    if (emp.completionPct === 100 && emp.variance <= 0) {
      observation = `${emp.name} achieved a 100% completion rate across ${emp.totalAssigned} assigned tasks within ${emp.actHours}h against an estimated ${emp.estHours}h (${emp.efficiencyPct}% efficiency), demonstrating superior planning discipline and output.`;
      recommendation = `Recognize stellar sprint execution; consider assigning complex architectural ownership or cross-mentoring in upcoming sprints.`;
    } else if (emp.completionPct >= 85 && emp.variancePct <= 15) {
      observation = `${emp.name} delivered ${emp.completed} of ${emp.totalAssigned} tasks (${emp.completionPct}%) with controlled effort variance (+${emp.variance}h, ${emp.efficiencyPct}% efficiency), meeting delivery milestones reliably.`;
      recommendation = `Maintain current capacity allocation and support resolution of remaining in-flight items.`;
    } else if (emp.blocked > 0) {
      observation = `${emp.name} logged ${emp.actHours}h but is currently obstructed by ${emp.blocked} blocked task(s), notably impacting overall sprint throughput.`;
      recommendation = `Lead PM should immediately escalate external dependencies and unblock technical prerequisites to prevent delivery slippage.`;
    } else if (emp.variancePct > 25 && emp.completionPct < 80) {
      observation = `${emp.name} experienced noticeable effort overruns (+${emp.variance}h / +${emp.variancePct}%) while completing ${emp.completed} of ${emp.totalAssigned} tasks, indicating unforeseen scope complexity or estimation drift.`;
      recommendation = `Conduct a targeted post-sprint estimation review to calibrate task sizing and provide paired support on complex modules.`;
    } else if (emp.workloadStatus === 'Overloaded') {
      observation = `${emp.name} carried a high workload concentration of ${emp.actHours}h (${emp.workloadPct}% of team total), completing ${emp.completed}/${emp.totalAssigned} tasks under elevated delivery pressure.`;
      recommendation = `Rebalance task distribution in next sprint planning to prevent burnout and mitigate single-point dependency risk.`;
    } else if (emp.workloadStatus === 'Underloaded') {
      observation = `${emp.name} was allocated ${emp.actHours}h (${emp.completed}/${emp.totalAssigned} completed), operating below average team capacity utilization.`;
      recommendation = `Assign higher-leverage sprint backlog items or allocate available bandwidth to secondary QA / technical review.`;
    } else {
      observation = `${emp.name} logged ${emp.actHours}h against ${emp.estHours}h planned, completing ${emp.completed} tasks with an overall efficiency of ${emp.efficiencyPct}%.`;
      recommendation = `Continue monitoring task velocity and refine estimation granularity during backlog grooming.`;
    }

    if (topContributions.length === 0) topContributions.push('Active contributor across sprint scope');
    if (concerns.length === 0) concerns.push('No critical blockers or severe overruns identified');

    return { observation, recommendation, topContributions, concerns };
  }

  /**
   * Workload Analysis Metrics & Distribution Score
   */
  static calculateWorkload(tasks, config, employees) {
    const totalHours = employees.reduce((sum, e) => sum + e.actHours, 0);
    const count = employees.length || 1;
    const avgHours = totalHours / count;

    let maxHours = 0;
    let minHours = Infinity;
    let maxEmployee = null;
    let minEmployee = null;

    employees.forEach(e => {
      if (e.actHours > maxHours) {
        maxHours = e.actHours;
        maxEmployee = e.name;
      }
      if (e.actHours < minHours) {
        minHours = e.actHours;
        minEmployee = e.name;
      }
    });

    if (minHours === Infinity) minHours = 0;

    // Calculate Standard Deviation for Imbalance Score
    const varianceSum = employees.reduce((sum, e) => sum + Math.pow(e.actHours - avgHours, 2), 0);
    const stdDev = Math.sqrt(varianceSum / count);
    const imbalanceScore = avgHours > 0 ? Math.min(100, Math.round((stdDev / avgHours) * 100)) : 0;

    const underloadedList = employees.filter(e => e.workloadStatus === 'Underloaded');
    const balancedList = employees.filter(e => e.workloadStatus === 'Balanced');
    const overloadedList = employees.filter(e => e.workloadStatus === 'Overloaded');

    return {
      totalHours: Math.round(totalHours * 10) / 10,
      avgHours: Math.round(avgHours * 10) / 10,
      maxHours: Math.round(maxHours * 10) / 10,
      minHours: Math.round(minHours * 10) / 10,
      maxEmployee: maxEmployee || 'N/A',
      minEmployee: minEmployee || 'N/A',
      imbalanceScore,
      underloadedCount: underloadedList.length,
      balancedCount: balancedList.length,
      overloadedCount: overloadedList.length,
      underloadedList,
      balancedList,
      overloadedList
    };
  }

  /**
   * Project & Client Level Breakdown & Extraction
   */
  static extractProjects(tasks) {
    const projMap = new Map();

    tasks.forEach(t => {
      let projectName = 'General Delivery';
      const itemStr = t.item || '';

      // Pattern: "Project Name | Activity" or "Project Name - Activity"
      if (itemStr.includes('|')) {
        projectName = itemStr.split('|')[0].trim();
      } else if (itemStr.includes(' - ')) {
        projectName = itemStr.split(' - ')[0].trim();
      } else {
        // Specific keyword checks
        const lower = itemStr.toLowerCase();
        if (lower.includes('vee networks')) projectName = 'Vee Networks';
        else if (lower.includes('allenhouse')) projectName = 'Allenhouse Group';
        else if (lower.includes('fastranking')) projectName = 'Fastranking';
        else if (lower.includes('vee repairs')) projectName = 'Vee Repairs';
        else if (lower.includes('sparta crm')) projectName = 'SPARTA CRM';
        else if (lower.includes('sparta website') || lower.includes('sparta telecom')) projectName = 'Sparta Website';
        else if (lower.includes('reading refurbishment')) projectName = 'Reading Refurbishment';
        else if (lower.includes('sofiya design')) projectName = 'Sofiya Design Academy';
        else if (lower.includes('88 driving')) projectName = '88 Driving School';
        else if (lower.includes('seo audit') || lower.includes('catesby england')) projectName = 'SEO & Retainers';
        else if (lower.includes('dma phase')) projectName = 'DMA Implementation';
        else if (lower.includes('shopify') || lower.includes('patrick shoes')) projectName = 'Shopify E-Commerce';
        else if (lower.includes('generic cms')) projectName = 'Generic CMS';
        else if (lower.includes('reading design')) projectName = 'Reading Design Studio';
        else if (lower.includes('optimum global')) projectName = 'Optimum Global Care';
        else if (lower.includes('nomads trade')) projectName = 'Nomads Trade Website';
        else projectName = itemStr.slice(0, 24).trim();
      }

      if (!projMap.has(projectName)) {
        projMap.set(projectName, {
          name: projectName,
          tasks: [],
          totalTasks: 0,
          completed: 0,
          estHours: 0,
          actHours: 0,
          owners: new Set()
        });
      }

      const p = projMap.get(projectName);
      p.tasks.push(t);
      p.totalTasks++;
      if ((t.status || '').toLowerCase() === 'completed') p.completed++;
      p.estHours += t.est || 0;
      p.actHours += t.act || 0;
      if (t.owner && t.owner !== 'Unassigned') p.owners.add(t.owner);
    });

    const projects = [];
    projMap.forEach(p => {
      const completionPct = p.totalTasks > 0 ? (p.completed / p.totalTasks) * 100 : 0;
      const variance = p.actHours - p.estHours;
      const variancePct = p.estHours > 0 ? (variance / p.estHours) * 100 : 0;

      let rag = 'GREEN';
      if (completionPct < 60 || variancePct > 30) rag = 'RED';
      else if (completionPct < 85 || variancePct > 15) rag = 'AMBER';

      projects.push({
        name: p.name,
        taskCount: p.totalTasks,
        completedCount: p.completed,
        completionPct: Math.round(completionPct * 10) / 10,
        estHours: Math.round(p.estHours * 10) / 10,
        actHours: Math.round(p.actHours * 10) / 10,
        variance: Math.round(variance * 10) / 10,
        variancePct: Math.round(variancePct * 10) / 10,
        assignedOwners: Array.from(p.owners),
        rag,
        tasks: p.tasks
      });
    });

    // Sort descending by actual hours
    projects.sort((a, b) => b.actHours - a.actHours);
    return projects;
  }

  /**
   * Priority Analysis
   */
  static calculatePriorityMetrics(tasks) {
    const priorities = {
      High: { count: 0, completed: 0, est: 0, act: 0 },
      Medium: { count: 0, completed: 0, est: 0, act: 0 },
      Low: { count: 0, completed: 0, est: 0, act: 0 }
    };

    tasks.forEach(t => {
      const p = t.priority || 'Medium';
      if (!priorities[p]) priorities[p] = { count: 0, completed: 0, est: 0, act: 0 };
      priorities[p].count++;
      if ((t.status || '').toLowerCase() === 'completed') priorities[p].completed++;
      priorities[p].est += t.est || 0;
      priorities[p].act += t.act || 0;
    });

    const result = [];
    ['High', 'Medium', 'Low'].forEach(p => {
      const data = priorities[p];
      const completionPct = data.count > 0 ? (data.completed / data.count) * 100 : 0;
      const variance = data.act - data.est;
      const variancePct = data.est > 0 ? (variance / data.est) * 100 : 0;
      result.push({
        priority: p,
        taskCount: data.count,
        completedCount: data.completed,
        completionPct: Math.round(completionPct * 10) / 10,
        estHours: Math.round(data.est * 10) / 10,
        actHours: Math.round(data.act * 10) / 10,
        variance: Math.round(variance * 10) / 10,
        variancePct: Math.round(variancePct * 10) / 10
      });
    });

    return result;
  }

  /**
   * Sprint Risk Register Engine
   */
  static identifyRisks(tasks, config, employees, sprintMetrics) {
    const risks = [];
    let riskCounter = 1;

    // 1. Blocked Tasks (Critical/High Severity)
    tasks.filter(t => (t.status || '').toLowerCase() === 'blocked').forEach(t => {
      risks.push({
        id: `RSK-${String(riskCounter++).padStart(3, '0')}`,
        type: 'Blocked Activity',
        task: t.item,
        owner: t.owner,
        priority: t.priority,
        impact: 'High',
        severity: 'Critical',
        rag: 'RED',
        description: `Task "${t.item}" is currently blocked with ${t.act}h logged, halting downstream release milestones.`,
        action: `Escalate dependency to PMO Lead & technical stakeholders for immediate unblocking.`
      });
    });

    // 2. High Priority Incomplete / In-Progress Tasks with High Effort
    tasks.filter(t => (t.priority || '').toLowerCase() === 'high' && (t.status || '').toLowerCase() === 'in progress' && t.act >= (t.est || 10)).forEach(t => {
      risks.push({
        id: `RSK-${String(riskCounter++).padStart(3, '0')}`,
        type: 'High Priority Overrun',
        task: t.item,
        owner: t.owner,
        priority: t.priority,
        impact: 'High',
        severity: 'High',
        rag: 'AMBER',
        description: `High-priority item "${t.item}" has consumed ${t.act}h (against ${t.est}h est) and remains in progress.`,
        action: `Review remaining work breakdown and assign secondary developer support to ensure timely sprint closure.`
      });
    });

    // 3. Significant Effort Variance (> 35% overrun and >= 4h diff)
    tasks.filter(t => (t.act - t.est >= 4) && (t.est > 0 && ((t.act - t.est) / t.est) > 0.35)).forEach(t => {
      risks.push({
        id: `RSK-${String(riskCounter++).padStart(3, '0')}`,
        type: 'Estimation Drift',
        task: t.item,
        owner: t.owner,
        priority: t.priority,
        impact: 'Medium',
        severity: 'Medium',
        rag: 'AMBER',
        description: `Effort overrun of +${Math.round((t.act - t.est) * 10) / 10}h (+${Math.round(((t.act - t.est) / t.est) * 100)}%) observed on "${t.item}".`,
        action: `Conduct root-cause analysis during retrospective to calibrate future story point estimations.`
      });
    });

    // 4. Overloaded Employee Concentration Risk
    employees.filter(e => e.workloadStatus === 'Overloaded').forEach(e => {
      risks.push({
        id: `RSK-${String(riskCounter++).padStart(3, '0')}`,
        type: 'Resource Over-utilization',
        task: `${e.name} (${e.totalAssigned} tasks, ${e.actHours}h logged)`,
        owner: e.name,
        priority: 'High',
        impact: 'High',
        severity: 'High',
        rag: 'RED',
        description: `${e.name} is carrying ${e.workloadPct}% of total team effort, presenting single-point-of-failure and burnout risks.`,
        action: `Re-distribute active workload and establish knowledge sharing on key customer deliverables.`
      });
    });

    return risks;
  }

  /**
   * Management Executive Summary Generator
   */
  static generateExecutiveSummary(sprint, sprintMetrics, employees, risks) {
    const { totalTasks, completed, completionPct, totalEst, totalAct, variance, efficiencyPct, rag, teamSize } = sprintMetrics;
    const criticalRisks = risks.filter(r => r.severity === 'Critical');
    const greenEmployees = employees.filter(e => e.rag === 'GREEN').length;
    const redEmployees = employees.filter(e => e.rag === 'RED').length;

    let leadText = `Sprint execution concluded with an overall **${rag}** health rating, achieving a **${completionPct}% completion rate** (${completed} of ${totalTasks} committed deliverables resolved).`;
    
    let effortText = `Total engineering effort recorded stood at **${totalAct}h** against a planned baseline of **${totalEst}h**, resulting in a net variance of **${variance >= 0 ? '+' : ''}${variance}h** and an aggregate team efficiency of **${efficiencyPct}%**.`;

    let teamText = `Resource distribution across ${teamSize} active delivery resources showed ${greenEmployees} members maintaining optimal Green RAG velocity, while ${redEmployees} contributor(s) experienced delivery hurdles or severe capacity constraints.`;

    let riskText = criticalRisks.length > 0 
      ? `Management attention is immediately directed toward ${criticalRisks.length} critical blocker(s), most notably: "${criticalRisks[0].task}" assigned to ${criticalRisks[0].owner}.`
      : `No blocking impediments were active at sprint close; in-flight tasks have been transitioned cleanly to the upcoming iteration.`;

    return `${leadText} ${effortText}\n\n${teamText} ${riskText}`;
  }

  /**
   * Format an employee profile consistently.
   */
  static _formatEmployee(profile) {
    if (!profile) return 'Unassigned';
    return profile.employee_name + (profile.designation ? ` / ${profile.designation}` : '');
  }

  /**
   * Build a deterministic snapshot of allowed values for retrospective generation.
   */
  static buildRetrospectiveSnapshot(sprint, metrics, employees, risks, projects, leadership) {
    const team = this.team();
    const deliveryTasks = this.deliveryTasks(sprint.tasks || []);
    const allowedEmployeeNames = new Set();
    const allowedEmployeeDisplay = new Set();

    (employees || []).forEach(e => {
      allowedEmployeeNames.add(e.name);
      const r = team ? team.resolve(e.name) : null;
      if (r && r.employee_name) allowedEmployeeDisplay.add(this._formatEmployee(r));
    });

    const members = (leadership && leadership.members) ? leadership.members : (leadership || []);
    members.forEach(m => {
      allowedEmployeeNames.add(m.name);
      const r = team ? team.resolve(m.name) : null;
      if (r && r.employee_name) allowedEmployeeDisplay.add(this._formatEmployee(r));
    });

    ['Sprint Leadership', 'Delivery Team', 'Team', 'Unassigned'].forEach(t => allowedEmployeeDisplay.add(t));

    const allowedOwners = new Set(allowedEmployeeDisplay);
    allowedEmployeeNames.forEach(n => allowedOwners.add(n));

    const allowedTaskNames = new Set(deliveryTasks.map(t => t.item).filter(Boolean));
    const allowedProjectNames = new Set((projects || []).map(p => p.name).filter(Boolean));
    const allTaskItems = (sprint.tasks || []).map(t => t.item).filter(Boolean);
    const nonAllowedTasks = allTaskItems.filter(item => !allowedTaskNames.has(item));

    const allowedNumbers = new Set();
    const addNum = (v) => {
      if (typeof v !== 'number' || isNaN(v)) return;
      allowedNumbers.add(String(v));
      allowedNumbers.add(String(Math.round(v * 10) / 10));
      allowedNumbers.add(String(Math.round(v)));
      allowedNumbers.add(String(Math.floor(v)));
      allowedNumbers.add(String(Math.ceil(v)));
      if (v % 1 !== 0) allowedNumbers.add(String(Number(v).toFixed(1)));
    };

    const addNumericProps = (obj) => {
      if (!obj) return;
      Object.values(obj).forEach(v => {
        if (typeof v === 'number') addNum(v);
        if (Array.isArray(v)) v.forEach(x => { if (typeof x === 'number') addNum(x); });
      });
    };

    addNumericProps(metrics);
    (employees || []).forEach(addNumericProps);
    (risks || []).forEach(addNumericProps);
    (projects || []).forEach(addNumericProps);
    members.forEach(addNumericProps);
    deliveryTasks.forEach(addNumericProps);

    // Per-task derived numbers used by risk descriptions
    deliveryTasks.forEach(t => {
      const v = (t.act || 0) - (t.est || 0);
      addNum(v);
      if (t.est > 0) {
        addNum((v / t.est) * 100);
        addNum(Math.round((v / t.est) * 100));
      }
    });

    // Common constants and derived averages
    addNum(100);
    addNum(0);
    if (metrics && metrics.teamSize > 0) {
      const avg = metrics.totalAct / metrics.teamSize;
      addNum(avg);
      allowedNumbers.add(String(avg.toFixed(1)));
    }
    if (metrics) {
      addNum(metrics.totalTasks - metrics.completed);
    }
    if (employees) {
      addNum(employees.filter(e => e.rag === 'GREEN').length);
      addNum(employees.filter(e => e.rag === 'RED').length);
    }
    if (risks) {
      addNum(risks.filter(r => r.severity === 'Critical').length);
    }

    const allowedStatuses = new Set(deliveryTasks.map(t => String(t.status || 'pending').toLowerCase()));
    ['completed', 'in progress', 'in_progress', 'blocked', 'pending', 'cancelled'].forEach(s => allowedStatuses.add(s));

    const allowedPriorities = new Set(deliveryTasks.map(t => String(t.priority || 'medium').toLowerCase()));
    ['high', 'medium', 'low', 'High', 'Medium', 'Low'].forEach(p => allowedPriorities.add(p));

    const allowedRags = new Set(['GREEN', 'AMBER', 'RED', 'green', 'amber', 'red']);
    if (metrics && metrics.rag) allowedRags.add(metrics.rag);
    (employees || []).forEach(e => allowedRags.add(e.rag));
    (projects || []).forEach(p => allowedRags.add(p.rag));
    (risks || []).forEach(r => allowedRags.add(r.rag));

    // Allow numeric tokens that appear inside task, project or employee display names
    // (e.g. "88 Driving School", "DMA Phase 2", "Shopify E-Commerce 2024").
    const addNumericTokens = (items) => {
      (items || []).forEach(s => {
        const matches = String(s).match(/\d+(\.\d+)?/g);
        if (matches) matches.forEach(n => allowedNumbers.add(n));
      });
    };
    addNumericTokens(allowedTaskNames);
    addNumericTokens(allowedProjectNames);
    addNumericTokens(allowedEmployeeNames);
    addNumericTokens(allowedEmployeeDisplay);

    const fullRoster = (team ? team.all() : []).map(r => r.employee_name);
    const nonAllowedEmployees = fullRoster.filter(n => !allowedEmployeeNames.has(n) && !allowedEmployeeDisplay.has(n));

    const allowedEmployeeTokens = new Set();
    allowedEmployeeNames.forEach(n => allowedEmployeeTokens.add(String(n).toLowerCase()));
    allowedEmployeeDisplay.forEach(d => d.split(/[^a-z0-9]+/i).forEach(tok => { if (tok) allowedEmployeeTokens.add(tok.toLowerCase()); }));
    const nonAllowedEmployeeTokens = new Set(nonAllowedEmployees.map(n => String(n).toLowerCase()));

    return {
      sprintId: sprint && sprint.id,
      timestamp: Date.now(),
      allowedEmployeeNames: Array.from(allowedEmployeeNames).sort(),
      allowedEmployeeDisplay: Array.from(allowedEmployeeDisplay).sort(),
      allowedOwners: Array.from(allowedOwners).sort(),
      allowedEmployeeTokens: Array.from(allowedEmployeeTokens).sort(),
      nonAllowedEmployeeTokens: Array.from(nonAllowedEmployeeTokens).sort(),
      allowedTaskNames: Array.from(allowedTaskNames).sort(),
      allowedProjectNames: Array.from(allowedProjectNames).sort(),
      allTaskItems,
      nonAllowedTasks,
      allowedNumbers: Array.from(allowedNumbers).sort(),
      allowedStatuses: Array.from(allowedStatuses).sort(),
      allowedPriorities: Array.from(allowedPriorities).sort(),
      allowedRags: Array.from(allowedRags).sort()
    };
  }

  /**
   * Pre-validate that all required analysis inputs are present and consistent.
   */
  static preValidateSnapshot(sprint, metrics, employees, risks, projects, leadership) {
    const errors = [];
    if (!sprint || !sprint.id) errors.push('Sprint is missing or has no id.');
    if (!metrics) errors.push('Metrics input is missing.');
    if (!Array.isArray(employees)) errors.push('Employees input must be an array.');
    if (!Array.isArray(risks)) errors.push('Risks input must be an array.');
    if (!Array.isArray(projects)) errors.push('Projects input must be an array.');
    if (!leadership || !Array.isArray(leadership.members)) errors.push('Leadership input is missing members.');

    if (sprint && sprint.tasks && projects) {
      const allTaskKeys = new Set((sprint.tasks || []).map(t => t.id || t.item).filter(Boolean));
      projects.forEach((p, i) => {
        (p.tasks || []).forEach(t => {
          const key = t.id || t.item;
          if (key && !allTaskKeys.has(key)) {
            errors.push(`Project ${i} references task not in sprint: ${key}`);
          }
        });
      });
    }

    return { ok: errors.length === 0, errors };
  }

  /**
   * Post-validate a generated retrospective against the allowed snapshot.
   */
  static postValidateGeneratedRetrospective(retrospective, snapshot) {
    if (!retrospective || !snapshot) {
      return { status: 'FAILED', errors: ['Retrospective or snapshot missing.'] };
    }

    const errors = [];

    const isAllowedNumber = (n) => {
      const f = parseFloat(n);
      const cands = [String(f), String(Math.round(f * 10) / 10), String(Math.round(f)), String(Math.floor(f)), String(Math.ceil(f))];
      if (f % 1 !== 0) cands.push(String(f.toFixed(1)));
      return cands.some(c => snapshot.allowedNumbers.includes(c));
    };

    const visit = (val, path) => {
      if (val === null || val === undefined) return;
      if (path.startsWith('sprintLeadership')) return;
      if (path.startsWith('__')) return;
      if (Array.isArray(val)) {
        val.forEach((v, i) => visit(v, `${path}[${i}]`));
        return;
      }
      if (typeof val === 'object') {
        Object.entries(val).forEach(([k, v]) => visit(v, path ? `${path}.${k}` : k));
        return;
      }
      if (typeof val === 'number') {
        if (!isAllowedNumber(String(val))) {
          errors.push(`${path}: disallowed number ${val}`);
        }
        return;
      }
      if (typeof val === 'string') {
        const lower = val.toLowerCase();

        const words = lower.split(/[\s.,;:!?(){}[\]\/\\'"|&*+~–—\-]+/).filter(Boolean);
        (snapshot.nonAllowedEmployeeTokens || []).forEach(tok => {
          if (words.includes(tok)) errors.push(`${path}: contains non-allowed employee name "${tok}"`);
        });

        (snapshot.nonAllowedTasks || []).forEach(item => {
          if (lower.includes(String(item).toLowerCase())) {
            errors.push(`${path}: contains non-allowed task/project "${item}"`);
          }
        });

        if (path.endsWith('.owner')) {
          const parts = val.split(/\s*,\s*|\s+&\s+/);
          parts.forEach(part => {
            if (!snapshot.allowedOwners.some(o => o.toLowerCase() === part.toLowerCase())) {
              errors.push(`${path}: owner "${part}" not in allowed set`);
            }
          });
        }

        if (path.endsWith('.priority')) {
          if (!snapshot.allowedPriorities.some(p => String(p).toLowerCase() === val.toLowerCase())) {
            errors.push(`${path}: disallowed priority "${val}"`);
          }
        }

        const numberMatches = val.match(/[-+]?\d+(\.\d+)?/g) || [];
        numberMatches.forEach(n => {
          if (!isAllowedNumber(n)) {
            errors.push(`${path}: string contains disallowed number ${n}`);
          }
        });
      }
    };

    visit(retrospective, '');

    return { status: errors.length === 0 ? 'PASSED' : 'FAILED', errors };
  }

  /**
   * Build an empty retrospective shell when validation fails.
   */
  static _emptyRetrospective(snapshot, status, validationErrors, analysisVersion) {
    return {
      summary: 'Retrospective could not be generated because input validation failed.',
      sprintLeadership: { scrumMaster: null, members: [], deliveryRoster: [], excludedFromCapacity: { headcount: 0, taskCount: 0, estHours: 0, actHours: 0 } },
      retrospectiveOwner: 'Sprint Leadership',
      whatWentWell: [],
      whatDidNotGoWell: [],
      keyAchievements: [],
      bottlenecks: [],
      resourceUtilizationSummary: '',
      estimationAccuracySummary: '',
      recommendations: [],
      nextSprintActions: [],
      __validationStatus: status,
      __validationErrors: validationErrors,
      __snapshot: snapshot,
      __analysisVersion: analysisVersion || (snapshot && snapshot.timestamp) || Date.now()
    };
  }

  /**
   * Build, pre-validate, generate, post-validate and wrap a retrospective.
   */
  static generateValidatedRetrospective(sprint, metrics, employees, risks, projects, leadership, analysisVersion = null) {
    const snapshot = this.buildRetrospectiveSnapshot(sprint, metrics, employees, risks, projects, leadership);
    const pre = this.preValidateSnapshot(sprint, metrics, employees, risks, projects, leadership);

    let content, post;
    if (!pre.ok) {
      content = this._emptyRetrospective(snapshot, 'PRE_VALIDATION_FAILED', pre.errors, analysisVersion);
      post = { status: 'FAILED', errors: pre.errors };
    } else {
      content = this.generateRetrospective(sprint, metrics, employees, risks, projects, leadership);
      post = this.postValidateGeneratedRetrospective(content, snapshot);

      if (post.status !== 'PASSED') {
        const retry = this.generateRetrospective(sprint, metrics, employees, risks, projects, leadership);
        const retryPost = this.postValidateGeneratedRetrospective(retry, snapshot);
        if (retryPost.status === 'PASSED') {
          content = retry;
          post = retryPost;
        }
      }
    }

    content.__validationStatus = post.status;
    content.__validationErrors = post.errors;
    content.__snapshot = snapshot;
    content.__analysisVersion = analysisVersion || snapshot.timestamp;
    return content;
  }

  /**
   * Complete Sprint Retrospective Generator
   */
  static generateRetrospective(sprint, metrics, employees, risks, projects, leadership = null) {
    const fmt = (raw) => {
      const p = this.team() ? this.team().resolve(raw) : null;
      if (p && p.employee_name) {
        return p.employee_name + (p.designation ? ` / ${p.designation}` : '');
      }
      return raw || 'Unassigned';
    };

    // What Went Well
    const whatWentWell = [];
    if (metrics.completionPct >= 85) {
      whatWentWell.push(`High delivery success rate with ${metrics.completionPct}% of sprint deliverables successfully finished.`);
    }
    const topPerformers = employees.filter(e => e.rag === 'GREEN' && e.completionPct >= 90);
    if (topPerformers.length > 0) {
      whatWentWell.push(`Strong individual execution by ${topPerformers.map(e => e.name).join(', ')} delivering full commitments within planned capacity.`);
    }
    const onTimeProjects = projects.filter(p => p.completionPct >= 80 && p.variance <= 2);
    if (onTimeProjects.length > 0) {
      whatWentWell.push(`Disciplined milestone tracking across key client accounts: ${onTimeProjects.slice(0, 3).map(p => p.name).join(', ')}.`);
    }
    if (metrics.efficiencyPct >= 90 && metrics.efficiencyPct <= 110) {
      whatWentWell.push(`High estimation accuracy overall (${metrics.efficiencyPct}% efficiency), reflecting reliable scope sizing.`);
    }
    if (whatWentWell.length === 0) {
      whatWentWell.push('Core baseline architecture and task tracking maintained across all active workstreams.');
    }

    // What Did Not Go Well
    const whatDidNotGoWell = [];
    if (metrics.blocked > 0) {
      whatDidNotGoWell.push(`${metrics.blocked} task(s) encountered external dependencies or blocking impediments during execution.`);
    }
    const overruns = projects.filter(p => p.variancePct > 20);
    if (overruns.length > 0) {
      whatDidNotGoWell.push(`Effort overruns recorded on ${overruns.map(p => `${p.name} (+${p.variance}h)`).join(', ')} due to unanticipated scope expansion.`);
    }
    const overloadedEmps = employees.filter(e => e.workloadStatus === 'Overloaded');
    if (overloadedEmps.length > 0) {
      whatDidNotGoWell.push(`Capacity imbalance: heavy task loading concentrated on ${overloadedEmps.map(e => e.name).join(', ')}.`);
    }
    if (metrics.completionPct < 80) {
      whatDidNotGoWell.push(`Lower than targeted completion rate (${metrics.completionPct}%), deferring ${metrics.totalTasks - metrics.completed} items into subsequent planning.`);
    }
    if (whatDidNotGoWell.length === 0) {
      whatDidNotGoWell.push('Minor estimation variance across selected non-critical tasks.');
    }

    // Key Achievements
    const keyAchievements = [];
    const completedHigh = projects.flatMap(p => p.tasks).filter(t => (t.priority || '').toLowerCase() === 'high' && (t.status || '').toLowerCase() === 'completed');
    completedHigh.slice(0, 5).forEach(t => {
      const ownerDisplay = fmt(t.owner);
      keyAchievements.push(`Successfully delivered high-priority milestone: "${t.item}" by ${ownerDisplay}.`);
    });
    if (keyAchievements.length === 0) {
      keyAchievements.push(`Maintained active development pace with ${metrics.completed} deliverables resolved.`);
    }

    // Challenges & Bottlenecks
    const bottlenecks = risks.map(r => `${r.type}: ${r.description}`);

    // Recommended Improvements (data-driven from actual sprint metrics and risks)
    const recommendations = [];
    if (metrics.blocked > 0) {
      const blockedTasks = this.deliveryTasks(sprint.tasks || []).filter(t => (t.status || '').toLowerCase() === 'blocked');
      const owners = [...new Set(blockedTasks.map(t => fmt(t.owner)))].slice(0, 3).join(', ');
      recommendations.push(`Run a focused daily dependency triage for the ${metrics.blocked} blocked task(s)${owners ? ` owned by ${owners}` : ''}.`);
    }
    if (overloadedEmps.length > 0) {
      const names = overloadedEmps.slice(0, 3).map(e => e.name).join(', ');
      recommendations.push(`Rebalance workload for ${names} to keep individual utilization within a healthy range of the team average.`);
    }
    if (overruns.length > 0) {
      const names = overruns.slice(0, 2).map(p => p.name).join(' and ');
      recommendations.push(`Re-estimate in-flight items in ${names} and revise sprint planning baselines.`);
    }
    if (metrics.completionPct < 80) {
      recommendations.push(`Defer or split ${metrics.totalTasks - metrics.completed} incomplete deliverables into the next sprint with re-committed scope.`);
    }
    if (recommendations.length === 0) {
      recommendations.push('Maintain current estimation and delivery practices; no major process adjustments required.');
    }

    // Next Sprint Action Items (data-driven from actual blocked, in-flight, overloaded and high-variance items)
    const nextSprintActions = [];
    const deliveryTasks = this.deliveryTasks(sprint.tasks || []);

    deliveryTasks.filter(t => (t.status || '').toLowerCase() === 'blocked').slice(0, 2).forEach(t => {
      nextSprintActions.push({
        action: `Unblock and complete: ${t.item}`,
        owner: fmt(t.owner),
        priority: 'High',
        outcome: `Dependency resolved and ${t.item} delivered`
      });
    });

    deliveryTasks.filter(t =>
      (t.priority || '').toLowerCase() === 'high' &&
      ((t.status || '').toLowerCase() === 'in progress' || (t.status || '').toLowerCase() === 'in_progress')
    ).slice(0, 2).forEach(t => {
      nextSprintActions.push({
        action: `Complete high-priority item: ${t.item}`,
        owner: fmt(t.owner),
        priority: 'High',
        outcome: `High-priority milestone closed within the next sprint`
      });
    });

    overloadedEmps.slice(0, 2).forEach(e => {
      nextSprintActions.push({
        action: `Rebalance workload for ${e.name}`,
        owner: e.name,
        priority: 'Medium',
        outcome: `Individual load redistributed within a healthy range of the team average`
      });
    });

    projects.filter(p => p.variancePct > 20).slice(0, 2).forEach(p => {
      const owners = (p.assignedOwners || []).map(o => fmt(o)).filter(Boolean).slice(0, 2).join(', ') || 'Delivery Team';
      nextSprintActions.push({
        action: `Re-estimate and review: ${p.name}`,
        owner: owners,
        priority: 'Medium',
        outcome: `Corrected baselines and realistic targets set for ${p.name}`
      });
    });

    if (nextSprintActions.length === 0) {
      nextSprintActions.push({
        action: 'Review sprint commitments and confirm next-sprint priorities',
        owner: 'Sprint Leadership',
        priority: 'Medium',
        outcome: 'Next sprint backlog finalized and accepted by the team'
      });
    }

    const retrospectiveLeadership = leadership || this.buildLeadership(this.leadershipTasks(sprint.tasks || []));

    return {
      summary: this.generateExecutiveSummary(sprint, metrics, employees, risks),
      sprintLeadership: retrospectiveLeadership,
      retrospectiveOwner: retrospectiveLeadership.scrumMaster ? retrospectiveLeadership.scrumMaster.name : 'Sprint Leadership',
      whatWentWell,
      whatDidNotGoWell,
      keyAchievements,
      bottlenecks,
      resourceUtilizationSummary: `Delivery-team effort totaled ${metrics.totalAct}h across ${metrics.teamSize} active delivery resources. Average individual effort was ${(metrics.totalAct / (metrics.teamSize || 1)).toFixed(1)}h. Sprint leadership hours are tracked separately and excluded from capacity.`,
      estimationAccuracySummary: `Planned: ${metrics.totalEst}h vs Actual: ${metrics.totalAct}h (Variance: ${metrics.variance >= 0 ? '+' : ''}${metrics.variance}h, Efficiency: ${metrics.efficiencyPct}%).`,
      recommendations,
      nextSprintActions
    };
  }
}

window.SprintAnalytics = SprintAnalytics;
