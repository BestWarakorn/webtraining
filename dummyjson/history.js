const API_URL='https://dummyjson.com/products';
function money(cents) { return new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(cents/100); }
const productImages = new Map();
function createOrderImage(productId, title) {
  const frame = document.createElement('div');
  frame.className = 'order-image';
  const placeholder = document.createElement('span');
  placeholder.textContent = 'กำลังโหลดรูป';
  frame.append(placeholder);
  if (!productImages.has(productId)) {
    productImages.set(productId, fetch(`${API_URL}/${productId}`, { signal: AbortSignal.timeout(10000) })
      .then(response => {
        if (!response.ok) throw new Error('Image unavailable');
        return response.json();
      })
      .then(product => {
        const url = new URL(product.thumbnail);
        if (url.protocol !== 'https:') throw new Error('Invalid image URL');
        return url.href;
      })
      .catch(() => { productImages.delete(productId); return null; }));
  }
  productImages.get(productId).then(url => {
    if (!url) { placeholder.textContent = 'ไม่มีรูปสินค้า'; return; }
    const image = document.createElement('img');
    image.alt = title;
    image.loading = 'lazy';
    image.addEventListener('error', () => { placeholder.textContent = 'ไม่มีรูปสินค้า'; frame.replaceChildren(placeholder); });
    image.src = url;
    frame.replaceChildren(image);
  });
  return frame;
}

async function api(url, options) {
  if (location.protocol === 'file:') throw new Error('กรุณาเปิดผ่าน http://localhost:3000 โดยรัน npm start ก่อน');
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'ทำรายการไม่สำเร็จ');
  return data;
}
async function loadOrders() {
  const status = document.querySelector('#history-status');
  const container = document.querySelector('#order-history');
  status.textContent = 'กำลังโหลดประวัติ...'; container.replaceChildren();
  try {
    await window.storeAuth.ready;
    if (!window.storeAuth.user) {
      status.textContent = 'กรุณาเข้าสู่ระบบเพื่อดูคำสั่งซื้อของคุณ ';
      const link = document.createElement('a'); link.href = '/account.html'; link.textContent = 'เข้าสู่ระบบ'; status.append(link); return;
    }
    const orders = await api('/api/orders');
    status.textContent = orders.length ? 'แสดงล่าสุด 20 คำสั่งซื้อ' : 'ยังไม่มีคำสั่งซื้อ';
    for (const order of orders) {
      const card = document.createElement('article'); card.className = 'history-card';
      const heading = document.createElement('h3'); heading.textContent = `คำสั่งซื้อ ${order.id}`;
      const detail = document.createElement('p'); detail.textContent = `${new Date(order.created_at).toLocaleString('th-TH')} · ${order.status} · ${money(order.total_cents)}`;
      const items = document.createElement('div'); items.className = 'order-items';
      for (const item of order.order_items) {
        const row = document.createElement('div'); row.className = 'order-item';
        const description = document.createElement('div');
        const title = document.createElement('p'); title.textContent = item.product_title;
        const subtotal = document.createElement('p'); subtotal.className = 'order-item-price';
        subtotal.textContent = `${money(item.unit_price_cents)} × ${item.quantity} = ${money(item.unit_price_cents * item.quantity)}`;
        description.append(title, subtotal);
        row.append(createOrderImage(item.product_id, item.product_title), description);
        items.append(row);
      }
      card.append(heading, detail, items); container.append(card);
    }
  } catch (error) { status.textContent = error.message; }
}
loadOrders();
