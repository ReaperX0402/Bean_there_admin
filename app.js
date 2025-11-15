import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const htmlRoot = document.documentElement;

const authPanel = document.getElementById('auth-panel');
const loginCard = document.getElementById('login-card');
const signupCard = document.getElementById('signup-card');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const logoutBtn = document.getElementById('logout-btn');
const navButtons = Array.from(document.querySelectorAll('.nav-item'));
const sections = {
  orders: document.getElementById('section-orders'),
  menu: document.getElementById('section-menu'),
  profile: document.getElementById('section-profile')
};
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.querySelector('.page-subtitle');
const menuDialog = document.getElementById('menu-dialog');
const menuForm = document.getElementById('menu-form');
const menuDialogTitle = document.getElementById('menu-dialog-title');
const ordersTableBody = document.getElementById('orders-table-body');
const menuTableBody = document.getElementById('menu-table-body');
const profileStores = document.getElementById('profile-stores');
const profileActivity = document.getElementById('profile-activity');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileRole = document.getElementById('profile-role');
const addMenuItemBtn = document.getElementById('add-menu-item');
const statusChips = Array.from(document.querySelectorAll('.chip'));
const noticeBanner = document.getElementById('app-notice');

const TABLES = {
  orders: htmlRoot.dataset.tableOrders || 'orders',
  orderItems: htmlRoot.dataset.tableOrderItems || 'order_items',
  menuItems: htmlRoot.dataset.tableMenuItems || 'menu_items',
  staff: htmlRoot.dataset.tableStaff || 'staff',
  staffStores: htmlRoot.dataset.tableStaffStores || 'staff_store_assignments',
  stores: htmlRoot.dataset.tableStores || 'stores',
  staffActivity: htmlRoot.dataset.tableStaffActivity || 'staff_activity_logs'
};

let currentStatusFilter = 'all';
let currentUser = null;
let orders = [];
let menuItems = [];
let adminProfile = null;
let editingItemIndex = null;

let menuItemColumnMap = {
  id: 'id',
  name: 'name',
  category: 'category',
  price: 'price',
  status: 'status',
  isAvailable: 'is_available'
};

let orderColumnMap = {
  id: 'id',
  code: 'order_code',
  status: 'status',
  total: 'total_amount',
  createdAt: 'created_at',
  customer: 'customer_name'
};

let orderItemColumnMap = {
  orderId: 'order_id',
  name: 'name',
  quantity: 'quantity'
};

let profileColumnMap = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  role: 'role'
};

let staffIdColumn = 'id';
let noticeTimer = null;

const resolveSupabaseConfig = () => {
  const attrUrl = htmlRoot.dataset.supabaseUrl?.trim();
  const attrKey = htmlRoot.dataset.supabaseAnonKey?.trim();
  const url = attrUrl && attrUrl !== 'YOUR_SUPABASE_URL' ? attrUrl : window.SUPABASE_URL || window?.SUPABASE_CONFIG?.url;
  const key = attrKey && attrKey !== 'YOUR_SUPABASE_ANON_KEY' ? attrKey : window.SUPABASE_ANON_KEY || window?.SUPABASE_CONFIG?.anonKey;
  if (!url || !key) {
    console.warn('Supabase URL or anon key is missing. Update the <html> data attributes or provide window.SUPABASE_URL / window.SUPABASE_ANON_KEY.');
    return null;
  }
  return { url, key };
};

const supabaseConfig = resolveSupabaseConfig();
const supabase = supabaseConfig
  ? createClient(supabaseConfig.url, supabaseConfig.key, { auth: { persistSession: true } })
  : null;

const sectionCopy = {
  orders: {
    title: 'Orders',
    subtitle: 'Monitor live orders pulled directly from the Supabase `orders` and `order_items` tables.'
  },
  menu: {
    title: 'Menu management',
    subtitle: 'Maintain the Supabase-backed `menu_items` catalog and keep pricing in sync.'
  },
  profile: {
    title: 'Profile',
    subtitle: 'Review your admin identity sourced from Supabase auth and `staff` metadata.'
  }
};

