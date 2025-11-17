import {
  getSupabaseClient,
  getSupabaseConfig,
  getCurrentAdminSession,
  cacheAdminSession,
  getAdminTableName
} from '../common/supabaseClient.js';
import { showNotice, setFormLoading, hideNotice } from '../common/ui.js';

const loginForm = document.getElementById('login-form');

let supabaseConfig = null;
let supabase = null;
const ADMIN_TABLE = getAdminTableName();

const prefillFromQuery = () => {
  if (!loginForm) return;
  try {
    const currentUrl = new URL(window.location.href);
    const email = currentUrl.searchParams.get('email');
    const password = currentUrl.searchParams.get('password');

    const emailField = loginForm.elements.namedItem('email');
    if (email && emailField && 'value' in emailField) {
      emailField.value = decodeURIComponent(email);
    }

    const passwordField = loginForm.elements.namedItem('password');
    if (password && passwordField && 'value' in passwordField) {
      passwordField.value = password;
    }

    if (email || password) {
      currentUrl.searchParams.delete('email');
      currentUrl.searchParams.delete('password');
      window.history.replaceState({}, document.title, `${currentUrl.pathname}${currentUrl.hash}`);
    }
  } catch (error) {
    console.warn('Unable to sanitize login query params', error);
  }
};

const disableForm = () => {
  if (!loginForm) return;
  Array.from(loginForm.elements).forEach((element) => {
    if ('disabled' in element) {
      element.disabled = true;
    }
  });
};

const initialize = async () => {
  prefillFromQuery();

  try {
    supabaseConfig = getSupabaseConfig();
    supabase = getSupabaseClient(); // ✱ CHANGE: throws if not configured
  } catch (e) {
    showNotice(
      'Supabase credentials are missing. Update `supabase_config.js` or <html> data attributes before using the admin console.',
      'error',
      true
    );
    disableForm();
    return;
  }

  const session = await getCurrentAdminSession();
  if (session?.admin) {
    window.location.replace('index.html');
  }
};

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabase) return;

    const formData = new FormData(loginForm);
    const email = formData.get('email')?.toString().trim();
    const password = formData.get('password')?.toString();

    if (!email || !password) {
      showNotice('Please provide both email and password.', 'warning');
      return;
    }

    try {
      hideNotice();
      setFormLoading(loginForm, true);
      const { data, error } = await supabase
        .from(ADMIN_TABLE)
        .select('admin_id:id, cafe_id, name, email, pwd, created_at')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('Database error while verifying admin credentials', error);
        showNotice(
          'Unable to check your credentials because of a database issue. Please try again later.',
          'error'
        );
        return;
      }

      const storedPassword = data?.pwd != null ? String(data.pwd) : '';
      if (!data || storedPassword !== password) {
        showNotice('Incorrect email or password. Please try again.', 'error');
        return;
      }

      const { pwd, ...admin } = data;
      const normalizedAdmin = {
        ...admin,
        admin_id: admin.id,
        id: admin.id
      };
      cacheAdminSession(normalizedAdmin);
      showNotice('Logged in successfully.', 'success');
      window.location.replace('index.html');
    } catch (error) {
      console.error('Unable to sign in with Supabase admin table', error);
      showNotice(error?.message || 'Unable to sign in with Supabase.', 'error');
    } finally {
      setFormLoading(loginForm, false);
    }
  });
}

initialize();
