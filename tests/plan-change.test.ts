import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { makeWorkspace, signIn } from "./helpers";

// Simulated Stripe: only the calls the plan change uses.
const state = { status: "active" as string, trialEnd: 0, pending: false, updates: [] as Record<string, unknown>[], previewTotal: 1500 };
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    subscriptions: {
      retrieve: async (id: string) => ({ id, status: state.status, trial_end: state.trialEnd || null, customer: "cus_1", cancel_at_period_end: false, items: { data: [{ id: "si_1", price: { id: "price_old", recurring: { interval: "month" } }, current_period_end: Math.floor(Date.now() / 1000) + 20 * 86400 }] } }),
      update: async (_id: string, params: Record<string, unknown>) => { state.updates.push(params); return { cancel_at_period_end: false, pending_update: state.pending ? {} : null }; },
    },
    invoices: { createPreview: async () => ({ amount_due: Math.max(0, state.previewTotal), total: state.previewTotal }) },
  }),
}));

const { previewPlanChangeAction, changePlanAction } = await import("@/server/actions/billing");

async function setup() {
  const w = await makeWorkspace();
  const plan = await db.plan.create({ data: { code: `BIZ${Date.now()}${Math.random().toString(36).slice(2, 6)}`, name: "Business", monthlyPriceCents: 2490, stripeMonthlyPriceId: "price_new", isActive: true } });
  await db.subscription.update({ where: { workspaceId: w.ws.id }, data: { stripeSubscriptionId: `sub_${w.ws.id}`, stripeCustomerId: `cus_${w.ws.id}` } });
  await signIn(w.owner.id, { workspaceId: w.ws.id });
  return { ...w, plan };
}

beforeEach(() => { Object.assign(state, { status: "active", trialEnd: 0, pending: false, updates: [], previewTotal: 1500 }); });

describe("plan change", () => {
  it("quotes only the difference and charges it on confirmation", async () => {
    const { ws, plan } = await setup();
    const q = await previewPlanChangeAction(plan.code, "month");
    expect(q.ok).toBe(true);
    const d = (q as { data: { mode: string; dueNow: number; credit: number; prorationDate: number } }).data;
    expect(d.mode).toBe("change");
    expect(d.dueNow).toBe(1500);
    expect(d.credit).toBe(0);
    expect((await changePlanAction(plan.code, "month", d.prorationDate)).ok).toBe(true);
    expect(state.updates[0]).toMatchObject({ proration_behavior: "always_invoice", payment_behavior: "pending_if_incomplete", proration_date: d.prorationDate });
    expect((await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws.id } })).planId).toBe(plan.id);
  });

  it("credits a downgrade instead of charging", async () => {
    const { plan } = await setup();
    state.previewTotal = -800;
    const d = ((await previewPlanChangeAction(plan.code, "month")) as { data: { dueNow: number; credit: number } }).data;
    expect(d.dueNow).toBe(0);
    expect(d.credit).toBe(800);
  });

  it("charges nothing during the trial", async () => {
    const { plan } = await setup();
    state.status = "trialing";
    state.trialEnd = Math.floor(Date.now() / 1000) + 10 * 86400;
    const d = ((await previewPlanChangeAction(plan.code, "month")) as { data: { mode: string; dueNow: number } }).data;
    expect(d).toMatchObject({ mode: "trial", dueNow: 0 });
    expect((await changePlanAction(plan.code, "month")).ok).toBe(true);
    expect(state.updates[0]).toMatchObject({ proration_behavior: "none" });
  });

  it("keeps the current plan when the payment fails", async () => {
    const { ws, plan } = await setup();
    const before = (await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws.id } })).planId;
    state.pending = true;
    const r = await changePlanAction(plan.code, "month");
    expect(r.ok).toBe(false);
    expect((await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws.id } })).planId).toBe(before);
  });
});
