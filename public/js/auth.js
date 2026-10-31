import { STORAGE_KEYS } from './config.js';
import { api } from './api.js';

/** Decodifica el payload del JWT (sin verificar firma: solo para leer `exp` en el cliente). */
function decodeJWT(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(base64))));
  } catch {
    return null;
  }
}

function isExpired(token) {
  const payload = decodeJWT(token);
  return !payload?.exp || payload.exp * 1000 <= Date.now();
}

export function getToken() {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  if (token && isExpired(token)) {
    clearSession();
    return null;
  }
  return token;
}

export function getUser() {
  if (!getToken()) return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || 'null');
  } catch {
    return null;
  }
}

export const isLoggedIn = () => Boolean(getUser());
export const isAdmin = () => getUser()?.rol === 'admin';

export function saveSession({ token, user }) {
  localStorage.setItem(STORAGE_KEYS.token, token);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('auth:change', { detail: user }));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
  window.dispatchEvent(new CustomEvent('auth:change', { detail: null }));
}

export function logout() {
  clearSession();
  sessionStorage.setItem(STORAGE_KEYS.flash, JSON.stringify({ message: 'Sesión cerrada. ¡Vuelve pronto!', type: 'info' }));
  location.href = 'index.html';
}

/** Página actual (para el parámetro ?next=). */
const currentPage = () => location.pathname.split('/').pop() + location.search;

/**
 * Guardia de rutas en el cliente.
 * @param {{ role?: 'admin' | 'cliente' }} opts
 * @returns usuario actual o null (si redirige)
 * Nota: es UX; la protección real la hace el backend (verifyToken + isAdmin).
 */
export function requireAuth({ role } = {}) {
  const user = getUser();
  if (!user) {
    sessionStorage.setItem(STORAGE_KEYS.flash, JSON.stringify({ message: 'Inicia sesión para continuar.', type: 'info' }));
    location.replace(`login.html?next=${encodeURIComponent(currentPage())}`);
    return null;
  }
  if (role === 'admin' && user.rol !== 'admin') {
    location.replace('index.html');
    return null;
  }
  return user;
}

/** Confirma con el servidor que el token sigue siendo válido y refresca los datos del usuario. */
export async function verifySession({ role } = {}) {
  const { data } = await api.auth.me();
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data));
  if (role === 'admin' && data.rol !== 'admin') {
    location.replace('index.html');
    return null;
  }
  return data;
}

/** Destino tras login: admin -> panel; cliente -> ?next o catálogo. Evita open-redirects. */
export function redirectAfterLogin(user) {
  const next = new URLSearchParams(location.search).get('next') || '';
  const safeNext = /^[\w-]+\.html(\?.*)?$/.test(next) && !next.startsWith('login.html') ? next : '';
  if (user.rol === 'admin' && (!safeNext || safeNext.startsWith('index.html'))) {
    location.replace('admin.html');
  } else if (safeNext === 'admin.html' && user.rol !== 'admin') {
    location.replace('index.html');
  } else {
    location.replace(safeNext || 'index.html');
  }
}
