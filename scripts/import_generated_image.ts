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
 * Directly saves x_caption from JSON as post text with image attachment.
 */

const ROOT_DIR = path.resolve(__dirname, '..');
const MANAGED_IMAGES_DIR = path.join(ROOT_DIR, 'public', 'managed_images');

// Ensure directories exist
fs.mkdirSync(MANAGED_IMAGES_DIR, { recursive: true });

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

    const imageName = path.basename(imagePath);
    const targetImagePath = path.join(MANAGED_IMAGES_DIR, imageName);

    // 3. Copy Image
    console.log(`🖼️  Copying image to: public/managed_images/${imageName}`);
    fs.copyFileSync(imagePath, targetImagePath);

    // 4. Get x_caption from JSON
    const caption = jsonContent.x_caption || '';
    if (!caption) {
        console.error('❌ No x_caption found in JSON file');
        process.exit(1);
    }

    console.log(`📝 Using x_caption: "${caption}"`);

    // 5. Save directly to Supabase
    const supabase = getSupabaseClient();
    if (!supabase) {
        process.exit(1);
    }

    const mediaPath = `/managed_images/${imageName}`;
    const formattedMedia = [{
        url: mediaPath,
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
    console.log(`🖼️  Image: ${mediaPath}`);
    console.log('='.repeat(50));
}

main().catch(console.error);
