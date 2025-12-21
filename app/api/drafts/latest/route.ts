import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Force Node.js runtime for Vercel Edge compatibility
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type Draft = {
    id: string;
    text: string;
    source: string;
    meta: object | null;
    created_at: string;
};

// Create Supabase client directly in this route to ensure it's available
function getSupabaseClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        return null;
    }

    return createClient(url, key);
}

// GET: 最新の下書きを取得
export async function GET() {
    const supabase = getSupabaseClient();

    if (!supabase) {
        return NextResponse.json(
            { error: "Database not configured" },
            { status: 500 }
        );
    }

    try {
        const { data, error } = await supabase
            .from("drafts")
            .select("id, text, source, meta, created_at")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("Supabase error:", error);
            throw error;
        }

        // Return draft (null if no rows)
        return NextResponse.json({
            draft: data || null,
        });
    } catch (e: unknown) {
        console.error("Fetch Latest Draft Error:", e);
        const message = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json(
            { error: `下書きの取得に失敗しました: ${message}` },
            { status: 500 }
        );
    }
}
