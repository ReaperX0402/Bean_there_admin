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
const addMenuItemBtn = document.getElementById('add-menu-item');
const statusChips = Array.from(document.querySelectorAll('.chip'));

let currentStatusFilter = 'all';
let editingItemIndex = null;

const orders = [
  {
    order_id: 'ORD-3021',
    customer: 'Maya Delgado',
    status: 'pending',
    total: 18.4,
    placed_at: '2024-01-19 08:42',
    items: [
      { name: 'Cappuccino', qty: 2 },
      { name: 'Almond Croissant', qty: 1 }
    ]
  },
  {
    order_id: 'ORD-3018',
    customer: 'Julien Hart',
    status: 'in_progress',
    total: 12.9,
    placed_at: '2024-01-19 08:15',
    items: [
      { name: 'Flat White', qty: 1 },
      { name: 'Berry Parfait', qty: 1 }
    ]
  },
  {
    order_id: 'ORD-3012',
    customer: 'Ivy Ramirez',
    status: 'completed',
    total: 6.5,
    placed_at: '2024-01-19 07:55',
    items: [{ name: 'Espresso', qty: 2 }]
  }
];

const menuItems = [
  {
    menu_item_id: 'MENU-001',
    name: 'Signature Latte',
    category: 'Beverages',
    price: 4.5,
    status: 'available'
  },
  {
    menu_item_id: 'MENU-019',
    name: 'Matcha Cold Brew',
    category: 'Seasonal',
    price: 5.25,
    status: 'available'
  },
  {
    menu_item_id: 'MENU-034',
    name: 'Salted Caramel Brownie',
    category: 'Pastries',
    price: 3.15,
    status: 'out_of_stock'
  }
];

const adminProfile = {
  first_name: 'Alex',
  last_name: 'Rivera',
  email: 'admin@beanthere.com',
  stores: ['Downtown Flagship', 'Seaside Pop-up', 'Airport Express'],
  recent_activity: [
    'Updated seasonal pricing in `menu_items`',
    'Approved refund for order ORD-2999',
    'Invited new manager to `staff_roles`'
  ]
};

