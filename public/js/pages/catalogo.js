import { api } from '../api.js';
import * as Cart from '../cart.js';
import { CATEGORIA_ICONOS, MAX_QTY } from '../config.js';
import { initPage, toast, formatMoney, escapeHTML, resolveImg, imgFallbackAttr, categoriaIcon, debounce, bump, openCart } from '../ui.js';

initPage({ active: 'menu' });

const $ = (sel) => document.querySelector(sel);
const els = {
  grid: $('#product-grid'),
  filters: $('#category-filters'),
  empty: $('#catalog-empty'),
  error: $('#catalog-error'),
  errorMsg: $('#catalog-error-msg'),
  retry: $('#btn-retry'),
  search: $('#search-input'),
  searchForm: $('#hero-search-form'),
  sort: $('#sort-select'),
  count: $('#catalog-count'),
  title: $('#catalog-title'),
  clear: $('#btn-clear-filters'),
  stat: $('#stat-platillos'),
};

const state = {
  productos: [],
  categoria: new URLSearchParams(location.search).get('categoria') || 'Todos',
  q: '',
  sort: 'destacados',
};

/* ---------------- Render ---------------- */

function renderSkeleton() {
  els.grid.innerHTML = Array.from({ length: 8 }, () => `
    <div class="overflow-hidden rounded-3xl bg-white ring-1 ring-black/5">
      <div class="skeleton aspect-[4/3]"></div>
      <div class="space-y-3 p-5">
        <div class="skeleton h-4 w-2/3 rounded-full"></div>
        <div class="skeleton h-3 w-full rounded-full"></div>
        <div class="skeleton h-3 w-1/2 rounded-full"></div>
        <div class="flex items-center justify-between pt-2"><div class="skeleton h-6 w-16 rounded-full"></div><div class="skeleton h-10 w-24 rounded-xl"></div></div>
      </div>
    </div>`).join('');
}

function renderFilters() {
  const counts = state.productos.reduce((acc, p) => ((acc[p.categoria] = (acc[p.categoria] ?? 0) + 1), acc), {});
  const cats = ['Todos', ...Object.keys(CATEGORIA_ICONOS).filter((c) => counts[c])];
  els.filters.innerHTML = cats.map((c) => `
    <button type="button" class="chip flex shrink-0 items-center gap-2 rounded-2xl border border-ink-100 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 transition hover:border-ink-200 hover:bg-cream"
      data-categoria="${escapeHTML(c)}" aria-pressed="${c === state.categoria}">
      <span class="text-base">${c === 'Todos' ? '✨' : categoriaIcon(c)}</span>${escapeHTML(c)}
      <span class="rounded-lg bg-black/5 px-1.5 text-xs">${c === 'Todos' ? state.productos.length : counts[c]}</span>
    </button>`).join('');
}

function actionButton(p) {
  const qty = Cart.getQty(p._id);
  if (qty === 0) {
    return `<button type="button" class="btn btn-brand flex items-center gap-1.5 px-3.5 py-2 text-sm" data-action="add" data-id="${p._id}" aria-label="Agregar ${escapeHTML(p.nombre)} al carrito">
      <i class="bi bi-plus-lg"></i>Agregar</button>`;
  }
  return `<div class="flex items-center gap-1 rounded-xl bg-ink-900 p-1 text-white" role="group" aria-label="Cantidad de ${escapeHTML(p.nombre)}">
      <button type="button" class="grid h-8 w-8 place-items-center rounded-lg bg-transparent text-white hover:bg-white/10" data-action="dec" data-id="${p._id}" aria-label="Quitar uno"><i class="bi bi-dash"></i></button>
      <span class="w-6 text-center text-sm font-bold" data-qty>${qty}</span>
      <button type="button" class="grid h-8 w-8 place-items-center rounded-lg bg-transparent text-white hover:bg-white/10" data-action="inc" data-id="${p._id}" aria-label="Agregar uno"><i class="bi bi-plus"></i></button>
    </div>`;
}

function card(p, index) {
  return `
    <article class="product-card group flex flex-col overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-lift animate-fade-up" style="animation-delay:${Math.min(index, 12) * 40}ms" data-card="${p._id}">
      <button type="button" class="relative block aspect-[4/3] overflow-hidden bg-cream p-0 text-start" data-action="detail" data-id="${p._id}" aria-label="Ver detalle de ${escapeHTML(p.nombre)}">
        <img src="${escapeHTML(resolveImg(p.imagen))}" ${imgFallbackAttr} alt="${escapeHTML(p.nombre)}" loading="lazy" class="h-full w-full object-cover">
        <span class="badge glass absolute left-3 top-3 rounded-pill px-2.5 py-1.5 text-ink-800">${categoriaIcon(p.categoria)} ${escapeHTML(p.categoria)}</span>
        ${p.destacado ? '<span class="badge absolute right-3 top-3 rounded-pill bg-brand-gradient px-2.5 py-1.5 shadow-glow"><i class="bi bi-fire me-1"></i>Popular</span>' : ''}
      </button>
      <div class="flex flex-1 flex-col p-5">
        <h3 class="font-display text-lg font-bold leading-snug text-ink-900 mb-1">${escapeHTML(p.nombre)}</h3>
        <p class="line-clamp-2 text-sm text-ink-400 mb-4">${escapeHTML(p.descripcion)}</p>
        <div class="mt-auto flex items-center justify-between gap-3">
          <span class="font-display text-xl font-extrabold text-ink-900">${formatMoney(p.precio)}</span>
          <div data-actions="${p._id}">${actionButton(p)}</div>
        </div>
      </div>
    </article>`;
}

