/**
 * SprintIQ - Sample Sprint Datasets
 * Realistic enterprise sprint data matching the PMO project layout and team structure.
 */

const SAMPLE_SPRINTS = [
  {
    id: 'sprint-14',
    name: 'Sprint 14 (Current - Web & CRM Delivery)',
    startDate: '2026-08-08',
    endDate: '2026-08-22',
    status: 'Active',
    description: 'Core focus on CRM improvements, client website releases, and SEO optimization retainers.',
    tasks: [
      { id: 1, item: 'Vee Networks | Custom Website Development', priority: 'High', owner: 'Vani', est: 16, act: 15.5, status: 'Completed' },
      { id: 2, item: 'Allenhouse Group | Client Requirements, Issue Resolve', priority: 'High', owner: 'Deepak', est: 12, act: 14, status: 'Completed' },
      { id: 3, item: 'Fastranking | Website Development & Speed Optimization', priority: 'Medium', owner: 'Avinash', est: 24, act: 22.5, status: 'Completed' },
      { id: 4, item: 'Vee Repairs | Custom Website Development', priority: 'High', owner: 'Abhijeet', est: 32, act: 36, status: 'In Progress' },
      { id: 5, item: 'Reading Refurbishment Website Development', priority: 'Medium', owner: 'Nikhil', est: 20, act: 18, status: 'Completed' },
      { id: 6, item: 'Sofiya Design Academy Demos Development', priority: 'Low', owner: 'Shivam', est: 10, act: 9.5, status: 'Completed' },
      { id: 7, item: '88 Driving School Website Development', priority: 'Medium', owner: 'Suraj', est: 18, act: 17, status: 'Completed' },
      { id: 8, item: 'SEO Audit Report & Technical Crawl Fixes', priority: 'Medium', owner: 'Raunik', est: 14, act: 12, status: 'Completed' },
      { id: 9, item: 'DMA Phase 2 Implementation + Testing', priority: 'High', owner: 'Aman', est: 28, act: 34, status: 'Completed' },
      { id: 10, item: 'Vee Repairs File Audit & Media Review', priority: 'Low', owner: 'Vani', est: 8, act: 6.5, status: 'Completed' },
      { id: 11, item: 'Digital MarketingHub | Campaign Landing Page', priority: 'Medium', owner: 'Deepak', est: 16, act: 15, status: 'Completed' },
      { id: 12, item: 'SPARTA CRM | Development & API Webhook Integration', priority: 'High', owner: 'Avinash', est: 30, act: 38, status: 'In Progress' },
      { id: 13, item: 'Sparta Website | Development & Mobile UI Polish', priority: 'Medium', owner: 'Abhijeet', est: 18, act: 16.5, status: 'Completed' },
      { id: 14, item: 'Vee Repairs CRM | Improvements & Workflow Automation', priority: 'High', owner: 'Nikhil', est: 22, act: 25, status: 'Completed' },
      { id: 15, item: 'Generic CMS | Template Architecture Refactoring', priority: 'Low', owner: 'Shivam', est: 12, act: 11, status: 'Completed' },
      { id: 16, item: 'Shopify Changes & Checkout Update for Patrick Shoes', priority: 'High', owner: 'Suraj', est: 15, act: 19.5, status: 'Completed' },
      { id: 17, item: 'Reading Design Studio Website Development', priority: 'Medium', owner: 'Raunik', est: 18, act: 13.5, status: 'Completed' },
      { id: 18, item: 'Optimum Global Care | Portal Security Patching', priority: 'High', owner: 'Aman', est: 14, act: 13, status: 'Completed' },
      { id: 19, item: 'Nomads Trade Website | Catalogue Integration', priority: 'High', owner: 'Abhijeet', est: 16, act: 14, status: 'Completed' },
      { id: 20, item: 'Catesby England | Monthly SEO & Content Pipeline', priority: 'Medium', owner: 'Raunik', est: 10, act: 9.5, status: 'Completed' },
      { id: 21, item: 'SPARTA CRM | Reporting Engine Bugfix', priority: 'High', owner: 'Avinash', est: 8, act: 12, status: 'Blocked' },
      { id: 22, item: '88 Driving School | Booking Form Verification', priority: 'Low', owner: 'Suraj', est: 6, act: 5, status: 'Completed' },
      { id: 23, item: 'Fastranking | Client Analytics Dashboard Refresh', priority: 'Medium', owner: 'Deepak', est: 12, act: 11.5, status: 'Completed' },
      { id: 24, item: 'Sofiya Design Academy | Student Portal UI Revamp', priority: 'Low', owner: 'Shivam', est: 14, act: 8, status: 'In Progress' }
    ]
  },
  {
    id: 'sprint-13',
    name: 'Sprint 13 (Previous - Portal & E-Commerce Sprint)',
    startDate: '2026-07-25',
    endDate: '2026-08-08',
    status: 'Closed',
    description: 'Execution of e-commerce updates, payment gateways, and client onboarding workflows.',
    tasks: [
      { id: 1, item: 'Vee Networks | Payment Gateway Setup & SSL', priority: 'High', owner: 'Vani', est: 18, act: 17, status: 'Completed' },
      { id: 2, item: 'Allenhouse Group | User Role Management', priority: 'Medium', owner: 'Deepak', est: 14, act: 15, status: 'Completed' },
      { id: 3, item: 'Fastranking | Core Web Vitals Optimization', priority: 'High', owner: 'Avinash', est: 22, act: 24, status: 'Completed' },
      { id: 4, item: 'Vee Repairs | Booking Scheduler Integration', priority: 'High', owner: 'Abhijeet', est: 28, act: 32, status: 'Completed' },
      { id: 5, item: 'Reading Refurbishment | Portfolio Gallery Grid', priority: 'Low', owner: 'Nikhil', est: 12, act: 10.5, status: 'Completed' },
      { id: 6, item: 'Sofiya Design Academy | Course Module CMS', priority: 'Medium', owner: 'Shivam', est: 16, act: 15, status: 'Completed' },
      { id: 7, item: '88 Driving School | Instructor Schedule Sync', priority: 'High', owner: 'Suraj', est: 20, act: 23, status: 'Completed' },
      { id: 8, item: 'SEO Audit Report & Competitor Benchmark', priority: 'Medium', owner: 'Raunik', est: 16, act: 14, status: 'Completed' },
      { id: 9, item: 'DMA Phase 1 | Final Acceptance Testing', priority: 'High', owner: 'Aman', est: 24, act: 26, status: 'Completed' },
      { id: 10, item: 'SPARTA CRM | Contact Import CSV Parser', priority: 'Medium', owner: 'Avinash', est: 16, act: 18, status: 'Completed' },
      { id: 11, item: 'Shopify Changes | Patrick Shoes Cart Customization', priority: 'High', owner: 'Suraj', est: 18, act: 22, status: 'Completed' },
      { id: 12, item: 'Optimum Global Care | Patient Intake Form', priority: 'High', owner: 'Aman', est: 15, act: 14, status: 'Completed' },
      { id: 13, item: 'Reading Design Studio | Contact Map & Lead Form', priority: 'Low', owner: 'Raunik', est: 8, act: 7, status: 'Completed' },
      { id: 14, item: 'Vee Repairs CRM | Email Notifications Setup', priority: 'Medium', owner: 'Nikhil', est: 14, act: 13, status: 'Completed' },
      { id: 15, item: 'Sparta Website | Hero Banner Animation Polish', priority: 'Low', owner: 'Abhijeet', est: 10, act: 9, status: 'Completed' }
    ]
  },
  {
    id: 'sprint-12',
    name: 'Sprint 12 (Baseline - Architecture & Foundation)',
    startDate: '2026-07-11',
    endDate: '2026-07-25',
    status: 'Closed',
    description: 'Foundation sprint for multi-tenant CRM, design system baseline, and server configurations.',
    tasks: [
      { id: 1, item: 'SPARTA CRM | Database Schema & Migrations', priority: 'High', owner: 'Avinash', est: 35, act: 42, status: 'Completed' },
      { id: 2, item: 'Vee Networks | Initial Wireframing & Design', priority: 'Medium', owner: 'Vani', est: 20, act: 19, status: 'Completed' },
      { id: 3, item: 'Fastranking | Server Migration & DNS Cutover', priority: 'High', owner: 'Deepak', est: 16, act: 20, status: 'Completed' },
      { id: 4, item: 'Vee Repairs | Requirement Specification & ERD', priority: 'High', owner: 'Abhijeet', est: 24, act: 28, status: 'Completed' },
      { id: 5, item: 'Reading Refurbishment | Figma Design Approval', priority: 'Medium', owner: 'Nikhil', est: 14, act: 13, status: 'Completed' },
      { id: 6, item: 'Sofiya Design Academy | Brand Assets Preparation', priority: 'Low', owner: 'Shivam', est: 12, act: 11, status: 'Completed' },
      { id: 7, item: '88 Driving School | Payment Webhook Specs', priority: 'Medium', owner: 'Suraj', est: 15, act: 14, status: 'Completed' },
      { id: 8, item: 'SEO Audit Report | Keyword Baseline Research', priority: 'Medium', owner: 'Raunik', est: 18, act: 16, status: 'Completed' },
      { id: 9, item: 'DMA Phase 1 | Architecture Blueprint', priority: 'High', owner: 'Aman', est: 25, act: 29, status: 'Completed' },
      { id: 10, item: 'Shopify Changes | Patrick Shoes Theme Setup', priority: 'Medium', owner: 'Suraj', est: 16, act: 18, status: 'Completed' }
    ]
  }
];

// Helper to provide deep clone of sample sprints
window.SprintIQSampleData = {
  getSampleSprints: function() {
    return JSON.parse(JSON.stringify(SAMPLE_SPRINTS));
  }
};
