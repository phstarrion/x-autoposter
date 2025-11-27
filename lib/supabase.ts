import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Only create client if credentials exist and NOT in mock mode (unless we want to test DB in mock mode?)
// For this requirement, let's assume Mock Mode skips DB entirely for simplicity, 
// OR we can use DB even in Mock Mode if the user wants to test the scheduling logic.
// Given the requirement "Mock Mode also works", let's make it safe.

export const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;
