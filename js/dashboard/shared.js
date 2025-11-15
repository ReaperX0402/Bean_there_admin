import { getSupabaseClient, requireSession, signOut } from '../common/supabaseClient.js';
import { showNotice } from '../common/ui.js';

const setActiveNav = (active) => {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach((link) => {
    const target = link.dataset.section;
    link.classList.toggle('active', target === active);
  });
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

  const session = await requireSession();
  if (!session) {
    return { supabase, session: null };
  }

  setActiveNav(activeSection);
  bindLogout();
  return { supabase, session };
};
