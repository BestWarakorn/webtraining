(() => {
  const storageKey = 'dummyjson-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let saved;
  try { saved = localStorage.getItem(storageKey); } catch { /* ใช้โหมดระบบเมื่อบันทึกไม่ได้ */ }
  let explicit = saved === 'light' || saved === 'dark';
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    const button = document.querySelector('#theme-toggle');
    if (button) {
      const dark = theme === 'dark';
      button.textContent = dark ? '☀ Light mode' : '☾ Dark mode';
      button.setAttribute('aria-label', dark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด');
      button.setAttribute('aria-pressed', String(dark));
    }
  }
  apply(explicit ? saved : system.matches ? 'dark' : 'light');
  document.addEventListener('DOMContentLoaded', () => {
    apply(document.documentElement.dataset.theme);
    document.querySelector('#theme-toggle')?.addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      explicit = true; apply(theme);
      try { localStorage.setItem(storageKey, theme); } catch { /* สลับโหมดได้แม้พื้นที่จัดเก็บถูกปิด */ }
    });
  });
  system.addEventListener('change', event => { if (!explicit) apply(event.matches ? 'dark' : 'light'); });
  window.addEventListener('storage', event => {
    if (event.key !== storageKey) return;
    explicit = event.newValue === 'light' || event.newValue === 'dark';
    apply(explicit ? event.newValue : system.matches ? 'dark' : 'light');
  });
})();
