import { getSupabaseClient, getCurrentSession } from '../common/supabaseClient.js';
import { showNotice, setFormLoading, hideNotice } from '../common/ui.js';

const loginForm = document.getElementById('login-form');

const supabase = getSupabaseClient();

const disableForm = () => {
  if (!loginForm) return;
  Array.from(loginForm.elements).forEach((element) => {
    if ('disabled' in element) {
      element.disabled = true;
    }
  });
};

const initialize = async () => {
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
