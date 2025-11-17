import {
  getSupabaseClient,
  getSupabaseConfig,
  getCurrentAdminSession,
  cacheAdminSession,
  getAdminTableName
} from '../common/supabaseClient.js';
import { showNotice, setFormLoading, hideNotice } from '../common/ui.js';

const signupForm = document.getElementById('signup-form');
const cafeSelect = document.getElementById('signup-cafe');
const htmlRoot = document.documentElement;

const supabaseConfig = getSupabaseConfig();
const supabase = getSupabaseClient();
const ADMIN_TABLE = getAdminTableName();
const CAFES_TABLE = htmlRoot?.dataset?.tableCafes || 'cafe';

const disableForm = () => {
  if (!signupForm) return;
  Array.from(signupForm.elements).forEach((element) => {
    if ('disabled' in element) {
      element.disabled = true;
    }
  });
};

const setCafeSelectState = (label, { disabled = true } = {}) => {
  if (!cafeSelect) return;
  cafeSelect.innerHTML = '';
  const option = document.createElement('option');
  option.value = '';
  option.textContent = label;
  option.disabled = true;
  option.selected = true;
  cafeSelect.append(option);
  cafeSelect.disabled = disabled;
};

const populateCafeSelect = (cafes) => {
  if (!cafeSelect) return;
  cafeSelect.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a café';
  placeholder.disabled = true;
  placeholder.selected = true;
  cafeSelect.append(placeholder);

  cafes.forEach((cafe) => {
    if (!cafe?.id) return;
    const option = document.createElement('option');
    option.value = cafe.id;
    option.textContent = cafe.name ? `${cafe.name} (${cafe.id})` : cafe.id;
    cafeSelect.append(option);
  });

  cafeSelect.disabled = cafes.length === 0;
  if (!cafes.length) {
    cafeSelect.firstElementChild.textContent = 'No cafés available';
  }
};

const loadCafeOptions = async () => {
  if (!supabase || !CAFES_TABLE || !cafeSelect) return;
  setCafeSelectState('Loading cafés…');

  try {
    const { data, error } = await supabase
      .from(CAFES_TABLE)
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;
    populateCafeSelect(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('Unable to load café list for signup form', error);
    setCafeSelectState('Unable to load cafés', { disabled: true });
    showNotice('Unable to load cafés from Supabase. Try refreshing the page.', 'warning');
  }
};

const initialize = async () => {
  if (!supabase || !supabaseConfig) {
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

  await loadCafeOptions();
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
