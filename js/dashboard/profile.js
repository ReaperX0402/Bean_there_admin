import { formatDateTime, showNotice } from '../common/ui.js';
import { initializeDashboardPage } from './shared.js';

const htmlRoot = document.documentElement;
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileCafe = document.getElementById('profile-cafe');
const profileCreated = document.getElementById('profile-created');
const profileNotes = document.getElementById('profile-notes');

const ADMIN_TABLE = htmlRoot.dataset.tableAdmin || 'admin';

let supabaseClient = null;

const setLoadingState = () => {
  if (profileName) profileName.textContent = 'Loading…';
  if (profileEmail) profileEmail.textContent = 'Loading…';
  if (profileCafe) profileCafe.textContent = 'Loading…';
  if (profileCreated) profileCreated.textContent = 'Loading…';
};

const populateProfile = (admin) => {
  if (!admin) return;
  if (profileName) profileName.textContent = admin.name || 'Admin';
  if (profileEmail) profileEmail.textContent = admin.email || '—';
  if (profileCafe) profileCafe.textContent = admin.cafe_id || '—';
  if (profileCreated) profileCreated.textContent = formatDateTime(admin.created_at);
  if (profileNotes) {
    const cafeLabel = admin.cafe_id ? `café ${admin.cafe_id}` : 'your café';
    profileNotes.textContent = `Details reflect the current admin record for ${cafeLabel}.`;
  }
};

const fetchLatestAdminRecord = async (admin) => {
  if (!supabaseClient || !admin?.admin_id) return admin;

  const { data, error } = await supabaseClient
    .from(ADMIN_TABLE)
    .select('admin_id, cafe_id, name, email, created_at')
    .eq('admin_id', admin.admin_id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data || admin;
};

const initialize = async () => {
  setLoadingState();

  const { supabase, session } = await initializeDashboardPage('profile');
  if (!session?.admin) return;

  supabaseClient = supabase;

  const fallback = session.admin;

  try {
    const adminRecord = supabase ? await fetchLatestAdminRecord(fallback) : fallback;
    populateProfile(adminRecord);
    if (supabase) {
      showNotice('Profile details loaded from the admin table.', 'success');
    }
  } catch (error) {
    console.error('Failed to load admin profile', error);
    populateProfile(fallback);
    showNotice('Showing cached admin details. Unable to refresh from Supabase.', 'warning');
  }
};

initialize();
