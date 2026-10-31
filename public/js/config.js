/**
 * Configuración global del frontend.
 * Si la página se sirve desde el propio Express (puerto 4000) se usa '/api' relativo;
 * si se abre con Live Server u otro puerto/file://, apunta a http://localhost:4000/api.
 */
const API_PORT = '4000';
const { protocol, hostname, port } = window.location;
const isLocal = ['localhost', '127.0.0.1'].includes(hostname);

export const API_BASE =
  protocol === 'file:' || (isLocal && port !== API_PORT) ? `http://localhost:${API_PORT}/api` : '/api';

export const STORAGE_KEYS = Object.freeze({
  token: 'foodexpress:token',
  user: 'foodexpress:user',
  cart: 'foodexpress:cart:v2',
  lastOrder: 'foodexpress:last-order',
  flash: 'foodexpress:flash',
});

/** Valores por defecto; se sincronizan con GET /api/config (el servidor es la fuente de verdad). */
export const PRICING = {
  costoEnvio: 2.5,
  tasaImpuesto: 0.13,
};

export const CURRENCY = { locale: 'en-US', code: 'USD' };
export const DATE_LOCALE = 'es-CR';
export const MAX_QTY = 99;
export const REQUEST_TIMEOUT_MS = 12000;
export const ORDER_REFRESH_MS = 15000;
export const ADMIN_REFRESH_MS = 30000;

export const CATEGORIA_ICONOS = {
  Hamburguesas: '🍔',
  Pizzas: '🍕',
  Mexicana: '🌮',
  Saludable: '🥗',
  Postres: '🍰',
  Bebidas: '🥤',
};

export const ESTADOS = Object.freeze({
  pendiente: { label: 'Pendiente', icon: 'bi-hourglass-split', desc: 'Recibimos tu pedido' },
  en_preparacion: { label: 'En preparación', icon: 'bi-fire', desc: 'La cocina está en acción' },
  en_camino: { label: 'En camino', icon: 'bi-scooter', desc: 'Tu repartidor va en camino' },
  entregado: { label: 'Entregado', icon: 'bi-bag-check-fill', desc: '¡Buen provecho!' },
  cancelado: { label: 'Cancelado', icon: 'bi-x-octagon-fill', desc: 'El pedido fue cancelado' },
});

/** Debe coincidir con TRANSICIONES en src/models/Order.ts */
export const TRANSICIONES = Object.freeze({
  pendiente: ['en_preparacion', 'cancelado'],
  en_preparacion: ['en_camino', 'cancelado'],
  en_camino: ['entregado'],
  entregado: [],
  cancelado: [],
});

export const DEMO_USERS = Object.freeze({
  admin: { email: 'admin@foodexpress.com', password: 'Admin123' },
  cliente: { email: 'cliente@foodexpress.com', password: 'Cliente123' },
});
