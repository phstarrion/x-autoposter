import { NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

export async function POST(req: Request) {
    try {
        const { text } = await req.json();
        if (!text) {
            return NextResponse.json({ error: "text is required" }, { status: 400 });
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

        return NextResponse.json({
            success: true,
            tweetId: tweet.data.id,
            text,
        });

    } catch (e: any) {
        console.error("X API ERROR:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}