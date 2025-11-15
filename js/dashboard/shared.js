import {
  getSupabaseClient,
  getSupabaseConfig,
  requireAdminSession,
  signOut,
  getCachedAdminSession
} from '../common/supabaseClient.js';
import { showNotice } from '../common/ui.js';

const setActiveNav = (active) => {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach((link) => {
    const target = link.dataset.section;
    link.classList.toggle('active', target === active);
  });
};

const renderSessionAdmin = (session) => {
  const container = document.getElementById('session-admin');
  if (!container) return;

  if (!session?.admin) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  const { admin } = session;
  const identifier = admin.id ?? admin.admin_id;
  const displayName = admin.name || admin.email || (identifier ? `Admin #${identifier}` : 'Admin');

  container.classList.remove('hidden');
  container.innerHTML = '';
  const label = document.createElement('span');
  label.className = 'session-label';
  label.textContent = 'Signed in as';

  const value = document.createElement('span');
  value.className = 'session-value';
  value.textContent = displayName;

  container.append(label, value);
};

const bindLogout = () => {
  const logoutBtn = document.getElementById('logout-btn');
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', async () => {
    await signOut();
    showNotice('Signed out successfully.', 'info');
    window.location.replace('login.html');
  });
};

export const initializeDashboardPage = async (activeSection) => {
  const supabaseConfig = getSupabaseConfig();
  const supabase = getSupabaseClient();
  if (!supabase || !supabaseConfig) {
    showNotice(
      'Supabase credentials are missing. Update `supabase_config.js` before using the admin console.',
      'error',
      true
    );
  }

  renderSessionAdmin(getCachedAdminSession());
  const session = await requireAdminSession();
  if (!session) {
    return { supabase, session: null };
  }

  renderSessionAdmin(session);
  setActiveNav(activeSection);
  bindLogout();
  return { supabase, session };
};
