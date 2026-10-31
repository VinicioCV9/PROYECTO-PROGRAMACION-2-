import { api } from '../api.js';
import { requireAdmin, verifySession } from '../auth.js';
import { ESTADOS, TRANSICIONES, ADMIN_REFRESH_MS } from '../config.js';
import { schemas, validate, showErrors, liveValidate } from '../validators.js';
import {
  initPage, toast, confirmDialog, formatMoney, formatDate, timeAgo, escapeHTML,
  resolveImg, imgFallbackAttr, categoriaIcon, estadoBadge, debounce, setLoading,
} from '../ui.js';

const $ = (sel) => document.querySelector(sel);
const els = {
  name: $('#admin-name'),
  sync: $('#last-sync'),
  refresh: $('#btn-refresh'),
  kpi: {
    total: $('#kpi-total'),
    hoy: $('#kpi-hoy'),
    ingresos: $('#kpi-ingresos'),
    ingresosHoy: $('#kpi-ingresos-hoy'),
    pendiente: $('#kpi-pendiente'),
    en_preparacion: $('#kpi-en_preparacion'),
    en_camino: $('#kpi-en_camino'),
    entregado: $('#kpi-entregado'),
    cancelado: $('#kpi-cancelado'),
  },
  filters: $('#estado-filters'),
  search: $('#orders-search'),
  searchForm: $('#orders-search-form'),
  ordersBody: $('#orders-body'),
  ordersEmpty: $('#orders-empty'),
  ordersMeta: $('#orders-meta'),
  ordersPage: $('#orders-page'),
  prev: $('#orders-prev'),
  next: $('#orders-next'),
  productsBody: $('#products-body'),
  productsCount: $('#products-count'),
  newProduct: $('#btn-new-product'),
  productForm: $('#product-form'),
  productTitle: $('#productModalTitle'),
  saveProduct: $('#btn-save-product'),
  preview: $('#pf-preview'),
  orderTitle: $('#orderModalTitle'),
  orderFecha: $('#om-fecha'),
  orderBody: $('#om-body'),
};

const state = {
  estado: '',
  q: '',
  page: 1,
  pages: 1,
  pedidos: [],
  productos: [],
  editingId: null,
  categorias: [],
};

const orderModal = new bootstrap.Modal('#orderModal');
const productModal = new bootstrap.Modal('#productModal');

/* ============================== KPIs ============================== */

async function loadStats() {
  const { data: s } = await api.admin.stats();
  els.kpi.total.textContent = s.totalPedidos;
  els.kpi.hoy.textContent = `${s.pedidosHoy} hoy`;
  els.kpi.ingresos.textContent = formatMoney(s.ingresosTotales);
  els.kpi.ingresosHoy.textContent = `${formatMoney(s.ingresosHoy)} hoy`;
  els.kpi.pendiente.textContent = s.estados.pendiente;
  els.kpi.en_preparacion.textContent = s.estados.en_preparacion;
  els.kpi.en_camino.textContent = `${s.estados.en_camino} en camino`;
  els.kpi.entregado.textContent = s.estados.entregado;
  els.kpi.cancelado.textContent = `${s.estados.cancelado} cancelados`;
  renderFilters(s.estados, s.totalPedidos);
}

/* ============================== Pedidos ============================== */

function renderFilters(counts = {}, total = 0) {
  const opciones = [['', 'Todos', 'bi-grid', total], ...Object.entries(ESTADOS).map(([k, m]) => [k, m.label, m.icon, counts[k] ?? 0])];
  els.filters.innerHTML = opciones.map(([key, label, icon, n]) => `
    <button type="button" class="chip flex shrink-0 items-center gap-2 rounded-2xl border border-ink-100 bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 transition hover:border-ink-200 hover:bg-cream"
      data-estado="${key}" aria-pressed="${key === state.estado}">
      <i class="bi ${icon}"></i>${label}
      <span class="rounded-lg bg-black/5 px-1.5 text-xs">${n}</span>
    </button>`).join('');
}

function renderOrdersSkeleton() {
  els.ordersEmpty.hidden = true;
  els.ordersBody.innerHTML = Array.from({ length: 5 }, () => `
    <tr>${Array.from({ length: 7 }, () => '<td><div class="skeleton h-4 w-full rounded-full"></div></td>').join('')}</tr>`).join('');
}

