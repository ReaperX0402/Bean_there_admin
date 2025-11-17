import {
  renderPlaceholderRow,
  formatCurrency,
  formatStatus,
  formatDateTime,
  normalizeMenuStatus,
  showNotice,
  setFormLoading
} from '../common/ui.js';
import { initializeDashboardPage } from './shared.js';

const htmlRoot = document.documentElement;
const menuItemsTableBody = document.getElementById('menu-items-table-body');
const menusTableBody = document.getElementById('menus-table-body');
const selectedMenuDetails = document.getElementById('selected-menu-details');
const menuSelector = document.getElementById('menu-selector');

const menuItemDialog = document.getElementById('menu-item-dialog');
const menuItemDialogTitle = document.getElementById('menu-item-dialog-title');
const menuItemForm = document.getElementById('menu-item-form');
const addMenuItemBtn = document.getElementById('add-menu-item');
const menuItemDialogDismissButtons = menuItemDialog
  ? Array.from(menuItemDialog.querySelectorAll('[data-dialog-dismiss]'))
  : [];

const menuDefinitionDialog = document.getElementById('menu-definition-dialog');
const menuDefinitionDialogTitle = document.getElementById('menu-definition-dialog-title');
const menuDefinitionForm = document.getElementById('menu-definition-form');
const addMenuBtn = document.getElementById('add-menu');
const menuDefinitionDismissButtons = menuDefinitionDialog
  ? Array.from(menuDefinitionDialog.querySelectorAll('[data-dialog-dismiss]'))
  : [];

const TABLES = {
  items: htmlRoot.dataset.tableMenuItems || 'item',
  menus: htmlRoot.dataset.tableMenus || 'menu'
};

let supabaseClient = null;
let menuItems = [];
let menus = [];
let editingItemIndex = null;
let editingMenuIndex = null;
let selectedMenuId = null;
let currentAdminCafeId = null;

const parseIdentifierValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? value : numeric;
};

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

const mapMenuRow = (row) => ({
  menu_id: row?.menu_id ?? '—',
  cafe_id: row?.cafe_id ?? '—',
  name: row?.name || 'Menu',
  description: row?.description || '',
  is_active: Boolean(row?.is_active ?? true),
  updated_at: row?.updated_at || row?.created_at || null,
  raw: row
});

const formatMenuActiveStatus = (isActive) => (isActive ? 'active' : 'inactive');

const setSelectedMenuDetails = () => {
  if (!selectedMenuDetails) return;
  if (selectedMenuId === null || selectedMenuId === undefined) {
    selectedMenuDetails.textContent = 'Select a menu to view and manage its items.';
    return;
  }

  const targetMenu = menus.find((menu) => menu.menu_id === selectedMenuId);
  if (!targetMenu) {
    selectedMenuDetails.textContent = 'Select a menu to view and manage its items.';
    return;
  }

  selectedMenuDetails.textContent = `Managing items for "${targetMenu.name}" (Menu ID ${targetMenu.menu_id}).`;
};

const updateAddMenuItemAvailability = () => {
  if (!addMenuItemBtn) return;
  const disabled = selectedMenuId === null || selectedMenuId === undefined;
  addMenuItemBtn.disabled = disabled;
  if (disabled) {
    addMenuItemBtn.title = 'Create and select a menu before adding items.';
  } else {
    addMenuItemBtn.removeAttribute('title');
  }
};

