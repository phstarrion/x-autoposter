import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export type Draft = {
    id: string;
    text: string;
    source: string;
    meta: object | null;
    created_at: string;
};

// GET: 最新の下書きを取得
export async function GET() {
    if (!supabase) {
        return NextResponse.json(
            { success: false, error: "Database not configured" },
            { status: 500 }
        );
    }

    try {
        const { data, error } = await supabase
            .from("drafts")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows returned, which is fine
            throw error;
        }

        return NextResponse.json({
            success: true,
            draft: data || null,
        });
    } catch (e: unknown) {
        console.error("Fetch Latest Draft Error:", e);
        const message = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json(
            { success: false, error: `下書きの取得に失敗しました: ${message}` },
            { status: 500 }
        );
    }
}
