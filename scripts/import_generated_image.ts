#!/usr/bin/env npx ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

/**
 * Import Generated Image Script
 * Usage: npm run import-image <path_to_json_file>
 * 
 * Uploads image to Supabase Storage and saves x_caption as draft.
 */

function getSupabaseClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.error('❌ Supabase credentials not found in .env.local');
        return null;
    }

    return createClient(url, key);
}

async function main() {
    // 1. Parse arguments
    const jsonPath = process.argv[2];
    if (!jsonPath) {
        console.error('Usage: npm run import-image <path_to_json_file>');
        process.exit(1);
    }

    const absoluteJsonPath = path.resolve(process.cwd(), jsonPath);
    if (!fs.existsSync(absoluteJsonPath)) {
        console.error(`Error: JSON file not found at ${absoluteJsonPath}`);
        process.exit(1);
    }

    // 2. Read JSON and find companion PNG
    console.log(`📖 Reading metadata from: ${path.basename(absoluteJsonPath)}`);
    const jsonContent = JSON.parse(fs.readFileSync(absoluteJsonPath, 'utf-8'));

    // Assume PNG has same basename
    const imagePath = absoluteJsonPath.replace(/\.json$/, '.png');
    if (!fs.existsSync(imagePath)) {
        console.error(`Error: Companion PNG file not found at ${imagePath}`);
        process.exit(1);
    }

    // 3. Get Supabase client
    const supabase = getSupabaseClient();
    if (!supabase) {
        process.exit(1);
    }

    // 4. Upload image to Supabase Storage
    const imageName = path.basename(imagePath);
    const fileBuffer = fs.readFileSync(imagePath);
    const fileName = `${Date.now()}_${imageName}`;

    console.log(`🖼️  Uploading image to Supabase Storage: ${fileName}`);

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, fileBuffer, {
            contentType: 'image/png',
            upsert: false
        });

    if (uploadError) {
        console.error(`❌ Upload failed: ${uploadError.message}`);
        process.exit(1);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(fileName);

    console.log(`✅ Uploaded successfully: ${publicUrl}`);

    // 5. Get x_caption from JSON
    const caption = jsonContent.x_caption || '';
    if (!caption) {
        console.error('❌ No x_caption found in JSON file');
        process.exit(1);
    }

    console.log(`📝 Using x_caption: "${caption}"`);

    // 6. Save draft to Supabase
    const formattedMedia = [{
        url: publicUrl,
        type: 'image' as const
    }];

    const meta = {
        theme_id: jsonContent.theme_id || path.basename(absoluteJsonPath, '.json'),
        prompt: jsonContent.prompt || '',
        ready_to_post: true,
        char_count: caption.length
    };

    console.log('💾 Saving draft to Supabase...');

    const { error } = await supabase.from('drafts').insert({
        text: caption,
        source: 'agents',
        meta: meta,
        media: formattedMedia,
    });

    if (error) {
        console.error(`❌ Failed to save draft: ${error.message}`);
        process.exit(1);
    }

    console.log('\n✅ Import completed successfully!');
    console.log('='.repeat(50));
    console.log(`📝 Post text: ${caption}`);
    console.log(`🖼️  Image: ${publicUrl}`);
    console.log('='.repeat(50));
}

main().catch(console.error);
