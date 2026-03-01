import { createClient } from '@supabase/supabase-js';

// Access environment variables securely
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("⚠️ Supabase credentials missing! Check your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Fetches ALL rows from a Supabase query, bypassing the 1000-row default limit.
 * Pass a factory function that returns a fresh query builder each time.
 *
 * Usage:
 *   const { data, error } = await fetchAllRows(() =>
 *     supabase.from("conferme_sap").select("*").eq("data", today)
 *   );
 */
export async function fetchAllRows(queryFactory) {
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;

    while (true) {
        const { data, error } = await queryFactory().range(from, from + PAGE_SIZE - 1);
        if (error) return { data: null, error };
        allData = [...allData, ...(data || [])];
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return { data: allData, error: null };
}
