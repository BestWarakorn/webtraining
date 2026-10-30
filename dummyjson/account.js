let mode = 'login';
const status = document.querySelector('#auth-status');
function setMode(next) {
  mode = next; status.textContent = '';
  document.querySelector('#name-field').hidden = mode !== 'signup';
  document.querySelector('#name').required = mode === 'signup';
  document.querySelector('#password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  document.querySelector('#auth-submit').textContent = mode === 'signup' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
  document.querySelector('#login-tab').setAttribute('aria-pressed', mode === 'login');
  document.querySelector('#signup-tab').setAttribute('aria-pressed', mode === 'signup');
}
async function showAccount() {
  const user = await window.storeAuth.refresh();
  document.querySelector('#signed-in').hidden = !user;
  document.querySelector('#auth-forms').hidden = !!user;
  if (user) document.querySelector('#user-detail').textContent = `${user.name || ''} · ${user.email}`;
}
document.querySelector('#login-tab').addEventListener('click', () => setMode('login'));
document.querySelector('#signup-tab').addEventListener('click', () => setMode('signup'));
document.querySelector('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.querySelector('#auth-submit'); button.disabled = true;
  status.textContent = 'กำลังดำเนินการ...';
  try {
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = await window.storeAuth.request(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(values) });
    document.querySelector('#password').value = '';
    status.textContent = result.message;
    if (result.user) await showAccount();
    else setMode('login'), status.textContent = result.message;
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
// ไม่เก็บ token ที่อาจแนบมากับลิงก์ยืนยันอีเมลใน URL
if (location.hash) history.replaceState(null, '', location.pathname);
showAccount().catch(error => { status.textContent = error.message; });
