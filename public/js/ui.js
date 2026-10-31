import * as Cart from './cart.js';
import { getUser, logout } from './auth.js';
import { CURRENCY, DATE_LOCALE, ESTADOS, STORAGE_KEYS, CATEGORIA_ICONOS } from './config.js';

/* ============================== Helpers ============================== */

const money = new Intl.NumberFormat(CURRENCY.locale, { style: 'currency', currency: CURRENCY.code });
export const formatMoney = (n) => money.format(Number(n) || 0);

export const formatDate = (d, opts = { dateStyle: 'medium', timeStyle: 'short' }) =>
  new Intl.DateTimeFormat(DATE_LOCALE, opts).format(new Date(d));

export function timeAgo(d) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(DATE_LOCALE, { numeric: 'auto' });
  if (s < 60) return rtf.format(-s, 'second');
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const FALLBACK_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#f3ede7"/><text x="50%" y="56%" font-size="72" text-anchor="middle">🍽️</text></svg>',
  );

export function resolveImg(url) {
  if (!url) return FALLBACK_IMG;
  return /^(https?:)?\/\//.test(url) || url.startsWith('data:') ? url : url.replace(/^\//, '');
}

export const imgFallbackAttr = `onerror="this.onerror=null;this.src='${FALLBACK_IMG}'"`;
export const categoriaIcon = (c) => CATEGORIA_ICONOS[c] ?? '🍽️';

export function estadoBadge(estado, extra = '') {
  const meta = ESTADOS[estado] ?? { label: estado, icon: 'bi-circle' };
  return `<span class="badge rounded-pill estado-${escapeHTML(estado)} inline-flex items-center gap-1.5 px-2.5 py-1.5 ${extra}"><i class="bi ${meta.icon}"></i>${meta.label}</span>`;
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Estado de carga en botones: guarda el HTML original y muestra un spinner Bootstrap. */
export function setLoading(btn, loading, text = 'Procesando...') {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${escapeHTML(text)}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
  }
}

export function bump(el) {
  if (!el) return;
  el.classList.remove('animate-bump');
  void el.offsetWidth;
  el.classList.add('animate-bump');
}

/* ============================== Toasts (Bootstrap) ============================== */

const TOAST_STYLES = {
  success: { icon: 'bi-check-lg', cls: 'bg-emerald-500' },
  error: { icon: 'bi-exclamation-lg', cls: 'bg-rose-500' },
  warning: { icon: 'bi-exclamation-triangle', cls: 'bg-amber-500' },
  info: { icon: 'bi-info-lg', cls: 'bg-ink-900' },
};

function toastContainer() {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container position-fixed end-0 p-3';
    c.style.top = '72px';
    c.setAttribute('aria-live', 'polite');
    document.body.appendChild(c);
  }
  return c;
}

export function toast(message, type = 'info', delay = 3500) {
  const s = TOAST_STYLES[type] ?? TOAST_STYLES.info;
  const el = document.createElement('div');
  el.className = 'toast bg-white';
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `
    <div class="flex items-center gap-3 p-3">
      <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full ${s.cls} text-white"><i class="bi ${s.icon}"></i></span>
      <p class="mb-0 flex-1 text-sm font-medium text-ink-800">${escapeHTML(message)}</p>
      <button type="button" class="btn-close btn-sm" data-bs-dismiss="toast" aria-label="Cerrar"></button>
    </div>`;
  toastContainer().appendChild(el);
  el.addEventListener('hidden.bs.toast', () => el.remove());
  bootstrap.Toast.getOrCreateInstance(el, { delay }).show();
}

/** Mensaje que sobrevive a una redirección (se muestra en la siguiente página). */
export function setFlash(message, type = 'success') {
  sessionStorage.setItem(STORAGE_KEYS.flash, JSON.stringify({ message, type }));
}

function showFlash() {
  const raw = sessionStorage.getItem(STORAGE_KEYS.flash);
  if (!raw) return;
  sessionStorage.removeItem(STORAGE_KEYS.flash);
  try {
    const { message, type } = JSON.parse(raw);
    toast(message, type);
  } catch { /* ignore */ }
}

