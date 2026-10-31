import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import colors from 'colors';

/** Error HTTP con código de estado y detalles opcionales (p. ej. errores por campo). */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** 404 para rutas /api inexistentes. */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};

/** Manejador centralizado: traduce cualquier error a una respuesta JSON consistente. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let message = 'Error interno del servidor.';
  let details: Record<string, string> | undefined;

  if (err instanceof HttpError) {
    ({ status, message, details } = err);
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    message = 'Datos inválidos.';
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Valor inválido para "${err.path}".`;
  } else if (err?.code === 11000) {
    status = 409;
    const campo = Object.keys(err.keyValue ?? {})[0] ?? 'campo';
    message = campo === 'email' ? 'Ese email ya está registrado.' : `El valor de "${campo}" ya existe.`;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'El cuerpo de la petición no es JSON válido.';
  }

  if (status >= 500) console.error(colors.red('✖'), err);

  res.status(status).json({ ok: false, error: message, ...(details && { details }) });
};
