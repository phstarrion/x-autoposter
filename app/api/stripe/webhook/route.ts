import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, planFromPriceId } from "../../../../lib/stripe";
import { supabase } from "../../../../lib/supabase";

/**
 * Stripe webhook handler. Records payments and subscriptions so the KPI
 * dashboard can confirm real revenue against the ¥1,000,000 goal.
 *
 * Configure STRIPE_WEBHOOK_SECRET and point a Stripe webhook at this route.
 * Relevant events: checkout.session.completed, invoice.paid,
 * customer.subscription.updated, customer.subscription.deleted.
 */
export async function POST(req: Request) {
    if (!stripe) {
        return NextResponse.json({ received: true, mock: true });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    let event: Stripe.Event;
    try {
        if (!webhookSecret || !signature) {
            event = JSON.parse(body) as Stripe.Event;
        } else {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : "invalid signature";
        console.error("Webhook signature verification failed:", message);
        return NextResponse.json({ error: message }, { status: 400 });
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                await upsertUserFromCheckout(session);
                break;
            }
            case "invoice.paid": {
                const invoice = event.data.object as Stripe.Invoice;
                await recordPayment(invoice);
                break;
            }
            case "customer.subscription.updated":
            case "customer.subscription.created":
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                await upsertSubscription(subscription);
                break;
            }
            default:
                // ignore unrelated events
                break;
        }
    } catch (err) {
        console.error(`Error handling ${event.type}:`, err);
        // Return 500 so Stripe retries.
        return NextResponse.json({ error: "handler failed" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}

async function upsertUserFromCheckout(session: Stripe.Checkout.Session) {
    if (!supabase) return;
    const email = session.customer_details?.email || session.customer_email;
    const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
    const plan = (session.metadata?.plan as string) || "pro";
    if (!email) return;

    await supabase.from("app_users").upsert(
        {
            email,
            stripe_customer_id: customerId ?? null,
            plan,
        },
        { onConflict: "email" }
    );
}

async function recordPayment(invoice: Stripe.Invoice) {
    if (!supabase) return;
    const amount = invoice.amount_paid ?? 0; // JPY is zero-decimal, so this is already yen
    if (amount <= 0) return;
    const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

    await supabase.from("payments").upsert(
        {
            id: invoice.id,
            stripe_customer_id: customerId ?? null,
            amount_jpy: amount,
            status: "paid",
            paid_at: new Date((invoice.status_transitions?.paid_at ?? invoice.created) * 1000).toISOString(),
            raw: { number: invoice.number, hosted_invoice_url: invoice.hosted_invoice_url },
        },
        { onConflict: "id" }
    );
}

async function upsertSubscription(subscription: Stripe.Subscription) {
    if (!supabase) return;
    const item = subscription.items.data[0];
    const priceId = item?.price?.id;
    const plan = planFromPriceId(priceId);
    if (!plan) return;

    const customerId =
        typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;

    await supabase.from("subscriptions").upsert(
        {
            id: subscription.id,
            stripe_customer_id: customerId ?? "",
            plan,
            status: subscription.status,
            amount_jpy: item?.price?.unit_amount ?? 0,
            current_period_end: new Date(subscription.items.data[0].current_period_end * 1000).toISOString(),
        },
        { onConflict: "id" }
    );

    // Keep the user's plan in sync.
    if (customerId) {
        const effectivePlan = subscription.status === "active" || subscription.status === "trialing" ? plan : "free";
        await supabase
            .from("app_users")
            .update({ plan: effectivePlan })
            .eq("stripe_customer_id", customerId);
    }
}
