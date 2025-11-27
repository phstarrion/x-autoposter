import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import { TwitterApi } from "twitter-api-v2";

export async function GET() {
    // Mock Mode: Just log
    if (process.env.MOCK_MODE === "true") {
        console.log("★ MOCK MODE: Cron job triggered");
        return NextResponse.json({ success: true, message: "Mock Cron executed" });
    }

    if (!supabase) {
        return NextResponse.json(
            { success: false, error: "Database not configured" },
            { status: 500 }
        );
    }

    try {
        // 1. Get pending posts that are due
        const { data: posts, error } = await supabase
            .from("scheduled_posts")
            .select("*")
            .eq("status", "pending")
            .lte("scheduled_at", new Date().toISOString());

        if (error) throw error;
        if (!posts || posts.length === 0) {
            return NextResponse.json({ success: true, message: "No posts to send" });
        }

        // 2. Initialize X Client
        const client = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY!,
            appSecret: process.env.TWITTER_API_SECRET!,
            accessToken: process.env.TWITTER_ACCESS_TOKEN!,
            accessSecret: process.env.TWITTER_ACCESS_SECRET!,
        });

        const results = [];

        // 3. Process each post
        for (const post of posts) {
            try {
                const tweet = await client.v2.tweet(post.text);

                // Update status to sent
                await supabase
                    .from("scheduled_posts")
                    .update({
                        status: "sent",
                        tweet_id: tweet.data.id,
                    })
                    .eq("id", post.id);

                results.push({ id: post.id, status: "sent", tweetId: tweet.data.id });
            } catch (e: any) {
                console.error(`Failed to post ${post.id}:`, e);

                // Update status to failed
                await supabase
                    .from("scheduled_posts")
                    .update({ status: "failed" })
                    .eq("id", post.id);

                results.push({ id: post.id, status: "failed", error: e.message });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (e: any) {
        console.error("Cron Error:", e);
        return NextResponse.json(
            { success: false, error: e.message },
            { status: 500 }
        );
    }
}
