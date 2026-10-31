import { api } from '../api.js';
import { getUser, saveSession, redirectAfterLogin } from '../auth.js';
import { DEMO_USERS } from '../config.js';
import { schemas, validate, showErrors, liveValidate } from '../validators.js';
import { initPage, toast, setLoading, setFlash } from '../ui.js';

// Si ya hay sesión activa no tiene sentido mostrar el login
const current = getUser();
if (current) redirectAfterLogin(current);

initPage({ active: 'login' });

const $ = (sel) => document.querySelector(sel);
const els = {
  loginForm: $('#login-form'),
  loginBtn: $('#btn-login'),
  registroForm: $('#registro-form'),
  registroBtn: $('#btn-registro'),
  title: $('#auth-title'),
};

let submitting = false;

/* ---------------- Pestañas ---------------- */

const TITLES = {
  'tab-login': '¡Hola de nuevo! 👋',
  'tab-registro': 'Crea tu cuenta ✨',
};

document.querySelectorAll('#auth-tabs [data-bs-toggle="pill"]').forEach((tab) => {
  tab.addEventListener('shown.bs.tab', (e) => {
    els.title.textContent = TITLES[e.target.id];
    const isRegistro = e.target.id === 'tab-registro';
    history.replaceState(null, '', isRegistro ? `${location.pathname}${location.search}#registro` : `${location.pathname}${location.search}`);
    (isRegistro ? els.registroForm.nombre : els.loginForm.email).focus();
  });
});

if (location.hash === '#registro') bootstrap.Tab.getOrCreateInstance($('#tab-registro')).show();

/* ---------------- Credenciales de prueba ---------------- */

document.querySelectorAll('[data-demo-label]').forEach((el) => {
  const demo = DEMO_USERS[el.dataset.demoLabel];
  el.textContent = `${demo.email} / ${demo.password}`;
});

document.querySelectorAll('[data-demo]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const demo = DEMO_USERS[btn.dataset.demo];
    els.loginForm.email.value = demo.email;
    els.loginForm.password.value = demo.password;
    showErrors(els.loginForm, {});
    els.loginBtn.focus();
  });
});

/* ---------------- Mostrar / ocultar contraseña ---------------- */

document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.togglePassword);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = `<i class="bi ${show ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
    btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
});

/* ---------------- Sesión ---------------- */

function onAuthenticated({ token, user }, message) {
  saveSession({ token, user });
  setFlash(message, 'success');
  redirectAfterLogin(user);
}

els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submitting) return;

  const data = Object.fromEntries(new FormData(els.loginForm));
  const { valid, errors } = validate(data, schemas.login);
  showErrors(els.loginForm, errors);
  if (!valid) return;

  submitting = true;
  setLoading(els.loginBtn, true, 'Ingresando...');
  try {
    const res = await api.auth.login(data.email.trim(), data.password);
    onAuthenticated(res.data, res.message);
  } catch (err) {
    submitting = false;
    setLoading(els.loginBtn, false);
    if (err.status === 401) {
      showErrors(els.loginForm, { password: err.message });
      els.loginForm.password.select();
    }
    toast(err.message, 'error', 4500);
  }
});

els.registroForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submitting) return;

  const data = Object.fromEntries(new FormData(els.registroForm));
  const { valid, errors } = validate(data, schemas.registro);
  showErrors(els.registroForm, errors);
  if (!valid) return toast('Revisa los datos del registro.', 'error');

  submitting = true;
  setLoading(els.registroBtn, true, 'Creando cuenta...');
  try {
    const res = await api.auth.register({
      nombre: data.nombre.trim(),
      email: data.email.trim(),
      password: data.password,
      telefono: data.telefono.trim(),
      direccion: data.direccion.trim(),
    });
    onAuthenticated(res.data, res.message);
  } catch (err) {
    submitting = false;
    setLoading(els.registroBtn, false);
    if (err.details) showErrors(els.registroForm, err.details);
    toast(err.message, 'error', 4500);
  }
});

liveValidate(els.loginForm, schemas.login);
liveValidate(els.registroForm, schemas.registro);
