import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

let cachedClient = null;

const STORAGE_KEY = 'bt-admin-session';
const PLACEHOLDER_URL = 'YOUR_SUPABASE_URL';
const PLACEHOLDER_KEY = 'YOUR_SUPABASE_ANON_KEY';

// ---------- storage (session first, fallback to local) ----------
const getStore = () => {
  if (typeof window === 'undefined') return null;
  try { window.sessionStorage.setItem('__t','1'); window.sessionStorage.removeItem('__t'); return window.sessionStorage; } catch {}
  try { window.localStorage.setItem('__t','1'); window.localStorage.removeItem('__t'); return window.localStorage; } catch {}
  return null;
};

// ---------- session serialize ----------
const serializeAdmin = (admin) => {
  const adminId = admin?.admin_id ?? admin?.id;
  if (!adminId) return null;
  const { cafe_id = null, name = null, email = null, created_at = null } = admin;
  return {
    admin: {
      id: adminId,          // keep both keys populated
      admin_id: adminId,
      cafe_id,
      name,
      email,
      created_at
    }
  };
};

export const cacheAdminSession = (adminOrSession) => {
  const store = getStore();
  if (!store) return;

  const session = adminOrSession?.admin ? adminOrSession.admin : adminOrSession;
  const serialized = serializeAdmin(session);

  if (!serialized) {
    store.removeItem(STORAGE_KEY);
    return;
  }
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.warn('Unable to persist admin session details', error);
  }
};

export const clearAdminSession = () => {
  const store = getStore();
  if (!store) return;
  store.removeItem(STORAGE_KEY);
};

export const getCachedAdminSession = () => {
  const store = getStore();
  if (!store) return null;
  const cached = store.getItem(STORAGE_KEY);
  if (!cached) return null;
  try {
    return JSON.parse(cached);
  } catch (error) {
    console.warn('Unable to parse cached admin session, clearing it', error);
    store.removeItem(STORAGE_KEY);
    return null;
  }
};

// For this MVP you’re using table-based “auth”; cache is the source of truth
export const getCurrentAdminSession = async () => getCachedAdminSession();

export const requireAdminSession = async () => {
  const session = await getCurrentAdminSession();
  const hasId = Boolean(session?.admin?.id || session?.admin?.admin_id);
  if (!hasId) {
    clearAdminSession();
    if (typeof window !== 'undefined') {
      // default to a login in the same folder as current page
      const loginUrl = new URL('login.html', window.location.href).toString();
      window.location.replace(loginUrl);
    }
    return null;
  }
  return session;
};

export const getAdminTableName = () => {
  if (typeof document === 'undefined') return 'admin';
  const table = document.documentElement.dataset.tableAdmin?.trim();
  return table && table.length ? table : 'admin';
};

// ---------- config ----------
const sanitizeCredential = (value, placeholder) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || (placeholder && trimmed === placeholder)) return '';
  return trimmed;
};

const getConfigFromWindow = () => {
  if (typeof window === 'undefined') return null;
  const config = window.SUPABASE_CONFIG;
  if (!config || typeof config !== 'object') return null;

  const url = sanitizeCredential(config.url, PLACEHOLDER_URL);
  const anonKey = sanitizeCredential(config.anonKey, PLACEHOLDER_KEY);

  if (!url || !anonKey) return null;
  return { url, anonKey };
};

const getConfigFromDataset = () => {
  if (typeof document === 'undefined') return null;
  const root = document.documentElement;
  if (!root) return null;

  const url = sanitizeCredential(root.dataset.supabaseUrl, PLACEHOLDER_URL);
  const anonKey = sanitizeCredential(root.dataset.supabaseAnonKey, PLACEHOLDER_KEY);

  if (!url || !anonKey) return null;
  return { url, anonKey };
};

export const getSupabaseConfig = () => {
  const fromWindow = getConfigFromWindow();
  if (fromWindow) return fromWindow;

  const fromDataset = getConfigFromDataset();
  if (fromDataset) return fromDataset;

  console.warn(
    'Supabase URL or anon key is missing. Provide credentials in `supabase_config.js` to expose them via `window.SUPABASE_CONFIG` or add <html> data attributes.'
  );
  return null;
};

// ---------- client ----------
export const getSupabaseClient = () => {
  if (cachedClient) return cachedClient;
  const config = getSupabaseConfig();
  if (!config) throw new Error('Supabase client not configured'); // be loud

  cachedClient = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return cachedClient;
};

export const requireSupabaseClient = () => {
  const client = getSupabaseClient(); // throws if missing
  return client;
};

export const signOut = async () => {
  try {
    const client = cachedClient ?? null;
    await client?.auth?.signOut?.();
  } catch (e) {
    console.warn('Supabase signOut failed/ignored', e);
  } finally {
    clearAdminSession();
  }
};
