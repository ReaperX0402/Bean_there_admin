import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

let cachedClient = null;

const resolveSupabaseConfig = () => {
  const root = document.documentElement;
  const attrUrl = root.dataset.supabaseUrl?.trim();
  const attrKey = root.dataset.supabaseAnonKey?.trim();
  const url = attrUrl && attrUrl !== 'YOUR_SUPABASE_URL'
    ? attrUrl
    : window.SUPABASE_URL || window?.SUPABASE_CONFIG?.url;
  const anonKey = attrKey && attrKey !== 'YOUR_SUPABASE_ANON_KEY'
    ? attrKey
    : window.SUPABASE_ANON_KEY || window?.SUPABASE_CONFIG?.anonKey;

  if (!url || !anonKey) {
    console.warn(
      'Supabase URL or anon key is missing. Provide credentials in `supabase_config.js` or via <html> data attributes.'
    );
    return null;
  }

  return { url, anonKey };
};

export const getSupabaseClient = () => {
  if (cachedClient) return cachedClient;
  const config = resolveSupabaseConfig();
  if (!config) return null;
  cachedClient = createClient(config.url, config.anonKey, { auth: { persistSession: true } });
  return cachedClient;
};

export const requireSupabaseClient = () => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  return client;
};

export const getCurrentSession = async () => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data?.session ?? null;
  } catch (error) {
    console.warn('Unable to fetch Supabase session', error);
    return null;
  }
};

export const requireSession = async () => {
  const session = await getCurrentSession();
  if (!session?.user) {
    window.location.replace('login.html');
    return null;
  }
  return session;
};

export const signOut = async () => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.auth.signOut();
  } catch (error) {
    console.warn('Error during Supabase sign-out', error);
  }
};
