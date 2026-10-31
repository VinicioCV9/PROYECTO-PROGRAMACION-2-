import { STORAGE_KEYS, MAX_QTY, PRICING } from './config.js';

/**
 * Estado del carrito persistido en localStorage.
 * Item: { id, nombre, precio, imagen, categoria, cantidad }
 * Los montos se calculan en centavos para evitar errores de coma flotante.
 */
const KEY = STORAGE_KEYS.cart;

const isValidItem = (i) =>
  i &&
  typeof i.id === 'string' && /^[a-f\d]{24}$/i.test(i.id) &&
  typeof i.nombre === 'string' &&
  Number.isFinite(i.precio) && i.precio >= 0 &&
  Number.isInteger(i.cantidad) && i.cantidad > 0;

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter(isValidItem).map((i) => ({ ...i, cantidad: Math.min(i.cantidad, MAX_QTY) }))
      : [];
  } catch {
    return [];
  }
}

let items = read();

const toCents = (n) => Math.round(Number(n) * 100);
const clampQty = (q) => Math.max(0, Math.min(MAX_QTY, Math.floor(Number(q) || 0)));

function emit() {
  window.dispatchEvent(new CustomEvent('cart:change', { detail: { items: getItems(), count: count() } }));
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('No se pudo guardar el carrito', err);
  }
  emit();
}

export const getItems = () => items.map((i) => ({ ...i }));
export const getQty = (id) => items.find((i) => i.id === id)?.cantidad ?? 0;
export const isEmpty = () => items.length === 0;
export const count = () => items.reduce((acc, i) => acc + i.cantidad, 0);

export function add(product, qty = 1) {
  const pid = product._id ?? product.id;
  const existing = items.find((i) => i.id === pid);
  if (existing) {
    existing.cantidad = clampQty(existing.cantidad + qty) || 1;
  } else {
    items.push({
      id: pid,
      nombre: product.nombre,
      precio: Number(product.precio),
      imagen: product.imagen,
      categoria: product.categoria,
      cantidad: clampQty(qty) || 1,
    });
  }
  persist();
  return getQty(pid);
}

export function setQty(id, qty) {
  const q = clampQty(qty);
  if (q === 0) return remove(id);
  const item = items.find((i) => i.id === id);
  if (item) {
    item.cantidad = q;
    persist();
  }
}

export const increment = (id) => setQty(id, getQty(id) + 1);
export const decrement = (id) => setQty(id, getQty(id) - 1);

export function remove(id) {
  items = items.filter((i) => i.id !== id);
  persist();
}

export function clear() {
  items = [];
  persist();
}

export const lineSubtotal = (item) => (toCents(item.precio) * item.cantidad) / 100;

/** Desglose completo: subtotal, envío, impuestos y total. */
export function totals() {
  const subtotalC = items.reduce((acc, i) => acc + toCents(i.precio) * i.cantidad, 0);
  const envioC = subtotalC > 0 ? toCents(PRICING.costoEnvio) : 0;
  const impuestosC = Math.round(subtotalC * PRICING.tasaImpuesto);
  return {
    subtotal: subtotalC / 100,
    envio: envioC / 100,
    impuestos: impuestosC / 100,
    total: (subtotalC + envioC + impuestosC) / 100,
  };
}

/** Sincroniza precios/nombres con el catálogo actual y elimina productos que ya no existen. */
export function syncWithCatalog(productos) {
  const byId = new Map(productos.map((p) => [p._id, p]));
  const removed = [];
  const priceChanged = [];

  items = items.filter((i) => {
    const p = byId.get(i.id);
    if (!p) {
      removed.push(i.nombre);
      return false;
    }
    if (toCents(p.precio) !== toCents(i.precio)) priceChanged.push(p.nombre);
    Object.assign(i, { nombre: p.nombre, precio: Number(p.precio), imagen: p.imagen, categoria: p.categoria });
    return true;
  });

  persist();
  return { removed, priceChanged };
}

/** Payload para POST /api/pedidos */
export const toOrderItems = () => items.map((i) => ({ producto: i.id, cantidad: i.cantidad }));

export function onChange(callback) {
  window.addEventListener('cart:change', (e) => callback(e.detail));
}

// Sincroniza entre pestañas
window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    items = read();
    emit();
  }
});