/* ============================== Modal de confirmación ============================== */

/**
 * Diálogo de confirmación con Modal de Bootstrap.
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title = '¿Estás seguro?', message = '', confirmText = 'Confirmar', cancelText = 'Cancelar', variant = 'danger', icon = 'bi-exclamation-triangle' } = {}) {
  return new Promise((resolve) => {
    const colors = variant === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-600';
    const btn = variant === 'danger' ? 'btn-danger' : 'btn-brand';
    const wrapper = document.createElement('div');
    wrapper.className = 'modal fade';
    wrapper.tabIndex = -1;
    wrapper.innerHTML = `
      <div class="modal-dialog modal-dialog-centered" style="max-width:420px">
        <div class="modal-content p-2">
          <div class="modal-body text-center p-4">
            <div class="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl ${colors} text-2xl animate-pop"><i class="bi ${icon}"></i></div>
            <h2 class="font-display text-xl font-bold text-ink-900 mb-2">${escapeHTML(title)}</h2>
            <p class="text-sm text-ink-500 mb-0">${escapeHTML(message)}</p>
          </div>
          <div class="flex gap-2 px-4 pb-4">
            <button type="button" class="btn btn-light flex-1 py-2.5" data-action="cancel">${escapeHTML(cancelText)}</button>
            <button type="button" class="btn ${btn} flex-1 py-2.5" data-action="confirm">${escapeHTML(confirmText)}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrapper);
    const modal = new bootstrap.Modal(wrapper);
    let result = false;
    wrapper.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      result = action === 'confirm';
      modal.hide();
    });
    wrapper.addEventListener('hidden.bs.modal', () => {
      modal.dispose();
      wrapper.remove();
      resolve(result);
    });
    modal.show();
  });
}

/* ============================== Navbar dinámica ============================== */

const LOGO = `
  <a href="index.html" class="flex items-center gap-2.5 shrink-0" aria-label="FoodExpress inicio">
    <span class="grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow"><i class="bi bi-lightning-charge-fill text-lg"></i></span>
    <span class="font-display text-xl font-extrabold tracking-tight text-ink-900">Food<span class="text-brand-500">Express</span></span>
  </a>`;

function navLinks(user, active) {
  const links = [{ href: 'index.html', key: 'menu', label: 'Menú', icon: 'bi-grid' }];
  if (user) links.push({ href: 'confirmacion.html', key: 'pedidos', label: 'Mis pedidos', icon: 'bi-receipt' });
  // El enlace al panel SOLO existe en el DOM para administradores
  if (user?.rol === 'admin') links.push({ href: 'admin.html', key: 'admin', label: 'Panel admin', icon: 'bi-speedometer2' });
  return links.map((l) => ({ ...l, active: l.key === active }));
}

