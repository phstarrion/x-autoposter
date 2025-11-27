import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import { PostResponse } from "../../../types/api";

export async function POST(req: Request) {
    try {
        const { text, scheduledAt } = await req.json();

        if (!text) {
            return NextResponse.json(
                { success: false, error: "text is required" },
                { status: 400 }
            );
        }

        if (!scheduledAt) {
            return NextResponse.json(
                { success: false, error: "scheduledAt is required" },
                { status: 400 }
            );
        }

        // Mock Mode: Simulate scheduling
        if (process.env.MOCK_MODE === "true") {
            console.log("★ MOCK MODE: Scheduled post:", text, "at", scheduledAt);
            await new Promise((resolve) => setTimeout(resolve, 500));
            return NextResponse.json({
                success: true,
                tweetId: "mock-scheduled-id-" + Date.now(),
                text,
            });
        }

        // Real Mode: Insert into Supabase
        if (!supabase) {
            return NextResponse.json(
                { success: false, error: "Database not configured" },
                { status: 500 }
            );
        }

        const { error } = await supabase.from("scheduled_posts").insert({
            text,
            scheduled_at: scheduledAt,
            status: "pending",
        });

        if (error) {
            console.error("Supabase Error:", error);
            throw error;
        }

        return NextResponse.json({
            success: true,
            tweetId: "pending-schedule",
            text,
        });
    } catch (e: any) {
        console.error("Schedule API Error:", e);
        return NextResponse.json(
            { success: false, error: "予約投稿に失敗しました" },
            { status: 500 }
        );
    }
}