const sectionCopy = {
  orders: {
    title: 'Orders',
    subtitle: 'Monitor live orders from the Supabase `orders` and `order_items` entities.'
  },
  menu: {
    title: 'Menu management',
    subtitle: 'Maintain the `menu_items` catalog and sync pricing across channels.'
  },
  profile: {
    title: 'Profile',
    subtitle: 'Review your admin identity from `staff` and related metadata.'
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

const showDashboard = (user) => {
  authPanel.classList.add('hidden');
  dashboard.classList.remove('hidden');
  populateOrders();
  populateMenu();
  populateProfile(user);
  updateSection('orders');
};

const populateOrders = () => {
  ordersTableBody.innerHTML = '';
  const filtered = currentStatusFilter === 'all'
    ? orders
    : orders.filter((order) => order.status === currentStatusFilter);

  filtered.forEach((order) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${order.order_id}</td>
      <td>${order.customer}</td>
      <td><span class="badge ${order.status}">${formatStatus(order.status)}</span></td>
      <td>$${order.total.toFixed(2)}</td>
      <td>${order.placed_at}</td>
      <td>${renderOrderItems(order.items)}</td>
    `;
    ordersTableBody.appendChild(tr);
  });
};

const formatStatus = (status) => {
  return status
    .replace('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const renderOrderItems = (items) => {
  return `
    <div class="order-items">
      ${items
        .map(
          (item) =>
            `<span class="order-item-chip">${item.qty}× ${item.name}</span>`
        )
        .join('')}
    </div>
  `;
};

const populateMenu = () => {
  menuTableBody.innerHTML = '';
  menuItems.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="menu-item-cell">
          <strong>${item.name}</strong>
          <div class="menu-item-meta">${item.menu_item_id}</div>
        </div>
      </td>
      <td>${item.category}</td>
      <td>$${item.price.toFixed(2)}</td>
      <td><span class="badge ${item.status}">${formatStatus(item.status)}</span></td>
      <td>
        <div class="menu-actions">
          <button class="icon-btn" data-action="edit" data-index="${index}" aria-label="Edit menu item">✎</button>
          <button class="icon-btn" data-action="delete" data-index="${index}" aria-label="Delete menu item">🗑</button>
        </div>
      </td>
    `;
    menuTableBody.appendChild(tr);
  });
};

const populateProfile = (user) => {
  const { first_name, last_name, email, stores, recent_activity } = user;
  profileName.textContent = `${first_name} ${last_name}`;
  profileEmail.textContent = email;

  profileStores.innerHTML = stores.map((store) => `<li>${store}</li>`).join('');
  profileActivity.innerHTML = recent_activity.map((item) => `<li>${item}</li>`).join('');
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

const openMenuDialog = (mode, index = null) => {
  editingItemIndex = index;
  if (!menuDialog.open) menuDialog.showModal();

  menuDialogTitle.textContent = mode === 'edit' ? 'Edit menu item' : 'Add menu item';

  if (mode === 'edit' && typeof index === 'number') {
    const item = menuItems[index];
    menuForm.itemName.value = item.name;
    menuForm.category.value = item.category;
    menuForm.price.value = item.price;
    menuForm.status.value = item.status;
  } else {
    menuForm.reset();
  }
};

const closeMenuDialog = () => {
  if (menuDialog.open) menuDialog.close();
  editingItemIndex = null;
};

const handleMenuFormSubmit = (event) => {
  event.preventDefault();
  const formData = new FormData(menuForm);
  const payload = Object.fromEntries(formData.entries());
  const price = Number(payload.price);
  if (Number.isNaN(price)) {
    alert('Price must be a valid number.');
    return;
  }

  const normalized = {
    menu_item_id: editingItemIndex === null ? `MENU-${Date.now()}` : menuItems[editingItemIndex].menu_item_id,
    name: payload.itemName,
    category: payload.category,
    price,
    status: payload.status
  };

  if (editingItemIndex === null) {
    menuItems.unshift(normalized);
  } else {
    menuItems[editingItemIndex] = normalized;
  }

  populateMenu();
  closeMenuDialog();
};

const handleMenuAction = (event) => {
  const action = event.target.dataset.action;
  if (!action) return;

  const index = Number(event.target.dataset.index);
  if (Number.isNaN(index)) return;

  if (action === 'edit') {
    openMenuDialog('edit', index);
  }

  if (action === 'delete') {
    const shouldDelete = confirm('Remove this menu item?');
    if (shouldDelete) {
      menuItems.splice(index, 1);
      populateMenu();
    }
  }
};

Array.from(document.querySelectorAll('.auth-switch .link-btn')).forEach((btn) => {
  btn.addEventListener('click', (event) => switchAuthCard(event.currentTarget.dataset.target));
});

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const email = formData.get('email');
  const password = formData.get('password');

  if (!email || !password) {
    alert('Please fill in both email and password.');
    return;
  }

  showDashboard(adminProfile);
});

signupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');

  if (password !== confirmPassword) {
    alert('Passwords do not match.');
    return;
  }

  const user = {
    first_name: formData.get('firstName'),
    last_name: formData.get('lastName'),
    email: formData.get('email'),
    stores: adminProfile.stores,
    recent_activity: ['Created admin account', ...adminProfile.recent_activity]
  };

  showDashboard(user);
});

logoutBtn.addEventListener('click', () => {
  dashboard.classList.add('hidden');
  authPanel.classList.remove('hidden');
  loginForm.reset();
  signupForm.reset();
  switchAuthCard('login');
});

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => updateSection(btn.dataset.section));
});

addMenuItemBtn.addEventListener('click', () => openMenuDialog('create'));

menuTableBody.addEventListener('click', handleMenuAction);

menuForm.addEventListener('submit', handleMenuFormSubmit);
menuDialog.addEventListener('close', closeMenuDialog);

statusChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    statusChips.forEach((btn) => btn.classList.remove('active'));
    chip.classList.add('active');
    const status = chip.dataset.status;
    currentStatusFilter = status ?? 'all';
    populateOrders();
  });
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMenuDialog();
  }
});

populateOrders();
populateMenu();
populateProfile(adminProfile);
