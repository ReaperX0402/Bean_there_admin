import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

let cachedClient = null;
let storageSupported = null;

const SESSION_STORAGE_KEY = 'bt-admin-session';

const storageAvailable = () => {
  if (storageSupported !== null) return storageSupported;
  try {
    const testKey = '__bt-admin-session-test__';
    window.sessionStorage.setItem(testKey, '1');
    window.sessionStorage.removeItem(testKey);
    storageSupported = true;
  } catch (error) {
    storageSupported = false;
  }
  return storageSupported;
};

const serializeSession = (session) => {
  if (!session?.user) return null;
  const { user } = session;
  const { id, email, phone, user_metadata: userMetadata, app_metadata: appMetadata, aud, role } = user;
  return {
    user: {
      id,
      email: email || null,
      phone: phone || null,
      aud: aud || null,
      role: role || null,
      user_metadata: userMetadata || {},
      app_metadata: appMetadata || {}
    }
  };
};

export const cacheSession = (session) => {
  if (!storageAvailable()) return;
  if (!session?.user) {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  const safeSession = serializeSession(session);
  if (!safeSession) return;

  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(safeSession));
  } catch (error) {
    console.warn('Unable to persist session details', error);
  }
};

export const getCachedSession = () => {
  if (!storageAvailable()) return null;
  const cached = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!cached) return null;
  try {
    return JSON.parse(cached);
  } catch (error) {
    console.warn('Unable to parse cached session, clearing it', error);
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
};

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
    const session = data?.session ?? null;
    if (session?.user) {
      cacheSession(session);
    }
    return session;
  } catch (error) {
    console.warn('Unable to fetch Supabase session', error);
    return null;
  }
};

export const requireSession = async () => {
  const session = await getCurrentSession();
  if (!session?.user) {
    cacheSession(null);
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
    cacheSession(null);
  } catch (error) {
    console.warn('Error during Supabase sign-out', error);
  }
};