const detectColumn = (keys, candidates, fallback) => {
  for (const candidate of candidates) {
    if (keys.has(candidate)) return candidate;
  }
  return fallback;
};

const configureMenuItemMapping = (rows) => {
  const sample = rows?.find((row) => row && typeof row === 'object');
  if (!sample) return;
  const keys = new Set(Object.keys(sample));
  menuItemColumnMap = {
    id: detectColumn(keys, ['menu_item_id', 'id', 'uuid', 'menuId'], menuItemColumnMap.id),
    name: detectColumn(keys, ['name', 'item_name', 'menu_item_name'], menuItemColumnMap.name),
    category: detectColumn(keys, ['category', 'category_name', 'menu_category', 'type'], menuItemColumnMap.category),
    price: detectColumn(keys, ['price', 'unit_price', 'price_amount', 'price_cents'], menuItemColumnMap.price),
    status: detectColumn(keys, ['status', 'availability_status'], menuItemColumnMap.status),
    isAvailable: detectColumn(keys, ['is_available', 'available', 'in_stock'], menuItemColumnMap.isAvailable)
  };
};

const configureOrderMapping = (rows) => {
  const sample = rows?.find((row) => row && typeof row === 'object');
  if (!sample) return;
  const keys = new Set(Object.keys(sample));
  orderColumnMap = {
    id: detectColumn(keys, ['id', 'order_id', 'uuid'], orderColumnMap.id),
    code: detectColumn(keys, ['order_code', 'order_number', 'reference', 'code', 'id'], orderColumnMap.code),
    status: detectColumn(keys, ['status', 'order_status'], orderColumnMap.status),
    total: detectColumn(keys, ['total_amount', 'total', 'amount', 'grand_total'], orderColumnMap.total),
    createdAt: detectColumn(keys, ['created_at', 'createdAt', 'placed_at', 'inserted_at'], orderColumnMap.createdAt),
    customer: detectColumn(keys, ['customer_name', 'customer', 'customer_full_name', 'name'], orderColumnMap.customer)
  };
};

const configureOrderItemMapping = (rows) => {
  const sample = rows?.find((row) => row && typeof row === 'object');
  if (!sample) return;
  const keys = new Set(Object.keys(sample));
  orderItemColumnMap = {
    orderId: detectColumn(keys, ['order_id', 'orderId', 'order', 'orders_id'], orderItemColumnMap.orderId),
    name: detectColumn(keys, ['name', 'item_name', 'menu_item_name'], orderItemColumnMap.name),
    quantity: detectColumn(keys, ['quantity', 'qty', 'amount'], orderItemColumnMap.quantity)
  };
};

const configureProfileMapping = (record) => {
  if (!record || typeof record !== 'object') return;
  const keys = new Set(Object.keys(record));
  profileColumnMap = {
    firstName: detectColumn(keys, ['first_name', 'firstname', 'given_name', 'firstName'], profileColumnMap.firstName),
    lastName: detectColumn(keys, ['last_name', 'lastname', 'family_name', 'lastName'], profileColumnMap.lastName),
    email: detectColumn(keys, ['email', 'work_email'], profileColumnMap.email),
    role: detectColumn(keys, ['role', 'title', 'position', 'staff_role'], profileColumnMap.role)
  };
  staffIdColumn = detectColumn(keys, ['id', 'staff_id', 'uuid'], staffIdColumn);
};

const showNotice = (message, variant = 'info', sticky = false) => {
  if (!noticeBanner) return;
  noticeBanner.textContent = message;
  noticeBanner.classList.remove('hidden', 'is-success', 'is-warning', 'is-error');
  if (variant !== 'info') {
    noticeBanner.classList.add(`is-${variant}`);
  }
  if (noticeTimer) {
    window.clearTimeout(noticeTimer);
    noticeTimer = null;
  }
  if (!sticky) {
    noticeTimer = window.setTimeout(() => {
      hideNotice();
    }, 5000);
  }
};

