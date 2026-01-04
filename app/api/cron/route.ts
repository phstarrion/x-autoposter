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
                let mediaIds: string[] = [];
                const media = post.media;

                // Media Upload Logic (Copied from /api/post/route.ts)
                if (media && Array.isArray(media) && media.length > 0) {
                    console.log(`Uploading media for post ${post.id}...`, media.length);
                    mediaIds = await Promise.all(media.map(async (m: { url: string; type: "image" | "video" }) => {
                        try {
                            // Fetch file from URL
                            const res = await fetch(m.url);
                            if (!res.ok) throw new Error(`Failed to fetch media: ${m.url}`);
                            const arrayBuffer = await res.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);

                            // Infer mime type from URL extension if possible
                            const ext = m.url.split('.').pop()?.split('?')[0];
                            const mimeType = m.type === 'video'
                                ? 'video/mp4'
                                : ext === 'png'
                                    ? 'image/png'
                                    : ext === 'webp'
                                        ? 'image/webp'
                                        : 'image/jpeg';

                            // Upload media using v1 API
                            const mediaId = await client.v1.uploadMedia(buffer, { mimeType });
                            return mediaId;
                        } catch (e) {
                            console.error(`Failed to upload media item for post ${post.id}:`, e);
                            throw e;
                        }
                    }));
                    console.log(`Media uploaded for post ${post.id}, IDs:`, mediaIds);
                }

                const tweet = await client.v2.tweet(post.text, {
                    media: mediaIds.length > 0 ? { media_ids: mediaIds as any } : undefined
                });

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
