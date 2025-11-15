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

const serializeAdmin = (admin) => {
  const adminId = admin?.id ?? admin?.admin_id;
  if (!adminId) return null;
  const { cafe_id = null, name = null, email = null, created_at = null } = admin;
  return {
    admin: {
      id: adminId,
      admin_id: adminId,
      cafe_id,
      name,
      email,
      created_at
    }
  };
};

export const cacheAdminSession = (adminOrSession) => {
  if (!storageAvailable()) return;

  const session = adminOrSession?.admin ? adminOrSession.admin : adminOrSession;
  const serialized = serializeAdmin(session);

  if (!serialized) {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.warn('Unable to persist admin session details', error);
  }
};

export const clearAdminSession = () => {
  if (!storageAvailable()) return;
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
};

export const getCachedAdminSession = () => {
  if (!storageAvailable()) return null;
  const cached = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!cached) return null;
  try {
    return JSON.parse(cached);
  } catch (error) {
    console.warn('Unable to parse cached admin session, clearing it', error);
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
};

export const getCurrentAdminSession = async () => getCachedAdminSession();

export const requireAdminSession = async () => {
  const session = await getCurrentAdminSession();
  const hasId = Boolean(session?.admin?.id || session?.admin?.admin_id);
  if (!hasId) {
    clearAdminSession();
    window.location.replace('login.html');
    return null;
  }
  return session;
};

export const getAdminTableName = () => {
  const table = document.documentElement.dataset.tableAdmin?.trim();
  return table && table.length ? table : 'admin';
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

export const signOut = async () => {
  clearAdminSession();
};
