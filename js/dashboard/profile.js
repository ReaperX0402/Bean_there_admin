import { setListContent, formatDateTime, showNotice } from '../common/ui.js';
import { initializeDashboardPage } from './shared.js';

const htmlRoot = document.documentElement;
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileRole = document.getElementById('profile-role');
const profileStores = document.getElementById('profile-stores');
const profileActivity = document.getElementById('profile-activity');

const TABLES = {
  staff: htmlRoot.dataset.tableStaff || 'staff',
  staffStores: htmlRoot.dataset.tableStaffStores || 'staff_store_assignments',
  stores: htmlRoot.dataset.tableStores || 'stores',
  staffActivity: htmlRoot.dataset.tableStaffActivity || 'staff_activity_logs'
};

let supabaseClient = null;
let profileColumnMap = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  role: 'role'
};
let staffIdColumn = 'id';

const detectColumn = (keys, candidates, fallback) => {
  for (const candidate of candidates) {
    if (keys.has(candidate)) return candidate;
  }
  return fallback;
};

const configureProfileMapping = (record) => {
  if (!record || typeof record !== 'object') return;
  const keys = new Set(Object.keys(record));
  profileColumnMap = {
    firstName: detectColumn(keys, ['first_name', 'firstname', 'given_name', 'firstName'], profileColumnMap.firstName),
    lastName: detectColumn(keys, ['last_name', 'lastname', 'family_name', 'lastName'], profileColumnMap.lastName),
    email: detectColumn(keys, ['email', 'work_email'], profileColumnMap.email),
    role: detectColumn(keys, ['role', 'title', 'position', 'staff_role'], profileColumnMap.role)
  };
  staffIdColumn = detectColumn(keys, ['id', 'staff_id', 'uuid'], staffIdColumn);
};

const populateProfile = (profile) => {
  if (!profile) return;
  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
  profileName.textContent = fullName || 'Admin user';
  profileEmail.textContent = profile.email || '—';
  if (profileRole) {
    profileRole.textContent = profile.role || 'Admin';
  }
  setListContent(profileStores, profile.stores, 'No stores assigned yet.');
  setListContent(profileActivity, profile.recent_activity, 'No recent activity recorded.');
};

const buildFallbackProfile = (user) => {
  const metadata = user?.user_metadata || {};
  const fullName = metadata.full_name || '';
  const [firstNameFromFull, ...rest] = fullName.split(' ');
  return {
    first_name: metadata.first_name || firstNameFromFull || '',
    last_name: metadata.last_name || rest.join(' ') || '',
    email: user?.email || metadata.email || '—',
    role: metadata.role || 'Admin',
    stores: [],
    recent_activity: []
  };
};

const mapStaffRecordToProfile = (record, user) => {
  configureProfileMapping(record);
  const firstName = record?.[profileColumnMap.firstName] ?? user?.user_metadata?.first_name ?? '';
  const lastName = record?.[profileColumnMap.lastName] ?? user?.user_metadata?.last_name ?? '';
  const email = record?.[profileColumnMap.email] ?? user?.email ?? '—';
  const role = record?.[profileColumnMap.role] ?? user?.user_metadata?.role ?? 'Admin';

  return {
    first_name: firstName || '',
    last_name: lastName || '',
    email,
    role,
    stores: [],
    recent_activity: []
  };
};

const fetchStoresForStaff = async (staffRecord) => {
  if (!supabaseClient) return [];
  const staffId = staffRecord?.[staffIdColumn] ?? staffRecord?.id;
  if (!staffId) return [];

  try {
    const { data, error } = await supabaseClient
      .from(TABLES.staffStores)
      .select('*, stores(name), store(name)')
      .eq('staff_id', staffId);

    if (error) throw error;

    const stores = (data || [])
      .map((entry) => entry?.stores?.name || entry?.store?.name || entry?.store_name || entry?.name)
      .filter(Boolean);

    if (stores.length) return stores;

    const directStore = staffRecord?.store || staffRecord?.primary_store || staffRecord?.location;
    return directStore ? [directStore] : [];
  } catch (error) {
    console.warn('Unable to load store assignments', error);
    const directStore = staffRecord?.store || staffRecord?.primary_store || staffRecord?.location;
    return directStore ? [directStore] : [];
  }
};

const fetchActivityForStaff = async (staffRecord) => {
  if (!supabaseClient) return [];
  const staffId = staffRecord?.[staffIdColumn] ?? staffRecord?.id;
  if (!staffId) return [];

  try {
    const { data, error } = await supabaseClient
      .from(TABLES.staffActivity)
      .select('*')
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    return (data || []).map((entry) => {
      const description = entry?.description || entry?.message || entry?.action || 'Updated record';
      const timestamp = entry?.created_at || entry?.timestamp || entry?.logged_at;
      return timestamp ? `${description} · ${formatDateTime(timestamp)}` : description;
    });
  } catch (error) {
    console.warn('Unable to load staff activity', error);
    return [];
  }
};

const refreshProfile = async (user) => {
  const fallback = buildFallbackProfile(user);

  try {
    profileName.textContent = 'Loading…';
    profileEmail.textContent = user?.email || '—';
    if (profileRole) profileRole.textContent = 'Loading…';
    setListContent(profileStores, [], 'Loading…');
    setListContent(profileActivity, [], 'Loading…');

    const { data, error } = await supabaseClient
      .from(TABLES.staff)
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      populateProfile(fallback);
      return;
    }

    const profile = mapStaffRecordToProfile(data, user);
    const [stores, activity] = await Promise.all([
      fetchStoresForStaff(data),
      fetchActivityForStaff(data)
    ]);
    profile.stores = stores;
    profile.recent_activity = activity;
    populateProfile(profile);
  } catch (error) {
    console.error('Failed to load admin profile', error);
    populateProfile(fallback);
    showNotice('Showing profile details from Supabase auth metadata.', 'warning');
  }
};

const initialize = async () => {
  setListContent(profileStores, [], 'Connect to Supabase to load store assignments.');
  setListContent(profileActivity, [], 'Connect to Supabase to load recent activity.');

  const { supabase, session } = await initializeDashboardPage('profile');
  if (!supabase || !session) return;
  supabaseClient = supabase;

  await refreshProfile(session.user);
  showNotice('Profile details loaded from Supabase.', 'success');
};

initialize();
