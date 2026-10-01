// Demo accounts for evaluating the product (runs only when DEMO_ACCOUNTS=1).
// Idempotent: does nothing if the demo workspace already exists.
// Passwords come from env vars (never committed): DEMO_ADMIN_PASSWORD, DEMO_CLIENT_PASSWORD.
import crypto from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const scrypt = promisify(crypto.scrypt);

async function hash(pw) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${salt.toString("base64")}$${h.toString("base64")}`;
}

/**
 * Demo team for the workload & health views: two fictional teammates (no password, they can't sign
 * in), estimates and time spent on tasks, an absence, unassigned tasks. Idempotent; never touches
 * any login.
 */
async function enrichTeam(ws) {
  const now = new Date();
  const days = (n) => new Date(now.getTime() + n * 86400_000);
  const team = [
    { email: "sophie.martin@team.followmyfuture.demo", name: "Sophie Martin", title: "Designer UI", capacity: 2100, cost: 4500 },
    { email: "lucas.bernard@team.followmyfuture.demo", name: "Lucas Bernard", title: "Développeur", capacity: 1680, cost: 5000 },
  ];
  const ids = [];
  for (const m of team) {
    const u = await db.user.upsert({ where: { email: m.email }, create: { email: m.email, name: m.name, locale: "fr" }, update: {} });
    ids.push(u.id);
    const exists = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId: u.id } } });
    if (!exists) await db.workspaceMember.create({ data: { workspaceId: ws.id, userId: u.id, role: "COLLABORATOR", title: m.title, allProjects: true, weeklyCapacityMinutes: m.capacity, hourlyCostCents: m.cost } });
  }
  const [sophie, lucas] = ids;
  const owner = await db.workspaceMember.findFirst({ where: { workspaceId: ws.id, role: "OWNER" } });
  if (owner && owner.hourlyCostCents === null) await db.workspaceMember.update({ where: { id: owner.id }, data: { hourlyCostCents: 6000 } });
  const lucasM = await db.workspaceMember.findFirst({ where: { workspaceId: ws.id, userId: lucas } });
  if (lucasM && !(await db.memberAbsence.count({ where: { memberId: lucasM.id } })))
    await db.memberAbsence.create({ data: { workspaceId: ws.id, memberId: lucasM.id, startDate: days(8), endDate: days(9), reason: "LEAVE", note: "Congés" } });

  const ESTIMATES = { "Wireframes": 720, "Maquette page d'accueil": 900, "Maquettes pages internes": 1200, "Intégration page d'accueil": 960, "Intégration pages internes": 1440, "Recette navigateurs": 480, "Recette mobile": 420, "DNS & domaine": 120, "Formation": 180, "Mise en place technique": 600, "Réunion de lancement": 120, "Collecte des contenus": 240, "Arborescence": 300, "Marge & coûts internes": 120 };
  const DESIGN = ["Wireframes", "Maquette page d'accueil", "Maquettes pages internes"];
  const DEV = ["Intégration page d'accueil", "Intégration pages internes", "Mise en place technique", "DNS & domaine"];
  const tasks = await db.task.findMany({ where: { workspaceId: ws.id } });
  for (const t of tasks) {
    const est = ESTIMATES[t.title];
    const data = {};
    if (est && t.estimatedMinutes === null) data.estimatedMinutes = est;
    if (est && t.actualMinutes === null && t.status !== "NOT_STARTED") data.actualMinutes = t.status === "COMPLETED" ? Math.round(est * 1.1) : Math.round(est * 0.45);
    if (DESIGN.includes(t.title) && t.status !== "COMPLETED" && t.assigneeId !== sophie) data.assigneeId = sophie;
    if (DEV.includes(t.title) && t.status !== "COMPLETED" && t.assigneeId !== lucas) data.assigneeId = lucas;
    if (Object.keys(data).length) await db.task.update({ where: { id: t.id }, data });
  }
  const project = await db.project.findFirst({ where: { workspaceId: ws.id, name: "Refonte du site web" } });
  if (project) {
    for (const [title, est, d] of [["Optimisation SEO", 480, 12], ["Bannière promotionnelle", 300, 6]]) {
      if (await db.task.count({ where: { projectId: project.id, title } })) continue;
      const phase = await db.phase.findFirst({ where: { projectId: project.id, title: "Développement" } });
      await db.task.create({ data: { workspaceId: ws.id, projectId: project.id, phaseId: phase?.id, title, status: "NOT_STARTED", estimatedMinutes: est, deadline: days(d), position: 20 } });
    }
  }
}

async function main() {
  const adminEmail = (process.env.SUPER_ADMIN_EMAIL || "admin@viewmywork.demo").trim().toLowerCase();
  const clientEmail = (process.env.DEMO_CLIENT_EMAIL || "client@viewmywork.demo").trim().toLowerCase();
  const adminPw = process.env.DEMO_ADMIN_PASSWORD;
  const clientPw = process.env.DEMO_CLIENT_PASSWORD;
  if (!adminPw || !clientPw) return console.log("demo: DEMO_ADMIN_PASSWORD / DEMO_CLIENT_PASSWORD not set — skipped");
  const existing = await db.workspace.findUnique({ where: { slug: "studio-demo" } });
  if (existing) {
    // Keep the demo content in a single language (French); credentials are never touched here.
    await db.phase.updateMany({ where: { title: "Discovery", project: { workspaceId: existing.id } }, data: { title: "Découverte" } });
    await db.workspace.update({ where: { id: existing.id }, data: { locale: "fr" } });
    await db.client.updateMany({ where: { workspaceId: existing.id }, data: { preferredLanguage: "fr" } });
    // Placeholder previews pointing at example.com are confusing: the project's website is set in its settings.
    await db.preview.deleteMany({ where: { url: { startsWith: "https://example.com" }, project: { workspaceId: existing.id } } });
    await enrichTeam(existing);
    return console.log("demo: already present (content normalised)");
  }

  const now = new Date();
  const days = (n) => new Date(now.getTime() + n * 86400_000);
  const plan = await db.plan.findFirst({ where: { code: "PRO" } }) ?? await db.plan.findFirstOrThrow({ orderBy: { sortOrder: "asc" } });

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: "Admin Démo", locale: "fr", passwordHash: await hash(adminPw), emailVerifiedAt: now, platformRole: "SUPER_ADMIN" },
    update: { platformRole: "SUPER_ADMIN", passwordHash: await hash(adminPw), emailVerifiedAt: now },
  });
  const clientUser = await db.user.upsert({
    where: { email: clientEmail },
    create: { email: clientEmail, name: "Claire Dubois", locale: "fr", passwordHash: await hash(clientPw), emailVerifiedAt: now },
    update: { passwordHash: await hash(clientPw), emailVerifiedAt: now },
  });

  const ws = await db.workspace.create({ data: { name: "Studio Démo", slug: "studio-demo", onboardingDone: true, locale: "fr", industry: "Web & software" } });
  await db.workspaceMember.create({ data: { workspaceId: ws.id, userId: admin.id, role: "OWNER", allProjects: true } });
  await db.workspaceSetting.create({ data: { workspaceId: ws.id, companyLegalName: "Studio Démo SAS", companyEmail: adminEmail, companyAddress: "12 rue de la Paix\n75002 Paris", companyCountry: "France", companyVatNumber: "FR12345678901" } });
  await db.invoiceSettings.create({ data: { workspaceId: ws.id, defaultTaxRateBps: 2000, bankDetails: "IBAN FR76 0000 0000 0000 0000 0000 000 · BIC DEMOFRPP", remindersEnabled: true } });
  await db.subscription.create({ data: { workspaceId: ws.id, planId: plan.id, status: "TRIALING", priceCents: plan.monthlyPriceCents, currency: plan.currency, trialEndsAt: days(30) } });

  const client = await db.client.create({ data: { workspaceId: ws.id, firstName: "Claire", lastName: "Dubois", company: "Maison Lumière", email: clientEmail, preferredLanguage: "fr", billingAddress: "8 avenue Montaigne\n75008 Paris", country: "France", tags: ["VIP"] } });
  await db.clientPortalAccess.create({ data: { workspaceId: ws.id, clientId: client.id, userId: clientUser.id } });

  const project = await db.project.create({ data: { workspaceId: ws.id, clientId: client.id, name: "Refonte du site web", type: "Website", description: "Nouveau site vitrine et boutique.", startDate: days(-30), targetDate: days(45), managerId: admin.id, budgetCents: 480000, currency: "EUR" } });
  const spec = [
    ["Découverte", 10, [["Réunion de lancement", "COMPLETED"], ["Collecte des contenus", "COMPLETED"], ["Arborescence", "COMPLETED"]]],
    ["Design", 25, [["Wireframes", "COMPLETED"], ["Maquette page d'accueil", "COMPLETED"], ["Maquettes pages internes", "IN_REVIEW"]]],
    ["Développement", 45, [["Mise en place technique", "COMPLETED"], ["Intégration page d'accueil", "IN_PROGRESS"], ["Intégration pages internes", "NOT_STARTED"], ["Marge & coûts internes", "IN_PROGRESS", "INTERNAL"]]],
    ["Tests", 15, [["Recette navigateurs", "NOT_STARTED"], ["Recette mobile", "NOT_STARTED"]]],
    ["Mise en ligne", 5, [["DNS & domaine", "NOT_STARTED"], ["Formation", "NOT_STARTED"]]],
  ];
  const statusOf = (tasks) => (tasks.every((t) => t[1] === "COMPLETED") ? "COMPLETED" : tasks.some((t) => t[1] !== "NOT_STARTED") ? "IN_PROGRESS" : "NOT_STARTED");
  let weighted = 0;
  for (const [i, [title, weight, tasks]] of spec.entries()) {
    const top = tasks;
    const progress = Math.round((top.filter((t) => t[1] === "COMPLETED").length / top.length) * 100);
    weighted += progress * weight;
    const phase = await db.phase.create({ data: { projectId: project.id, title, weight, position: i, progress, status: statusOf(tasks), deadline: days(-20 + i * 15) } });
    if (i === 2) await db.milestone.create({ data: { phaseId: phase.id, projectId: project.id, title: "Recette mobile", dueDate: days(20), position: 0 } });
    for (const [j, [t, status, vis]] of tasks.entries())
      await db.task.create({ data: { workspaceId: ws.id, projectId: project.id, phaseId: phase.id, title: t, status, position: j, visibility: vis ?? "CLIENT_VISIBLE", assigneeId: admin.id, deadline: days(-15 + i * 12 + j * 2), completedAt: status === "COMPLETED" ? days(-10) : null } });
  }
  await db.project.update({ where: { id: project.id }, data: { progress: Math.round(weighted / 100) } });

  const d = await db.deliverable.create({ data: { workspaceId: ws.id, projectId: project.id, title: "Maquette page d'accueil", status: "WAITING_FOR_CLIENT", requiresApproval: true, currentVersion: 2 } });
  await db.deliverableVersion.create({ data: { deliverableId: d.id, version: 1, submittedAt: days(-6), previewUrl: "https://example.com" } });
  await db.deliverableVersion.create({ data: { deliverableId: d.id, version: 2, submittedAt: days(-1), notes: "Logo agrandi, couleurs ajustées.", previewUrl: "https://example.com" } });
  await db.approval.create({ data: { workspaceId: ws.id, deliverableId: d.id, version: 1, decision: "CHANGES_REQUESTED", comment: "Pouvez-vous agrandir le logo ?", clientId: client.id, userId: clientUser.id, userName: clientUser.name, createdAt: days(-5) } });
  await db.clientWait.create({ data: { projectId: project.id, reason: "APPROVAL", label: "Maquette page d'accueil V2", entityType: "DELIVERABLE", entityId: d.id, startedAt: days(-1) } });
  await db.clientWait.create({ data: { projectId: project.id, reason: "DOCUMENT", label: "Logo en format vectoriel (SVG ou AI)", startedAt: days(-4) } });

  await db.projectUpdate.create({ data: { projectId: project.id, title: "Design validé, développement lancé", body: "Les maquettes principales sont prêtes et la mise en place technique est terminée.", nextSteps: "Intégration de la page d'accueil puis recette mobile.", authorId: admin.id, authorName: admin.name, publishedAt: days(-2) } });
  await db.message.create({ data: { workspaceId: ws.id, projectId: project.id, entityType: "PROJECT", entityId: project.id, body: "Bonjour Claire, la V2 de la page d'accueil est en ligne pour validation.", authorId: admin.id, authorName: admin.name, createdAt: days(-1) } });

  // Issued invoice: 4 800 € HT deposit share, partially paid.
  const year = now.getUTCFullYear();
  await db.invoiceCounter.create({ data: { workspaceId: ws.id, scope: String(year), last: 1 } });
  const inv = await db.invoice.create({
    data: {
      workspaceId: ws.id, clientId: client.id, projectId: project.id, number: `INV-${year}-0001`, status: "PARTIALLY_PAID", currency: "EUR",
      issueDate: days(-10), dueDate: days(20), issuedAt: days(-10), sentAt: days(-10), firstViewedAt: days(-9),
      subtotalCents: 192000, taxCents: 38400, totalCents: 230400, paidCents: 100000, notes: "Acompte de 40 % à la commande.", terms: "Paiement à 30 jours.",
      sellerSnapshot: { name: ws.name, legalName: "Studio Démo SAS", address: "12 rue de la Paix\n75002 Paris", email: adminEmail, vatNumber: "FR12345678901", country: "France", bankDetails: "IBAN FR76 0000 0000 0000 0000 0000 000 · BIC DEMOFRPP" },
      clientSnapshot: { name: "Claire Dubois", company: "Maison Lumière", email: clientEmail, address: "8 avenue Montaigne\n75008 Paris", country: "France" },
      lineItems: { create: [{ position: 0, description: "Refonte du site web — acompte 40 %", quantityMilli: 1000, unitPriceCents: 192000, taxRateBps: 2000, lineSubtotal: 192000, lineTax: 38400, lineTotal: 230400 }] },
    },
  });
  await db.payment.create({ data: { workspaceId: ws.id, invoiceId: inv.id, clientId: client.id, amountCents: 100000, currency: "EUR", provider: "manual", method: "BANK_TRANSFER", status: "SUCCEEDED", reference: "VIR-0001", paidAt: days(-5), recordedById: admin.id } });
  await db.expense.create({ data: { workspaceId: ws.id, projectId: project.id, name: "Licence Figma", category: "SOFTWARE", amountCents: 4500, currency: "EUR", date: days(-12), supplier: "Figma" } });

  await db.activityLog.createMany({ data: [
    { workspaceId: ws.id, projectId: project.id, clientId: client.id, actorId: admin.id, actorName: admin.name, action: "PROJECT_CREATED", entityType: "PROJECT", entityId: project.id, summary: "Projet « Refonte du site web » créé", createdAt: days(-30) },
    { workspaceId: ws.id, projectId: project.id, clientId: client.id, actorId: clientUser.id, actorName: clientUser.name, action: "CLIENT_REQUESTED_CHANGES", entityType: "DELIVERABLE", entityId: d.id, summary: "Modifications demandées sur la maquette V1", clientVisible: true, createdAt: days(-5) },
    { workspaceId: ws.id, projectId: project.id, clientId: client.id, actorId: admin.id, actorName: admin.name, action: "PAYMENT_RECEIVED", entityType: "INVOICE", entityId: inv.id, summary: `Paiement de 1 000 € reçu pour INV-${year}-0001`, clientVisible: true, createdAt: days(-5) },
  ] });
  await db.notification.create({ data: { workspaceId: ws.id, userId: clientUser.id, audience: "CLIENT", category: "PROJECT", type: "APPROVAL_REQUESTED", title: "Votre avis est attendu : maquette V2", message: "La V2 de la page d'accueil attend votre validation.", actionUrl: `/portal/projects/${project.id}/deliverables/${d.id}`, actionLabel: "Voir" } });
  await enrichTeam(ws);
  console.log(`demo: created — admin ${adminEmail}, client ${clientEmail}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