function estadoSelect(p) {
  const siguientes = TRANSICIONES[p.estado] ?? [];
  if (!siguientes.length) return '<span class="text-xs text-ink-400"><i class="bi bi-lock me-1"></i>Finalizado</span>';
  return `
    <select class="form-select form-select-sm py-1.5" data-action="estado" data-id="${p._id}" aria-label="Cambiar estado de ${escapeHTML(p.numeroOrden)}">
      <option value="" selected disabled>Mover a…</option>
      ${siguientes.map((e) => `<option value="${e}">${ESTADOS[e].label}</option>`).join('')}
    </select>`;
}

function orderRow(p) {
  const cliente = p.usuario?.nombre ?? p.entrega.nombre;
  return `
    <tr data-id="${p._id}">
      <td class="whitespace-nowrap">
        <span class="font-display font-bold text-ink-900">${escapeHTML(p.numeroOrden)}</span>
        <span class="block text-xs text-ink-400">${p.unidades} ${p.unidades === 1 ? 'platillo' : 'platillos'} · ${p.metodoPago === 'efectivo' ? 'Efectivo' : 'Tarjeta'}</span>
      </td>
      <td class="max-w-[220px]">
        <span class="block truncate font-semibold text-ink-800">${escapeHTML(cliente)}</span>
        <span class="block truncate text-xs text-ink-400">${escapeHTML(p.entrega.telefono)} · ${escapeHTML(p.entrega.direccion)}</span>
      </td>
      <td class="text-end font-display font-bold text-ink-900">${formatMoney(p.total)}</td>
      <td class="whitespace-nowrap">
        <span class="block text-sm">${formatDate(p.createdAt, { dateStyle: 'short', timeStyle: 'short' })}</span>
        <span class="block text-xs text-ink-400">${timeAgo(p.createdAt)}</span>
      </td>
      <td>${estadoBadge(p.estado)}</td>
      <td>${estadoSelect(p)}</td>
      <td class="text-end">
        <button type="button" class="btn btn-light btn-sm px-3 ring-1 ring-black/5" data-action="detalle" data-id="${p._id}">
          <i class="bi bi-eye me-1"></i>Ver
        </button>
      </td>
    </tr>`;
}

async function loadOrders({ silent = false } = {}) {
  if (!silent) renderOrdersSkeleton();
  const { data, meta } = await api.admin.pedidos({ estado: state.estado, q: state.q, page: state.page, limit: 15 });
  state.pedidos = data;
  state.pages = meta.pages;
  if (state.page > meta.pages) {
    state.page = meta.pages;
    return loadOrders({ silent });
  }
  els.ordersBody.innerHTML = data.map(orderRow).join('');
  els.ordersEmpty.hidden = data.length > 0;
  els.ordersMeta.textContent = `${meta.total} ${meta.total === 1 ? 'pedido' : 'pedidos'}`;
  els.ordersPage.textContent = `${meta.page} / ${meta.pages}`;
  els.prev.disabled = meta.page <= 1;
  els.next.disabled = meta.page >= meta.pages;
}