function renderNavbar(active) {
  const header = document.getElementById('app-navbar');
  if (!header) return;
  const user = getUser();
  const links = navLinks(user, active);
  const onCartPage = active === 'carrito';
  const initials = user ? user.nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() : '';

  header.className = 'sticky-top';
  header.innerHTML = `
    <nav class="glass border-b border-black/5">
      <div class="mx-auto flex h-[72px] max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        ${LOGO}
        <ul class="hidden md:flex items-center gap-1 ms-8 mb-0 ps-0 list-none">
          ${links.map((l) => `
            <li><a href="${l.href}" class="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${l.active ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-black/5 hover:text-ink-900'}" ${l.active ? 'aria-current="page"' : ''}>
              <i class="bi ${l.icon}"></i>${l.label}${l.key === 'admin' ? '<span class="badge bg-brand-500 ms-1 text-[10px]">ADMIN</span>' : ''}
            </a></li>`).join('')}
        </ul>
        <div class="ms-auto flex items-center gap-2">
          ${onCartPage ? '' : `
          <button type="button" id="nav-cart-btn" class="relative flex items-center gap-2 rounded-2xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800 active:scale-95" data-bs-toggle="offcanvas" data-bs-target="#cartOffcanvas" aria-controls="cartOffcanvas">
            <i class="bi bi-bag"></i><span class="hidden sm:inline">Carrito</span>
            <span data-cart-count hidden class="badge rounded-pill bg-brand-500 min-w-[1.4rem]">0</span>
          </button>`}
          ${user ? `
          <div class="dropdown hidden md:block">
            <button class="flex items-center gap-2 rounded-2xl bg-white py-1.5 pl-1.5 pr-3 shadow-card ring-1 ring-black/5 transition hover:ring-black/10" data-bs-toggle="dropdown" aria-expanded="false" id="user-menu-btn">
              <span class="grid h-8 w-8 place-items-center rounded-xl ${user.rol === 'admin' ? 'bg-ink-900' : 'bg-brand-gradient'} text-xs font-bold text-white">${escapeHTML(initials)}</span>
              <span class="text-sm font-semibold text-ink-800 max-w-[120px] truncate">${escapeHTML(user.nombre.split(' ')[0])}</span>
              <i class="bi bi-chevron-down text-xs text-ink-400"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end mt-2" style="min-width:240px">
              <li class="px-3 py-2">
                <p class="mb-0 text-sm font-semibold text-ink-900 truncate">${escapeHTML(user.nombre)}</p>
                <p class="mb-1 text-xs text-ink-400 truncate">${escapeHTML(user.email)}</p>
                <span class="badge ${user.rol === 'admin' ? 'bg-dark' : 'bg-brand-100 text-brand-700'}">${user.rol === 'admin' ? 'Administrador' : 'Cliente'}</span>
              </li>
              <li><hr class="dropdown-divider"></li>
              ${links.filter((l) => l.key !== 'menu').map((l) => `<li><a class="dropdown-item flex items-center gap-2" href="${l.href}"><i class="bi ${l.icon}"></i>${l.label}</a></li>`).join('')}
              <li><button class="dropdown-item flex items-center gap-2 text-rose-600" data-logout><i class="bi bi-box-arrow-right"></i>Cerrar sesión</button></li>
            </ul>
          </div>` : `
          <a href="login.html" id="nav-login-btn" class="hidden md:flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink-800 ring-1 ring-black/10 bg-white transition hover:ring-brand-300 hover:text-brand-600">
            <i class="bi bi-person-circle"></i>Ingresar
          </a>`}
          <button type="button" class="md:hidden grid h-11 w-11 place-items-center rounded-2xl bg-white ring-1 ring-black/10" data-bs-toggle="offcanvas" data-bs-target="#navOffcanvas" aria-label="Abrir menú">
            <i class="bi bi-list text-xl"></i>
          </button>
        </div>
      </div>
    </nav>`;

  renderMobileMenu(user, links);
}

/** Offcanvas de navegación móvil (se monta en <body> porque backdrop-filter rompe position:fixed). */
function renderMobileMenu(user, links) {
  document.getElementById('navOffcanvas')?.remove();
  const el = document.createElement('div');
  el.className = 'offcanvas offcanvas-start';
  el.id = 'navOffcanvas';
  el.tabIndex = -1;
  el.innerHTML = `
    <div class="offcanvas-header px-4 pt-4">${LOGO}<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button></div>
    <div class="offcanvas-body px-4 flex flex-col">
      ${user ? `
      <div class="mb-4 flex items-center gap-3 rounded-2xl bg-cream p-3 ring-1 ring-black/5">
        <span class="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white"><i class="bi bi-person-fill"></i></span>
        <div class="min-w-0"><p class="mb-0 font-semibold text-ink-900 truncate">${escapeHTML(user.nombre)}</p><p class="mb-0 text-xs text-ink-400 truncate">${escapeHTML(user.email)}</p></div>
      </div>` : ''}
      <nav class="flex flex-col gap-1">
        ${links.map((l) => `<a href="${l.href}" class="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold ${l.active ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-black/5'}"><i class="bi ${l.icon}"></i>${l.label}</a>`).join('')}
        <a href="carrito.html" class="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-ink-700 hover:bg-black/5"><i class="bi bi-bag"></i>Carrito <span data-cart-count hidden class="badge rounded-pill bg-brand-500 ms-auto">0</span></a>
      </nav>
      <div class="mt-auto pt-4">
        ${user
          ? '<button class="btn btn-outline-danger w-full py-2.5" data-logout><i class="bi bi-box-arrow-right me-2"></i>Cerrar sesión</button>'
          : '<a href="login.html" class="btn btn-brand w-full py-2.5"><i class="bi bi-person-circle me-2"></i>Iniciar sesión</a>'}
      </div>
    </div>`;
  document.body.appendChild(el);
}

