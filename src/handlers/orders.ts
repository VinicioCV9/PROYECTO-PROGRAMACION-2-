import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import Order, { ESTADOS_PEDIDO, TRANSICIONES, type EstadoPedido, type IOrderItem } from '../models/Order';
import Product from '../models/Product';
import User from '../models/User';
import { HttpError } from '../middlewares/errorHandler';

// ---------- Reglas de negocio (fuente de verdad en el servidor) ----------
const COSTO_ENVIO = Number(process.env.COSTO_ENVIO ?? 2.5);
const TASA_IMPUESTO = Number(process.env.TASA_IMPUESTO ?? 0.13);

const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

function generarNumeroOrden(): string {
  const d = new Date();
  const fecha = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `FX-${fecha}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

/** Tiempo estimado de entrega según estado y cantidad de unidades. */
function tiempoEstimado(estado: EstadoPedido, unidades: number) {
  if (estado === 'entregado' || estado === 'cancelado') return null;
  const extra = Math.min(unidades, 10) * 2;
  const base = { pendiente: 25, en_preparacion: 18, en_camino: 8 }[estado];
  return { min: base + extra, max: base + extra + 12 };
}

function serialize(order: InstanceType<typeof Order>) {
  const json = order.toJSON();
  const unidades = order.items.reduce((acc, i) => acc + i.cantidad, 0);
  return { ...json, unidades, tiempoEstimado: tiempoEstimado(order.estado, unidades) };
}

/** POST /api/pedidos — cliente autenticado. Recalcula precios desde la BD. */
export async function createOrder(req: Request, res: Response) {
  const { items, entrega, metodoPago, notas } = req.pedido!;
  const user = req.user!;

  const ids = items.map((i) => i.producto);
  const productos = await Product.find({ _id: { $in: ids }, disponible: true });
  const mapa = new Map(productos.map((p) => [p.id as string, p]));

  const faltantes = ids.filter((id) => !mapa.has(id));
  if (faltantes.length) {
    throw new HttpError(422, 'Algunos productos ya no están disponibles. Actualiza tu carrito.', {
      items: faltantes.join(','),
    });
  }

  let subtotalCents = 0;
  const detalle: IOrderItem[] = items.map(({ producto, cantidad }) => {
    const p = mapa.get(producto)!;
    const lineCents = toCents(p.precio) * cantidad;
    subtotalCents += lineCents;
    return { producto: p._id, nombre: p.nombre, imagen: p.imagen, precio: p.precio, cantidad, subtotal: fromCents(lineCents) };
  });

  const envioCents = toCents(COSTO_ENVIO);
  const impuestosCents = Math.round(subtotalCents * TASA_IMPUESTO);
  const totalCents = subtotalCents + envioCents + impuestosCents;

  // Reintenta en el improbable caso de colisión del número de orden (índice único).
  let order: InstanceType<typeof Order> | null = null;
  for (let intento = 0; intento < 3 && !order; intento++) {
    try {
      order = await Order.create({
        numeroOrden: generarNumeroOrden(),
        usuario: user._id,
        items: detalle,
        entrega,
        metodoPago,
        notas,
        subtotal: fromCents(subtotalCents),
        envio: fromCents(envioCents),
        impuestos: fromCents(impuestosCents),
        total: fromCents(totalCents),
      });
    } catch (err) {
      if ((err as { code?: number }).code !== 11000 || intento === 2) throw err;
    }
  }

  // Recuerda teléfono y dirección para autocompletar el próximo checkout.
  await User.updateOne({ _id: user._id }, { telefono: entrega.telefono, direccion: entrega.direccion });

  res
    .status(201)
    .location(`/api/pedidos/${order!.id}`)
    .json({ ok: true, message: '¡Pedido registrado con éxito!', data: serialize(order!) });
}

/** GET /api/pedidos/mis-pedidos — historial del cliente autenticado. */
export async function getMyOrders(req: Request, res: Response) {
  const pedidos = await Order.find({ usuario: req.user!._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ ok: true, data: pedidos.map(serialize) });
}

/** GET /api/pedidos/:id — dueño del pedido o admin. */
export async function getOrderById(req: Request, res: Response) {
  const pedido = await Order.findById(req.params.id).populate('usuario', 'nombre email');
  const user = req.user!;
  const duenoId = (pedido?.usuario as unknown as { _id?: unknown })?._id ?? pedido?.usuario;

  // 404 (no 403) para no revelar la existencia de pedidos ajenos.
  if (!pedido || (user.rol !== 'admin' && String(duenoId) !== user.id)) {
    throw new HttpError(404, 'Pedido no encontrado.');
  }
  res.json({ ok: true, data: serialize(pedido) });
}

/** PATCH /api/pedidos/:id/cancelar — el cliente cancela su pedido mientras esté pendiente. */
export async function cancelMyOrder(req: Request, res: Response) {
  const pedido = await Order.findOne({ _id: req.params.id, usuario: req.user!._id });
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado.');
  if (pedido.estado !== 'pendiente') {
    throw new HttpError(409, 'Solo puedes cancelar pedidos que aún no se están preparando.');
  }
  pedido.estado = 'cancelado';
  pedido.historial.push({ estado: 'cancelado', fecha: new Date() });
  await pedido.save();
  res.json({ ok: true, message: 'Pedido cancelado.', data: serialize(pedido) });
}

// ============================ ADMIN ============================

/** GET /api/pedidos — admin. Filtros: ?estado=&q=&page=&limit= */
export async function getAllOrders(req: Request, res: Response) {
  const filtro: Record<string, unknown> = {};
  const estado = String(req.query.estado ?? '');
  const q = String(req.query.q ?? '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  if (ESTADOS_PEDIDO.includes(estado as EstadoPedido)) filtro.estado = estado;
  if (q) {
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    filtro.$or = [{ numeroOrden: rx }, { 'entrega.nombre': rx }, { 'entrega.telefono': rx }];
  }

  const [pedidos, total] = await Promise.all([
    Order.find(filtro)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('usuario', 'nombre email'),
    Order.countDocuments(filtro),
  ]);

  res.json({
    ok: true,
    data: pedidos.map(serialize),
    meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}

/** PATCH /api/pedidos/:id/estado — admin. Respeta el flujo definido en TRANSICIONES. */
export async function updateOrderStatus(req: Request, res: Response) {
  const nuevo = req.nuevoEstado!;
  const pedido = await Order.findById(req.params.id);
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado.');

  if (!TRANSICIONES[pedido.estado].includes(nuevo)) {
    throw new HttpError(409, `No se puede pasar de "${pedido.estado}" a "${nuevo}".`);
  }

  pedido.estado = nuevo;
  pedido.historial.push({ estado: nuevo, fecha: new Date() });
  await pedido.save();
  await pedido.populate('usuario', 'nombre email');

  res.json({ ok: true, message: `Pedido ${pedido.numeroOrden} actualizado.`, data: serialize(pedido) });
}

/** GET /api/admin/stats — métricas del dashboard. */
export async function getStats(_req: Request, res: Response) {
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);

  const [porEstado, ingresos, hoy, topProductos, totalProductos, totalClientes] = await Promise.all([
    Order.aggregate<{ _id: EstadoPedido; count: number }>([{ $group: { _id: '$estado', count: { $sum: 1 } } }]),
    Order.aggregate<{ total: number }>([
      { $match: { estado: { $ne: 'cancelado' } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Order.aggregate<{ count: number; total: number }>([
      { $match: { createdAt: { $gte: inicioDia }, estado: { $ne: 'cancelado' } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$total' } } },
    ]),
    Order.aggregate<{ _id: string; unidades: number; ingresos: number }>([
      { $match: { estado: { $ne: 'cancelado' } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.nombre', unidades: { $sum: '$items.cantidad' }, ingresos: { $sum: '$items.subtotal' } } },
      { $sort: { unidades: -1 } },
      { $limit: 5 },
    ]),
    Product.countDocuments(),
    User.countDocuments({ rol: 'cliente' }),
  ]);

  const estados = Object.fromEntries(ESTADOS_PEDIDO.map((e) => [e, 0])) as Record<EstadoPedido, number>;
  porEstado.forEach(({ _id, count }) => (estados[_id] = count));

  res.json({
    ok: true,
    data: {
      estados,
      totalPedidos: Object.values(estados).reduce((a, b) => a + b, 0),
      ingresosTotales: Math.round((ingresos[0]?.total ?? 0) * 100) / 100,
      pedidosHoy: hoy[0]?.count ?? 0,
      ingresosHoy: Math.round((hoy[0]?.total ?? 0) * 100) / 100,
      topProductos: topProductos.map((p) => ({ nombre: p._id, unidades: p.unidades, ingresos: Math.round(p.ingresos * 100) / 100 })),
      totalProductos,
      totalClientes,
    },
  });
}
