import { api } from '../api.js';
import { requireAuth } from '../auth.js';
import { ESTADOS, ORDER_REFRESH_MS, STORAGE_KEYS } from '../config.js';
import {
  initPage, toast, confirmDialog, formatMoney, formatDate, timeAgo, escapeHTML,
  resolveImg, imgFallbackAttr, estadoBadge, setLoading,
} from '../ui.js';

const $ = (sel) => document.querySelector(sel);
const params = new URLSearchParams(location.search);
const orderId = params.get('id');
const isNew = params.get('nuevo') === '1';

const els = {
  loading: $('#state-loading'),
  error: $('#state-error'),
  errorMsg: $('#state-error-msg'),
  hero: $('#success-hero'),
  crumbOrden: $('#crumb-orden'),
  orderView: $('#order-view'),
  listView: $('#list-view'),
  number: $('#order-number'),
  date: $('#order-date'),
  badge: $('#order-badge'),
  timeline: $('#order-timeline'),
  cancelled: $('#order-cancelled'),
  eta: $('#order-eta'),
  etaText: $('#order-eta-text'),
  items: $('#order-items'),
  pago: $('#order-pago'),
  sum: {
    subtotal: $('#sum-subtotal'),
    envio: $('#sum-envio'),
    impuestos: $('#sum-impuestos'),
    total: $('#sum-total'),
  },
  delivery: {
    nombre: $('#delivery-nombre'),
    telefono: $('#delivery-telefono'),
    direccion: $('#delivery-direccion'),
    referencias: $('#delivery-referencias'),
  },
  notas: $('#order-notas'),
  copy: $('#btn-copy'),
  cancel: $('#btn-cancel-order'),
  refresh: $('#btn-refresh'),
  updated: $('#last-updated'),
  list: $('#orders-list'),
  empty: $('#orders-empty'),
};

/** Flujo normal del pedido (cancelado se muestra aparte). */
const PASOS = ['pendiente', 'en_preparacion', 'en_camino', 'entregado'];
const FINALES = ['entregado', 'cancelado'];

let pedido = null;
let timer = null;

function showError(message) {
  els.loading.hidden = true;
  els.hero.hidden = true;
  els.errorMsg.textContent = message;
  els.error.hidden = false;
}

/* ============================== Detalle ============================== */

function renderTimeline(p) {
  const actual = PASOS.indexOf(p.estado);
  const fechas = Object.fromEntries(p.historial.map((h) => [h.estado, h.fecha]));
  els.timeline.innerHTML = PASOS.map((estado, i) => {
    const meta = ESTADOS[estado];
    const done = actual >= i;
    const current = actual === i && !FINALES.includes(estado);
    // Barra izquierda: llega a este paso; derecha: sale hacia el siguiente
    const left = i === 0 ? 'invisible' : actual >= i ? 'bg-brand-500' : 'bg-ink-100';
    const right = i === PASOS.length - 1 ? 'invisible' : actual > i ? 'bg-brand-500' : 'bg-ink-100';
    return `
      <li class="timeline-step ${done ? 'done' : ''} ${current ? 'current' : ''} flex flex-col items-center text-center">
        <div class="flex w-full items-center">
          <span class="h-1 flex-1 rounded-full ${left}"></span>
          <span class="timeline-dot grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-lg ${done ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-100 bg-white text-ink-400'}"><i class="bi ${meta.icon}"></i></span>
          <span class="h-1 flex-1 rounded-full ${right}"></span>
        </div>
        <p class="mt-2 mb-0 text-xs font-semibold sm:text-sm ${done ? 'text-ink-900' : 'text-ink-400'}">${meta.label}</p>
        <p class="mb-0 hidden text-[11px] text-ink-400 sm:block">${fechas[estado] ? formatDate(fechas[estado], { timeStyle: 'short' }) : meta.desc}</p>
      </li>`;
  }).join('');
}

