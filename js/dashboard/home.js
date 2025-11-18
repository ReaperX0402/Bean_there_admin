import {
  renderPlaceholderRow,
  formatCurrency,
  formatDateTime,
  formatStatus,
  normalizeOrderStatus,
  showNotice
} from '../common/ui.js';
import { initializeDashboardPage } from './shared.js';

const htmlRoot = document.documentElement;
const ordersTableBody = document.getElementById('orders-table-body');
const statusChips = Array.from(document.querySelectorAll('[data-status]'));
const connectionStatus = document.getElementById('connection-status');

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' }
];

// Match your Supabase table names
const TABLES = {
  orders: htmlRoot.dataset.tableOrders || 'orders',
  orderItems: htmlRoot.dataset.tableOrderItems || 'order_item',
  items: htmlRoot.dataset.tableItems || 'item'
};

let supabaseClient = null;
let orders = [];
let currentStatusFilter = 'all';

const renderOrderItems = (items) => {
  if (!items || items.length === 0) {
    return '<span class="muted">No items</span>';
  }
  return `
    <div class="order-items">
      ${items.map((item) => `<span class="order-item-chip">${item.qty}× ${item.name}</span>`).join('')}
    </div>
  `;
};

const renderStatusSelect = (order) => {
  const orderId = order?.order_id ?? '';
  const label = orderId ? `Update status for order #${orderId}` : 'Update status';
  const options = STATUS_OPTIONS.map(
    (option) =>
      `<option value="${option.value}" ${option.value === order.status ? 'selected' : ''}>${option.label}</option>`
  ).join('');

  return `
    <label class="status-select">
      <select
        class="order-status-select"
        data-order-id="${orderId}"
        data-current-status="${order.status}"
        aria-label="${label}"
      >
        ${options}
      </select>
    </label>
  `;
};

const populateOrders = () => {
  if (!ordersTableBody) return;
  ordersTableBody.innerHTML = '';

  const filtered =
    currentStatusFilter === 'all'
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
    .map(
      (order) => `
        <tr>
          <td>${order.order_id}</td>
          <!-- Show username instead of user_id -->
          <td>${order.user_name || order.user_id || '—'}</td>
          <td>
            <div class="status-cell">
              ${renderStatusSelect(order)}
            </div>
          </td>
          <td>${formatCurrency(order.total)}</td>
          <td>${order.placed_at}</td>
          <td>${renderOrderItems(order.items)}</td>
        </tr>
      `
    )
    .join('');

  ordersTableBody.innerHTML = rows;
  bindStatusSelects();
};

const handleStatusChange = async (event) => {
  if (!supabaseClient) return;
  const select = event.target;
  const orderId = select.dataset.orderId;
  const previousStatus = select.dataset.currentStatus || select.dataset.previousStatus || select.value;
  const nextStatus = normalizeOrderStatus(select.value);

  if (!orderId || !nextStatus || nextStatus === previousStatus) {
    select.value = previousStatus;
    return;
  }

  select.disabled = true;
  try {
    const { error } = await supabaseClient
      .from(TABLES.orders)
      .update({ status: nextStatus })
      .eq('order_id', orderId);

    if (error) throw error;

    const order = orders.find((entry) => `${entry.order_id}` === `${orderId}`);
    if (order) {
      order.status = nextStatus;
    }
    select.dataset.currentStatus = nextStatus;
    showNotice(`Order #${orderId} marked as ${formatStatus(nextStatus)}.`, 'success');
    populateOrders();
  } catch (error) {
    console.error('Unable to update order status', error);
    select.value = previousStatus;
    showNotice('Unable to update order status. Please try again.', 'error');
  } finally {
    select.disabled = false;
  }
};

const bindStatusSelects = () => {
  if (!ordersTableBody) return;
  const selects = Array.from(ordersTableBody.querySelectorAll('.order-status-select'));
  selects.forEach((select) => {
    select.addEventListener('change', handleStatusChange);
  });
};

