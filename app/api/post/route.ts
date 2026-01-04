import { NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { PostResponse } from "../../../types/api";

export async function POST(req: Request) {
    try {
        const { text, media } = await req.json();
        // Allow text to be empty if media is present? Standard Twitter requires text OR media.
        // But for this app let's enforce text for now or valid combination.
        if (!text && (!media || media.length === 0)) {
            const errorResponse: PostResponse = { success: false, error: "text or media is required" };
            return NextResponse.json(errorResponse, { status: 400 });
        }

        // Mock Mode Check
        if (process.env.MOCK_MODE === "true") {
            console.log("★ MOCK MODE: Post received:", text, "Media:", media);

            // Simulate network delay
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // Simulate error for specific keyword
            if (text && text.includes("error")) {
                throw new Error("Simulated Mock Error");
            }

            const mockResponse: PostResponse = {
                success: true,
                tweetId: "mock-tweet-id-" + Date.now(),
                text,
                post: {
                    id: Date.now(),
                    text: text || "",
                    status: "sent",
                    created_at: new Date().toISOString(),
                    scheduled_at: new Date().toISOString(),
                    media: media || []
                }
            };
            return NextResponse.json(mockResponse);
        }

        // X API クライアント作成
        const client = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY!,
            appSecret: process.env.TWITTER_API_SECRET!,
            accessToken: process.env.TWITTER_ACCESS_TOKEN!,
            accessSecret: process.env.TWITTER_ACCESS_SECRET!,
        });

        let mediaIds: string[] = [];
        if (media && Array.isArray(media) && media.length > 0) {
            console.log("Uploading media...", media.length);
            mediaIds = await Promise.all(media.map(async (m: { url: string; type: "image" | "video" }) => {
                try {
                    // Fetch file from URL
                    const res = await fetch(m.url);
                    if (!res.ok) throw new Error(`Failed to fetch media: ${m.url}`);
                    const arrayBuffer = await res.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    // Infer mime type from URL extension if possible
                    // simple heuristic
                    const ext = m.url.split('.').pop()?.split('?')[0];

                    // Upload media
                    // ensure we use the v1 API for upload as currently v2 upload is limited or just use convenience wrapper
                    // client.v1.uploadMedia handles it.
                    const mediaId = await client.v1.uploadMedia(buffer, { mimeType: m.type === 'video' ? 'video/mp4' : undefined });
                    return mediaId;
                } catch (e) {
                    console.error("Failed to upload media item:", e);
                    throw e;
                }
            }));
            console.log("Media uploaded, IDs:", mediaIds);
        }

        // ツイート投稿
        // v2.tweet supports media.media_ids
        const tweet = await client.v2.tweet(text, {
            media: mediaIds.length > 0 ? { media_ids: mediaIds as any } : undefined // cast as any because type definition might be slightly off in strict mode or different version
        });

        const successResponse: PostResponse = {
            success: true,
            tweetId: tweet.data.id,
            text,
        };
        return NextResponse.json(successResponse);
    } catch (e: any) {
        // ログには詳細を出すが、クライアントには安全なメッセージのみ返す
        console.error("X API ERROR:", e);

        const errorResponse: PostResponse = {
            success: false,
            error: "Xへの投稿に失敗しました。しばらく待ってから再度お試しください。",
        };
        return NextResponse.json(errorResponse, { status: 500 });
    }
}
