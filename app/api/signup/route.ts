import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

/**
 * Register a user (free plan by default). Drives the "100 users" goal metric.
 * Body: { email: string }
 */
export async function POST(req: Request) {
    try {
        const { email } = (await req.json()) as { email?: string };
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            return NextResponse.json({ success: false, error: "valid email is required" }, { status: 400 });
        }

        if (process.env.MOCK_MODE === "true" || !supabase) {
            console.log("★ MOCK MODE: Signup:", email);
            return NextResponse.json({ success: true, mock: true });
        }

        const { error } = await supabase
            .from("app_users")
            .upsert({ email, plan: "free" }, { onConflict: "email", ignoreDuplicates: true });

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Signup error:", error);
        const message = error instanceof Error ? error.message : "signup failed";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
