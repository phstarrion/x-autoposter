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

type ReorderItem = {
    id: number;
    sort_order: number;
    scheduled_at?: string; // Optional: swap times when provided
};

/**
 * POST: 予約投稿の並び順と予約時間を更新
 * Body: { items: [{ id: number, sort_order: number, scheduled_at?: string }] }
 * 
 * When scheduled_at is provided, it will update the scheduled time as well.
 * This allows swapping times when reordering posts.
 */
export async function POST(req: Request) {
    const supabase = getSupabaseClient();

    if (!supabase) {
        return NextResponse.json(
            { ok: false, error: "Database not configured" },
            { status: 500 }
        );
    }

    try {
        const { items } = await req.json() as { items: ReorderItem[] };

        if (!items || !Array.isArray(items)) {
            return NextResponse.json(
                { ok: false, error: "items array is required" },
                { status: 400 }
            );
        }

        // Update each item's sort_order and optionally scheduled_at
        const updates = items.map(item => {
            const updateData: { sort_order: number; scheduled_at?: string } = {
                sort_order: item.sort_order,
            };

            // Include scheduled_at if provided (for time swapping)
            if (item.scheduled_at) {
                updateData.scheduled_at = item.scheduled_at;
            }

            return supabase
                .from("scheduled_posts")
                .update(updateData)
                .eq("id", item.id);
        });

        const results = await Promise.all(updates);

        // Check for errors
        for (const result of results) {
            if (result.error) {
                console.error("Reorder update error:", result.error);
                throw result.error;
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        console.error("Reorder API Error:", e);
        const message = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json(
            { ok: false, error: `並び替えに失敗しました: ${message}` },
            { status: 500 }
        );
    }
}
