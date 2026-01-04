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
            .order("sort_order", { ascending: true, nullsFirst: false })
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
        const { text, scheduledAt, media } = await req.json();

        if (!text && (!media || media.length === 0)) {
            return NextResponse.json(
                { success: false, error: "text or media is required" },
                { status: 400 }
            );
        }

        if (!scheduledAt) {
            return NextResponse.json(
                { success: false, error: "scheduledAt is required" },
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
                media: media || []
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

// PUT: 予約投稿を編集
export async function PUT(req: Request) {
    try {
        const { id, text, scheduledAt, media } = await req.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: "id is required" },
                { status: 400 }
            );
        }

        if (!text && !scheduledAt && !media) {
            return NextResponse.json(
                { success: false, error: "No fields to update" },
                { status: 400 }
            );
        }

        // バリデーション: 280文字制限
        if (text && text.length > 280) {
            return NextResponse.json(
                { success: false, error: "テキストは280文字以内にしてください" },
                { status: 400 }
            );
        }

        // バリデーション: 予約日時が過去でないか
        if (scheduledAt && new Date(scheduledAt) <= new Date()) {
            return NextResponse.json(
                { success: false, error: "予約日時は未来の日時を指定してください" },
                { status: 400 }
            );
        }

        // Mock Mode
        if (process.env.MOCK_MODE === "true") {
            const post = mockPostsStore.find(p => p.id === id);
            if (post && post.status === "pending") {
                if (text !== undefined) post.text = text;
                if (scheduledAt) post.scheduled_at = new Date(scheduledAt).toISOString();
                if (media) post.media = media;
                console.log("★ MOCK MODE: Updated scheduled post:", post);
                return NextResponse.json({ success: true, post });
            }
            return NextResponse.json(
                { success: false, error: "投稿が見つかりません" },
                { status: 404 }
            );
        }

        if (!supabase) {
            return NextResponse.json(
                { success: false, error: "Database not configured" },
                { status: 500 }
            );
        }

        // 更新データを構築
        const updateData: { text?: string; scheduled_at?: string; media?: any } = {};
        if (text !== undefined) updateData.text = text;
        if (scheduledAt) updateData.scheduled_at = scheduledAt;
        if (media) updateData.media = media;

        const { data, error } = await supabase
            .from("scheduled_posts")
            .update(updateData)
            .eq("id", id)
            .eq("status", "pending")
            .select()
            .single();

        if (error) throw error;

        if (!data) {
            return NextResponse.json(
                { success: false, error: "投稿が見つかりません" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, post: data });
    } catch (e: any) {
        console.error("Update Scheduled Post Error:", e);
        return NextResponse.json(
            { success: false, error: "予約投稿の更新に失敗しました" },
            { status: 500 }
        );
    }
}

// DELETE: 予約投稿を削除
export async function DELETE(req: Request) {
    try {
        const url = new URL(req.url);
        const action = url.searchParams.get("action");

        // Handle clear history action
        if (action === "clear_history") {
            // Mock Mode
            if (process.env.MOCK_MODE === "true") {
                // Remove sent and failed posts
                const initialLength = mockPostsStore.length;
                const newStore = mockPostsStore.filter(p => p.status === "pending");
                mockPostsStore.length = 0; // Clear array
                mockPostsStore.push(...newStore); // Restore pending

                console.log(`★ MOCK MODE: Cleared history. Removed ${initialLength - mockPostsStore.length} posts.`);
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
                .in("status", ["sent", "failed"]);

            if (error) throw error;

            return NextResponse.json({ success: true });
        }

        // Standard single delete
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
            .eq("id", id);
        // Note: We allow deleting pending AND sent/failed items individually too, so no status check here or allow all.
        // Previous code had .eq("status", "pending") which prevented deleting completed posts. 
        // Let's remove that restriction so user can delete any post.

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
