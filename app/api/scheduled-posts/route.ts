import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import { ScheduledPost } from "../../../types/api";

// In-memory store for mock mode
const mockPostsStore: ScheduledPost[] = [];

// GET: 予約投稿一覧を取得
export async function GET() {
    // Mock Mode
    if (process.env.MOCK_MODE === "true") {
        console.log("★ MOCK MODE: Fetching scheduled posts, count:", mockPostsStore.length);
        return NextResponse.json({ success: true, posts: mockPostsStore });
    }

    if (!supabase) {
        return NextResponse.json(
            { success: false, error: "Database not configured" },
            { status: 500 }
        );
    }

    try {
        const { data: posts, error } = await supabase
            .from("scheduled_posts")
            .select("*")
            .order("scheduled_at", { ascending: true });

        if (error) throw error;

        return NextResponse.json({ success: true, posts: posts || [] });
    } catch (e: any) {
        console.error("Fetch Scheduled Posts Error:", e);
        return NextResponse.json(
            { success: false, error: "予約投稿の取得に失敗しました" },
            { status: 500 }
        );
    }
}

// POST: 予約投稿を追加（モックモード用）
export async function POST(req: Request) {
    try {
        const { text, scheduledAt } = await req.json();

        if (!text || !scheduledAt) {
            return NextResponse.json(
                { success: false, error: "text and scheduledAt are required" },
                { status: 400 }
            );
        }

        // Mock Mode
        if (process.env.MOCK_MODE === "true") {
            const newPost: ScheduledPost = {
                id: Date.now(),
                text,
                scheduled_at: new Date(scheduledAt).toISOString(),
                status: "pending",
                created_at: new Date().toISOString(),
            };
            mockPostsStore.push(newPost);
            console.log("★ MOCK MODE: Added scheduled post:", newPost);
            return NextResponse.json({ success: true, post: newPost });
        }

        return NextResponse.json(
            { success: false, error: "Database not configured" },
            { status: 500 }
        );
    } catch (e: any) {
        console.error("Add Scheduled Post Error:", e);
        return NextResponse.json(
            { success: false, error: "予約投稿の追加に失敗しました" },
            { status: 500 }
        );
    }
}

// DELETE: 予約投稿を削除
export async function DELETE(req: Request) {
    try {
        const { id } = await req.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: "id is required" },
                { status: 400 }
            );
        }

        // Mock Mode
        if (process.env.MOCK_MODE === "true") {
            const index = mockPostsStore.findIndex(p => p.id === id);
            if (index !== -1) {
                mockPostsStore.splice(index, 1);
            }
            console.log("★ MOCK MODE: Deleted scheduled post:", id);
            return NextResponse.json({ success: true });
        }

        if (!supabase) {
            return NextResponse.json(
                { success: false, error: "Database not configured" },
                { status: 500 }
            );
        }

        const { error } = await supabase
            .from("scheduled_posts")
            .delete()
            .eq("id", id)
            .eq("status", "pending");

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Delete Scheduled Post Error:", e);
        return NextResponse.json(
            { success: false, error: "予約投稿の削除に失敗しました" },
            { status: 500 }
        );
    }
}
