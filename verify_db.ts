import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("URL:", supabaseUrl);
console.log("Key exists:", !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log("Testing connection to 'scheduled_posts'...");
    const { data, error } = await supabase.from('scheduled_posts').select('count', { count: 'exact', head: true });

    if (error) {
        console.error("Connection failed:", error.message);
        console.error("Details:", error);
    } else {
        console.log("Connection successful!");
        console.log("Table 'scheduled_posts' exists.");
    }
}

testConnection();
