import type { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import { ESTADOS_PEDIDO, METODOS_PAGO, type EstadoPedido, type MetodoPago } from '../models/Order';
import { HttpError } from './errorHandler';

const MAX_CANTIDAD = 99;
const TELEFONO_RE = /^[+\d][\d\s-]{6,18}$/;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Valida y normaliza el cuerpo de POST /api/pedidos:
 *  - carrito no vacío, IDs válidos, cantidades 1..99 (agrupa duplicados)
 *  - datos de entrega completos y método de pago permitido
 * El precio NUNCA se toma del cliente: se recalcula en el handler con la BD.
 */
export const validarPedido: RequestHandler = (req, _res, next) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const entrega = (body.entrega ?? {}) as Record<string, unknown>;
  const errores: Record<string, string> = {};

  const nombre = str(entrega.nombre);
  const telefono = str(entrega.telefono);
  const direccion = str(entrega.direccion);
  const referencias = str(entrega.referencias).slice(0, 200);
  const metodoPago = str(body.metodoPago) || 'efectivo';
  const notas = str(body.notas).slice(0, 300);

  if (nombre.length < 3) errores.nombre = 'Ingresa el nombre de quien recibe (mín. 3 caracteres).';
  if (!TELEFONO_RE.test(telefono)) errores.telefono = 'Ingresa un teléfono válido.';
  if (direccion.length < 8) errores.direccion = 'Ingresa una dirección de entrega más detallada.';
  if (!METODOS_PAGO.includes(metodoPago as MetodoPago)) errores.metodoPago = 'Método de pago inválido.';

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) errores.items = 'El carrito está vacío.';

  const agrupados = new Map<string, number>();
  for (const raw of rawItems as Record<string, unknown>[]) {
    const id = str(raw?.producto);
    const cantidad = Number(raw?.cantidad);
    if (!isValidObjectId(id) || !Number.isInteger(cantidad) || cantidad < 1) {
      errores.items = 'El carrito contiene productos o cantidades inválidas.';
      break;
    }
    agrupados.set(id, Math.min(MAX_CANTIDAD, (agrupados.get(id) ?? 0) + cantidad));
  }

  if (Object.keys(errores).length > 0) {
    return next(new HttpError(422, 'Revisa los datos del pedido.', errores));
  }

  req.pedido = {
    items: [...agrupados].map(([producto, cantidad]) => ({ producto, cantidad })),
    entrega: { nombre, telefono, direccion, referencias },
    metodoPago: metodoPago as MetodoPago,
    notas,
  };
  next();
};

/** Valida que `:id` sea un ObjectId de MongoDB. */
export const validarObjectId: RequestHandler = (req, _res, next) => {
  if (!isValidObjectId(req.params.id)) return next(new HttpError(400, 'ID inválido.'));
  next();
};

/** Valida el cuerpo de PATCH /api/pedidos/:id/estado. */
export const validarEstado: RequestHandler = (req, _res, next) => {
  const estado = str((req.body ?? {}).estado);
  if (!ESTADOS_PEDIDO.includes(estado as EstadoPedido)) {
    return next(new HttpError(422, `Estado inválido. Usa: ${ESTADOS_PEDIDO.join(', ')}.`));
  }
  req.nuevoEstado = estado as EstadoPedido;
  next();
};