const populateMenuItemsTable = () => {
  if (!menuItemsTableBody) return;
  menuItemsTableBody.innerHTML = '';

  if (selectedMenuId === null || selectedMenuId === undefined) {
    menuItemsTableBody.innerHTML = renderPlaceholderRow(5, 'Select a menu to view its items.');
    return;
  }

  if (!menuItems.length) {
    menuItemsTableBody.innerHTML = renderPlaceholderRow(5, 'No items found for this menu. Use "Add item" to create one.');
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

  menuItemsTableBody.innerHTML = rows;
};

const populateMenusTable = () => {
  if (!menusTableBody) return;
  menusTableBody.innerHTML = '';

  if (!menus.length) {
    menusTableBody.innerHTML = renderPlaceholderRow(5, 'No menus found. Use "Create menu" to add one.');
    return;
  }

  const rows = menus
    .map(
      (menu, index) => `
        <tr>
          <td>
            <div class="menu-item-cell">
              <strong>${menu.name}</strong>
              <div class="menu-item-meta">Menu ID: ${menu.menu_id}</div>
              ${menu.description ? `<div class="menu-item-description">${menu.description}</div>` : ''}
            </div>
          </td>
          <td>${menu.cafe_id ?? '—'}</td>
          <td><span class="badge ${menu.is_active ? 'available' : 'out_of_stock'}">${formatStatus(
            formatMenuActiveStatus(menu.is_active)
          )}</span></td>
          <td>${menu.updated_at ? formatDateTime(menu.updated_at) : '—'}</td>
          <td>
            <div class="menu-actions">
              <button class="icon-btn" data-menu-action="edit" data-index="${index}" aria-label="Edit menu">✎</button>
              <button class="icon-btn" data-menu-action="delete" data-index="${index}" aria-label="Delete menu">🗑</button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');

  menusTableBody.innerHTML = rows;
};

const populateMenuSelector = () => {
  if (!menuSelector) return;

  if (!menus.length) {
    menuSelector.innerHTML = '<option value="">No menus available</option>';
    menuSelector.value = '';
    menuSelector.disabled = true;
    selectedMenuId = null;
    setSelectedMenuDetails();
    updateAddMenuItemAvailability();
    populateMenuItemsTable();
    return;
  }

  if (!menus.some((menu) => menu.menu_id === selectedMenuId)) {
    selectedMenuId = menus[0].menu_id;
  }

  const options = menus
    .map(
      (menu) => `
        <option value="${menu.menu_id}">${menu.name} (${menu.menu_id})</option>
      `
    )
    .join('');

  menuSelector.innerHTML = options;
  menuSelector.disabled = false;
  menuSelector.value = selectedMenuId !== null && selectedMenuId !== undefined ? String(selectedMenuId) : '';
  setSelectedMenuDetails();
  updateAddMenuItemAvailability();
};

const buildMenuItemPayload = (values) => {
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

const buildMenuDefinitionPayload = (values) => ({
  name: values.name,
  cafe_id: values.cafeId ?? null,
  description: values.description || null,
  is_active: values.status !== 'inactive'
});

const openMenuItemDialog = (mode, index = null) => {
  if (!menuItemDialog || !menuItemForm) return;

  if (mode === 'create' && (selectedMenuId === null || selectedMenuId === undefined)) {
    showNotice('Create a menu before adding menu items.', 'warning');
    return;
  }

  editingItemIndex = typeof index === 'number' ? index : null;
  menuItemDialog.dataset.mode = mode;
  if (!menuItemDialog.open) {
    menuItemDialog.showModal();
  }
  menuItemDialogTitle.textContent = mode === 'edit' ? 'Edit menu item' : 'Add menu item';

  if (mode === 'edit' && editingItemIndex !== null) {
    const item = menuItems[editingItemIndex];
    if (item) {
      menuItemForm.itemName.value = item.name;
      if (menuItemForm.menuId) {
        menuItemForm.menuId.value = item.menu_id ?? '';
      }
      if (menuItemForm.description) {
        menuItemForm.description.value = item.description || '';
      }
      menuItemForm.price.value = item.price;
      if (menuItemForm.status) {
        menuItemForm.status.value = item.status;
      }
    }
  } else {
    menuItemForm.reset();
    if (menuItemForm.menuId) {
      menuItemForm.menuId.value = selectedMenuId ?? '';
    }
    if (menuItemForm.description) {
      menuItemForm.description.value = '';
    }
    if (menuItemForm.status) {
      menuItemForm.status.value = 'available';
    }
  }
};

const closeMenuItemDialog = () => {
  if (menuItemDialog?.open) {
    menuItemDialog.close('cancel');
  }
};

const applyDefaultCafeId = () => {
  if (!menuDefinitionForm?.cafeId) return;
  menuDefinitionForm.cafeId.value = currentAdminCafeId ?? '';
};

const openMenuDefinitionDialog = (mode, index = null) => {
  if (!menuDefinitionDialog || !menuDefinitionForm) return;

  editingMenuIndex = typeof index === 'number' ? index : null;
  menuDefinitionDialog.dataset.mode = mode;
  if (!menuDefinitionDialog.open) {
    menuDefinitionDialog.showModal();
  }
  menuDefinitionDialogTitle.textContent = mode === 'edit' ? 'Edit menu' : 'Create menu';

  if (mode === 'edit' && editingMenuIndex !== null) {
    const menu = menus[editingMenuIndex];
    if (menu) {
      menuDefinitionForm.menuName.value = menu.name;
      menuDefinitionForm.cafeId.value = menu.cafe_id ?? '';
      if (menuDefinitionForm.menuDescription) {
        menuDefinitionForm.menuDescription.value = menu.description || '';
      }
      if (menuDefinitionForm.menuStatus) {
        menuDefinitionForm.menuStatus.value = menu.is_active ? 'active' : 'inactive';
      }
    }
  } else {
    menuDefinitionForm.reset();
    applyDefaultCafeId();
    if (menuDefinitionForm.menuStatus) {
      menuDefinitionForm.menuStatus.value = 'active';
    }
  }
};

const closeMenuDefinitionDialog = () => {
  if (menuDefinitionDialog?.open) {
    menuDefinitionDialog.close('cancel');
  }
};

const refreshMenuItems = async () => {
  if (!supabaseClient || !menuItemsTableBody) return;
  if (selectedMenuId === null || selectedMenuId === undefined) {
    menuItems = [];
    populateMenuItemsTable();
    return;
  }

  try {
    menuItemsTableBody.innerHTML = renderPlaceholderRow(5, 'Loading menu items…');
    const identifier = selectedMenuId;
    const { data, error } = await supabaseClient
      .from(TABLES.items)
      .select('item_id, menu_id, item_name, description, price, availability')
      .eq('menu_id', identifier)
      .order('item_name', { ascending: true });

    if (error) throw error;
    menuItems = (data || []).map(mapMenuItemRow);
    populateMenuItemsTable();
  } catch (error) {
    console.error('Failed to load menu items', error);
    menuItems = [];
    menuItemsTableBody.innerHTML = renderPlaceholderRow(5, 'Unable to load menu items from Supabase.');
  }
};

const refreshMenus = async () => {
  if (!supabaseClient || !menusTableBody) return;

  try {
    menusTableBody.innerHTML = renderPlaceholderRow(5, 'Loading menus…');
    const { data, error } = await supabaseClient
      .from(TABLES.menus)
      .select('menu_id, cafe_id, name, description, is_active, updated_at, created_at')
      .order('name', { ascending: true });

    if (error) throw error;
    menus = (data || []).map(mapMenuRow);
    populateMenusTable();
    populateMenuSelector();
    await refreshMenuItems();
  } catch (error) {
    console.error('Failed to load menus', error);
    menus = [];
    menusTableBody.innerHTML = renderPlaceholderRow(5, 'Unable to load menus from Supabase.');
    populateMenuSelector();
  }
};

const handleMenuItemFormSubmit = async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  if (!submitter || submitter.value !== 'confirm') {
    closeMenuItemDialog();
    return;
  }

  if (!supabaseClient) return;

  try {
    const formData = new FormData(menuItemForm);
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

    const menuIdValue = parseIdentifierValue(menuIdInput);

    const payload = buildMenuItemPayload({
      name,
      menuId: menuIdValue,
      description,
      price: priceValue,
      status: status || 'available'
    });

    setFormLoading(menuItemForm, true);
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

    await refreshMenuItems();
    closeMenuItemDialog();
  } catch (error) {
    console.error('Failed to save menu item', error);
    showNotice('Unable to save the menu item. Check Supabase configuration.', 'error', true);
  } finally {
    setFormLoading(menuItemForm, false);
  }
};

const handleMenuDefinitionFormSubmit = async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  if (!submitter || submitter.value !== 'confirm') {
    closeMenuDefinitionDialog();
    return;
  }

  if (!supabaseClient) return;

  try {
    const formData = new FormData(menuDefinitionForm);
    const name = formData.get('menuName')?.toString().trim();
    const cafeIdInput = formData.get('cafeId')?.toString().trim();
    const description = formData.get('menuDescription')?.toString().trim();
    const status = formData.get('menuStatus')?.toString();

    const derivedCafeId = cafeIdInput || (currentAdminCafeId !== null && currentAdminCafeId !== undefined
      ? String(currentAdminCafeId)
      : '');

    if (!name || !derivedCafeId) {
      showNotice('Both menu name and cafe ID are required.', 'warning');
      return;
    }

    const cafeIdValue = parseIdentifierValue(derivedCafeId);
    const payload = buildMenuDefinitionPayload({
      name,
      cafeId: cafeIdValue,
      description,
      status: status || 'active'
    });

    setFormLoading(menuDefinitionForm, true);
    if (editingMenuIndex === null) {
      const { error } = await supabaseClient.from(TABLES.menus).insert([payload]);
      if (error) throw error;
      showNotice('Menu created successfully.', 'success');
    } else {
      const target = menus[editingMenuIndex];
      const identifier = target?.raw?.menu_id ?? target?.menu_id;
      if (identifier === undefined || identifier === null) {
        throw new Error('Unable to determine the menu identifier for update.');
      }
      const { error } = await supabaseClient
        .from(TABLES.menus)
        .update(payload)
        .eq('menu_id', identifier);
      if (error) throw error;
      showNotice('Menu updated successfully.', 'success');
    }

    await refreshMenus();
    closeMenuDefinitionDialog();
  } catch (error) {
    console.error('Failed to save menu', error);
    showNotice('Unable to save the menu. Check Supabase configuration.', 'error', true);
  } finally {
    setFormLoading(menuDefinitionForm, false);
  }
};

const handleMenuItemAction = async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || !supabaseClient) return;

  const action = button.dataset.action;
  const index = Number(button.dataset.index);
  if (Number.isNaN(index)) return;

  if (action === 'edit') {
    openMenuItemDialog('edit', index);
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
      await refreshMenuItems();
    } catch (error) {
      console.error('Failed to delete menu item', error);
      showNotice('Unable to delete the menu item. Check Supabase configuration.', 'error', true);
    }
  }
};

const handleMenusAction = async (event) => {
  const button = event.target.closest('button[data-menu-action]');
  if (!button || !supabaseClient) return;

  const action = button.dataset.menuAction;
  const index = Number(button.dataset.index);
  if (Number.isNaN(index)) return;

  if (action === 'edit') {
    openMenuDefinitionDialog('edit', index);
    return;
  }

  if (action === 'delete') {
    const menu = menus[index];
    if (!menu) return;
    const confirmed = window.confirm(
      `Delete menu "${menu.name}"? Its items will need to be reassigned manually if necessary.`
    );
    if (!confirmed) return;

    try {
      const identifier = menu?.raw?.menu_id ?? menu?.menu_id;
      if (identifier === undefined || identifier === null) {
        throw new Error('Unable to determine the menu identifier for deletion.');
      }
      const { error } = await supabaseClient
        .from(TABLES.menus)
        .delete()
        .eq('menu_id', identifier);
      if (error) throw error;
      showNotice('Menu deleted.', 'success');
      if (selectedMenuId === identifier) {
        selectedMenuId = null;
      }
      await refreshMenus();
    } catch (error) {
      console.error('Failed to delete menu', error);
      showNotice('Unable to delete the menu. Check Supabase configuration.', 'error', true);
    }
  }
};

const bindMenuItemDialogLifecycle = () => {
  if (!menuItemDialog) return;
  menuItemDialog.addEventListener('close', () => {
    editingItemIndex = null;
    menuItemDialog.dataset.mode = '';
    if (menuItemForm) {
      setFormLoading(menuItemForm, false);
      menuItemForm.reset();
    }
  });

  menuItemDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeMenuItemDialog();
  });

  menuItemDialogDismissButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      closeMenuItemDialog();
    });
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenuItemDialog();
      closeMenuDefinitionDialog();
    }
  });
};

const bindMenuDefinitionDialogLifecycle = () => {
  if (!menuDefinitionDialog) return;
  menuDefinitionDialog.addEventListener('close', () => {
    editingMenuIndex = null;
    menuDefinitionDialog.dataset.mode = '';
    if (menuDefinitionForm) {
      setFormLoading(menuDefinitionForm, false);
      menuDefinitionForm.reset();
      applyDefaultCafeId();
    }
  });

  menuDefinitionDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeMenuDefinitionDialog();
  });

  menuDefinitionDismissButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      closeMenuDefinitionDialog();
    });
  });
};

const handleMenuSelectorChange = (event) => {
  const value = event.target.value;
  selectedMenuId = value === '' ? null : parseIdentifierValue(value);
  setSelectedMenuDetails();
  updateAddMenuItemAvailability();
  refreshMenuItems();
};

const initialize = async () => {
  if (menusTableBody) {
    menusTableBody.innerHTML = renderPlaceholderRow(5, 'Connect to Supabase to load menus.');
  }
  if (menuItemsTableBody) {
    menuItemsTableBody.innerHTML = renderPlaceholderRow(5, 'Connect to Supabase to load menu items.');
  }

  bindMenuItemDialogLifecycle();
  bindMenuDefinitionDialogLifecycle();

  if (addMenuItemBtn) {
    addMenuItemBtn.addEventListener('click', () => openMenuItemDialog('create'));
  }
  if (menuSelector) {
    menuSelector.addEventListener('change', handleMenuSelectorChange);
  }
  if (menuItemsTableBody) {
    menuItemsTableBody.addEventListener('click', handleMenuItemAction);
  }
  if (menuItemForm) {
    menuItemForm.addEventListener('submit', handleMenuItemFormSubmit);
  }
  if (menusTableBody) {
    menusTableBody.addEventListener('click', handleMenusAction);
  }
  if (menuDefinitionForm) {
    menuDefinitionForm.addEventListener('submit', handleMenuDefinitionFormSubmit);
  }
  if (addMenuBtn) {
    addMenuBtn.addEventListener('click', () => openMenuDefinitionDialog('create'));
  }

  const { supabase, session } = await initializeDashboardPage('menu');
  if (!supabase || !session) return;
  supabaseClient = supabase;
  currentAdminCafeId = session?.admin?.cafe_id ?? null;
  applyDefaultCafeId();

  await refreshMenus();
  setSelectedMenuDetails();
  updateAddMenuItemAvailability();
  showNotice('Menus synced with Supabase.', 'success');
};

initialize();
