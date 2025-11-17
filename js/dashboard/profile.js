import { formatDateTime, showNotice } from '../common/ui.js';
import { initializeDashboardPage } from './shared.js';

const htmlRoot = document.documentElement;
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileCafe = document.getElementById('profile-cafe');
const profileCreated = document.getElementById('profile-created');
const profileNotes = document.getElementById('profile-notes');

const ADMIN_TABLE = htmlRoot.dataset.tableAdmin || 'admin';
const CAFES_TABLE = htmlRoot.dataset.tableCafes || 'cafe';

let supabaseClient = null;

const setLoadingState = () => {
  if (profileName) profileName.textContent = 'Loading…';
  if (profileEmail) profileEmail.textContent = 'Loading…';
  if (profileCafe) profileCafe.textContent = 'Loading…';
  if (profileCreated) profileCreated.textContent = 'Loading…';
};

const renderCafeDetails = (cafeId, cafeDetails) => {
  if (!profileCafe) return;
  profileCafe.innerHTML = '';

  if (!cafeId) {
    profileCafe.textContent = '—';
    return;
  }

  const cafeWrapper = document.createElement('div');
  cafeWrapper.className = 'profile-cafe-details';

  if (cafeDetails?.name) {
    const cafeName = document.createElement('span');
    cafeName.className = 'profile-cafe-name';
    cafeName.textContent = cafeDetails.name;
    cafeWrapper.appendChild(cafeName);
  }

  const cafeIdPill = document.createElement('span');
  cafeIdPill.className = 'profile-cafe-id';
  cafeIdPill.textContent = cafeId;
  cafeWrapper.appendChild(cafeIdPill);

  profileCafe.appendChild(cafeWrapper);
};

const populateProfile = (admin, cafeDetails = null) => {
  if (!admin) return;
  if (profileName) profileName.textContent = admin.name || 'Admin';
  if (profileEmail) profileEmail.textContent = admin.email || '—';
  renderCafeDetails(admin.cafe_id, cafeDetails);
  if (profileCreated) profileCreated.textContent = formatDateTime(admin.created_at);
  if (profileNotes) {
    const fallbackLabel = admin.cafe_id ? `café ${admin.cafe_id}` : 'your café';
    const cafeLabel = cafeDetails?.name && admin.cafe_id ? `${cafeDetails.name} (${admin.cafe_id})` : fallbackLabel;
    profileNotes.textContent = `Details reflect the current admin record for ${cafeLabel}.`;
  }
};

const fetchLatestAdminRecord = async (admin) => {
  const adminId = admin?.id ?? admin?.admin_id;
  if (!supabaseClient || !adminId) return admin;

  const { data, error } = await supabaseClient
    .from(ADMIN_TABLE)
    .select('id, cafe_id, name, email, created_at')
    .eq('id', adminId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data ? { ...data, admin_id: data.id } : admin;
};

const fetchCafeDetails = async (cafeId) => {
  if (!supabaseClient || !cafeId) return null;

  const { data, error } = await supabaseClient
    .from(CAFES_TABLE)
    .select('id, name')
    .eq('id', cafeId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
};

const initialize = async () => {
  setLoadingState();

  const { supabase, session } = await initializeDashboardPage('profile');
  if (!session?.admin) return;

  supabaseClient = supabase;

  const fallback = session.admin;

  try {
    const adminRecord = supabase ? await fetchLatestAdminRecord(fallback) : fallback;
    const cafeDetails = supabase && adminRecord?.cafe_id ? await fetchCafeDetails(adminRecord.cafe_id) : null;
    populateProfile(adminRecord, cafeDetails);
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