function openOrderDetail(id) {
  const p = state.pedidos.find((x) => x._id === id);
  if (!p) return;
  els.orderTitle.innerHTML = `Pedido ${escapeHTML(p.numeroOrden)} ${estadoBadge(p.estado, 'ms-2 align-middle text-xs')}`;
  els.orderFecha.textContent = `Realizado el ${formatDate(p.createdAt)}`;
  els.orderBody.innerHTML = `
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="rounded-2xl bg-cream p-4 ring-1 ring-black/5">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400"><i class="bi bi-person me-1"></i>Cliente</p>
        <p class="mb-0 font-semibold text-ink-900">${escapeHTML(p.usuario?.nombre ?? '—')}</p>
        <p class="mb-0 text-sm text-ink-500">${escapeHTML(p.usuario?.email ?? '')}</p>
      </div>
      <div class="rounded-2xl bg-cream p-4 ring-1 ring-black/5">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400"><i class="bi bi-geo-alt me-1"></i>Entrega</p>
        <p class="mb-0 font-semibold text-ink-900">${escapeHTML(p.entrega.nombre)} · ${escapeHTML(p.entrega.telefono)}</p>
        <p class="mb-0 text-sm text-ink-500">${escapeHTML(p.entrega.direccion)}</p>
        ${p.entrega.referencias ? `<p class="mb-0 text-xs text-ink-400">Ref.: ${escapeHTML(p.entrega.referencias)}</p>` : ''}
      </div>
    </div>

    ${p.notas ? `<div class="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-100"><i class="bi bi-chat-left-text me-2"></i>${escapeHTML(p.notas)}</div>` : ''}

    <h3 class="mt-6 mb-3 font-display text-base font-bold text-ink-900">Platillos</h3>
    <ul class="list-none ps-0 mb-0 divide-y divide-black/5 rounded-2xl ring-1 ring-black/5">
      ${p.items.map((i) => `
        <li class="flex items-center gap-3 p-3">
          <img src="${escapeHTML(resolveImg(i.imagen))}" ${imgFallbackAttr} alt="" class="h-12 w-12 rounded-xl object-cover">
          <div class="min-w-0 flex-1">
            <p class="mb-0 truncate font-semibold text-ink-900">${escapeHTML(i.nombre)}</p>
            <p class="mb-0 text-xs text-ink-400">${i.cantidad} × ${formatMoney(i.precio)}</p>
          </div>
          <span class="font-bold text-ink-900">${formatMoney(i.subtotal)}</span>
        </li>`).join('')}
    </ul>

    <dl class="mt-4 ms-auto max-w-xs space-y-1 text-sm">
      <div class="flex justify-between"><dt class="font-normal text-ink-500">Subtotal</dt><dd class="mb-0">${formatMoney(p.subtotal)}</dd></div>
      <div class="flex justify-between"><dt class="font-normal text-ink-500">Envío</dt><dd class="mb-0">${formatMoney(p.envio)}</dd></div>
      <div class="flex justify-between"><dt class="font-normal text-ink-500">Impuestos</dt><dd class="mb-0">${formatMoney(p.impuestos)}</dd></div>
      <div class="flex justify-between border-t border-dashed border-ink-100 pt-2 text-base font-bold text-ink-900"><dt>Total</dt><dd class="mb-0">${formatMoney(p.total)}</dd></div>
    </dl>

    <h3 class="mt-6 mb-3 font-display text-base font-bold text-ink-900">Historial</h3>
    <ol class="list-none ps-0 mb-0 space-y-2 text-sm">
      ${p.historial.map((h) => `<li class="flex items-center justify-between gap-3">${estadoBadge(h.estado)}<span class="text-ink-400">${formatDate(h.fecha)}</span></li>`).join('')}
    </ol>`;
  orderModal.show();
}

async function changeEstado(select) {
  const { id } = select.dataset;
  const nuevo = select.value;
  const pedido = state.pedidos.find((x) => x._id === id);
  if (!pedido || !nuevo) return;

  if (nuevo === 'cancelado') {
    const ok = await confirmDialog({ title: '¿Cancelar pedido?', message: `El pedido ${pedido.numeroOrden} se marcará como cancelado. Esta acción no se puede deshacer.`, confirmText: 'Cancelar pedido', cancelText: 'Volver' });
    if (!ok) {
      select.value = '';
      return;
    }
  }

  select.disabled = true;
  try {
    const res = await api.admin.updateEstado(id, nuevo);
    toast(res.message, 'success');
    await Promise.all([loadOrders({ silent: true }), loadStats()]);
  } catch (err) {
    toast(err.message, 'error', 5000);
    select.disabled = false;
    select.value = '';
    loadOrders({ silent: true }).catch(() => {});
  }
}

/* ============================== Productos ============================== */