/* ============================== Mini carrito (Offcanvas) ============================== */

function renderCartOffcanvas() {
  let el = document.getElementById('cartOffcanvas');
  if (!el) {
    el = document.createElement('div');
    el.className = 'offcanvas offcanvas-end';
    el.id = 'cartOffcanvas';
    el.tabIndex = -1;
    el.style.width = 'min(420px, 100vw)';
    el.setAttribute('aria-labelledby', 'cartOffcanvasLabel');
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cart-action]');
      if (!btn) return;
      const { cartAction, id } = btn.dataset;
      if (cartAction === 'inc') Cart.increment(id);
      if (cartAction === 'dec') Cart.decrement(id);
      if (cartAction === 'remove') Cart.remove(id);
    });
  }

  const items = Cart.getItems();
  const t = Cart.totals();
  el.innerHTML = `
    <div class="offcanvas-header border-b border-black/5 px-4 py-4">
      <h2 class="offcanvas-title font-display text-xl font-bold" id="cartOffcanvasLabel">Tu pedido <span class="text-ink-400 text-base font-medium">(${Cart.count()})</span></h2>
      <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
    </div>
    <div class="offcanvas-body px-4">
      ${items.length === 0 ? `
        <div class="flex h-full flex-col items-center justify-center text-center">
          <div class="mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-brand-50 text-4xl animate-float">🛍️</div>
          <p class="font-display text-lg font-bold text-ink-900 mb-1">Tu carrito está vacío</p>
          <p class="text-sm text-ink-400">Agrega tus platillos favoritos del menú.</p>
          <a href="index.html#menu" class="btn btn-brand mt-2 px-4" onclick="bootstrap.Offcanvas.getInstance(this.closest('.offcanvas'))?.hide()">Ver menú</a>
        </div>` : `
        <ul class="list-none ps-0 mb-0 flex flex-col gap-3">
          ${items.map((i) => `
            <li class="flex gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-black/5">
              <img src="${escapeHTML(resolveImg(i.imagen))}" ${imgFallbackAttr} alt="" class="h-16 w-16 rounded-xl object-cover">
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <p class="mb-0 text-sm font-semibold text-ink-900 truncate">${escapeHTML(i.nombre)}</p>
                  <button class="text-ink-400 hover:text-rose-500 bg-transparent" data-cart-action="remove" data-id="${i.id}" aria-label="Eliminar ${escapeHTML(i.nombre)}"><i class="bi bi-x-lg text-xs"></i></button>
                </div>
                <div class="mt-1.5 flex items-center justify-between">
                  <div class="flex items-center gap-1 rounded-xl bg-cream p-0.5 ring-1 ring-black/5">
                    <button class="grid h-7 w-7 place-items-center rounded-lg bg-transparent hover:bg-white" data-cart-action="dec" data-id="${i.id}" aria-label="Quitar uno"><i class="bi bi-dash"></i></button>
                    <span class="w-6 text-center text-sm font-bold">${i.cantidad}</span>
                    <button class="grid h-7 w-7 place-items-center rounded-lg bg-transparent hover:bg-white" data-cart-action="inc" data-id="${i.id}" aria-label="Agregar uno"><i class="bi bi-plus"></i></button>
                  </div>
                  <span class="text-sm font-bold text-ink-900">${formatMoney(Cart.lineSubtotal(i))}</span>
                </div>
              </div>
            </li>`).join('')}
        </ul>`}
    </div>
    ${items.length ? `
    <div class="border-t border-black/5 p-4 bg-white">
      <dl class="mb-3 text-sm">
        <div class="flex justify-between text-ink-500"><dt class="font-normal">Subtotal</dt><dd class="mb-1">${formatMoney(t.subtotal)}</dd></div>
        <div class="flex justify-between text-ink-500"><dt class="font-normal">Envío + impuestos</dt><dd class="mb-1">${formatMoney(t.envio + t.impuestos)}</dd></div>
        <div class="flex justify-between text-base font-bold text-ink-900"><dt>Total</dt><dd class="mb-0">${formatMoney(t.total)}</dd></div>
      </dl>
      <a href="carrito.html" class="btn btn-brand w-full py-3 flex items-center justify-center gap-2" id="offcanvas-checkout-btn">Ir a pagar <i class="bi bi-arrow-right"></i></a>
    </div>` : ''}`;
}

