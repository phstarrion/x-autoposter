import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { text } = await request.json();

        // Validation
        if (!text || typeof text !== "string" || text.trim() === "") {
            return NextResponse.json(
                { ok: false, message: "テキストが空です" },
                { status: 400 }
            );
        }

        if (text.length > 280) {
            return NextResponse.json(
                { ok: false, message: "280文字を超えています" },
                { status: 400 }
            );
        }

        // Log to server console
        console.log("Xに投稿（予定）:", text);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json(
            { ok: false, message: "サーバーエラーです" },
            { status: 500 }
        );
    }
}
