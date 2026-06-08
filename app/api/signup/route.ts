import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

/** Short, URL-safe referral code (e.g. "k3f9qa2x"). */
function generateReferralCode(): string {
    return Math.random().toString(36).slice(2, 10);
}

/**
 * Register a user (free plan by default). Drives the "100 users" goal metric.
 * Body: { email: string, ref?: string }  — `ref` is the referrer's code.
 * Returns the new user's own referral code so the client can build an invite link.
 */
export async function POST(req: Request) {
    try {
        const { email, ref } = (await req.json()) as { email?: string; ref?: string };
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            return NextResponse.json({ success: false, error: "valid email is required" }, { status: 400 });
        }

        const referralCode = generateReferralCode();

        if (process.env.MOCK_MODE === "true" || !supabase) {
            console.log("★ MOCK MODE: Signup:", email, "ref:", ref);
            return NextResponse.json({ success: true, mock: true, referralCode });
        }

        // Resolve the referrer (if the code is valid) so referrals are only credited to real users.
        let referredBy: string | null = null;
        if (ref) {
            const { data: referrer } = await supabase
                .from("app_users")
                .select("referral_code")
                .eq("referral_code", ref)
                .maybeSingle();
            referredBy = referrer?.referral_code ?? null;
        }

        // Insert new users only; never overwrite an existing user's referral data.
        const { data: existing } = await supabase
            .from("app_users")
            .select("referral_code")
            .eq("email", email)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ success: true, referralCode: existing.referral_code ?? referralCode });
        }

        const { error } = await supabase.from("app_users").insert({
            email,
            plan: "free",
            referral_code: referralCode,
            referred_by: referredBy,
        });
        if (error) throw error;

        return NextResponse.json({ success: true, referralCode });
    } catch (error) {
        console.error("Signup error:", error);
        const message = error instanceof Error ? error.message : "signup failed";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