function filtered() {
  const q = state.q.toLowerCase();
  const list = state.productos.filter(
    (p) =>
      (state.categoria === 'Todos' || p.categoria === state.categoria) &&
      (!q || p.nombre.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)),
  );
  const sorters = {
    destacados: (a, b) => Number(b.destacado) - Number(a.destacado),
    'precio-asc': (a, b) => a.precio - b.precio,
    'precio-desc': (a, b) => b.precio - a.precio,
    nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
  };
  return list.sort(sorters[state.sort]);
}

function renderGrid() {
  const list = filtered();
  els.grid.innerHTML = list.map(card).join('');
  els.empty.hidden = list.length > 0;
  els.count.textContent = `(${list.length})`;
  els.title.textContent = state.categoria === 'Todos' ? (state.q ? `Resultados para “${state.q}”` : 'Todo el menú') : state.categoria;
  els.clear.hidden = state.categoria === 'Todos' && !state.q;
}

function refreshCardActions(id) {
  const slot = els.grid.querySelector(`[data-actions="${id}"]`);
  const p = state.productos.find((x) => x._id === id);
  if (slot && p) slot.innerHTML = actionButton(p);
}

/* ---------------- Datos ---------------- */

async function load() {
  els.error.hidden = true;
  renderSkeleton();
  try {
    const [{ data }] = await Promise.all([api.productos.list(), api.config.load()]);
    state.productos = data;
    els.stat.textContent = `${data.length}+`;

    const { removed, priceChanged } = Cart.syncWithCatalog(data);
    if (removed.length) toast(`Se quitaron del carrito: ${removed.join(', ')} (ya no disponibles).`, 'warning', 6000);
    if (priceChanged.length) toast(`Se actualizó el precio de: ${priceChanged.join(', ')}.`, 'info', 6000);

    if (state.categoria !== 'Todos' && !data.some((p) => p.categoria === state.categoria)) state.categoria = 'Todos';
    renderFilters();
    renderGrid();
  } catch (err) {
    els.grid.innerHTML = '';
    els.errorMsg.textContent = err.message;
    els.error.hidden = false;
  }
}

/* ---------------- Modal de detalle ---------------- */

const modalEl = document.getElementById('productModal');
const modal = new bootstrap.Modal(modalEl);
let modalState = { product: null, qty: 1 };

function updateModalTotals() {
  $('#pm-qty').textContent = modalState.qty;
  $('#pm-total').textContent = formatMoney(modalState.product.precio * modalState.qty);
}

function openDetail(id) {
  const p = state.productos.find((x) => x._id === id);
  if (!p) return;
  modalState = { product: p, qty: 1 };
  const img = $('#pm-img');
  img.src = resolveImg(p.imagen);
  img.alt = p.nombre;
  img.onerror = () => { img.onerror = null; img.src = resolveImg(''); };
  $('#pm-cat').textContent = `${categoriaIcon(p.categoria)} ${p.categoria}`;
  $('#productModalTitle').textContent = p.nombre;
  $('#pm-desc').textContent = p.descripcion;
  $('#pm-price').textContent = formatMoney(p.precio);
  updateModalTotals();
  modal.show();
}

$('#pm-inc').addEventListener('click', () => { modalState.qty = Math.min(MAX_QTY, modalState.qty + 1); updateModalTotals(); });
$('#pm-dec').addEventListener('click', () => { modalState.qty = Math.max(1, modalState.qty - 1); updateModalTotals(); });
$('#pm-add').addEventListener('click', () => {
  const { product, qty } = modalState;
  Cart.add(product, qty);
  modal.hide();
  toast(`${qty} × ${product.nombre} agregado al carrito`, 'success');
});

/* ---------------- Eventos ---------------- */

els.filters.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-categoria]');
  if (!btn) return;
  state.categoria = btn.dataset.categoria;
  els.filters.querySelectorAll('[data-categoria]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  const url = new URL(location.href);
  state.categoria === 'Todos' ? url.searchParams.delete('categoria') : url.searchParams.set('categoria', state.categoria);
  history.replaceState(null, '', url);
  renderGrid();
});

els.grid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  const p = state.productos.find((x) => x._id === id);
  if (!p) return;

  if (action === 'detail') return openDetail(id);
  if (action === 'add') {
    Cart.add(p, 1);
    toast(`${p.nombre} agregado al carrito`, 'success', 2200);
    bump(document.getElementById('nav-cart-btn'));
  }
  if (action === 'inc') {
    if (Cart.getQty(id) >= MAX_QTY) return toast(`Máximo ${MAX_QTY} unidades por producto.`, 'warning');
    Cart.increment(id);
  }
  if (action === 'dec') Cart.decrement(id);
  refreshCardActions(id);
});

// Mantiene sincronizadas las tarjetas si el carrito cambia desde el offcanvas u otra pestaña
Cart.onChange(() => state.productos.forEach((p) => refreshCardActions(p._id)));

els.search.addEventListener('input', debounce(() => {
  state.q = els.search.value.trim();
  renderGrid();
}, 200));

els.searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  state.q = els.search.value.trim();
  renderGrid();
  document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
});

els.sort.addEventListener('change', () => {
  state.sort = els.sort.value;
  renderGrid();
});

els.clear.addEventListener('click', () => {
  state.categoria = 'Todos';
  state.q = '';
  els.search.value = '';
  history.replaceState(null, '', location.pathname);
  renderFilters();
  renderGrid();
});

els.retry.addEventListener('click', load);
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    els.search.focus();
  }
});

// Permite abrir el carrito desde un enlace con #carrito
if (location.hash === '#carrito') openCart();

load();
