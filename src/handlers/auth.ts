import type { Request, Response } from 'express';
import User from '../models/User';
import { checkPassword, generateJWT, hashPassword } from '../utils/auth';
import { HttpError } from '../middlewares/errorHandler';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFONO_RE = /^[+\d][\d\s-]{6,18}$/;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Datos públicos del usuario que viajan al frontend. */
function toPublicUser(user: InstanceType<typeof User>) {
  return {
    id: user.id as string,
    nombre: user.nombre,
    email: user.email,
    telefono: user.telefono ?? '',
    direccion: user.direccion ?? '',
    rol: user.rol,
  };
}

/** POST /api/auth/register — siempre crea cuentas con rol "cliente". */
export async function register(req: Request, res: Response) {
  const nombre = str(req.body?.nombre);
  const email = str(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const telefono = str(req.body?.telefono).slice(0, 20);
  const direccion = str(req.body?.direccion).slice(0, 200);

  const errores: Record<string, string> = {};
  if (nombre.length < 3) errores.nombre = 'El nombre debe tener al menos 3 caracteres.';
  if (!EMAIL_RE.test(email)) errores.email = 'Ingresa un email válido.';
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errores.password = 'La contraseña debe tener mínimo 8 caracteres, con letras y números.';
  }
  if (telefono && !TELEFONO_RE.test(telefono)) errores.telefono = 'Ingresa un teléfono válido.';
  if (Object.keys(errores).length) throw new HttpError(422, 'Revisa los datos del registro.', errores);

  if (await User.exists({ email })) {
    throw new HttpError(409, 'Ese email ya está registrado.', { email: 'Ese email ya está registrado.' });
  }

  const user = await User.create({ nombre, email, telefono, direccion, password: await hashPassword(password), rol: 'cliente' });
  const token = generateJWT({ id: user.id, rol: user.rol });

  res.status(201).json({ ok: true, message: '¡Cuenta creada con éxito!', data: { token, user: toPublicUser(user) } });
}

/** POST /api/auth/login */
export async function login(req: Request, res: Response) {
  const email = str(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) throw new HttpError(422, 'Email y contraseña son obligatorios.');

  const user = await User.findOne({ email }).select('+password');
  // Mismo mensaje para email inexistente o contraseña incorrecta (evita enumeración de cuentas).
  if (!user || !(await checkPassword(password, user.password))) {
    throw new HttpError(401, 'Credenciales incorrectas.');
  }

  const token = generateJWT({ id: user.id, rol: user.rol });
  res.json({ ok: true, message: `¡Bienvenido, ${user.nombre.split(' ')[0]}!`, data: { token, user: toPublicUser(user) } });
}

/** GET /api/auth/me — valida el token y devuelve el usuario actual. */
export async function getMe(req: Request, res: Response) {
  res.json({ ok: true, data: toPublicUser(req.user!) });
}
