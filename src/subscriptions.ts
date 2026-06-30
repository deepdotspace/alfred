/**
 * Subscription plan declarations.
 *
 * Alfred ships free and open-source with no paid plans, so this list is empty
 * and `deepspace deploy` syncs zero plans to Stripe. Payments live only in the
 * separate "Alfred 2" fork; this app has no paywall.
 *
 * To add a plan in a paid fork: each entry needs a stable `slug`, a `name`, and
 * `priceCents` (free plans use 0 and never hit Stripe).
 */

export const subscriptionPlans = [] as const

export type SubscriptionPlanSlug = (typeof subscriptionPlans)[number] extends never
  ? string
  : (typeof subscriptionPlans)[number]['slug']
