#!/usr/bin/env npx ts-node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Import Generated Image Script
 * Usage: npm run import-image <path_to_json_file>
 */

const ROOT_DIR = path.resolve(__dirname, '..');
const INPUTS_DIR = path.join(ROOT_DIR, 'inputs');
const MANAGED_IMAGES_DIR = path.join(ROOT_DIR, 'public', 'managed_images');

// Ensure directories exist
fs.mkdirSync(INPUTS_DIR, { recursive: true });
fs.mkdirSync(MANAGED_IMAGES_DIR, { recursive: true });

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
    console.log(`Reading metadata from: ${path.basename(absoluteJsonPath)}`);
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
    console.log(`Copying image to: public/managed_images/${imageName}`);
    fs.copyFileSync(imagePath, targetImagePath);

    // 4. Create Input File
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const inputFilename = `import_${timestamp}.md`;
    const inputPath = path.join(INPUTS_DIR, inputFilename);

    const prompt = jsonContent.prompt || '';
    const caption = jsonContent.x_caption || 'No caption provided';
    const constraints = jsonContent.negative_constraints ? `\nConstraints: ${jsonContent.negative_constraints}` : '';

    const markdownContent = `# ${caption}

## Context
This is an AI generated image.
Prompt used: ${prompt}
${constraints}

## Image
/managed_images/${imageName}

## Goal
Create an engaging social media post based on this image and context.
`;

    fs.writeFileSync(inputPath, markdownContent, 'utf-8');
    console.log(`Created input file: inputs/${inputFilename}`);

    // 5. Run Agents
    console.log('\n🚀 Running Agent Pipeline...');
    try {
        execSync('npm run agents', { stdio: 'inherit', cwd: ROOT_DIR });
        console.log('\n✅ Import and generation completed successfully!');
    } catch (error) {
        console.error('\n❌ Agent execution failed.');
        process.exit(1);
    }
}

main().catch(console.error);