function productRow(p) {
  return `
    <tr data-id="${p._id}" class="${p.disponible ? '' : 'opacity-60'}">
      <td>
        <div class="flex items-center gap-3">
          <img src="${escapeHTML(resolveImg(p.imagen))}" ${imgFallbackAttr} alt="" class="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-black/5">
          <div class="min-w-0">
            <p class="mb-0 truncate font-semibold text-ink-900">${escapeHTML(p.nombre)}${p.destacado ? ' <i class="bi bi-fire text-brand-500" title="Destacado"></i>' : ''}</p>
            <p class="mb-0 max-w-xs truncate text-xs text-ink-400">${escapeHTML(p.descripcion)}</p>
          </div>
        </div>
      </td>
      <td class="whitespace-nowrap">${categoriaIcon(p.categoria)} ${escapeHTML(p.categoria)}</td>
      <td class="text-end font-display font-bold text-ink-900">${formatMoney(p.precio)}</td>
      <td>
        <div class="form-check form-switch mb-0">
          <input class="form-check-input" type="checkbox" role="switch" data-action="toggle" data-id="${p._id}" ${p.disponible ? 'checked' : ''} aria-label="Disponibilidad de ${escapeHTML(p.nombre)}">
          <span class="text-xs font-semibold ${p.disponible ? 'text-emerald-600' : 'text-ink-400'}">${p.disponible ? 'Disponible' : 'Agotado'}</span>
        </div>
      </td>
      <td class="text-end whitespace-nowrap">
        <button type="button" class="btn btn-light btn-sm px-2.5 ring-1 ring-black/5" data-action="editar" data-id="${p._id}" aria-label="Editar ${escapeHTML(p.nombre)}"><i class="bi bi-pencil"></i></button>
        <button type="button" class="btn btn-light btn-sm px-2.5 text-rose-600 ring-1 ring-black/5" data-action="eliminar" data-id="${p._id}" aria-label="Eliminar ${escapeHTML(p.nombre)}"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>`;
}

async function loadProducts() {
  const { data } = await api.admin.productos();
  state.productos = data;
  els.productsCount.textContent = `(${data.length})`;
  els.productsBody.innerHTML = data.length
    ? data.map(productRow).join('')
    : '<tr><td colspan="5" class="py-10 text-center text-ink-400">Aún no hay platillos. Crea el primero.</td></tr>';
}

function updatePreview() {
  els.preview.src = resolveImg(els.productForm.imagen.value.trim());
}
els.preview.addEventListener('error', () => { els.preview.src = resolveImg(''); });

function openProductForm(id = null) {
  const p = id ? state.productos.find((x) => x._id === id) : null;
  state.editingId = p?._id ?? null;
  const f = els.productForm;
  f.reset();
  showErrors(f, {});
  els.productTitle.textContent = p ? 'Editar platillo' : 'Nuevo platillo';
  f.nombre.value = p?.nombre ?? '';
  f.precio.value = p?.precio ?? '';
  f.categoria.value = p?.categoria ?? state.categorias[0] ?? '';
  f.imagen.value = p?.imagen ?? '';
  f.descripcion.value = p?.descripcion ?? '';
  f.disponible.checked = p?.disponible ?? true;
  f.destacado.checked = p?.destacado ?? false;
  updatePreview();
  productModal.show();
}

els.productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = els.productForm;
  const data = Object.fromEntries(new FormData(f));
  const { valid, errors } = validate(data, schemas.producto);
  showErrors(f, errors);
  if (!valid) return;

  const payload = {
    nombre: data.nombre.trim(),
    precio: Number(data.precio),
    categoria: data.categoria,
    imagen: data.imagen.trim(),
    descripcion: data.descripcion.trim(),
    disponible: f.disponible.checked,
    destacado: f.destacado.checked,
  };

  setLoading(els.saveProduct, true, 'Guardando...');
  try {
    const res = state.editingId
      ? await api.admin.updateProducto(state.editingId, payload)
      : await api.admin.createProducto(payload);
    productModal.hide();
    toast(res.message, 'success');
    await Promise.all([loadProducts(), loadStats()]);
  } catch (err) {
    if (err.details) showErrors(f, err.details);
    toast(err.message, 'error', 5000);
  } finally {
    setLoading(els.saveProduct, false);
  }
});

async function toggleProduct(input) {
  input.disabled = true;
  try {
    const res = await api.admin.toggleProducto(input.dataset.id);
    toast(res.message, res.data.disponible ? 'success' : 'info');
  } catch (err) {
    toast(err.message, 'error');
  }
  await loadProducts();
}

