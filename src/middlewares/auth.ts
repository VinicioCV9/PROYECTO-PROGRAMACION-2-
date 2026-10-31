import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { verifyJWT } from '../utils/auth';
import { HttpError } from './errorHandler';

/** Exige un JWT válido en `Authorization: Bearer <token>` y carga el usuario en req.user. */
export const verifyToken: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'No autorizado: inicia sesión para continuar.'));
  }

  try {
    const { id } = verifyJWT(token);
    const user = await User.findById(id);
    if (!user) return next(new HttpError(401, 'La sesión ya no es válida.'));
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new HttpError(401, 'Tu sesión expiró. Inicia sesión de nuevo.'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new HttpError(401, 'Token inválido.'));
    }
    next(error);
  }
};

/** Debe ir después de verifyToken. Usa el rol de la BD (no el del token) como fuente de verdad. */
export const isAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.rol !== 'admin') {
    return next(new HttpError(403, 'Acceso denegado: se requiere rol de administrador.'));
  }
  next();
};
