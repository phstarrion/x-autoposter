import { NextResponse } from "next/server";
import { stripe } from "../../../../lib/stripe";
import { supabase } from "../../../../lib/supabase";

/**
 * Create a Stripe Customer Portal session so a user can manage their
 * subscription. Body: { email: string }
 */
export async function POST(req: Request) {
    try {
        const { email } = (await req.json()) as { email?: string };
        if (!email) {
            return NextResponse.json({ success: false, error: "email is required" }, { status: 400 });
        }

        if (process.env.MOCK_MODE === "true" || !stripe) {
            return NextResponse.json({ success: true, mock: true, url: "/dashboard" });
        }

        if (!supabase) {
            return NextResponse.json({ success: false, error: "database not configured" }, { status: 500 });
        }

        const { data: user } = await supabase
            .from("app_users")
            .select("stripe_customer_id")
            .eq("email", email)
            .maybeSingle();

        if (!user?.stripe_customer_id) {
            return NextResponse.json({ success: false, error: "no customer found" }, { status: 404 });
        }

        const origin =
            req.headers.get("origin") ||
            process.env.NEXT_PUBLIC_SITE_URL ||
            "http://localhost:3000";

        const session = await stripe.billingPortal.sessions.create({
            customer: user.stripe_customer_id,
            return_url: `${origin}/dashboard`,
        });

        return NextResponse.json({ success: true, url: session.url });
    } catch (error) {
        console.error("Portal error:", error);
        const message = error instanceof Error ? error.message : "portal failed";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
