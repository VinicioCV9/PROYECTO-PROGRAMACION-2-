import { API_BASE, REQUEST_TIMEOUT_MS, STORAGE_KEYS, PRICING } from './config.js';

export class ApiError extends Error {
  constructor(message, status = 0, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Wrapper de Fetch:
 *  - adjunta automáticamente `Authorization: Bearer <token>`
 *  - timeout con AbortController
 *  - normaliza errores a ApiError
 *  - si un token es rechazado (401) cierra la sesión y redirige a login
 */
async function request(path, { method = 'GET', body, params, timeout = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const token = localStorage.getItem(STORAGE_KEYS.token);

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString()
    : '';

  try {
    const res = await fetch(`${API_BASE}${path}${qs}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);

    if (res.status === 401 && token) handleExpiredSession(data?.error);

    if (!res.ok || data?.ok === false) {
      throw new ApiError(data?.error || `Error ${res.status} del servidor.`, res.status, data?.details);
    }
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') throw new ApiError('El servidor tardó demasiado en responder.');
    throw new ApiError('No se pudo conectar con el servidor. ¿Está encendido?');
  } finally {
    clearTimeout(timer);
  }
}

function handleExpiredSession(message) {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
  if (location.pathname.endsWith('login.html')) return;
  sessionStorage.setItem(STORAGE_KEYS.flash, JSON.stringify({ message: message || 'Tu sesión expiró.', type: 'warning' }));
  const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
  location.replace(`login.html?next=${next}`);
}

const get = (path, params) => request(path, { params });
const post = (path, body) => request(path, { method: 'POST', body });
const put = (path, body) => request(path, { method: 'PUT', body });
const patch = (path, body = {}) => request(path, { method: 'PATCH', body });
const del = (path) => request(path, { method: 'DELETE' });
const id = (v) => encodeURIComponent(v);

export const api = {
  config: {
    /** Sincroniza envío/impuesto con el servidor (silencioso si falla). */
    async load() {
      try {
        const { data } = await get('/config');
        Object.assign(PRICING, data);
      } catch { /* se usan los valores por defecto */ }
      return PRICING;
    },
  },
  auth: {
    login: (email, password) => post('/auth/login', { email, password }),
    register: (payload) => post('/auth/register', payload),
    me: () => get('/auth/me'),
  },
  productos: {
    list: (params) => get('/productos', params),
    categorias: () => get('/productos/categorias'),
    get: (pid) => get(`/productos/${id(pid)}`),
  },
  pedidos: {
    create: (payload) => post('/pedidos', payload),
    mine: () => get('/pedidos/mis-pedidos'),
    get: (oid) => get(`/pedidos/${id(oid)}`),
    cancel: (oid) => patch(`/pedidos/${id(oid)}/cancelar`),
  },
  admin: {
    stats: () => get('/admin/stats'),
    pedidos: (params) => get('/pedidos', params),
    updateEstado: (oid, estado) => patch(`/pedidos/${id(oid)}/estado`, { estado }),
    productos: () => get('/admin/productos'),
    createProducto: (payload) => post('/productos', payload),
    updateProducto: (pid, payload) => put(`/productos/${id(pid)}`, payload),
    toggleProducto: (pid) => patch(`/productos/${id(pid)}/disponibilidad`),
    deleteProducto: (pid) => del(`/productos/${id(pid)}`),
  },
};
