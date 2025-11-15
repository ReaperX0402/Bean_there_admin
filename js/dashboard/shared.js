import { getSupabaseClient, requireSession, signOut, getCachedSession } from '../common/supabaseClient.js';
import { showNotice } from '../common/ui.js';

const setActiveNav = (active) => {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach((link) => {
    const target = link.dataset.section;
    link.classList.toggle('active', target === active);
  });
};

const renderSessionUser = (session) => {
  const container = document.getElementById('session-user');
  if (!container) return;

  if (!session?.user) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  const { user } = session;
  const displayName =
    user.user_metadata?.full_name || user.user_metadata?.name || user.email || user.phone || 'Signed in';

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
  const supabase = getSupabaseClient();
  if (!supabase) {
    showNotice(
      'Supabase credentials are missing. Update `supabase_config.js` before using the admin console.',
      'error',
      true
    );
    return { supabase: null, session: null };
  }

  renderSessionUser(getCachedSession());
  const session = await requireSession();
  if (!session) {
    return { supabase, session: null };
  }

  renderSessionUser(session);
  setActiveNav(activeSection);
  bindLogout();
  return { supabase, session };
};
