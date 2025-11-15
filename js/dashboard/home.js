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

const TABLES = {
  orders: htmlRoot.dataset.tableOrders || 'orders',
  orderItems: htmlRoot.dataset.tableOrderItems || 'order_items'
};

let supabaseClient = null;
let orders = [];
let currentStatusFilter = 'all';

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

const detectColumn = (keys, candidates, fallback) => {
  for (const candidate of candidates) {
    if (keys.has(candidate)) return candidate;
  }
  return fallback;
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
          <td>${order.customer}</td>
          <td><span class="badge ${order.status}">${formatStatus(order.status)}</span></td>
          <td>${formatCurrency(order.total)}</td>
          <td>${order.placed_at}</td>
          <td>${renderOrderItems(order.items)}</td>
        </tr>
      `
    )
    .join('');

  ordersTableBody.innerHTML = rows;
};

const fetchOrderItems = async (orderRows) => {
  if (!supabaseClient || !orderRows?.length) return new Map();

  const idKey = orderColumnMap.id || 'id';
  const orderIds = orderRows
    .map((row) => row?.[idKey])
    .filter((value) => value !== null && value !== undefined);

  if (!orderIds.length) return new Map();

  try {
    const { data, error } = await supabaseClient
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
  if (!supabaseClient) return;
  try {
    ordersTableBody.innerHTML = renderPlaceholderRow(6, 'Loading orders…');
    const { data, error } = await supabaseClient
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
