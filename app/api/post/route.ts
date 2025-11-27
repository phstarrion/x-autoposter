import { NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { PostResponse } from "../../../types/api";

export async function POST(req: Request) {
    try {
        const { text } = await req.json();
        if (!text) {
            const errorResponse: PostResponse = { success: false, error: "text is required" };
            return NextResponse.json(errorResponse, { status: 400 });
        }

        // Mock Mode Check
        if (process.env.MOCK_MODE === "true") {
            console.log("★ MOCK MODE: Post received:", text);

            // Simulate network delay
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // Simulate error for specific keyword
            if (text.includes("error")) {
                throw new Error("Simulated Mock Error");
            }

            const mockResponse: PostResponse = {
                success: true,
                tweetId: "mock-tweet-id-" + Date.now(),
                text,
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

        // ツイート投稿
        const tweet = await client.v2.tweet(text);

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
