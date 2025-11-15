import {
  renderPlaceholderRow,
  formatCurrency,
  formatStatus,
  normalizeMenuStatus,
  showNotice,
  setFormLoading
} from '../common/ui.js';
import { initializeDashboardPage } from './shared.js';

const htmlRoot = document.documentElement;
const menuTableBody = document.getElementById('menu-table-body');
const menuDialog = document.getElementById('menu-dialog');
const menuDialogTitle = document.getElementById('menu-dialog-title');
const menuForm = document.getElementById('menu-form');
const addMenuItemBtn = document.getElementById('add-menu-item');

const TABLES = {
  menuItems: htmlRoot.dataset.tableMenuItems || 'menu_items'
};

let supabaseClient = null;
let menuItems = [];
let editingItemIndex = null;

let menuItemColumnMap = {
  id: 'id',
  name: 'name',
  category: 'category',
  price: 'price',
  status: 'status',
  isAvailable: 'is_available'
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

const populateMenu = () => {
  if (!menuTableBody) return;
  menuTableBody.innerHTML = '';
  if (!menuItems.length) {
    menuTableBody.innerHTML = renderPlaceholderRow(5, 'No menu items found. Use "Add item" to create one.');
    return;
  }

  const rows = menuItems
    .map(
      (item, index) => `
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
      `
    )
    .join('');

  menuTableBody.innerHTML = rows;
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
      if (menuForm.status) {
        menuForm.status.value = item.status;
      }
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

const refreshMenu = async () => {
  if (!supabaseClient) return;
  try {
    menuTableBody.innerHTML = renderPlaceholderRow(5, 'Loading menu…');
    const { data, error } = await supabaseClient
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

const handleMenuFormSubmit = async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  if (!submitter || submitter.value !== 'confirm') {
    closeMenuDialog();
    return;
  }

  if (!supabaseClient) return;

  try {
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
      const { error } = await supabaseClient.from(TABLES.menuItems).insert([payload]);
      if (error) throw error;
      showNotice('Menu item created successfully.', 'success');
    } else {
      const target = menuItems[editingItemIndex];
      const idKey = menuItemColumnMap.id || 'id';
      const identifier = target?.raw?.[idKey] ?? target?.menu_item_id;
      if (identifier === undefined || identifier === null) {
        throw new Error('Unable to determine the menu item identifier for update.');
      }
      const { error } = await supabaseClient
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
  if (!button || !supabaseClient) return;

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
      const idKey = menuItemColumnMap.id || 'id';
      const identifier = item?.raw?.[idKey] ?? item?.menu_item_id;
      if (identifier === undefined || identifier === null) {
        throw new Error('Unable to determine the menu item identifier for deletion.');
      }
      const { error } = await supabaseClient
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

const bindDialogLifecycle = () => {
  if (!menuDialog) return;
  menuDialog.addEventListener('close', () => {
    editingItemIndex = null;
    menuDialog.dataset.mode = '';
    if (menuForm) {
      setFormLoading(menuForm, false);
      menuForm.reset();
    }
  });

  menuDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeMenuDialog();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenuDialog();
    }
  });
};

const initialize = async () => {
  if (menuTableBody) {
    menuTableBody.innerHTML = renderPlaceholderRow(5, 'Connect to Supabase to load menu items.');
  }

  bindDialogLifecycle();
  if (addMenuItemBtn) {
    addMenuItemBtn.addEventListener('click', () => openMenuDialog('create'));
  }

  if (menuTableBody) {
    menuTableBody.addEventListener('click', handleMenuAction);
  }

  if (menuForm) {
    menuForm.addEventListener('submit', handleMenuFormSubmit);
  }

  const { supabase, session } = await initializeDashboardPage('menu');
  if (!supabase || !session) return;
  supabaseClient = supabase;

  await refreshMenu();
  showNotice('Menu synced with Supabase.', 'success');
};

initialize();
