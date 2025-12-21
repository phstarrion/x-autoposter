import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import { PostResponse } from "../../../types/api";

// Shared mock store - using a simple approach
const getBaseUrl = () => {
    return process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";
};

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

        // Mock Mode: Add to mock store via internal API
        if (process.env.MOCK_MODE === "true") {
            console.log("★ MOCK MODE: Scheduling post:", text, "at", scheduledAt);

            // Call the scheduled-posts API to add to the store
            const baseUrl = getBaseUrl();
            const response = await fetch(`${baseUrl}/api/scheduled-posts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, scheduledAt }),
            });

            if (!response.ok) {
                throw new Error("Failed to add to mock store");
            }

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

        // The frontend now sends ISO string with proper timezone
        // Just use it directly
        const { error } = await supabase.from("scheduled_posts").insert({
            text,
            scheduled_at: scheduledAt,
            status: "pending",
            sort_order: Date.now(),
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
