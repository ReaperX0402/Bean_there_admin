let noticeTimer = null;
const noticeBanner = document.getElementById('app-notice');

const resetNotice = () => {
  if (!noticeBanner) return;
  noticeBanner.classList.remove('is-success', 'is-warning', 'is-error');
};

export const showNotice = (message, variant = 'info', sticky = false) => {
  if (!noticeBanner) return;
  resetNotice();
  if (variant !== 'info') {
    noticeBanner.classList.add(`is-${variant}`);
  }
  noticeBanner.textContent = message;
  noticeBanner.classList.remove('hidden');

  if (!sticky) {
    if (noticeTimer) {
      window.clearTimeout(noticeTimer);
    }
    noticeTimer = window.setTimeout(() => {
      hideNotice();
    }, 5000);
  }
};

export const hideNotice = () => {
  if (!noticeBanner) return;
  noticeBanner.classList.add('hidden');
  if (noticeTimer) {
    window.clearTimeout(noticeTimer);
    noticeTimer = null;
  }
};

export const setFormLoading = (form, isLoading) => {
  if (!form) return;
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

export const renderPlaceholderRow = (colspan, message) =>
  `<tr><td colspan="${colspan}" class="table-placeholder">${message}</td></tr>`;

export const setListContent = (element, items, emptyMessage) => {
  if (!element) return;
  if (!items || items.length === 0) {
    element.innerHTML = `<li class="muted">${emptyMessage}</li>`;
    return;
  }
  element.innerHTML = items.map((item) => `<li>${item}</li>`).join('');
};

export const formatDateTime = (value) => {
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

export const formatCurrency = (amount) => {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return '—';
  return `$${numeric.toFixed(2)}`;
};

export const formatStatus = (status) =>
  status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const normalizeOrderStatus = (value) => {
  if (!value && value !== 0) return 'unknown';
  const normalized = String(value).trim().toLowerCase();
  if (['pending', 'in_progress', 'completed', 'cancelled', 'ready'].includes(normalized)) return normalized;
  if (normalized === 'in-progress') return 'in_progress';
  if (normalized === 'in transit') return 'in_progress';
  if (normalized === 'done') return 'completed';
  if (normalized === 'canceled') return 'cancelled';
  return normalized.replace(/[^a-z]+/g, '_') || 'unknown';
};

export const normalizeMenuStatus = (value) => {
  if (typeof value === 'boolean') {
    return value ? 'available' : 'out_of_stock';
  }
  if (!value && value !== 0) return 'available';
  const normalized = String(value).trim().toLowerCase();
  if (['available', 'in_stock', 'in-stock'].includes(normalized)) return 'available';
  if (['out_of_stock', 'sold_out', 'unavailable', 'out-of-stock'].includes(normalized)) return 'out_of_stock';
  return normalized.replace(/[^a-z]+/g, '_') || 'available';
};

if (noticeBanner) {
  noticeBanner.addEventListener('click', hideNotice);
}
