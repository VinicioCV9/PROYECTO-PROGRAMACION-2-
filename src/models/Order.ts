import { Schema, model, Types, type HydratedDocument, type Model } from 'mongoose';

export const ESTADOS_PEDIDO = ['pendiente', 'en_preparacion', 'en_camino', 'entregado', 'cancelado'] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const METODOS_PAGO = ['efectivo', 'tarjeta'] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

/** Transiciones permitidas en el flujo del pedido. */
export const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  pendiente: ['en_preparacion', 'cancelado'],
  en_preparacion: ['en_camino', 'cancelado'],
  en_camino: ['entregado'],
  entregado: [],
  cancelado: [],
};

/** Snapshot del producto al momento de la compra (precio/nombre congelados). */
export interface IOrderItem {
  producto: Types.ObjectId;
  nombre: string;
  imagen: string;
  precio: number;
  cantidad: number;
  subtotal: number;
}

export interface IEntrega {
  nombre: string;
  telefono: string;
  direccion: string;
  referencias?: string;
}

export interface IHistorial {
  estado: EstadoPedido;
  fecha: Date;
}

export interface IOrder {
  numeroOrden: string;
  usuario: Types.ObjectId;
  items: IOrderItem[];
  entrega: IEntrega;
  metodoPago: MetodoPago;
  notas?: string;
  subtotal: number;
  envio: number;
  impuestos: number;
  total: number;
  estado: EstadoPedido;
  historial: IHistorial[];
  createdAt: Date;
  updatedAt: Date;
}

export type OrderDocument = HydratedDocument<IOrder>;

const orderItemSchema = new Schema<IOrderItem>(
  {
    producto: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    nombre: { type: String, required: true },
    imagen: { type: String, default: '' },
    precio: { type: Number, required: true, min: 0 },
    cantidad: { type: Number, required: true, min: 1, max: 99 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    numeroOrden: { type: String, required: true, unique: true },
    usuario: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: {
      type: [orderItemSchema],
      validate: { validator: (v: IOrderItem[]) => v.length > 0, message: 'El pedido no tiene productos' },
    },
    entrega: {
      nombre: { type: String, required: true, trim: true },
      telefono: { type: String, required: true, trim: true },
      direccion: { type: String, required: true, trim: true },
      referencias: { type: String, trim: true, default: '' },
    },
    metodoPago: { type: String, enum: METODOS_PAGO, required: true },
    notas: { type: String, trim: true, default: '', maxlength: 300 },
    subtotal: { type: Number, required: true, min: 0 },
    envio: { type: Number, required: true, min: 0 },
    impuestos: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    estado: { type: String, enum: ESTADOS_PEDIDO, default: 'pendiente', index: true },
    historial: {
      type: [{ estado: { type: String, enum: ESTADOS_PEDIDO }, fecha: { type: Date, default: Date.now }, _id: false }],
      default: () => [{ estado: 'pendiente', fecha: new Date() }],
    },
  },
  { timestamps: true, versionKey: false },
);

orderSchema.index({ createdAt: -1 });

const Order: Model<IOrder> = model<IOrder>('Order', orderSchema);
export default Order;
