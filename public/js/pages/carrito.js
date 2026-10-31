import { api } from '../api.js';
import * as Cart from '../cart.js';
import { getUser } from '../auth.js';
import { PRICING, STORAGE_KEYS, MAX_QTY } from '../config.js';
import { schemas, validate, showErrors, liveValidate } from '../validators.js';
import { initPage, toast, confirmDialog, formatMoney, escapeHTML, resolveImg, imgFallbackAttr, categoriaIcon, setLoading, setFlash } from '../ui.js';

initPage({ active: 'carrito' });

const $ = (sel) => document.querySelector(sel);
const els = {
  empty: $('#cart-empty'),
  content: $('#cart-content'),
  list: $('#cart-items'),
  count: $('#items-count'),
  subtitle: $('#cart-subtitle'),
  clear: $('#btn-clear-cart'),
  form: $('#checkout-form'),
  fieldset: $('#checkout-fieldset'),
  guest: $('#guest-notice'),
  submit: $('#btn-checkout'),
  sum: {
    subtotal: $('#sum-subtotal'),
    envio: $('#sum-envio'),
    impuestos: $('#sum-impuestos'),
    total: $('#sum-total'),
    tasa: $('#sum-tasa'),
  },
};

const user = getUser();
let submitting = false;

/* ---------------- Render ---------------- */

function itemRow(i) {
  return `
    <li class="flex gap-4 px-6 py-5" data-id="${i.id}">
      <img src="${escapeHTML(resolveImg(i.imagen))}" ${imgFallbackAttr} alt="${escapeHTML(i.nombre)}" class="h-24 w-24 shrink-0 rounded-2xl object-cover ring-1 ring-black/5">
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="mb-0.5 text-xs font-medium text-ink-400">${categoriaIcon(i.categoria)} ${escapeHTML(i.categoria ?? '')}</p>
            <h3 class="font-display text-base font-bold text-ink-900 mb-0 truncate">${escapeHTML(i.nombre)}</h3>
            <p class="mb-0 text-sm text-ink-400">${formatMoney(i.precio)} c/u</p>
          </div>
          <button type="button" class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-transparent text-ink-400 transition hover:bg-rose-50 hover:text-rose-600" data-action="remove" aria-label="Eliminar ${escapeHTML(i.nombre)}">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
        <div class="mt-auto flex items-center justify-between pt-3">
          <div class="flex items-center gap-1 rounded-xl bg-cream p-1 ring-1 ring-black/5" role="group" aria-label="Cantidad">
            <button type="button" class="grid h-9 w-9 place-items-center rounded-lg bg-transparent hover:bg-white" data-action="dec" aria-label="Quitar uno"><i class="bi bi-dash-lg"></i></button>
            <input type="number" min="1" max="${MAX_QTY}" value="${i.cantidad}" class="h-9 w-12 border-0 bg-transparent text-center font-bold outline-none" data-action="qty" aria-label="Cantidad de ${escapeHTML(i.nombre)}">
            <button type="button" class="grid h-9 w-9 place-items-center rounded-lg bg-transparent hover:bg-white" data-action="inc" aria-label="Agregar uno"><i class="bi bi-plus-lg"></i></button>
          </div>
          <span class="font-display text-lg font-extrabold text-ink-900">${formatMoney(Cart.lineSubtotal(i))}</span>
        </div>
      </div>
    </li>`;
}

function renderSummary() {
  const t = Cart.totals();
  els.sum.subtotal.textContent = formatMoney(t.subtotal);
  els.sum.envio.textContent = formatMoney(t.envio);
  els.sum.impuestos.textContent = formatMoney(t.impuestos);
  els.sum.total.textContent = formatMoney(t.total);
  els.sum.tasa.textContent = Math.round(PRICING.tasaImpuesto * 100);
}

function render() {
  const items = Cart.getItems();
  const empty = items.length === 0;
  els.empty.hidden = !empty;
  els.content.hidden = empty;
  if (empty) {
    els.subtitle.textContent = 'No hay platillos en tu carrito.';
    return;
  }
  const n = Cart.count();
  els.count.textContent = `(${n})`;
  els.subtitle.textContent = `${n} ${n === 1 ? 'platillo' : 'platillos'} listos para ordenar.`;
  els.list.innerHTML = items.map(itemRow).join('');
  renderSummary();
}

