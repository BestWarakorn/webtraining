// เปลี่ยน URL และจำนวนสินค้าต่อหน้าได้ที่นี่
const API_URL = 'https://dummyjson.com/products';
const PAGE_SIZE = 9;
const productsElement = document.querySelector('#products');
const statusElement = document.querySelector('#status');
const countElement = document.querySelector('#result-count');
const pageElement = document.querySelector('#page-info');
const previousButton = document.querySelector('#previous');
const nextButton = document.querySelector('#next');
const retryButton = document.querySelector('#retry');
const searchInput = document.querySelector('#search');
let currentPage = 1;
let searchQuery = '';
const categoryFilter = document.querySelector('#category-filter');
const sortOrder = document.querySelector('#sort-order');
let catalogRequest;
let catalogVersion = 0;

// กรองและเรียงทั้งชุดก่อนแบ่งหน้า เพื่อให้ลำดับถูกต้องข้ามหน้า
function selectProducts(products, query, category, sort) {
  const keyword = query.trim().toLocaleLowerCase();
  const selected = products.filter(product =>
    (!category || product.category === category) &&
    (!keyword || [product.title, product.description, product.brand].some(value => String(value || '').toLocaleLowerCase().includes(keyword)))
  );
  const [field, direction] = sort.split('-');
  if (['price', 'rating', 'title'].includes(field)) {
    selected.sort((a, b) => {
      const comparison = field === 'title' ? a.title.localeCompare(b.title, 'en', { sensitivity: 'base', numeric: true }) : a[field] - b[field];
      return (direction === 'desc' ? -comparison : comparison) || a.id - b.id;
    });
  }
  return selected;
}

async function getCatalog() {
  if (!catalogRequest) {
    // โหลดเฉพาะข้อมูลที่ใช้แสดง แล้วเก็บไว้ระหว่างเปิดหน้านี้
    catalogRequest = fetch(`${API_URL}?limit=0&select=title,description,brand,category,price,rating,thumbnail`, { signal: AbortSignal.timeout(15000) })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.products)) throw new Error('Invalid product data');
        const categories = [...new Set(data.products.map(product => product.category))].sort();
        categoryFilter.replaceChildren(new Option('ทุกหมวดหมู่', ''), ...categories.map(category => new Option(category.replaceAll('-', ' '), category)));
        categoryFilter.disabled = false;
        return data.products;
      })
      .catch(error => { catalogRequest = null; throw error; });
  }
  return catalogRequest;
}

// ใช้ textContent เพื่อแสดงข้อความจาก API อย่างปลอดภัย
function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product';
  const image = document.createElement('img');
  image.src = product.thumbnail;
  image.alt = product.title;
  image.loading = 'lazy';
  const content = document.createElement('div');
  content.className = 'product-content';
  const category = document.createElement('span');
  category.className = 'category';
  category.textContent = product.category;
  const title = document.createElement('h3');
  title.textContent = product.title;
  const description = document.createElement('p');
  description.className = 'description';
  description.textContent = product.description;
  const meta = document.createElement('div');
  meta.className = 'product-meta';
  const price = document.createElement('span');
  price.className = 'price';
  price.textContent = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD'
  }).format(product.price);
  const rating = document.createElement('span');
  rating.className = 'rating';
  rating.textContent = `★ ${product.rating} / 5`;
  meta.append(price, rating);
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.textContent = 'เพิ่มลงตะกร้า';
  addButton.addEventListener('click', () => addToCart(product));
  content.append(category, title, description, meta, addButton);
  card.append(image, content);
  return card;
}

async function loadProducts() {
  const version = ++catalogVersion;
  statusElement.textContent = 'กำลังโหลดสินค้า...';
  productsElement.setAttribute('aria-busy', 'true');
  productsElement.replaceChildren();
  countElement.textContent = '';
  retryButton.hidden = true;
  previousButton.disabled = true;
  nextButton.disabled = true;
  pageElement.textContent = `หน้า ${currentPage}`;

  try {
    const catalog = await getCatalog();
    if (version !== catalogVersion) return;
    const selected = selectProducts(catalog, searchQuery, categoryFilter.value, sortOrder.value);
    const total = selected.length;
    currentPage = Math.max(1, Math.min(currentPage, Math.ceil(total / PAGE_SIZE) || 1));
    const data = { total, products: selected.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) };
    document.querySelector('.results-bar h2').textContent = categoryFilter.value ? categoryFilter.selectedOptions[0].textContent : 'สินค้าทั้งหมด';
    const cards = data.products.map(createProductCard);
    productsElement.replaceChildren(...cards);
    countElement.textContent = `${data.total} รายการ`;
    statusElement.textContent = data.products.length ? '' : 'ไม่พบสินค้า ลองค้นหาด้วยคำอื่น';
    pageElement.textContent = `หน้า ${currentPage} / ${Math.max(1, Math.ceil(data.total / PAGE_SIZE))}`;
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage * PAGE_SIZE >= data.total;
  } catch (error) {
    if (version !== catalogVersion) return;
    statusElement.textContent = 'โหลดสินค้าไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง';
    retryButton.hidden = false;
    console.error('โหลดสินค้าไม่สำเร็จ:', error);
  } finally {
    if (version === catalogVersion) productsElement.setAttribute('aria-busy', 'false');
  }
}

