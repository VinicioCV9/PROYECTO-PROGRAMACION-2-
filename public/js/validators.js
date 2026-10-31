/**
 * Validaciones de formularios (login, registro y checkout).
 * Usa las clases de Bootstrap `.is-invalid` + `.invalid-feedback` para mostrar errores.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFONO_RE = /^[+\d][\d\s-]{6,18}$/;
const v = (x) => String(x ?? '').trim();

export const rules = {
  required: (msg) => (x) => (v(x) ? '' : msg),
  email: (x) => (EMAIL_RE.test(v(x)) ? '' : 'Ingresa un email válido.'),
  minLen: (n, msg) => (x) => (v(x).length >= n ? '' : msg),
  password: (x) =>
    String(x ?? '').length >= 8 && /[A-Za-z]/.test(x) && /\d/.test(x)
      ? ''
      : 'Mínimo 8 caracteres, con letras y números.',
  telefono: (x) => (TELEFONO_RE.test(v(x)) ? '' : 'Ingresa un teléfono válido (ej. 8888-8888).'),
  oneOf: (list, msg) => (x) => (list.includes(v(x)) ? '' : msg),
  matches: (field, msg) => (x, data) => (x === data[field] ? '' : msg),
  optional: (rule) => (x, data) => (v(x) ? rule(x, data) : ''),
  precio: (x) => (Number(x) > 0 && Number(x) <= 10000 ? '' : 'Ingresa un precio válido mayor a 0.'),
};

export const schemas = {
  login: {
    email: [rules.email],
    password: [rules.required('Ingresa tu contraseña.')],
  },
  registro: {
    nombre: [rules.minLen(3, 'Tu nombre debe tener al menos 3 caracteres.')],
    email: [rules.email],
    password: [rules.password],
    confirmar: [rules.matches('password', 'Las contraseñas no coinciden.')],
    telefono: [rules.optional(rules.telefono)],
    direccion: [rules.optional(rules.minLen(8, 'Agrega una dirección más detallada (mín. 8 caracteres).'))],
  },
  producto: {
    nombre: [rules.minLen(3, 'El nombre debe tener al menos 3 caracteres.')],
    precio: [rules.precio],
    categoria: [rules.required('Selecciona una categoría.')],
  },
  checkout: {
    nombre: [rules.minLen(3, 'Ingresa el nombre de quien recibe.')],
    telefono: [rules.telefono],
    direccion: [rules.minLen(8, 'Agrega una dirección más detallada (mín. 8 caracteres).')],
    metodoPago: [rules.oneOf(['efectivo', 'tarjeta'], 'Selecciona un método de pago.')],
  },
};

/** Valida un objeto plano contra un schema. Devuelve { valid, errors }. */
export function validate(data, schema) {
  const errors = {};
  for (const [field, fieldRules] of Object.entries(schema)) {
    for (const rule of fieldRules) {
      const msg = rule(data[field], data);
      if (msg) {
        errors[field] = msg;
        break;
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Pinta/limpia errores en el formulario. Cada input debe tener `name` y un hermano `.invalid-feedback`. */
export function showErrors(form, errors = {}) {
  form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
  for (const [field, msg] of Object.entries(errors)) {
    const inputs = form.querySelectorAll(`[name="${field}"]`);
    if (!inputs.length) continue;
    inputs.forEach((input) => input.classList.add('is-invalid'));
    const feedback = form.querySelector(`[data-feedback="${field}"]`) ?? inputs[0].parentElement.querySelector('.invalid-feedback');
    if (feedback) {
      feedback.textContent = msg;
      feedback.classList.add('d-block');
    }
  }
  form.querySelectorAll('.invalid-feedback').forEach((fb) => {
    const field = fb.dataset.feedback ?? fb.parentElement.querySelector('[name]')?.name;
    if (field && !errors[field]) fb.classList.remove('d-block');
  });
  const first = form.querySelector('.is-invalid');
  first?.focus({ preventScroll: false });
}

/** Valida en vivo al salir de cada campo (y re-valida mientras escribe si ya estaba inválido). */
export function liveValidate(form, schema) {
  const check = (e) => {
    const name = e.target.name;
    if (!schema[name]) return;
    const data = Object.fromEntries(new FormData(form));
    const { errors } = validate(data, { [name]: schema[name] });
    const input = form.querySelector(`[name="${name}"]`);
    const fb = form.querySelector(`[data-feedback="${name}"]`) ?? input?.parentElement.querySelector('.invalid-feedback');
    form.querySelectorAll(`[name="${name}"]`).forEach((el) => el.classList.toggle('is-invalid', Boolean(errors[name])));
    if (fb) {
      fb.textContent = errors[name] ?? '';
      fb.classList.toggle('d-block', Boolean(errors[name]));
    }
  };
  form.addEventListener('focusout', check);
  form.addEventListener('input', (e) => e.target.classList.contains('is-invalid') && check(e));
  form.addEventListener('change', (e) => e.target.type === 'radio' && check(e));
}
