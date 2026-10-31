import type { Request, Response } from 'express';
import Product, { CATEGORIAS, type Categoria, type IProduct } from '../models/Product';
import { HttpError } from '../middlewares/errorHandler';

type ProductInput = Partial<Pick<IProduct, 'nombre' | 'descripcion' | 'precio' | 'categoria' | 'imagen' | 'disponible' | 'destacado'>>;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Normaliza y valida el body de creación/edición.
 * @param parcial true en edición (solo se validan los campos enviados)
 */
function parseProductBody(body: Record<string, unknown>, parcial = false): ProductInput {
  const data: ProductInput = {};
  const errores: Record<string, string> = {};
  const has = (k: string) => body[k] !== undefined;

  if (!parcial || has('nombre')) {
    const nombre = String(body.nombre ?? '').trim();
    if (nombre.length < 3) errores.nombre = 'El nombre debe tener al menos 3 caracteres.';
    data.nombre = nombre;
  }
  if (!parcial || has('precio')) {
    const precio = Number(body.precio);
    if (!Number.isFinite(precio) || precio <= 0 || precio > 10_000) errores.precio = 'Ingresa un precio válido mayor a 0.';
    data.precio = precio;
  }
  if (!parcial || has('categoria')) {
    const categoria = String(body.categoria ?? '') as Categoria;
    if (!CATEGORIAS.includes(categoria)) errores.categoria = 'Selecciona una categoría válida.';
    data.categoria = categoria;
  }
  if (has('descripcion')) data.descripcion = String(body.descripcion).trim().slice(0, 400);
  if (has('imagen')) data.imagen = String(body.imagen).trim();
  if (has('disponible')) data.disponible = Boolean(body.disponible);
  if (has('destacado')) data.destacado = Boolean(body.destacado);

  if (Object.keys(errores).length) throw new HttpError(422, 'Revisa los datos del producto.', errores);
  return data;
}

/** GET /api/productos — catálogo público (solo disponibles). Filtros: ?categoria=&q= */
export async function getProducts(req: Request, res: Response) {
  const filtro: Record<string, unknown> = { disponible: true };
  const categoria = String(req.query.categoria ?? '');
  const q = String(req.query.q ?? '').trim();

  if (CATEGORIAS.includes(categoria as Categoria)) filtro.categoria = categoria;
  if (q) filtro.nombre = { $regex: escapeRegex(q), $options: 'i' };

  const productos = await Product.find(filtro).sort({ destacado: -1, categoria: 1, nombre: 1 }).lean();
  res.json({ ok: true, data: productos });
}

/** GET /api/productos/categorias */
export function getCategories(_req: Request, res: Response) {
  res.json({ ok: true, data: CATEGORIAS });
}

/** GET /api/productos/:id */
export async function getProductById(req: Request, res: Response) {
  const producto = await Product.findById(req.params.id).lean();
  if (!producto || !producto.disponible) throw new HttpError(404, 'Producto no encontrado.');
  res.json({ ok: true, data: producto });
}

/** GET /api/admin/productos — admin: incluye no disponibles. */
export async function getAllProductsAdmin(_req: Request, res: Response) {
  const productos = await Product.find().sort({ categoria: 1, nombre: 1 }).lean();
  res.json({ ok: true, data: productos });
}

/** POST /api/productos — admin */
export async function createProduct(req: Request, res: Response) {
  const producto = await Product.create(parseProductBody(req.body ?? {}));
  res.status(201).json({ ok: true, message: 'Producto creado.', data: producto });
}

/** PUT /api/productos/:id — admin */
export async function updateProduct(req: Request, res: Response) {
  const producto = await Product.findByIdAndUpdate(req.params.id, parseProductBody(req.body ?? {}, true), {
    new: true,
    runValidators: true,
  });
  if (!producto) throw new HttpError(404, 'Producto no encontrado.');
  res.json({ ok: true, message: 'Producto actualizado.', data: producto });
}

/** PATCH /api/productos/:id/disponibilidad — admin: alterna disponible/agotado. */
export async function toggleAvailability(req: Request, res: Response) {
  const producto = await Product.findById(req.params.id);
  if (!producto) throw new HttpError(404, 'Producto no encontrado.');
  producto.disponible = !producto.disponible;
  await producto.save();
  res.json({
    ok: true,
    message: producto.disponible ? 'Producto disponible.' : 'Producto marcado como agotado.',
    data: producto,
  });
}

/** DELETE /api/productos/:id — admin. Los pedidos conservan su snapshot del producto. */
export async function deleteProduct(req: Request, res: Response) {
  const producto = await Product.findByIdAndDelete(req.params.id);
  if (!producto) throw new HttpError(404, 'Producto no encontrado.');
  res.json({ ok: true, message: `"${producto.nombre}" eliminado.`, data: { id: producto.id } });
}
