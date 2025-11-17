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
const dialogDismissButtons = menuDialog
  ? Array.from(menuDialog.querySelectorAll('[data-dialog-dismiss]'))
  : [];

const TABLES = {
  items: htmlRoot.dataset.tableMenuItems || 'item'
};

let supabaseClient = null;
let menuItems = [];
let editingItemIndex = null;

const mapMenuItemRow = (row) => {
  const priceValue = Number(row?.price ?? 0);
  const status = normalizeMenuStatus(row?.availability);

  return {
    item_id: row?.item_id ?? '—',
    menu_id: row?.menu_id ?? null,
    name: row?.item_name || 'Menu item',
    description: row?.description || '',
    price: Number.isFinite(priceValue) ? priceValue : 0,
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
              <div class="menu-item-meta">ID: ${item.item_id}${
                item.menu_id !== null && item.menu_id !== undefined
                  ? ` • Menu: ${item.menu_id}`
                  : ''
              }</div>
              ${item.description ? `<div class="menu-item-description">${item.description}</div>` : ''}
            </div>
          </td>
          <td>${item.menu_id ?? '—'}</td>
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
  const status = normalizeMenuStatus(values.status || 'available');
  const availability = status === 'available';

  return {
    menu_id: values.menuId ?? null,
    item_name: values.name,
    description: values.description || null,
    price: values.price,
    availability
  };
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
      if (menuForm.menuId) {
        menuForm.menuId.value = item.menu_id ?? '';
      }
      if (menuForm.description) {
        menuForm.description.value = item.description || '';
      }
      menuForm.price.value = item.price;
      if (menuForm.status) {
        menuForm.status.value = item.status;
      }
    }
  } else {
    menuForm.reset();
    if (menuForm.menuId) {
      menuForm.menuId.value = '';
    }
    if (menuForm.description) {
      menuForm.description.value = '';
    }
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
      .from(TABLES.items)
      .select('item_id, menu_id, item_name, description, price, availability')
      .order('item_name', { ascending: true });

    if (error) throw error;
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
    const menuIdInput = formData.get('menuId')?.toString().trim();
    const description = formData.get('description')?.toString().trim();
    const status = formData.get('status')?.toString();
    const priceValue = Number(formData.get('price'));

    if (!name || !menuIdInput) {
      showNotice('Please provide both a menu ID and item name.', 'warning');
      return;
    }

    if (!Number.isFinite(priceValue)) {
      showNotice('Price must be a valid number.', 'warning');
      return;
    }

    let menuIdValue = null;
    if (menuIdInput) {
      const parsedMenuId = Number(menuIdInput);
      menuIdValue = Number.isNaN(parsedMenuId) ? menuIdInput : parsedMenuId;
    }

    const payload = buildMenuMutationPayload({
      name,
      menuId: menuIdValue,
      description,
      price: priceValue,
      status: status || 'available'
    });

    setFormLoading(menuForm, true);
    if (editingItemIndex === null) {
      const { error } = await supabaseClient.from(TABLES.items).insert([payload]);
      if (error) throw error;
      showNotice('Menu item created successfully.', 'success');
    } else {
      const target = menuItems[editingItemIndex];
      const identifier = target?.raw?.item_id ?? target?.item_id;
      if (identifier === undefined || identifier === null) {
        throw new Error('Unable to determine the menu item identifier for update.');
      }
      const { error } = await supabaseClient
        .from(TABLES.items)
        .update(payload)
        .eq('item_id', identifier);
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
      const identifier = item?.raw?.item_id ?? item?.item_id;
      if (identifier === undefined || identifier === null) {
        throw new Error('Unable to determine the menu item identifier for deletion.');
      }
      const { error } = await supabaseClient
        .from(TABLES.items)
        .delete()
        .eq('item_id', identifier);
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

  dialogDismissButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      closeMenuDialog();
    });
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
