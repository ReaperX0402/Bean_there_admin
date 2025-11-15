import { getSupabaseClient, getCurrentSession, cacheSession } from '../common/supabaseClient.js';
import { showNotice, setFormLoading, hideNotice } from '../common/ui.js';

const loginForm = document.getElementById('login-form');

const supabase = getSupabaseClient();

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

  if (!supabase) {
    showNotice(
      'Supabase credentials are missing. Update `supabase_config.js` before using the admin console.',
      'error',
      true
    );
    disableForm();
    return;
  }

  const session = await getCurrentSession();
  if (session?.user) {
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session?.user) {
        cacheSession(data.session);
        showNotice('Logged in successfully.', 'success');
        window.location.replace('index.html');
      } else {
        showNotice('Login succeeded, redirecting…', 'info');
        window.location.replace('index.html');
      }
    } catch (error) {
      console.error('Unable to sign in with Supabase', error);
      showNotice(error?.message || 'Unable to sign in with Supabase.', 'error');
    } finally {
      setFormLoading(loginForm, false);
    }
  });
}

initialize();
