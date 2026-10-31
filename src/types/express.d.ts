import type { UserDocument } from '../models/User';
import type { EstadoPedido, IEntrega, MetodoPago } from '../models/Order';

export interface PedidoValidado {
  items: { producto: string; cantidad: number }[];
  entrega: IEntrega;
  metodoPago: MetodoPago;
  notas: string;
}

declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado (lo inyecta el middleware verifyToken). */
      user?: UserDocument;
      /** Pedido normalizado (lo inyecta el middleware validarPedido). */
      pedido?: PedidoValidado;
      /** Nuevo estado validado (lo inyecta validarEstado). */
      nuevoEstado?: EstadoPedido;
    }
  }
}

export {};
