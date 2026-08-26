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
  static analyzeSprint(sprint, config = window.SprintIQConfig.get()) {
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
    const retrospective = this.generateRetrospective(sprint, sprintMetrics, employeeMetrics, riskRegister, projectMetrics);

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
      const owner = t.owner || 'Unassigned';
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
   * Complete Sprint Retrospective Generator
   */
  static generateRetrospective(sprint, metrics, employees, risks, projects) {
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
      keyAchievements.push(`Successfully delivered high-priority milestone: "${t.item}" by ${t.owner}.`);
    });
    if (keyAchievements.length === 0) {
      keyAchievements.push(`Maintained active development pace with ${metrics.completed} deliverables resolved.`);
    }

    // Challenges & Bottlenecks
    const bottlenecks = risks.map(r => `${r.type}: ${r.description}`);

    // Recommended Improvements
    const recommendations = [
      'Refine task estimation granularity during sprint planning to cap single task estimates at 20h maximum.',
      'Establish a mandatory daily 15-minute blocker triage to resolve third-party API dependencies early.',
      'Rebalance workload distribution to maintain individual developer load within ±25% of team average.',
      'Introduce paired reviews on complex client custom CRM integrations prior to final QA.'
    ];

    // Next Sprint Action Items
    const nextSprintActions = [
      {
        action: 'Unblock and finalize SPARTA CRM webhook & reporting integrations',
        owner: 'Avinash / PM Lead',
        priority: 'High',
        outcome: 'Production API operational with verified automated sync'
      },
      {
        action: 'Conduct workload leveling session for Vee Repairs & Custom Web streams',
        owner: 'Abhijeet / Delivery Mgr',
        priority: 'High',
        outcome: 'Balanced sprint backlog with capped per-developer utilization'
      },
      {
        action: 'Re-estimate in-flight portal tasks for Optimum Global Care & Sofiya Design',
        owner: 'Aman / Shivam',
        priority: 'Medium',
        outcome: 'Refined task definitions and realistic milestone targets'
      },
      {
        action: 'Establish standardized QA checklist for client Shopify checkout releases',
        owner: 'Suraj / QA Lead',
        priority: 'Medium',
        outcome: 'Zero critical defects on payment & checkout releases'
      }
    ];

    const leadership = this.buildLeadership(this.leadershipTasks(sprint.tasks || []));

    return {
      summary: this.generateExecutiveSummary(sprint, metrics, employees, risks),
      sprintLeadership: leadership,
      retrospectiveOwner: leadership.scrumMaster ? leadership.scrumMaster.name : 'Sprint Leadership',
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
