import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
const root = path.dirname(fileURLToPath(import.meta.url));
try { loadEnvFile(path.join(root, '.env')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const port = Number(process.env.PORT || 3000);
const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const publicFiles = { '/theme.js': ['theme.js','text/javascript'], '/account.html': ['account.html','text/html'], '/account.js': ['account.js','text/javascript'], '/auth.js': ['auth.js','text/javascript'], '/history.html': ['history.html','text/html'], '/history.js': ['history.js','text/javascript'], '/': ['index.html','text/html'], '/index.html': ['index.html','text/html'], '/style.css': ['style.css','text/css'], '/script.js': ['script.js','text/javascript'] };
function fail(message, status = 400) { return Object.assign(new Error(message), { status }); }
async function database(endpoint, options = {}) {
  if (!base || !key || key === 'ใส่-secret-key-ที่นี่') throw fail('กรุณาตั้งค่า SUPABASE_URL และ SUPABASE_SECRET_KEY ใน .env แล้วเริ่มเซิร์ฟเวอร์ใหม่', 503);
  const response = await fetch(`${base}/rest/v1/${endpoint}`, {
    ...options, headers: { apikey: key, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw fail('ติดต่อฐานข้อมูลไม่สำเร็จ ตรวจสอบคีย์และรัน schema.sql ใน Supabase ก่อน', 502);
  return response.json();
}
// Supabase จัดการรหัสผ่าน ส่วนเว็บเก็บ session ใน HttpOnly cookies
async function authRequest(endpoint, options = {}, token) {
  if (!base || !key) throw fail('ยังไม่ได้ตั้งค่า Supabase ใน .env', 503);
  const response = await fetch(`${base}/auth/v1/${endpoint}`, {
    ...options, headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const code = data.error_code || data.code;
    const messages = {
      email_address_not_authorized: 'Supabase ยังส่งอีเมลยืนยันไปยังอีเมลนี้ไม่ได้: หากใช้ระบบส่งอีเมลเริ่มต้น ให้ทดลองด้วยอีเมลสมาชิกทีม Supabase หรือตั้งค่า Custom SMTP',
      over_email_send_rate_limit: 'ส่งอีเมลยืนยันถึงขีดจำกัดแล้ว กรุณารอแล้วลองใหม่ หรือตั้งค่า Custom SMTP',
      email_address_invalid: 'รูปแบบอีเมลไม่ถูกต้อง หรือโดเมนอีเมลนี้ใช้สมัครไม่ได้',
      signup_disabled: 'โปรเจกต์ Supabase ปิดการสมัครสมาชิกอยู่',
      email_provider_disabled: 'โปรเจกต์ Supabase ยังไม่เปิด Email provider',
      weak_password: 'รหัสผ่านไม่ผ่านนโยบาย Supabase กรุณาเพิ่มความยาวและใช้ตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก ตัวเลข และสัญลักษณ์',
      email_not_confirmed: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ',
      captcha_failed: 'โปรเจกต์เปิด CAPTCHA แต่หน้าเว็บยังไม่ได้ตั้งค่า CAPTCHA',
      unexpected_failure: 'Supabase Auth ทำงานไม่สำเร็จ กรุณาตรวจ Authentication Logs ใน Supabase',
      user_already_exists: 'สมัครสมาชิกไม่สำเร็จ หากเคยสมัครแล้วให้ลองเข้าสู่ระบบ'
    };
    if (messages[code]) throw fail(messages[code], code === 'email_not_confirmed' ? 401 : response.status === 429 ? 429 : 400);
    if (response.status === 429) throw fail('ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่', 429);
    if (endpoint.startsWith('signup')) throw fail(`สมัครสมาชิกไม่สำเร็จ (HTTP ${response.status}${/^[a-z_]+$/.test(code || '') ? ', ' + code : ''}) กรุณาตรวจ Authentication Logs ใน Supabase`, 400);
    throw fail('อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือเซสชันหมดอายุ', 401);
  }
  return data;
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(part => part.trim().split(/=(.*)/s)).filter(parts => parts[0]).map(([name,value]) => [name,value]));
}
function saveSession(res, session) {
  const options = '; HttpOnly; SameSite=Lax; Path=/';
  res.setHeader('Set-Cookie', [
    `store_access=${session.access_token}${options}; Max-Age=${session.expires_in || 3600}`,
    `store_refresh=${session.refresh_token}${options}; Max-Age=604800`
  ]);
}
function clearSession(res) {
  res.setHeader('Set-Cookie', ['store_access=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0', 'store_refresh=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0']);
}
async function currentUser(req, res) {
  const session = cookies(req);
  let user;
  if (session.store_access) {
    try { user = await authRequest('user', {}, session.store_access); }
    catch (error) { if (error.status !== 401) throw error; }
  }
  if (!user && session.store_refresh) {
    try {
      const refreshed = await authRequest('token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.store_refresh }) });
      saveSession(res, refreshed); user = refreshed.user;
    } catch (error) { clearSession(res); throw error; }
  }
  if (!user?.id) throw fail('กรุณาเข้าสู่ระบบก่อนสั่งซื้อหรือดูประวัติ', 401);
  return user;
}
async function readInput(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw fail('Expected JSON', 415);
  let body = '';
  for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 20000) throw fail('ข้อมูลมากเกินไป', 413); }
  try { const value = JSON.parse(body); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; }
  catch { throw fail('ข้อมูล JSON ไม่ถูกต้อง'); }
}
function publicUser(user) { return { id: user.id, email: user.email, name: user.user_metadata?.name || '' }; }
const server = http.createServer(async (req, res) => {
  const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  try {
    if (![`localhost:${port}`, `127.0.0.1:${port}`].includes(req.headers.host)) return json(403, { error: 'Invalid host' });
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === 'POST' && ![`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(req.headers.origin)) throw fail('กรุณาทำรายการผ่านหน้าเว็บ localhost', 403);
    if (url.pathname === '/api/auth/me' && req.method === 'GET') {
      try { return json(200, { user: publicUser(await currentUser(req, res)) }); }
      catch (error) { if (error.status === 401) return json(200, { user: null }); throw error; }
    }
    if (['/api/auth/signup','/api/auth/login'].includes(url.pathname) && req.method === 'POST') {
      const input = await readInput(req);
      if (typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) || typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) throw fail('กรอกอีเมลให้ถูกต้อง และรหัสผ่าน 8–128 ตัวอักษร');
      const signup = url.pathname.endsWith('signup');
      if (signup && (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100)) throw fail('กรุณากรอกชื่อไม่เกิน 100 ตัวอักษร');
      const session = await authRequest(signup ? `signup?redirect_to=${encodeURIComponent(`http://localhost:${port}/account.html`)}` : 'token?grant_type=password', {
        method: 'POST', body: JSON.stringify({ email: input.email.trim(), password: input.password, ...(signup ? { data: { name: input.name.trim() } } : {}) })
      });
      if (session.access_token) saveSession(res, session);
      return json(200, { user: session.access_token ? publicUser(session.user) : null, message: session.access_token ? 'เข้าสู่ระบบสำเร็จ' : 'หากอีเมลนี้สมัครได้ กรุณาตรวจกล่องอีเมลเพื่อยืนยัน แล้วกลับมาเข้าสู่ระบบ' });
    }
    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = cookies(req).store_access;
      if (token) {
        try { await authRequest('logout?scope=local', { method: 'POST' }, token); }
        catch (error) { if (error.status !== 401) throw error; }
      }
      clearSession(res); return json(200, { message: 'ออกจากระบบแล้ว' });
    }
    if (url.pathname === '/api/orders' && req.method === 'POST') {
      const user = await currentUser(req, res);
      if (![`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(req.headers.origin)) throw fail('กรุณาสั่งซื้อผ่านหน้าเว็บ localhost', 403);
      const input = await readInput(req);
      const customer = {};
      for (const [field, limit] of Object.entries({ customer_name: 100, phone: 30, address: 1000 })) {
        if (typeof input[field] !== 'string' || !input[field].trim() || input[field].length > limit) throw fail('กรุณากรอกชื่อ เบอร์โทร และที่อยู่ให้ครบ');
        customer[field] = input[field].trim();
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.request_id || '')) throw fail('รหัสคำขอไม่ถูกต้อง');
      if (!Array.isArray(input.items) || !input.items.length || input.items.length > 30) throw fail('ตะกร้าต้องมีสินค้า 1–30 รายการ');
      const ids = new Set();
      for (const item of input.items) {
        if (!Number.isSafeInteger(item.product_id) || item.product_id < 1 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 || ids.has(item.product_id)) throw fail('จำนวนหรือรหัสสินค้าไม่ถูกต้อง');
        ids.add(item.product_id);
      }
      // อ่านราคาจริงจากต้นทาง ไม่รับราคาหรือยอดรวมจากเบราว์เซอร์
      const items = await Promise.all(input.items.map(async item => {
        const response = await fetch(`https://dummyjson.com/products/${item.product_id}`, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw fail('ไม่พบสินค้า หรือบริการสินค้ายังไม่พร้อม', 502);
        const product = await response.json();
        const cents = Math.round(product.price * 100);
        if (!Number.isSafeInteger(cents) || cents < 0) throw fail('ราคาสินค้าไม่ถูกต้อง', 502);
        return { product_id: item.product_id, quantity: item.quantity, product_title: product.title, unit_price_cents: cents };
      }));
      const order = await database('rpc/place_user_order', { method: 'POST', body: JSON.stringify({ p_user_id: user.id, p_request_id: input.request_id, p_customer: customer, p_items: items }) });
      return json(201, order);
    }
    if (url.pathname === '/api/orders' && req.method === 'GET') {
      const user = await currentUser(req, res);
      const orders = await database(`orders?user_id=eq.${encodeURIComponent(user.id)}&select=id,total_cents,currency,status,created_at,order_items(product_id,product_title,quantity,unit_price_cents)&order=created_at.desc&limit=20`);
      return json(200, orders);
    }
    const file = publicFiles[url.pathname];
    if (req.method !== 'GET' || !file) return json(404, { error: 'Not found' });
    const content = await readFile(path.join(root, file[0]));
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' }); res.end(content);
  } catch (e) { json(e.status || 502, { error: e.status ? e.message : 'เชื่อมต่อบริการไม่สำเร็จ กรุณาลองอีกครั้ง' }); }
});
server.listen(port, '127.0.0.1', () => console.log(`เปิดเว็บที่ http://localhost:${port} (สำหรับทดลองบนเครื่องนี้)`));
