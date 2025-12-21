import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        return null;
    }

    return createClient(url, key);
}

// GET: 全下書きを取得
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
            .limit(50);

        if (error) {
            console.error("Supabase error:", error);
            throw error;
        }

        return NextResponse.json({
            drafts: data || [],
        });
    } catch (e: unknown) {
        console.error("Fetch Drafts Error:", e);
        const message = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json(
            { error: `下書きの取得に失敗しました: ${message}` },
            { status: 500 }
        );
    }
}

// DELETE: 下書きを削除
export async function DELETE(req: Request) {
    const supabase = getSupabaseClient();

    if (!supabase) {
        return NextResponse.json(
            { error: "Database not configured" },
            { status: 500 }
        );
    }

    try {
        const { id } = await req.json();

        if (!id) {
            return NextResponse.json(
                { error: "id is required" },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from("drafts")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Supabase error:", error);
            throw error;
        }

        return NextResponse.json({
            success: true,
        });
    } catch (e: unknown) {
        console.error("Delete Draft Error:", e);
        const message = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json(
            { error: `下書きの削除に失敗しました: ${message}` },
            { status: 500 }
        );
    }
}
