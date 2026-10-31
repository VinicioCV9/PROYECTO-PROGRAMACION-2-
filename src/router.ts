import { Router } from 'express';
import {
  register, login, getMe,
  getProducts, getCategories, getProductById, getAllProductsAdmin,
  createProduct, updateProduct, toggleAvailability, deleteProduct,
  createOrder, getMyOrders, getOrderById, cancelMyOrder,
  getAllOrders, updateOrderStatus, getStats,
} from './handlers';
import { verifyToken, isAdmin } from './middlewares/auth';
import { validarPedido, validarObjectId, validarEstado } from './middlewares/validarPedido';

const router = Router();

// ---------- Salud y configuración pública ----------
router.get('/health', (_req, res) => res.json({ ok: true, status: 'up', time: new Date().toISOString() }));
router.get('/config', (_req, res) =>
  res.json({
    ok: true,
    data: { costoEnvio: Number(process.env.COSTO_ENVIO ?? 2.5), tasaImpuesto: Number(process.env.TASA_IMPUESTO ?? 0.13) },
  }),
);

// ---------- Autenticación ----------
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', verifyToken, getMe);

// ---------- Productos (catálogo público) ----------
router.get('/productos', getProducts);
router.get('/productos/categorias', getCategories);
router.get('/productos/:id', validarObjectId, getProductById);

// ---------- Productos (admin) ----------
router.post('/productos', verifyToken, isAdmin, createProduct);
router.put('/productos/:id', verifyToken, isAdmin, validarObjectId, updateProduct);
router.patch('/productos/:id/disponibilidad', verifyToken, isAdmin, validarObjectId, toggleAvailability);
router.delete('/productos/:id', verifyToken, isAdmin, validarObjectId, deleteProduct);

// ---------- Pedidos (cliente) ----------
router.post('/pedidos', verifyToken, validarPedido, createOrder);
router.get('/pedidos/mis-pedidos', verifyToken, getMyOrders);
router.get('/pedidos/:id', verifyToken, validarObjectId, getOrderById);
router.patch('/pedidos/:id/cancelar', verifyToken, validarObjectId, cancelMyOrder);

// ---------- Pedidos (admin) ----------
router.get('/pedidos', verifyToken, isAdmin, getAllOrders);
router.patch('/pedidos/:id/estado', verifyToken, isAdmin, validarObjectId, validarEstado, updateOrderStatus);

// ---------- Panel de administración ----------
router.get('/admin/stats', verifyToken, isAdmin, getStats);
router.get('/admin/productos', verifyToken, isAdmin, getAllProductsAdmin);

export default router;
