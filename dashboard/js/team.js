/**
 * SprintIQ - Team Directory, Designation & Sprint Role Registry
 *
 * Single source of truth for "who is a delivery resource" and "who is sprint
 * leadership". Every capacity / utilization / performance calculation must ask
 * this registry instead of testing employee names, so new roles (Scrum Master,
 * Product Owner, Tech Lead, Delivery Manager...) can be introduced by adding a
 * role definition only - no calculation logic changes required.
 *
 * Employee record shape:
 *   employee_name, designation, sprint_role, resource_type,
 *   is_delivery_resource, is_scrum_master
 */

/**
 * Sprint role definitions. `isDeliveryResource` drives every exclusion rule.
 * Add new roles here; the rest of the application adapts automatically.
 */
const SPRINT_ROLE_DEFINITIONS = {
  'Team Member': {
    resourceType: 'Delivery',
    isDeliveryResource: true,
    isScrumMaster: false,
    badge: null,
    group: 'Delivery Team'
  },
  'Tech Lead': {
    resourceType: 'Delivery',
    isDeliveryResource: true,
    isScrumMaster: false,
    badge: 'TECH LEAD',
    group: 'Delivery Team'
  },
  'Scrum Master': {
    resourceType: 'Management / Non-Billable',
    isDeliveryResource: false,
    isScrumMaster: true,
    badge: 'SCRUM MASTER',
    group: 'Sprint Leadership'
  },
  'Project Manager': {
    resourceType: 'Management / Non-Billable',
    isDeliveryResource: false,
    isScrumMaster: false,
    badge: 'PROJECT MANAGER',
    group: 'Sprint Leadership'
  },
  'Product Owner': {
    resourceType: 'Management / Non-Billable',
    isDeliveryResource: false,
    isScrumMaster: false,
    badge: 'PRODUCT OWNER',
    group: 'Sprint Leadership'
  },
  'Delivery Manager': {
    resourceType: 'Management / Non-Billable',
    isDeliveryResource: false,
    isScrumMaster: false,
    badge: 'DELIVERY MANAGER',
    group: 'Sprint Leadership'
  }
};

const DEFAULT_SPRINT_ROLE = 'Team Member';

/**
 * Team / people directory. `designation` is the employee's permanent job title,
 * `sprint_role` is the role they carry for the sprint being analysed.
 */
const DEFAULT_TEAM_ROSTER = [
  { employee_name: 'Aman', designation: 'Developer', sprint_role: 'Team Member' },
  { employee_name: 'Deepak', designation: 'Developer', sprint_role: 'Team Member' },
  { employee_name: 'Nikhil', designation: 'DevOps', sprint_role: 'Team Member' },
  { employee_name: 'Abhijeet', designation: 'QA', sprint_role: 'Team Member' },
  { employee_name: 'Avinash', designation: 'Designer', sprint_role: 'Team Member' },
  { employee_name: 'Suraj', designation: 'Developer', sprint_role: 'Team Member' },
  { employee_name: 'Raunik', designation: 'Developer', sprint_role: 'Team Member' },
  { employee_name: 'Vani', designation: 'Developer', sprint_role: 'Team Member' },
  { employee_name: 'Shivam', designation: 'Developer', sprint_role: 'Team Member' },
  { employee_name: 'Sandeep', designation: 'Project Manager', sprint_role: 'Scrum Master' }
];

class TeamDirectory {
  constructor(roster = DEFAULT_TEAM_ROSTER, roles = SPRINT_ROLE_DEFINITIONS) {
    this.roleDefinitions = roles;
    this.setRoster(roster);
  }

  setRoster(roster) {
    this.roster = (roster || []).map(r => this.expand(r));
    this.index = new Map();
    this.roster.forEach(r => this.index.set(this.key(r.employee_name), r));
    return this.roster;
  }

  key(name) {
    return String(name || '').trim().toLowerCase();
  }

  roleDefinition(sprintRole) {
    return this.roleDefinitions[sprintRole] || this.roleDefinitions[DEFAULT_SPRINT_ROLE];
  }

  /**
   * Expands a raw roster entry into a complete employee record. Explicit
   * fields on the entry always win over the role defaults, so an individual
   * can be overridden without inventing a new role.
   */
  expand(entry) {
    const sprintRole = entry.sprint_role || DEFAULT_SPRINT_ROLE;
    const def = this.roleDefinition(sprintRole);
    return {
      employee_name: entry.employee_name,
      designation: entry.designation || sprintRole,
      sprint_role: sprintRole,
      resource_type: entry.resource_type || def.resourceType,
      is_delivery_resource: entry.is_delivery_resource !== undefined ? !!entry.is_delivery_resource : def.isDeliveryResource,
      is_scrum_master: entry.is_scrum_master !== undefined ? !!entry.is_scrum_master : def.isScrumMaster,
      role_badge: entry.role_badge !== undefined ? entry.role_badge : def.badge,
      group: def.group
    };
  }

  /**
   * Resolves any owner name (including names coming from uploaded sprint
   * files) to an employee record. Unknown names are treated as ordinary
   * delivery resources so imported sprints keep working.
   */
  resolve(name) {
    const found = this.index.get(this.key(name));
    if (found) return found;
    return this.expand({
      employee_name: name || 'Unassigned',
      designation: 'Unlisted Resource',
      sprint_role: DEFAULT_SPRINT_ROLE
    });
  }

  all() { return this.roster.slice(); }
  isDeliveryResource(name) { return this.resolve(name).is_delivery_resource; }
  isScrumMaster(name) { return this.resolve(name).is_scrum_master; }
  designation(name) { return this.resolve(name).designation; }
  sprintRole(name) { return this.resolve(name).sprint_role; }
  roleBadge(name) { return this.resolve(name).role_badge; }
  deliveryTeam() { return this.roster.filter(r => r.is_delivery_resource); }
  leadership() { return this.roster.filter(r => !r.is_delivery_resource); }
  scrumMaster() { return this.roster.find(r => r.is_scrum_master) || null; }
  availableRoles() { return Object.keys(this.roleDefinitions); }
}

window.SprintIQRoleDefinitions = SPRINT_ROLE_DEFINITIONS;
window.SprintIQTeamRoster = DEFAULT_TEAM_ROSTER;
window.TeamDirectory = TeamDirectory;
window.SprintIQTeam = new TeamDirectory();
