import Stripe from "stripe";

/**
 * Stripe client + plan configuration.
 *
 * Mirrors lib/supabase.ts: the client is null when STRIPE_SECRET_KEY is not
 * configured so the app still builds/runs (and Mock Mode keeps working).
 */
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey
    ? new Stripe(stripeSecretKey, { apiVersion: "2026-05-27.dahlia" })
    : null;

export type PlanId = "free" | "pro" | "business";

export type Plan = {
    id: PlanId;
    name: string;
    priceJpy: number;          // monthly price in JPY
    priceEnvVar?: string;      // env var holding the Stripe Price id
    features: string[];
    highlighted?: boolean;
};

/**
 * Pricing is sized for the launch goal: ¥1,000,000 first-month revenue.
 *
 *   100 paying users averaging ¥10,000/mo  =>  ¥1,000,000 MRR.
 *
 * The Business tier is the anchor that makes the math work; Pro widens the top
 * of the funnel toward the "100 users" goal.
 */
export const PLANS: Record<PlanId, Plan> = {
    free: {
        id: "free",
        name: "Free",
        priceJpy: 0,
        features: ["即時投稿", "1日3件まで予約投稿", "AIエージェント お試し"],
    },
    pro: {
        id: "pro",
        name: "Pro",
        priceJpy: 1980,
        priceEnvVar: "STRIPE_PRICE_PRO",
        features: ["無制限の予約投稿", "AIエージェント投稿生成", "画像・動画添付", "メールサポート"],
    },
    business: {
        id: "business",
        name: "Business",
        priceJpy: 9800,
        priceEnvVar: "STRIPE_PRICE_BUSINESS",
        features: ["Proの全機能", "複数アカウント管理", "優先サポート", "分析ダッシュボード"],
        highlighted: true,
    },
};

/** Goal targets surfaced on the KPI dashboard. */
export const GOALS = {
    firstMonthRevenueJpy: 1_000_000,
    users: 100,
};

export function planFromPriceId(priceId: string | null | undefined): PlanId | null {
    if (!priceId) return null;
    if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
    if (priceId === process.env.STRIPE_PRICE_BUSINESS) return "business";
    return null;
}
