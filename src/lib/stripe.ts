import Stripe from "stripe";
import { env, integrations } from "@/lib/env";
import { AppError } from "@/lib/errors";

let stripe: Stripe | null = null;
export function getStripe() {
  if (!integrations.stripe()) throw new AppError("Online payments are not configured on this platform yet.", "CONFIG");
  stripe ??= new Stripe(env.stripe.secretKey);
  return stripe;
}
