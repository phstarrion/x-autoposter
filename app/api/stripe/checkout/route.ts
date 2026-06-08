import { NextResponse } from "next/server";
import { stripe, PLANS, PlanId } from "../../../../lib/stripe";
import { supabase } from "../../../../lib/supabase";

/**
 * Create a Stripe Checkout session for a paid plan and return its URL.
 * Body: { plan: "pro" | "business", email?: string }
 */
export async function POST(req: Request) {
    try {
        const { plan, email } = (await req.json()) as { plan: PlanId; email?: string };

        if (plan !== "pro" && plan !== "business") {
            return NextResponse.json({ success: false, error: "invalid plan" }, { status: 400 });
        }

        const planConfig = PLANS[plan];
        const priceId = planConfig.priceEnvVar ? process.env[planConfig.priceEnvVar] : undefined;

        // Mock Mode: pretend a checkout was created so the UI flow is testable.
        if (process.env.MOCK_MODE === "true" || !stripe) {
            console.log("★ MOCK MODE: Checkout requested for plan:", plan, "email:", email);
            return NextResponse.json({
                success: true,
                mock: true,
                url: `/dashboard?mock_checkout=${plan}`,
            });
        }

        if (!priceId) {
            return NextResponse.json(
                { success: false, error: `Price id not configured (${planConfig.priceEnvVar})` },
                { status: 500 }
            );
        }

        const origin =
            req.headers.get("origin") ||
            process.env.NEXT_PUBLIC_SITE_URL ||
            "http://localhost:3000";

        // Reuse an existing Stripe customer when we already know this email.
        let customerId: string | undefined;
        if (email && supabase) {
            const { data: user } = await supabase
                .from("app_users")
                .select("stripe_customer_id")
                .eq("email", email)
                .maybeSingle();
            customerId = user?.stripe_customer_id ?? undefined;
        }

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            line_items: [{ price: priceId, quantity: 1 }],
            ...(customerId ? { customer: customerId } : email ? { customer_email: email } : {}),
            metadata: { plan },
            subscription_data: { metadata: { plan } },
            success_url: `${origin}/dashboard?checkout=success`,
            cancel_url: `${origin}/pricing?checkout=cancel`,
            allow_promotion_codes: true,
        });

        return NextResponse.json({ success: true, url: session.url });
    } catch (error) {
        console.error("Checkout error:", error);
        const message = error instanceof Error ? error.message : "checkout failed";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