function renderCartBadges() {
  const n = Cart.count();
  document.querySelectorAll('[data-cart-count]').forEach((badge) => {
    const prev = badge.textContent;
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = n === 0;
    if (prev !== badge.textContent && n > 0) bump(badge);
  });
}

/* ============================== Footer ============================== */

function renderFooter() {
  const footer = document.getElementById('app-footer');
  if (!footer) return;
  footer.className = 'mt-16 bg-ink-950 text-ink-200';
  footer.innerHTML = `
    <div class="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
      <div class="md:col-span-2">
        <a href="index.html" class="flex items-center gap-2.5">
          <span class="grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient text-white"><i class="bi bi-lightning-charge-fill"></i></span>
          <span class="font-display text-xl font-extrabold text-white">Food<span class="text-brand-400">Express</span></span>
        </a>
        <p class="mt-4 max-w-sm text-sm text-ink-400">Comida caliente, recién hecha y en la puerta de tu casa en minutos. Pide, sigue tu pedido en tiempo real y disfruta.</p>
      </div>
      <div>
        <h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-white">Navegación</h3>
        <ul class="list-none ps-0 space-y-2 text-sm">
          <li><a class="text-ink-400 hover:text-brand-400" href="index.html">Menú</a></li>
          <li><a class="text-ink-400 hover:text-brand-400" href="carrito.html">Carrito</a></li>
          <li><a class="text-ink-400 hover:text-brand-400" href="confirmacion.html">Mis pedidos</a></li>
        </ul>
      </div>
      <div>
        <h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-white">Horario</h3>
        <p class="text-sm text-ink-400 mb-1">Lun – Dom · 10:00 – 23:00</p>
        <p class="text-sm text-ink-400"><i class="bi bi-telephone me-1"></i>+506 2222-2222</p>
      </div>
    </div>
    <div class="border-t border-white/10">
      <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-ink-400 sm:flex-row sm:px-6 lg:px-8">
        <p class="mb-0">© ${new Date().getFullYear()} FoodExpress · Sistema Web de Pedidos de Comida a Domicilio</p>
        <p class="mb-0">Proyecto Programación II</p>
      </div>
    </div>`;
}

/* ============================== Init ============================== */

/**
 * Inicializa el layout común de cada página.
 * @param {{ active?: 'menu'|'carrito'|'pedidos'|'admin'|'login' }} opts
 */
export function initPage({ active } = {}) {
  renderNavbar(active);
  renderFooter();
  if (active !== 'carrito') renderCartOffcanvas();
  renderCartBadges();
  showFlash();

  Cart.onChange(() => {
    renderCartBadges();
    if (active !== 'carrito') renderCartOffcanvas();
  });
  window.addEventListener('auth:change', () => renderNavbar(active));

  document.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-logout]')) return;
    const ok = await confirmDialog({ title: '¿Cerrar sesión?', message: 'Tu carrito se conservará en este dispositivo.', confirmText: 'Cerrar sesión', variant: 'brand', icon: 'bi-box-arrow-right' });
    if (ok) logout();
  });
}

export const openCart = () => bootstrap.Offcanvas.getOrCreateInstance('#cartOffcanvas').show();