const hideNotice = () => {
  if (!noticeBanner) return;
  noticeBanner.classList.add('hidden');
  noticeBanner.classList.remove('is-success', 'is-warning', 'is-error');
  if (noticeTimer) {
    window.clearTimeout(noticeTimer);
    noticeTimer = null;
  }
};

if (noticeBanner) {
  noticeBanner.addEventListener('click', hideNotice);
}

const ensureSupabase = () => {
  if (!supabase) {
    showNotice('Supabase credentials are missing. Update the <html> data attributes with your project URL and anon key.', 'error', true);
    throw new Error('Supabase client not initialized');
  }
  return supabase;
};

const renderPlaceholderRow = (colspan, message) => `<tr><td colspan="${colspan}" class="table-placeholder">${message}</td></tr>`;

const setListContent = (element, items, emptyMessage) => {
  if (!element) return;
  if (!items || items.length === 0) {
    element.innerHTML = `<li class="muted">${emptyMessage}</li>`;
    return;
  }
  element.innerHTML = items.map((item) => `<li>${item}</li>`).join('');
};

const setFormLoading = (form, isLoading) => {
  Array.from(form.elements).forEach((element) => {
    if ('disabled' in element) {
      element.disabled = isLoading;
    }
  });
  if (isLoading) {
    form.setAttribute('aria-busy', 'true');
  } else {
    form.removeAttribute('aria-busy');
  }
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '—';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const normalizeOrderStatus = (value) => {
  if (!value && value !== 0) return 'unknown';
  const normalized = String(value).trim().toLowerCase();
  if (['pending', 'in_progress', 'completed', 'cancelled', 'ready'].includes(normalized)) return normalized;
  if (normalized === 'in-progress') return 'in_progress';
  if (normalized === 'in transit') return 'in_progress';
  if (normalized === 'done') return 'completed';
  if (normalized === 'canceled') return 'cancelled';
  return normalized.replace(/[^a-z]+/g, '_') || 'unknown';
};

const normalizeMenuStatus = (value) => {
  if (typeof value === 'boolean') {
    return value ? 'available' : 'out_of_stock';
  }
  if (!value && value !== 0) return 'available';
  const normalized = String(value).trim().toLowerCase();
  if (['available', 'in_stock', 'in-stock'].includes(normalized)) return 'available';
  if (['out_of_stock', 'sold_out', 'unavailable', 'out-of-stock'].includes(normalized)) return 'out_of_stock';
  return normalized.replace(/[^a-z]+/g, '_') || 'available';
};

const formatCurrency = (amount) => {
  if (!Number.isFinite(amount)) return '—';
  return `$${amount.toFixed(2)}`;
};

const formatStatus = (status) =>
  status
    .replace('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const renderOrderItems = (items) => {
  if (!items || items.length === 0) {
    return '<span class="muted">No items</span>';
  }
  return `
    <div class="order-items">
      ${items
        .map((item) => `<span class="order-item-chip">${item.qty}× ${item.name}</span>`)
        .join('')}
    </div>
  `;
};

const populateOrders = () => {
  ordersTableBody.innerHTML = '';
  const filtered = currentStatusFilter === 'all'
    ? orders
    : orders.filter((order) => order.status === currentStatusFilter);

  if (!filtered.length) {
    const message = orders.length === 0
      ? 'No orders found in Supabase yet.'
      : 'No orders match this status.';
    ordersTableBody.innerHTML = renderPlaceholderRow(6, message);
    return;
  }

  const rows = filtered
    .map((order) => `
      <tr>
        <td>${order.order_id}</td>
        <td>${order.customer}</td>
        <td><span class="badge ${order.status}">${formatStatus(order.status)}</span></td>
        <td>${formatCurrency(order.total)}</td>
        <td>${order.placed_at}</td>
        <td>${renderOrderItems(order.items)}</td>
      </tr>
    `)
    .join('');

  ordersTableBody.innerHTML = rows;
};

const populateMenu = () => {
  menuTableBody.innerHTML = '';
  if (!menuItems.length) {
    menuTableBody.innerHTML = renderPlaceholderRow(5, 'No menu items found. Use "Add item" to create one.');
    return;
  }

  const rows = menuItems
    .map((item, index) => `
      <tr>
        <td>
          <div class="menu-item-cell">
            <strong>${item.name}</strong>
            <div class="menu-item-meta">${item.menu_item_id}</div>
          </div>
        </td>
        <td>${item.category}</td>
        <td>${formatCurrency(item.price)}</td>
        <td><span class="badge ${item.status}">${formatStatus(item.status)}</span></td>
        <td>
          <div class="menu-actions">
            <button class="icon-btn" data-action="edit" data-index="${index}" aria-label="Edit menu item">✎</button>
            <button class="icon-btn" data-action="delete" data-index="${index}" aria-label="Delete menu item">🗑</button>
          </div>
        </td>
      </tr>
    `)
    .join('');

  menuTableBody.innerHTML = rows;
};

const populateProfile = (profile) => {
  if (!profile) return;
  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
  profileName.textContent = fullName || 'Admin user';
  profileEmail.textContent = profile.email || '—';
  if (profileRole) {
    profileRole.textContent = profile.role || 'Admin';
  }
  setListContent(profileStores, profile.stores, 'No stores assigned yet.');
  setListContent(profileActivity, profile.recent_activity, 'No recent activity recorded.');
};

const fetchOrderItems = async (orderRows) => {
  const client = ensureSupabase();
  if (!orderRows || orderRows.length === 0) return new Map();

  const idKey = orderColumnMap.id || 'id';
  const orderIds = orderRows
    .map((row) => row?.[idKey])
    .filter((value) => value !== null && value !== undefined);

  if (orderIds.length === 0) return new Map();

  try {
    const { data, error } = await client
      .from(TABLES.orderItems)
      .select('*')
      .in(orderItemColumnMap.orderId || 'order_id', orderIds);

    if (error) throw error;
    configureOrderItemMapping(data);

    const map = new Map();
    (data || []).forEach((item) => {
      const orderId = item?.[orderItemColumnMap.orderId] ?? item?.order_id;
      if (orderId === null || orderId === undefined) return;
      const quantityRaw = item?.[orderItemColumnMap.quantity];
      const quantity = Number(quantityRaw ?? 1) || 1;
      const joinedName =
        item?.menu_items?.name ??
        item?.menu_item?.name ??
        item?.[orderItemColumnMap.name] ??
        item?.menu_item_name ??
        item?.menu_item_id ??
        'Menu item';

      const existing = map.get(orderId) || [];
      existing.push({ name: joinedName, qty: quantity });
      map.set(orderId, existing);
    });

    return map;
  } catch (error) {
    console.warn('Unable to load order items from Supabase', error);
    return new Map();
  }
};

const refreshOrders = async () => {
  try {
    const client = ensureSupabase();
    ordersTableBody.innerHTML = renderPlaceholderRow(6, 'Loading orders…');
    const { data, error } = await client
      .from(TABLES.orders)
      .select('*')
      .order(orderColumnMap.createdAt || 'created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    configureOrderMapping(data);
    const itemsByOrder = await fetchOrderItems(data);

    const idKey = orderColumnMap.id || 'id';
    const codeKey = orderColumnMap.code || idKey;
    const statusKey = orderColumnMap.status || 'status';
    const totalKey = orderColumnMap.total || 'total_amount';
    const createdAtKey = orderColumnMap.createdAt || 'created_at';
    const customerKey = orderColumnMap.customer || 'customer_name';

    orders = (data || []).map((row) => {
      const rawStatus = row?.[statusKey];
      const status = normalizeOrderStatus(rawStatus);
      const totalRaw = row?.[totalKey];
      const total = Number(totalRaw ?? 0);
      const createdAt = row?.[createdAtKey] ?? row?.created_at ?? row?.placed_at;
      const orderId = row?.[idKey] ?? row?.id;
      const orderCode = row?.[codeKey] ?? orderId ?? '—';
      const customer =
        row?.[customerKey] ??
        row?.customer ??
        row?.customer_full_name ??
        row?.customer_details?.name ??
        'Guest customer';

      const items = itemsByOrder.get(orderId) || [];

      return {
        order_id: orderCode,
        customer,
        status,
        total: Number.isFinite(total) ? total : 0,
        placed_at: formatDateTime(createdAt),
        items
      };
    });

    populateOrders();
  } catch (error) {
    console.error('Failed to load orders', error);
    orders = [];
    ordersTableBody.innerHTML = renderPlaceholderRow(6, 'Unable to load orders from Supabase.');
  }
};

const mapMenuItemRow = (row) => {
  const idKey = menuItemColumnMap.id || 'id';
  const nameKey = menuItemColumnMap.name || 'name';
  const categoryKey = menuItemColumnMap.category || 'category';
  const priceKey = menuItemColumnMap.price || 'price';
  const statusKey = menuItemColumnMap.status;
  const availableKey = menuItemColumnMap.isAvailable;

  const priceRaw = row?.[priceKey];
  const price = (() => {
    const numeric = Number(priceRaw);
    if (Number.isNaN(numeric)) return Number(priceRaw) || 0;
    if (priceKey?.toLowerCase().includes('cents')) {
      return numeric / 100;
    }
    return numeric;
  })();

  let status = 'available';
  if (statusKey && row?.[statusKey] !== undefined) {
    status = normalizeMenuStatus(row?.[statusKey]);
  } else if (availableKey && row?.[availableKey] !== undefined) {
    status = row?.[availableKey] ? 'available' : 'out_of_stock';
  }

  return {
    menu_item_id: row?.[idKey] ?? row?.menu_item_id ?? row?.id ?? '—',
    name: row?.[nameKey] ?? row?.name ?? 'Menu item',
    category: row?.[categoryKey] ?? row?.category ?? 'Uncategorized',
    price: Number.isFinite(price) ? price : 0,
    status,
    raw: row
  };
};

const refreshMenu = async () => {
  try {
    const client = ensureSupabase();
    menuTableBody.innerHTML = renderPlaceholderRow(5, 'Loading menu…');
    const { data, error } = await client
      .from(TABLES.menuItems)
      .select('*')
      .order(menuItemColumnMap.name || 'name', { ascending: true });

    if (error) throw error;
    configureMenuItemMapping(data);
    menuItems = (data || []).map(mapMenuItemRow);
    populateMenu();
  } catch (error) {
    console.error('Failed to load menu items', error);
    menuItems = [];
    menuTableBody.innerHTML = renderPlaceholderRow(5, 'Unable to load menu items from Supabase.');
  }
};

const buildMenuMutationPayload = (values) => {
  const payload = {};
  const nameKey = menuItemColumnMap.name || 'name';
  const categoryKey = menuItemColumnMap.category || 'category';
  const priceKey = menuItemColumnMap.price || 'price';
  const statusKey = menuItemColumnMap.status;
  const availableKey = menuItemColumnMap.isAvailable;

  payload[nameKey] = values.name;
  payload[categoryKey] = values.category;
  if (priceKey.toLowerCase().includes('cents')) {
    payload[priceKey] = Math.round(values.price * 100);
  } else {
    payload[priceKey] = values.price;
  }

  if (statusKey) {
    payload[statusKey] = values.status;
  } else if (availableKey) {
    payload[availableKey] = values.status === 'available';
  } else {
    payload.status = values.status;
  }

  return payload;
};

const openMenuDialog = (mode, index = null) => {
  editingItemIndex = typeof index === 'number' ? index : null;
  menuDialog.dataset.mode = mode;
  if (!menuDialog.open) {
    menuDialog.showModal();
  }
  menuDialogTitle.textContent = mode === 'edit' ? 'Edit menu item' : 'Add menu item';

  if (mode === 'edit' && editingItemIndex !== null) {
    const item = menuItems[editingItemIndex];
    if (item) {
      menuForm.itemName.value = item.name;
      menuForm.category.value = item.category;
      menuForm.price.value = item.price;
      menuForm.status.value = item.status;
    }
  } else {
    menuForm.reset();
    if (menuForm.status) {
      menuForm.status.value = 'available';
    }
  }
};

const closeMenuDialog = () => {
  if (menuDialog.open) {
    menuDialog.close('cancel');
  }
};

menuDialog.addEventListener('close', () => {
  editingItemIndex = null;
  menuDialog.dataset.mode = '';
  setFormLoading(menuForm, false);
  menuForm.reset();
});

menuDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeMenuDialog();
});

