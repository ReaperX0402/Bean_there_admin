(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const root = document.documentElement;
  if (!root || root.dataset.authGuard !== 'required') return;

  const isLoginPage = /\/login\.html?$/.test(window.location.pathname || '');
  const loginUrl = new URL('login.html', window.location.href).toString();

  const getStore = () => {
    try { window.sessionStorage.setItem('__t','1'); window.sessionStorage.removeItem('__t'); return window.sessionStorage; } catch {}
    try { window.localStorage.setItem('__t','1'); window.localStorage.removeItem('__t'); return window.localStorage; } catch {}
    return null;
  };

  const redirectToLogin = () => {
    if (!isLoginPage) window.location.replace(loginUrl);
  };

  try {
    const store = getStore();
    if (!store) return redirectToLogin();

    const raw = store.getItem('bt-admin-session');
    if (!raw) return redirectToLogin();

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { return redirectToLogin(); }

    const adminId = parsed?.admin?.id ?? parsed?.admin?.admin_id ?? null;
    if (!adminId || typeof adminId !== 'string' || adminId.trim().length === 0) {
      return redirectToLogin();
    }

    root.dataset.authGuard = 'authenticated';
  } catch {
    return redirectToLogin();
  }
})();
