import { NextResponse } from "next/server";
import { stripe, GOALS } from "../../../lib/stripe";
import { supabase } from "../../../lib/supabase";

export type Metrics = {
    firstMonthRevenueJpy: number;
    totalRevenueJpy: number;
    users: number;
    payingUsers: number;
    referredUsers: number;
    goals: typeof GOALS;
    revenueGoalMet: boolean;
    usersGoalMet: boolean;
    source: "stripe" | "supabase" | "mock";
};

/**
 * Confirms progress toward the launch goal:
 *   ¥1,000,000 first-month Stripe revenue + 100 users.
 *
 * Revenue is read straight from Stripe (the source of truth) when configured,
 * with a fallback to the payments table recorded by the webhook.
 */
export async function GET() {
    // Mock Mode: deterministic sample so the dashboard renders without keys.
    if (process.env.MOCK_MODE === "true") {
        return NextResponse.json(buildMetrics(720_000, 1_240_000, 63, 41, 28, "mock"));
    }

    const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

    // --- Revenue from Stripe (authoritative) ---------------------------------
    if (stripe) {
        try {
            let firstMonthRevenue = 0;
            let totalRevenue = 0;
            const params: { limit: number; starting_after?: string } = { limit: 100 };
            // Page through charges; JPY is zero-decimal so amounts are already yen.
            for (let page = 0; page < 20; page++) {
                const charges = await stripe.charges.list(params);
                for (const charge of charges.data) {
                    if (charge.paid && !charge.refunded && charge.status === "succeeded") {
                        totalRevenue += charge.amount;
                        if (charge.created * 1000 >= startOfMonth.getTime()) {
                            firstMonthRevenue += charge.amount;
                        }
                    }
                }
                if (!charges.has_more) break;
                params.starting_after = charges.data[charges.data.length - 1]?.id;
            }

            const { users, payingUsers, referredUsers } = await countUsers();
            return NextResponse.json(
                buildMetrics(firstMonthRevenue, totalRevenue, users, payingUsers, referredUsers, "stripe")
            );
        } catch (err) {
            console.error("Stripe metrics error, falling back to DB:", err);
        }
    }

    // --- Fallback: payments table populated by the webhook -------------------
    if (supabase) {
        try {
            const { data: summary } = await supabase
                .from("revenue_summary")
                .select("*")
                .maybeSingle();
            const { users, payingUsers, referredUsers } = await countUsers();
            return NextResponse.json(
                buildMetrics(
                    summary?.current_month_revenue_jpy ?? 0,
                    summary?.total_revenue_jpy ?? 0,
                    users,
                    payingUsers,
                    referredUsers,
                    "supabase"
                )
            );
        } catch (err) {
            console.error("Supabase metrics error:", err);
        }
    }

    return NextResponse.json(buildMetrics(0, 0, 0, 0, 0, "supabase"));
}

async function countUsers(): Promise<{ users: number; payingUsers: number; referredUsers: number }> {
    if (!supabase) return { users: 0, payingUsers: 0, referredUsers: 0 };
    const { count: users } = await supabase
        .from("app_users")
        .select("*", { count: "exact", head: true });
    const { count: payingUsers } = await supabase
        .from("app_users")
        .select("*", { count: "exact", head: true })
        .neq("plan", "free");
    const { count: referredUsers } = await supabase
        .from("app_users")
        .select("*", { count: "exact", head: true })
        .not("referred_by", "is", null);
    return { users: users ?? 0, payingUsers: payingUsers ?? 0, referredUsers: referredUsers ?? 0 };
}

function buildMetrics(
    firstMonthRevenueJpy: number,
    totalRevenueJpy: number,
    users: number,
    payingUsers: number,
    referredUsers: number,
    source: Metrics["source"]
): Metrics {
    return {
        firstMonthRevenueJpy,
        totalRevenueJpy,
        users,
        payingUsers,
        referredUsers,
        goals: GOALS,
        revenueGoalMet: firstMonthRevenueJpy >= GOALS.firstMonthRevenueJpy,
        usersGoalMet: users >= GOALS.users,
        source,
    };
}