const handleMenuFormSubmit = async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  if (!submitter || submitter.value !== 'confirm') {
    closeMenuDialog();
    return;
  }

  try {
    const client = ensureSupabase();
    const formData = new FormData(menuForm);
    const name = formData.get('itemName')?.toString().trim();
    const category = formData.get('category')?.toString().trim();
    const status = formData.get('status')?.toString();
    const priceValue = Number(formData.get('price'));

    if (!name || !category) {
      showNotice('Please provide both a name and category for the menu item.', 'warning');
      return;
    }

    if (!Number.isFinite(priceValue)) {
      showNotice('Price must be a valid number.', 'warning');
      return;
    }

    const payload = buildMenuMutationPayload({
      name,
      category,
      price: priceValue,
      status: status || 'available'
    });

    setFormLoading(menuForm, true);
    if (editingItemIndex === null) {
      const { error } = await client.from(TABLES.menuItems).insert([payload]);
      if (error) throw error;
      showNotice('Menu item created successfully.', 'success');
    } else {
      const target = menuItems[editingItemIndex];
      const idKey = menuItemColumnMap.id || 'id';
      const identifier = target?.raw?.[idKey] ?? target?.menu_item_id;
      if (identifier === undefined || identifier === null) {
        throw new Error('Unable to determine the menu item identifier for update.');
      }
      const { error } = await client
        .from(TABLES.menuItems)
        .update(payload)
        .eq(idKey, identifier);
      if (error) throw error;
      showNotice('Menu item updated successfully.', 'success');
    }

    await refreshMenu();
    closeMenuDialog();
  } catch (error) {
    console.error('Failed to save menu item', error);
    showNotice('Unable to save the menu item. Check Supabase configuration.', 'error', true);
  } finally {
    setFormLoading(menuForm, false);
  }
};