function renderOrder(p) {
  pedido = p;
  els.number.textContent = p.numeroOrden;
  els.crumbOrden.textContent = p.numeroOrden;
  els.crumbOrden.hidden = false;
  document.title = `Pedido ${p.numeroOrden} | FoodExpress`;
  els.date.textContent = `Realizado ${timeAgo(p.createdAt)} · ${formatDate(p.createdAt)}`;
  els.badge.innerHTML = estadoBadge(p.estado, 'text-sm');

  const cancelado = p.estado === 'cancelado';
  els.timeline.hidden = cancelado;
  els.cancelled.hidden = !cancelado;
  if (!cancelado) renderTimeline(p);

  els.eta.hidden = !p.tiempoEstimado;
  if (p.tiempoEstimado) els.etaText.textContent = `${p.tiempoEstimado.min}–${p.tiempoEstimado.max} min`;

  els.items.innerHTML = p.items.map((i) => `
    <li class="flex items-center gap-4 px-6 py-4">
      <img src="${escapeHTML(resolveImg(i.imagen))}" ${imgFallbackAttr} alt="" class="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-black/5">
      <div class="min-w-0 flex-1">
        <p class="mb-0 truncate font-semibold text-ink-900">${escapeHTML(i.nombre)}</p>
        <p class="mb-0 text-sm text-ink-400">${i.cantidad} × ${formatMoney(i.precio)}</p>
      </div>
      <span class="font-display font-bold text-ink-900">${formatMoney(i.subtotal)}</span>
    </li>`).join('');

  els.pago.innerHTML = `<i class="bi ${p.metodoPago === 'efectivo' ? 'bi-cash-stack' : 'bi-credit-card-2-front'} me-1"></i>Pago con ${p.metodoPago} al recibir`;
  els.sum.subtotal.textContent = formatMoney(p.subtotal);
  els.sum.envio.textContent = formatMoney(p.envio);
  els.sum.impuestos.textContent = formatMoney(p.impuestos);
  els.sum.total.textContent = formatMoney(p.total);

  els.delivery.nombre.textContent = p.entrega.nombre;
  els.delivery.telefono.textContent = p.entrega.telefono;
  els.delivery.direccion.textContent = p.entrega.direccion;
  els.delivery.referencias.textContent = p.entrega.referencias ? `Ref.: ${p.entrega.referencias}` : '';
  els.notas.hidden = !p.notas;
  els.notas.textContent = p.notas ? `📝 ${p.notas}` : '';

  els.cancel.hidden = p.estado !== 'pendiente';
  els.updated.textContent = `Actualizado ${formatDate(new Date(), { timeStyle: 'short' })}`;

  if (FINALES.includes(p.estado)) stopPolling();
}

async function loadOrder({ silent = false } = {}) {
  const prev = pedido?.estado;
  const { data } = await api.pedidos.get(orderId);
  renderOrder(data);
  if (silent && prev && prev !== data.estado) {
    toast(`Tu pedido ahora está: ${ESTADOS[data.estado].label}`, data.estado === 'cancelado' ? 'warning' : 'success', 5000);
  }
}

function startPolling() {
  stopPolling();
  timer = setInterval(() => {
    if (!document.hidden) loadOrder({ silent: true }).catch(() => {});
  }, ORDER_REFRESH_MS);
}

function stopPolling() {
  clearInterval(timer);
  timer = null;
}

els.copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(pedido.numeroOrden);
    toast('Número de orden copiado.', 'success', 2000);
  } catch {
    toast('No se pudo copiar.', 'error');
  }
});

els.refresh.addEventListener('click', async () => {
  setLoading(els.refresh, true, 'Actualizando');
  try {
    await loadOrder({ silent: true });
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(els.refresh, false);
  }
});

els.cancel.addEventListener('click', async () => {
  const ok = await confirmDialog({
    title: '¿Cancelar pedido?',
    message: `El pedido ${pedido.numeroOrden} se cancelará. Solo es posible mientras no se esté preparando.`,
    confirmText: 'Sí, cancelar',
    cancelText: 'Volver',
  });
  if (!ok) return;
  setLoading(els.cancel, true, 'Cancelando...');
  try {
    const res = await api.pedidos.cancel(pedido._id);
    renderOrder(res.data);
    toast(res.message, 'info');
  } catch (err) {
    toast(err.message, 'error', 5000);
    loadOrder({ silent: true }).catch(() => {});
  } finally {
    setLoading(els.cancel, false);
  }
});

/* ============================== Historial ============================== */

function orderCard(p) {
  const resumen = p.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ');
  return `
    <a href="confirmacion.html?id=${encodeURIComponent(p._id)}" class="group flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lift sm:flex-row sm:items-center">
      <div class="flex -space-x-3">
        ${p.items.slice(0, 3).map((i) => `<img src="${escapeHTML(resolveImg(i.imagen))}" ${imgFallbackAttr} alt="" class="h-14 w-14 rounded-2xl object-cover ring-4 ring-white">`).join('')}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-display text-lg font-bold text-ink-900">${escapeHTML(p.numeroOrden)}</span>
          ${estadoBadge(p.estado)}
        </div>
        <p class="mb-0 truncate text-sm text-ink-500">${escapeHTML(resumen)}</p>
        <p class="mb-0 text-xs text-ink-400">${formatDate(p.createdAt)} · ${timeAgo(p.createdAt)}</p>
      </div>
      <div class="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
        <span class="font-display text-xl font-extrabold text-ink-900">${formatMoney(p.total)}</span>
        <span class="text-sm font-semibold text-brand-600">Ver detalle <i class="bi bi-arrow-right transition group-hover:translate-x-0.5"></i></span>
      </div>
    </a>`;
}

async function loadList() {
  const { data } = await api.pedidos.mine();
  els.list.innerHTML = data.map(orderCard).join('');
  els.empty.hidden = data.length > 0;
}

/* ============================== Init ============================== */

(async function init() {
  if (!requireAuth()) return;
  initPage({ active: 'pedidos' });

  try {
    if (orderId) {
      await loadOrder();
      els.hero.hidden = !isNew;
      els.orderView.hidden = false;
      if (isNew) localStorage.removeItem(STORAGE_KEYS.lastOrder);
      if (!FINALES.includes(pedido.estado)) startPolling();
    } else {
      await loadList();
      els.listView.hidden = false;
    }
    els.loading.hidden = true;
  } catch (err) {
    showError(err.message);
  }
})();
