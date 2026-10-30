window.storeAuth = {
  user: null,
  async request(url, options = {}) {
    if (location.protocol === 'file:') throw new Error('กรุณาเปิด http://localhost:3000/account.html เพื่อสมัครสมาชิก');
    const response = await fetch(url, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'ทำรายการไม่สำเร็จ');
    return data;
  },
  async refresh() {
    const data = await this.request('/api/auth/me');
    this.user = data.user;
    const account = document.querySelector('#account-link');
    if (account) account.textContent = this.user ? `บัญชี: ${this.user.name || this.user.email}` : 'เข้าสู่ระบบ / สมัครสมาชิก';
    document.querySelector('#logout')?.toggleAttribute('hidden', !this.user);
    return this.user;
  }
};
window.storeAuth.ready = window.storeAuth.refresh().catch(() => null);
document.querySelector('#logout')?.addEventListener('click', async () => {
  const button = document.querySelector('#logout'); button.disabled = true;
  try { await window.storeAuth.request('/api/auth/logout', { method: 'POST' }); location.href = '/account.html'; }
  catch (error) { button.disabled = false; const status = document.querySelector('#auth-nav-status'); if (status) status.textContent = error.message; }
});
