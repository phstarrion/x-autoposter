#!/usr/bin/env npx ts-node

/**
 * Agent Batch Execution Script
 * Runs planner → writer → checker agents in sequence
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { getProvider, parseJsonResponse, LLMMessage } from './lib/llm-provider';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client (using service role key for server-side operations)
function getSupabaseClient(): SupabaseClient | null {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.warn('⚠️ Supabase credentials not found. Draft will not be saved to database.');
        return null;
    }

    return createClient(supabaseUrl, supabaseKey);
}

const ROOT_DIR = path.resolve(__dirname, '..');
const AGENTS_DIR = path.join(ROOT_DIR, 'agents');
const INPUTS_DIR = path.join(ROOT_DIR, 'inputs');
const OUTPUTS_DIR = path.join(ROOT_DIR, 'outputs');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const POLICIES_DIR = path.join(ROOT_DIR, 'policies');

// Timestamp for filenames (YYYYMMDD-HHMMSS format)
function getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}-${hours}${mins}${secs}`;
}
const timestamp = getTimestamp();

// Logger
class Logger {
    private logFile: string;
    private logs: string[] = [];

    constructor() {
        this.logFile = path.join(LOGS_DIR, `run_${timestamp}.log`);
        fs.mkdirSync(LOGS_DIR, { recursive: true });
    }

    log(level: string, message: string) {
        const entry = `[${new Date().toISOString()}] [${level}] ${message}`;
        console.log(entry);
        this.logs.push(entry);
    }

    info(message: string) { this.log('INFO', message); }
    error(message: string) { this.log('ERROR', message); }
    debug(message: string) { this.log('DEBUG', message); }

    save() {
        fs.writeFileSync(this.logFile, this.logs.join('\n'), 'utf-8');
        console.log(`\n📝 Log saved: ${this.logFile}`);
    }
}

// Read latest file from directory
function getLatestFile(dir: string, ext: string = '.md'): string | null {
    if (!fs.existsSync(dir)) return null;

    const files = fs.readdirSync(dir)
        .filter(f => f.endsWith(ext))
        .map(f => ({
            name: f,
            path: path.join(dir, f),
            mtime: fs.statSync(path.join(dir, f)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    return files.length > 0 ? files[0].path : null;
}

// Read all policy files
function readPolicies(): string {
    if (!fs.existsSync(POLICIES_DIR)) return '';

    const policyFiles = fs.readdirSync(POLICIES_DIR).filter(f => f.endsWith('.md'));
    if (policyFiles.length === 0) return '';

    const policies = policyFiles.map(f => {
        const content = fs.readFileSync(path.join(POLICIES_DIR, f), 'utf-8');
        return `## Policy: ${f}\n${content}`;
    });

    return '\n\n---\n# Policies\n' + policies.join('\n\n');
}

// Read agent definition
function readAgent(name: string): string {
    const agentFile = path.join(AGENTS_DIR, `${name}.md`);
    if (!fs.existsSync(agentFile)) {
        throw new Error(`Agent file not found: ${agentFile}`);
    }
    return fs.readFileSync(agentFile, 'utf-8');
}

// Save output
function saveOutput(name: string, data: object): string {
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
    const filename = `${name}_${timestamp}.json`;
    const filepath = path.join(OUTPUTS_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    return filepath;
}

// Save final text
function saveFinalText(text: string): string {
    const filename = `final_${timestamp}.txt`;
    const filepath = path.join(OUTPUTS_DIR, filename);
    fs.writeFileSync(filepath, text, 'utf-8');
    return filepath;
}

// Save draft to Supabase
async function saveDraftToSupabase(
    logger: Logger,
    finalText: string,
    checkerResult: object
): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) {
        logger.info('Supabase not configured, skipping draft save to database');
        return false;
    }

    try {
        const { error } = await supabase.from('drafts').insert({
            text: finalText,
            source: 'agents',
            meta: checkerResult,
        });

        if (error) {
            logger.error(`Failed to save draft to Supabase: ${error.message}`);
            return false;
        }

        logger.info('Draft saved to Supabase successfully');
        return true;
    } catch (err) {
        logger.error(`Supabase error: ${err}`);
        return false;
    }
}

// Run single agent
async function runAgent(
    logger: Logger,
    agentName: string,
    userPrompt: string,
    policies: string
): Promise<object> {
    logger.info(`Running ${agentName} agent...`);

    const agentDef = readAgent(agentName);
    const systemPrompt = agentDef + policies;

    const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];

    const provider = getProvider();
    logger.debug(`Using provider: ${provider.name}`);

    const response = await provider.chat(messages, {
        temperature: 0.7,
        maxTokens: 2048,
    });

    logger.debug(`Response length: ${response.content.length} chars`);
    if (response.usage) {
        logger.debug(`Tokens used: ${response.usage.totalTokens}`);
    }

    try {
        const parsed = parseJsonResponse<object>(response.content);
        return parsed;
    } catch (error) {
        logger.error(`JSON parse failed for ${agentName}: ${error}`);
        throw error;
    }
}

// Main execution
async function main() {
    const logger = new Logger();

    try {
        logger.info('=== Agent Batch Execution Started ===');

        // 1. Read input
        const inputFile = getLatestFile(INPUTS_DIR);
        if (!inputFile) {
            throw new Error('No input files found in inputs/ directory. Create a .md file there first.');
        }
        logger.info(`Input file: ${inputFile}`);
        const inputContent = fs.readFileSync(inputFile, 'utf-8');
        logger.debug(`Input content length: ${inputContent.length} chars`);

        // 2. Read policies
        const policies = readPolicies();
        if (policies) {
            logger.info('Policies loaded');
        }

        // 3. Run Planner
        const plannerResult = await runAgent(logger, 'planner', inputContent, policies);
        const plannerPath = saveOutput('planner', plannerResult);
        logger.info(`Planner output saved: ${plannerPath}`);

        // 4. Run Writer
        const writerPrompt = `以下はプランナーの出力です。推奨された投稿案を洗練してください:\n\n${JSON.stringify(plannerResult, null, 2)}`;
        const writerResult = await runAgent(logger, 'writer', writerPrompt, policies);
        const writerPath = saveOutput('writer', writerResult);
        logger.info(`Writer output saved: ${writerPath}`);

        // 5. Run Checker
        const checkerPrompt = `以下はライターの出力です。最終チェックを行ってください:\n\n${JSON.stringify(writerResult, null, 2)}`;
        const checkerResult = await runAgent(logger, 'checker', checkerPrompt, policies) as { final_text?: string; ready_to_post?: boolean };
        const checkerPath = saveOutput('checked', checkerResult);
        logger.info(`Checker output saved: ${checkerPath}`);

        // 6. Extract and save final text
        if (checkerResult.final_text) {
            const finalPath = saveFinalText(checkerResult.final_text);
            logger.info(`Final text saved: ${finalPath}`);

            // 7. Save draft to Supabase
            await saveDraftToSupabase(logger, checkerResult.final_text, checkerResult);

            console.log('\n' + '='.repeat(50));
            console.log('📝 FINAL OUTPUT:');
            console.log('='.repeat(50));
            console.log(checkerResult.final_text);
            console.log('='.repeat(50));
            console.log(`Ready to post: ${checkerResult.ready_to_post ? '✅ Yes' : '❌ No'}`);
        }

        logger.info('=== Agent Batch Execution Completed ===');

    } catch (error) {
        logger.error(`Execution failed: ${error}`);
        throw error;
    } finally {
        logger.save();
    }
}

// Run
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
