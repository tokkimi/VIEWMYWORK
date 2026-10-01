// Idempotent production bootstrap: default plans, built-in templates, super admin promotion.
// Never overwrites values edited later in Platform Administration.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const PLANS = [
  {
    code: "STARTER", name: "Starter", description: "For solo professionals discovering the platform.", monthlyPriceCents: 200, annualPriceCents: 2000,
    storageLimitMb: 1024, activeProjectLimit: 3, clientLimit: 10, collaboratorLimit: 0, sortOrder: 1, highlight: false,
    features: ["online_payments", "portfolio_health", "client_decisions"],
  },
  {
    code: "PRO", name: "Pro", description: "For growing freelancers and small studios.", monthlyPriceCents: 990, annualPriceCents: 9900,
    storageLimitMb: 20480, activeProjectLimit: 25, clientLimit: 100, collaboratorLimit: 5, sortOrder: 2, highlight: true,
    features: ["online_payments", "custom_branding", "advanced_stats", "accounting_exports", "advanced_portal", "google_drive", "team_workload", "portfolio_health", "client_decisions", "weekly_reports"],
  },
  {
    code: "BUSINESS", name: "Business", description: "For agencies and larger teams.", monthlyPriceCents: 2490, annualPriceCents: 24900,
    storageLimitMb: 102400, activeProjectLimit: null, clientLimit: null, collaboratorLimit: 25, sortOrder: 3, highlight: false,
    features: ["online_payments", "custom_branding", "advanced_stats", "accounting_exports", "advanced_portal", "google_drive", "advanced_permissions", "priority_support", "team_workload", "portfolio_health", "client_decisions", "weekly_reports"],
  },
];

const TEMPLATES = [
  { name: "Website", category: "Website", phases: [
    ["Discovery", 10, ["Kick-off meeting", "Collect brand assets", "Sitemap & content plan"]],
    ["Design", 25, ["Wireframes", "Homepage design", "Inner pages design", "Design approval"]],
    ["Development", 45, ["Setup & infrastructure", "Homepage build", "Inner pages build", "CMS integration", "Responsive pass"]],
    ["Testing", 15, ["Cross-browser QA", "Mobile QA", "Client testing"]],
    ["Launch", 5, ["Domain & DNS", "Go live", "Handover & training"]],
  ]},
  { name: "Mobile Application", category: "Mobile Application", phases: [
    ["Discovery", 10, ["Requirements workshop", "User stories", "Technical architecture"]],
    ["UX / UI", 20, ["User flows", "Wireframes", "UI design", "Prototype approval"]],
    ["Development", 45, ["Backend & API", "Authentication", "Core features", "Notifications"]],
    ["QA", 15, ["Internal testing", "Beta testing", "Bug fixing"]],
    ["Release", 10, ["Store listings", "App Store submission", "Play Store submission"]],
  ]},
  { name: "Branding", category: "Branding", phases: [
    ["Research", 15, ["Brand questionnaire", "Competitor analysis", "Moodboard"]],
    ["Concepts", 35, ["Logo concepts", "Concept presentation", "Concept selection"]],
    ["Refinement", 30, ["Logo refinement", "Colour palette", "Typography"]],
    ["Delivery", 20, ["Brand guidelines", "Asset export", "Final delivery"]],
  ]},
  { name: "Marketing", category: "Marketing", phases: [
    ["Strategy", 25, ["Audit", "Goals & KPIs", "Channel plan"]],
    ["Production", 40, ["Content calendar", "Creative production", "Copywriting"]],
    ["Campaign", 25, ["Launch campaign", "Optimisation"]],
    ["Reporting", 10, ["Performance report"]],
  ]},
  { name: "Consulting", category: "Consulting", phases: [
    ["Assessment", 30, ["Stakeholder interviews", "Current state analysis"]],
    ["Recommendations", 40, ["Findings report", "Recommendations workshop"]],
    ["Implementation support", 30, ["Roadmap", "Follow-up sessions"]],
  ]},
  { name: "Architecture", category: "Architecture", phases: [
    ["Brief & survey", 10, ["Site survey", "Client brief"]],
    ["Concept design", 20, ["Sketch design", "Concept approval"]],
    ["Developed design", 25, ["Detailed drawings", "Planning application"]],
    ["Technical design", 25, ["Construction drawings", "Specifications"]],
    ["Construction", 20, ["Site visits", "Handover"]],
  ]},
  { name: "Event", category: "Event", phases: [
    ["Planning", 25, ["Brief & budget", "Venue selection", "Supplier booking"]],
    ["Preparation", 40, ["Invitations", "Logistics", "Run of show"]],
    ["Event day", 25, ["Setup", "Event delivery"]],
    ["Wrap-up", 10, ["Debrief report"]],
  ]},
];

async function main() {
  for (const p of PLANS) {
    const { features, ...data } = p;
    const existing = await db.plan.findUnique({ where: { code: p.code } });
    if (existing) continue;
    await db.plan.create({ data: { ...data, currency: "EUR", trialDays: 14, features: { create: features.map((key) => ({ key, enabled: true })) } } });
    console.log(`plan created: ${p.code}`);
  }
  // Features released after a plan was created: add them once to the default plans. A feature row that
  // already exists (enabled or disabled in Platform Administration) is never touched.
  const ROLLOUT = { STARTER: ["portfolio_health", "client_decisions"], PRO: ["team_workload", "portfolio_health", "client_decisions", "weekly_reports"], BUSINESS: ["team_workload", "portfolio_health", "client_decisions", "weekly_reports"] };
  for (const [code, keys] of Object.entries(ROLLOUT)) {
    const plan = await db.plan.findUnique({ where: { code }, include: { features: true } });
    if (!plan) continue;
    for (const key of keys) {
      if (plan.features.some((f) => f.key === key)) continue;
      await db.planFeature.create({ data: { planId: plan.id, key, enabled: true } });
      console.log(`feature ${key} added to ${code}`);
    }
  }
  for (const t of TEMPLATES) {
    const existing = await db.projectTemplate.findFirst({ where: { workspaceId: null, name: t.name } });
    if (existing) continue;
    await db.projectTemplate.create({
      data: {
        name: t.name, category: t.category, description: `Standard ${t.name.toLowerCase()} project structure.`,
        phases: { create: t.phases.map(([title, weight, tasks], i) => ({ title, weight, position: i, tasks: { create: tasks.map((tt, j) => ({ title: tt, position: j, requiresApproval: /approval/i.test(tt) })) } })) },
      },
    });
    console.log(`template created: ${t.name}`);
  }
  const admin = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (admin) {
    const r = await db.user.updateMany({ where: { email: admin }, data: { platformRole: "SUPER_ADMIN" } });
    if (r.count) console.log(`super admin: ${admin}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
