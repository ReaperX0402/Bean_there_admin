import { getSupabaseClient, getCurrentSession, cacheSession } from '../common/supabaseClient.js';
import { showNotice, setFormLoading, hideNotice } from '../common/ui.js';

const signupForm = document.getElementById('signup-form');

const supabase = getSupabaseClient();

const disableForm = () => {
  if (!signupForm) return;
  Array.from(signupForm.elements).forEach((element) => {
    if ('disabled' in element) {
      element.disabled = true;
    }
  });
};

const initialize = async () => {
  if (!supabase) {
    showNotice(
      'Supabase credentials are missing. Update `supabase_config.js` before creating admin accounts.',
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

if (signupForm) {
  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabase) return;

    const formData = new FormData(signupForm);
    const firstName = formData.get('firstName')?.toString().trim();
    const lastName = formData.get('lastName')?.toString().trim();
    const email = formData.get('email')?.toString().trim();
    const password = formData.get('password')?.toString();
    const confirmPassword = formData.get('confirmPassword')?.toString();

    if (!firstName || !lastName || !email || !password) {
      showNotice('Please complete all required fields.', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      showNotice('Passwords do not match.', 'warning');
      return;
    }

    try {
      hideNotice();
      setFormLoading(signupForm, true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName
          }
        }
      });

      if (error) throw error;

      if (data.session?.user) {
        cacheSession(data.session);
        showNotice('Account created and signed in successfully.', 'success');
        window.location.replace('index.html');
      } else {
        showNotice('Check your email to confirm the new admin account, then log in.', 'info', true);
        window.location.replace('login.html');
      }
    } catch (error) {
      console.error('Unable to sign up with Supabase', error);
      showNotice(error?.message || 'Unable to sign up with Supabase.', 'error');
    } finally {
      setFormLoading(signupForm, false);
    }
  });
}

initialize();