/* ---------------- Estado de sesión ---------------- */

function setupAuthState() {
  if (!user) {
    els.guest.hidden = false;
    els.fieldset.disabled = true;
    els.form.classList.add('opacity-60');
    els.submit.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Inicia sesión para continuar';
    return;
  }
  // Autocompleta con los datos del perfil
  els.form.nombre.value = user.nombre ?? '';
  els.form.telefono.value = user.telefono ?? '';
  els.form.direccion.value = user.direccion ?? '';
  liveValidate(els.form, schemas.checkout);
}

/* ---------------- Eventos ---------------- */

els.list.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  const id = btn?.closest('[data-id]')?.dataset.id;
  if (!btn || !id) return;
  const { action } = btn.dataset;

  if (action === 'inc') {
    if (Cart.getQty(id) >= MAX_QTY) return toast(`Máximo ${MAX_QTY} unidades por producto.`, 'warning');
    Cart.increment(id);
  }
  if (action === 'dec') {
    if (Cart.getQty(id) === 1) {
      const item = Cart.getItems().find((i) => i.id === id);
      const ok = await confirmDialog({ title: '¿Quitar platillo?', message: `Se eliminará "${item?.nombre}" del carrito.`, confirmText: 'Quitar' });
      if (!ok) return;
    }
    Cart.decrement(id);
  }
  if (action === 'remove') {
    const item = Cart.getItems().find((i) => i.id === id);
    const ok = await confirmDialog({ title: '¿Quitar platillo?', message: `Se eliminará "${item?.nombre}" del carrito.`, confirmText: 'Quitar' });
    if (ok) {
      Cart.remove(id);
      toast('Platillo eliminado del carrito.', 'info');
    }
  }
});

els.list.addEventListener('change', (e) => {
  if (e.target.dataset.action !== 'qty') return;
  const id = e.target.closest('[data-id]').dataset.id;
  const qty = Math.max(1, Math.min(MAX_QTY, parseInt(e.target.value, 10) || 1));
  Cart.setQty(id, qty);
});

els.clear.addEventListener('click', async () => {
  const ok = await confirmDialog({ title: '¿Vaciar carrito?', message: 'Se eliminarán todos los platillos.', confirmText: 'Vaciar' });
  if (ok) Cart.clear();
});

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!user) {
    location.href = 'login.html?next=carrito.html';
    return;
  }
  if (submitting) return;
  if (Cart.isEmpty()) return toast('Tu carrito está vacío.', 'warning');

  const data = Object.fromEntries(new FormData(els.form));
  const { valid, errors } = validate(data, schemas.checkout);
  showErrors(els.form, errors);
  if (!valid) return toast('Revisa los datos de entrega.', 'error');

  const ok = await confirmDialog({
    title: 'Confirmar pedido',
    message: `Total a pagar: ${formatMoney(Cart.totals().total)} en ${data.metodoPago === 'efectivo' ? 'efectivo' : 'tarjeta'} al recibir.`,
    confirmText: 'Sí, ordenar',
    variant: 'brand',
    icon: 'bi-bag-check',
  });
  if (!ok) return;

  submitting = true;
  setLoading(els.submit, true, 'Enviando pedido...');
  try {
    const { data: pedido } = await api.pedidos.create({
      items: Cart.toOrderItems(),
      entrega: { nombre: data.nombre, telefono: data.telefono, direccion: data.direccion, referencias: data.referencias },
      metodoPago: data.metodoPago,
      notas: data.notas,
    });
    Cart.clear();
    localStorage.setItem(STORAGE_KEYS.lastOrder, pedido._id);
    setFlash(`¡Pedido ${pedido.numeroOrden} confirmado!`, 'success');
    location.replace(`confirmacion.html?id=${encodeURIComponent(pedido._id)}&nuevo=1`);
  } catch (err) {
    submitting = false;
    setLoading(els.submit, false);
    if (err.details) showErrors(els.form, err.details);
    // Productos que ya no existen: se refresca el carrito contra el catálogo
    if (err.status === 422 && err.details?.items) {
      try {
        const { data: productos } = await api.productos.list();
        Cart.syncWithCatalog(productos);
      } catch { /* ignore */ }
    }
    toast(err.message, 'error', 5000);
  }
});

/* ---------------- Init ---------------- */

Cart.onChange(render);
setupAuthState();
render();
api.config.load().then(renderSummary);
