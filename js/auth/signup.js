import {
  getSupabaseClient,
  getCurrentAdminSession,
  cacheAdminSession,
  getAdminTableName
} from '../common/supabaseClient.js';
import { showNotice, setFormLoading, hideNotice } from '../common/ui.js';

const signupForm = document.getElementById('signup-form');

const supabase = getSupabaseClient();
const ADMIN_TABLE = getAdminTableName();

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

  const session = await getCurrentAdminSession();
  if (session?.admin) {
    window.location.replace('index.html');
  }
};

if (signupForm) {
  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabase) return;

    const formData = new FormData(signupForm);
    const name = formData.get('name')?.toString().trim();
    const cafeId = formData.get('cafeId')?.toString().trim();
    const email = formData.get('email')?.toString().trim();
    const password = formData.get('password')?.toString();
    const confirmPassword = formData.get('confirmPassword')?.toString();

    if (!name || !cafeId || !email || !password) {
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
      const { data, error } = await supabase
        .from(ADMIN_TABLE)
        .insert([
          {
            name,
            cafe_id: cafeId,
            email,
            pwd: password
          }
        ])
        .select('id, cafe_id, name, email, created_at')
        .single();

      if (error) {
        console.error('Database error while creating admin record', error);
        showNotice(
          'Unable to create your admin account because of a database issue. Please try again later.',
          'error'
        );
        return;
      }

      const normalizedAdmin = {
        ...data,
        admin_id: data?.id ?? data?.admin_id
      };
      cacheAdminSession(normalizedAdmin);
      showNotice('Account created and signed in successfully.', 'success');
      window.location.replace('index.html');
    } catch (error) {
      console.error('Unable to sign up with Supabase admin table', error);
      showNotice(error?.message || 'Unable to sign up with Supabase.', 'error');
    } finally {
      setFormLoading(signupForm, false);
    }
  });
}

initialize();