document.querySelector('#search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  searchQuery = searchInput.value.trim();
  currentPage = 1;
  loadProducts();
});
previousButton.addEventListener('click', () => {
  if (currentPage > 1) { currentPage--; loadProducts(); }
});
nextButton.addEventListener('click', () => { currentPage++; loadProducts(); });
retryButton.addEventListener('click', loadProducts);
for (const control of [categoryFilter, sortOrder]) {
  control.addEventListener('change', () => {
    searchQuery = searchInput.value.trim();
    currentPage = 1;
    loadProducts();
  });
}
document.querySelector('#reset-filters').addEventListener('click', () => {
  searchInput.value = ''; searchQuery = ''; categoryFilter.value = ''; sortOrder.value = 'default';
  currentPage = 1; loadProducts();
});

// เก็บเฉพาะตะกร้าบนเบราว์เซอร์ ข้อมูลผู้รับถูกส่งไป Backend เมื่อยืนยันเท่านั้น
const CART_KEY = 'dummyjson-cart-v1';
let cart = [];
try {
  const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  if (Array.isArray(saved)) cart = saved.filter(item => Number.isInteger(item.product_id) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99 && Number.isFinite(item.price) && typeof item.title === 'string').slice(0, 30);
} catch { /* เริ่มตะกร้าว่างเมื่อข้อมูลเดิมเสีย */ }
let submitting = false;
let requestId = sessionStorage.getItem('order-request-id') || crypto.randomUUID();
function money(cents) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100); }
function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* ยังใช้งานในหน้านี้ได้ */ }
  requestId = crypto.randomUUID();
  sessionStorage.setItem('order-request-id', requestId);
  renderCart();
}
function addToCart(product) {
  if (submitting) return;
  const item = cart.find(item => item.product_id === product.id);
  if (item) item.quantity = Math.min(99, item.quantity + 1);
  else if (cart.length < 30) cart.push({ product_id: product.id, title: product.title, price: product.price, quantity: 1 });
  saveCart();
}
// แคชคำขอรูปตามรหัสสินค้า เพื่อไม่เรียก API ซ้ำเมื่อปรับจำนวนหรือโหลดประวัติ
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

function renderCart() {
  document.querySelector('#cart-count').textContent = cart.reduce((sum,item)=>sum+item.quantity,0);
  const container = document.querySelector('#cart-items');
  container.replaceChildren();
  if (!cart.length) container.textContent = 'ยังไม่มีสินค้าในตะกร้า';
  for (const item of cart) {
    const row = document.createElement('div'); row.className = 'cart-row';
    const name = document.createElement('span'); name.textContent = `${item.title} · ${money(Math.round(item.price * 100))}`;
    const quantity = document.createElement('input'); quantity.type = 'number'; quantity.min = '1'; quantity.max = '99'; quantity.value = item.quantity;
    quantity.setAttribute('aria-label', `จำนวน ${item.title}`); quantity.disabled = submitting;
    quantity.addEventListener('change', () => {
      const value = Number(quantity.value);
      if (Number.isInteger(value) && value >= 1 && value <= 99) { item.quantity = value; saveCart(); }
      else quantity.value = item.quantity;
    });
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'ลบ'; remove.disabled = submitting;
    remove.addEventListener('click', () => { cart = cart.filter(entry => entry !== item); saveCart(); });
    row.append(createOrderImage(item.product_id, item.title), name, quantity, remove); container.append(row);
  }
  document.querySelector('#cart-total').textContent = `ยอดรวมประมาณ ${money(cart.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0))} (ยืนยันราคาจาก API อีกครั้งเมื่อสั่งซื้อ)`;
  document.querySelector('#place-order').disabled = submitting || !cart.length;
}
async function api(url, options) {
  if (location.protocol === 'file:') throw new Error('กรุณาเปิดผ่าน http://localhost:3000 โดยรัน npm start ก่อน');
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'ทำรายการไม่สำเร็จ');
  return data;
}
document.querySelector('#checkout-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || !cart.length) return;
  await window.storeAuth.ready;
  if (!window.storeAuth.user) {
    const status = document.querySelector('#order-status');
    status.textContent = 'กรุณาเข้าสู่ระบบก่อนสั่งซื้อ ';
    const link = document.createElement('a'); link.href = '/account.html'; link.textContent = 'เข้าสู่ระบบ / สมัครสมาชิก'; status.append(link); return;
  }
  submitting = true; renderCart();
  const status = document.querySelector('#order-status'); status.textContent = 'กำลังบันทึกคำสั่งซื้อ...';
  const customer = Object.fromEntries(new FormData(event.currentTarget));
  try {
    sessionStorage.setItem('order-request-id', requestId);
    const order = await api('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...customer, request_id: requestId, items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity })) }) });
    status.textContent = `สั่งซื้อสำเร็จ รหัส ${order.id} · ยอดรวม ${money(order.total_cents)} · รอดำเนินการ (ชำระเงินจำลอง)`;
    cart = []; saveCart(); document.querySelector('#checkout-form').reset();
  } catch (error) { status.textContent = error.message; }
  finally { submitting = false; renderCart(); }
});

renderCart();
loadProducts();
