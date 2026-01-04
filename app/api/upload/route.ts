import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        if (process.env.MOCK_MODE === "true") {
            // Return a fake URL in mock mode
            return NextResponse.json({
                url: `https://picsum.photos/seed/${Date.now()}/400/300`,
                type: file.type
            });
        }

        if (!supabase) {
            return NextResponse.json({ error: "Supabase client not initialized" }, { status: 500 });
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { data, error } = await supabase.storage
            .from('uploads')
            .upload(filePath, file);

        if (error) {
            console.error("Supabase Storage Error:", error);
            return NextResponse.json({ error: "Upload failed" }, { status: 500 });
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('uploads')
            .getPublicUrl(filePath);

        return NextResponse.json({ url: publicUrl });

    } catch (error) {
        console.error("Upload Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