async function deleteProduct(id) {
  const p = state.productos.find((x) => x._id === id);
  if (!p) return;
  const ok = await confirmDialog({
    title: '¿Eliminar platillo?',
    message: `"${p.nombre}" se eliminará del catálogo. Los pedidos existentes conservan su información.`,
    confirmText: 'Eliminar',
    icon: 'bi-trash3',
  });
  if (!ok) return;
  try {
    const res = await api.admin.deleteProducto(id);
    toast(res.message, 'success');
    await Promise.all([loadProducts(), loadStats()]);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function loadCategorias() {
  const { data } = await api.productos.categorias();
  state.categorias = data;
  els.productForm.categoria.innerHTML = data.map((c) => `<option value="${escapeHTML(c)}">${categoriaIcon(c)} ${escapeHTML(c)}</option>`).join('');
}

/* ============================== Eventos ============================== */

els.filters.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-estado]');
  if (!btn) return;
  state.estado = btn.dataset.estado;
  state.page = 1;
  els.filters.querySelectorAll('[data-estado]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  loadOrders().catch((err) => toast(err.message, 'error'));
});

els.search.addEventListener('input', debounce(() => {
  state.q = els.search.value.trim();
  state.page = 1;
  loadOrders().catch((err) => toast(err.message, 'error'));
}, 300));
els.searchForm.addEventListener('submit', (e) => e.preventDefault());

els.prev.addEventListener('click', () => { state.page--; loadOrders().catch((err) => toast(err.message, 'error')); });
els.next.addEventListener('click', () => { state.page++; loadOrders().catch((err) => toast(err.message, 'error')); });

els.ordersBody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="detalle"]');
  if (btn) openOrderDetail(btn.dataset.id);
});
els.ordersBody.addEventListener('change', (e) => {
  if (e.target.dataset.action === 'estado') changeEstado(e.target);
});

els.productsBody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'editar') openProductForm(btn.dataset.id);
  if (btn.dataset.action === 'eliminar') deleteProduct(btn.dataset.id);
});
els.productsBody.addEventListener('change', (e) => {
  if (e.target.dataset.action === 'toggle') toggleProduct(e.target);
});

els.newProduct.addEventListener('click', () => openProductForm());
els.productForm.imagen.addEventListener('input', debounce(updatePreview, 300));

async function refreshAll({ silent = false } = {}) {
  setLoading(els.refresh, true, 'Actualizando...');
  try {
    await Promise.all([loadStats(), loadOrders({ silent }), loadProducts()]);
    els.sync.textContent = `Actualizado ${formatDate(new Date(), { timeStyle: 'short' })}`;
  } catch (err) {
    toast(err.message, 'error', 5000);
  } finally {
    setLoading(els.refresh, false);
  }
}

els.refresh.addEventListener('click', () => refreshAll());

// Refresco automático de pedidos/KPIs (se pausa si la pestaña está oculta o hay un modal abierto)
setInterval(() => {
  if (document.documentElement.classList.contains('auth-pending') || document.hidden || document.querySelector('.modal.show') || document.activeElement?.dataset.action === 'estado') return;
  Promise.all([loadStats(), loadOrders({ silent: true })])
    .then(() => { els.sync.textContent = `Actualizado ${formatDate(new Date(), { timeStyle: 'short' })}`; })
    .catch(() => {});
}, ADMIN_REFRESH_MS);

/* ============================== Init ============================== */

(async function init() {
  // 1) Chequeo local inmediato (redirige a login o al menú si no es admin)
  if (!requireAdmin()) return;

  // 2) Verificación con el servidor: el token debe ser válido y el rol admin
  let user;
  try {
    user = await verifySession({ role: 'admin' });
  } catch (err) {
    if (err.status === 401) return; // api.js ya redirige a login si el token fue rechazado
    document.documentElement.classList.remove('auth-pending');
    initPage({ active: 'admin' });
    toast(err.message, 'error', 8000);
    return;
  }
  if (!user) return;

  document.documentElement.classList.remove('auth-pending');
  initPage({ active: 'admin' });
  els.name.textContent = user.nombre.split(' ')[0];
  liveValidate(els.productForm, schemas.producto);

  try {
    await loadCategorias();
  } catch (err) {
    toast(err.message, 'error');
  }
  await refreshAll();
})();
