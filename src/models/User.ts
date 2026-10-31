import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export const ROLES = ['cliente', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export interface IUser {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
  direccion?: string;
  rol: Role;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'El email es obligatorio'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Email inválido'],
    },
    // select:false -> nunca se devuelve salvo que se pida explícitamente con .select('+password')
    password: { type: String, required: true, select: false },
    telefono: { type: String, trim: true, maxlength: 20 },
    direccion: { type: String, trim: true, maxlength: 200 },
    rol: { type: String, enum: ROLES, default: 'cliente' },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.password;
        return ret;
      },
    },
  },
);

const User: Model<IUser> = model<IUser>('User', userSchema);
export default User;
