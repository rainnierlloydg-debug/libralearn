function getThemeRole(role) {
  return role === 'librarian' ? 'admin' : role;
}

export function getThemePreference(role) {
  return localStorage.getItem(`${getThemeRole(role)}-theme`) || 'light';
}

export function setShellTheme(role, preference) {
  const isDark = preference === 'dark'
    || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const shell = document.querySelector(`.${getThemeRole(role)}-shell`);

  shell?.setAttribute('data-theme', isDark ? 'dark' : 'light');
}