const handleMenuAction = async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const index = Number(button.dataset.index);
  if (Number.isNaN(index)) return;

  if (action === 'edit') {
    openMenuDialog('edit', index);
    return;
  }

  if (action === 'delete') {
    const item = menuItems[index];
    if (!item) return;
    const confirmed = window.confirm(`Delete ${item.name}? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const client = ensureSupabase();
      const idKey = menuItemColumnMap.id || 'id';
      const identifier = item?.raw?.[idKey] ?? item?.menu_item_id;
      if (identifier === undefined || identifier === null) {
        throw new Error('Unable to determine the menu item identifier for deletion.');
      }
      const { error } = await client
        .from(TABLES.menuItems)
        .delete()
        .eq(idKey, identifier);
      if (error) throw error;
      showNotice('Menu item deleted.', 'success');
      await refreshMenu();
    } catch (error) {
      console.error('Failed to delete menu item', error);
      showNotice('Unable to delete the menu item. Check Supabase configuration.', 'error', true);
    }
  }
};

const buildFallbackProfile = (user) => {
  const metadata = user?.user_metadata || {};
  const fullName = metadata.full_name || '';
  const [firstNameFromFull, ...rest] = fullName.split(' ');
  return {
    first_name: metadata.first_name || firstNameFromFull || '',
    last_name: metadata.last_name || rest.join(' ') || '',
    email: user?.email || metadata.email || '—',
    role: metadata.role || 'Admin',
    stores: [],
    recent_activity: []
  };
};

const mapStaffRecordToProfile = (record, user) => {
  configureProfileMapping(record);
  const firstName = record?.[profileColumnMap.firstName] ?? user?.user_metadata?.first_name ?? '';
  const lastName = record?.[profileColumnMap.lastName] ?? user?.user_metadata?.last_name ?? '';
  const email = record?.[profileColumnMap.email] ?? user?.email ?? '—';
  const role = record?.[profileColumnMap.role] ?? user?.user_metadata?.role ?? 'Admin';

  return {
    first_name: firstName || '',
    last_name: lastName || '',
    email,
    role,
    stores: [],
    recent_activity: []
  };
};

const fetchStoresForStaff = async (staffRecord) => {
  const client = ensureSupabase();
  const staffId = staffRecord?.[staffIdColumn] ?? staffRecord?.id;
  if (!staffId) return [];

  try {
    const { data, error } = await client
      .from(TABLES.staffStores)
      .select('*, stores(name), store(name)')
      .eq('staff_id', staffId);

    if (error) throw error;

    const stores = (data || [])
      .map((entry) => entry?.stores?.name || entry?.store?.name || entry?.store_name || entry?.name)
      .filter(Boolean);

    if (stores.length) return stores;

    const directStore = staffRecord?.store || staffRecord?.primary_store || staffRecord?.location;
    return directStore ? [directStore] : [];
  } catch (error) {
    console.warn('Unable to load store assignments', error);
    const directStore = staffRecord?.store || staffRecord?.primary_store || staffRecord?.location;
    return directStore ? [directStore] : [];
  }
};

const fetchActivityForStaff = async (staffRecord) => {
  const client = ensureSupabase();
  const staffId = staffRecord?.[staffIdColumn] ?? staffRecord?.id;
  if (!staffId) return [];

  try {
    const { data, error } = await client
      .from(TABLES.staffActivity)
      .select('*')
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    return (data || []).map((entry) => {
      const description = entry?.description || entry?.message || entry?.action || 'Updated record';
      const timestamp = entry?.created_at || entry?.timestamp || entry?.logged_at;
      return timestamp ? `${description} · ${formatDateTime(timestamp)}` : description;
    });
  } catch (error) {
    console.warn('Unable to load staff activity', error);
    return [];
  }
};

const refreshProfile = async (user) => {
  const fallback = buildFallbackProfile(user);

  try {
    const client = ensureSupabase();
    profileName.textContent = 'Loading…';
    profileEmail.textContent = user?.email || '—';
    if (profileRole) profileRole.textContent = 'Loading…';
    setListContent(profileStores, [], 'Loading…');
    setListContent(profileActivity, [], 'Loading…');

    const { data, error } = await client
      .from(TABLES.staff)
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      adminProfile = fallback;
      populateProfile(adminProfile);
      return;
    }

    const profile = mapStaffRecordToProfile(data, user);
    const [stores, activity] = await Promise.all([
      fetchStoresForStaff(data),
      fetchActivityForStaff(data)
    ]);
    profile.stores = stores;
    profile.recent_activity = activity;
    adminProfile = profile;
    populateProfile(adminProfile);
  } catch (error) {
    console.error('Failed to load admin profile', error);
    adminProfile = fallback;
    populateProfile(adminProfile);
    showNotice('Showing profile details from Supabase auth metadata.', 'warning');
  }
};

const switchAuthCard = (target) => {
  if (target === 'signup') {
    loginCard.classList.add('hidden');
    signupCard.classList.remove('hidden');
  } else {
    signupCard.classList.add('hidden');
    loginCard.classList.remove('hidden');
  }
};

const updateSection = (sectionKey) => {
  Object.values(sections).forEach((section) => section.classList.add('hidden'));
  sections[sectionKey].classList.remove('hidden');

  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === sectionKey);
  });

  const copy = sectionCopy[sectionKey];
  pageTitle.textContent = copy.title;
  pageSubtitle.textContent = copy.subtitle;
};

const showDashboard = async (user) => {
  currentUser = user;
  authPanel.classList.add('hidden');
  dashboard.classList.remove('hidden');
  currentStatusFilter = 'all';
  statusChips.forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.status === 'all');
  });
  updateSection('orders');
  await Promise.all([
    refreshOrders(),
    refreshMenu(),
    refreshProfile(user)
  ]);
};

Array.from(document.querySelectorAll('.auth-switch .link-btn')).forEach((btn) => {
  btn.addEventListener('click', (event) => switchAuthCard(event.currentTarget.dataset.target));
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const email = formData.get('email')?.toString().trim();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    showNotice('Please fill in both email and password.', 'warning');
    return;
  }

  try {
    const client = ensureSupabase();
    setFormLoading(loginForm, true);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const user = data.user;
    if (!user) {
      showNotice('Login succeeded but no user session was returned.', 'warning');
      return;
    }
    hideNotice();
    await showDashboard(user);
    loginForm.reset();
    showNotice(`Signed in as ${email}.`, 'success');
  } catch (error) {
    console.error('Login failed', error);
    showNotice(error?.message || 'Unable to log in with Supabase.', 'error');
  } finally {
    setFormLoading(loginForm, false);
  }
});

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
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
    const client = ensureSupabase();
    setFormLoading(signupForm, true);
    const { data, error } = await client.auth.signUp({
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
      hideNotice();
      await showDashboard(data.session.user);
      showNotice('Account created and signed in successfully.', 'success');
    } else {
      showNotice('Check your email to confirm the new admin account, then log in.', 'info', true);
      switchAuthCard('login');
    }
  } catch (error) {
    console.error('Sign up failed', error);
    showNotice(error?.message || 'Unable to sign up with Supabase.', 'error');
  } finally {
    setFormLoading(signupForm, false);
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch (error) {
    console.warn('Error during Supabase sign-out', error);
  }
  currentUser = null;
  dashboard.classList.add('hidden');
  authPanel.classList.remove('hidden');
  loginForm.reset();
  signupForm.reset();
  switchAuthCard('login');
  currentStatusFilter = 'all';
  statusChips.forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.status === 'all');
  });
  showNotice('Signed out successfully.', 'info');
});

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => updateSection(btn.dataset.section));
});

addMenuItemBtn.addEventListener('click', () => openMenuDialog('create'));

menuTableBody.addEventListener('click', handleMenuAction);

menuForm.addEventListener('submit', handleMenuFormSubmit);

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMenuDialog();
  }
});

statusChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    statusChips.forEach((btn) => btn.classList.remove('active'));
    chip.classList.add('active');
    const status = chip.dataset.status || 'all';
    currentStatusFilter = status;
    populateOrders();
  });
});

const initialize = async () => {
  ordersTableBody.innerHTML = renderPlaceholderRow(6, 'Connect to Supabase to load orders.');
  menuTableBody.innerHTML = renderPlaceholderRow(5, 'Connect to Supabase to load menu items.');
  setListContent(profileStores, [], 'Connect to Supabase to load store assignments.');
  setListContent(profileActivity, [], 'Connect to Supabase to load recent activity.');

  if (!supabase) {
    showNotice('Supabase credentials are missing. Update index.html with your project URL and anon key.', 'error', true);
    return;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data?.session?.user) {
      await showDashboard(data.session.user);
    }
  } catch (error) {
    console.warn('Unable to restore Supabase session', error);
  }
};

initialize();
