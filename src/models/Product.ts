import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export const CATEGORIAS = ['Hamburguesas', 'Pizzas', 'Mexicana', 'Saludable', 'Postres', 'Bebidas'] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export interface IProduct {
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: Categoria;
  imagen: string;
  disponible: boolean;
  destacado: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductDocument = HydratedDocument<IProduct>;

const productSchema = new Schema<IProduct>(
  {
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, maxlength: 100 },
    descripcion: { type: String, trim: true, default: '', maxlength: 400 },
    precio: {
      type: Number,
      required: [true, 'El precio es obligatorio'],
      min: [0.01, 'El precio debe ser mayor a 0'],
      set: (v: number) => Math.round(v * 100) / 100,
    },
    categoria: {
      type: String,
      required: [true, 'La categoría es obligatoria'],
      enum: { values: CATEGORIAS, message: 'Categoría inválida' },
    },
    imagen: { type: String, trim: true, default: '' },
    disponible: { type: Boolean, default: true },
    destacado: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

productSchema.index({ categoria: 1, disponible: 1 });

const Product: Model<IProduct> = model<IProduct>('Product', productSchema);
export default Product;