const fetchOrderItems = async (orderRows) => {
  if (!supabaseClient || !orderRows?.length) return new Map();

  const orderIds = orderRows
    .map((row) => row?.order_id)
    .filter((value) => value !== null && value !== undefined);

  if (!orderIds.length) return new Map();

  try {
    const { data, error } = await supabaseClient
      .from(TABLES.orderItems)
      .select('order_id, item_id, qty')
      .in('order_id', orderIds);

    if (error) throw error;

    const itemIds = Array.from(
      new Set(
        (data || [])
          .map((row) => row?.item_id)
          .filter((value) => value !== null && value !== undefined)
      )
    );

    const itemNameMap = new Map();
    if (itemIds.length) {
      try {
        const { data: itemRows, error: itemError } = await supabaseClient
          .from(TABLES.items)
          .select('item_id, item_name')
          .in('item_id', itemIds);

        if (itemError) throw itemError;
        (itemRows || []).forEach((item) => {
          if (item?.item_id !== null && item?.item_id !== undefined) {
            itemNameMap.set(item.item_id, item.item_name || `Item #${item.item_id}`);
          }
        });
      } catch (itemError) {
        console.warn('Unable to load item names from Supabase', itemError);
      }
    }

    const map = new Map();
    (data || []).forEach((item) => {
      const orderId = item?.order_id;
      if (orderId === null || orderId === undefined) return;
      const quantity = Number(item?.qty ?? 1) || 1;
      const label = itemNameMap.get(item?.item_id) || `Item #${item?.item_id ?? '—'}`;

      const existing = map.get(orderId) || [];
      existing.push({ name: label, qty: quantity });
      map.set(orderId, existing);
    });

    return map;
  } catch (error) {
    console.warn('Unable to load order items from Supabase', error);
    return new Map();
  }
};

const refreshOrders = async () => {
  if (!supabaseClient) return;
  try {
    if (ordersTableBody) {
      ordersTableBody.innerHTML = renderPlaceholderRow(6, 'Loading orders…');
    }

    // JOIN orders -> user to get username
    const { data, error } = await supabaseClient
      .from(TABLES.orders)
      .select(`
        order_id,
        user_id,
        status,
        total,
        created_at,
        notes,
        cafe_id,
        user:user (
          user_id,
          username
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Supabase orders error:', error);
      throw error;
    }

    const itemsByOrder = await fetchOrderItems(data);

    orders = (data || []).map((row) => {
      const status = normalizeOrderStatus(row?.status);
      const total = Number(row?.total ?? 0);
      const createdAt = row?.created_at;
      const items = itemsByOrder.get(row?.order_id) || [];

      return {
        order_id: row?.order_id ?? '—',
        user_id: row?.user_id,
        user_name: row?.user?.username || '',
        cafe_id: row?.cafe_id,
        status,
        total: Number.isFinite(total) ? total : 0,
        placed_at: formatDateTime(createdAt),
        notes: row?.notes || '',
        items
      };
    });

    populateOrders();
  } catch (error) {
    console.error('Failed to load orders', error);
    orders = [];
    if (ordersTableBody) {
      ordersTableBody.innerHTML = renderPlaceholderRow(6, 'Unable to load orders from Supabase.');
    }
  }
};

const initializeFilters = () => {
  statusChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      statusChips.forEach((btn) => btn.classList.remove('active'));
      chip.classList.add('active');
      currentStatusFilter = chip.dataset.status || 'all';
      populateOrders();
    });
  });
};

const initialize = async () => {
  if (ordersTableBody) {
    ordersTableBody.innerHTML = renderPlaceholderRow(6, 'Connect to Supabase to load orders.');
  }

  initializeFilters();
  const { supabase, session } = await initializeDashboardPage('orders');

  if (!supabase) {
    if (connectionStatus) {
      connectionStatus.textContent = 'Supabase credentials missing';
    }
    return;
  }

  if (!session) {
    if (connectionStatus) {
      connectionStatus.textContent = 'Authentication required';
    }
    return;
  }

  supabaseClient = supabase;

  if (connectionStatus) {
    connectionStatus.textContent = 'Connected to Supabase';
  }

  await refreshOrders();
  showNotice('Connected to Supabase and loaded the latest orders.', 'success');
};

initialize();
