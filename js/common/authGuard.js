(() => {
  const root = document.documentElement;
  if (!root || root.dataset.authGuard !== 'required') {
    return;
  }

  const redirectToLogin = () => {
    window.location.replace('login.html');
  };

  try {
    const storedSession = window.sessionStorage.getItem('bt-admin-session');
    if (!storedSession) {
      redirectToLogin();
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(storedSession);
    } catch (error) {
      redirectToLogin();
      return;
    }

    if (!parsed?.admin?.admin_id) {
      redirectToLogin();
      return;
    }

    root.dataset.authGuard = 'authenticated';
  } catch (error) {
    redirectToLogin();
  }
})();
