import colors from 'colors';
import Product, { type IProduct } from '../models/Product';
import User from '../models/User';
import Order from '../models/Order';
import { hashPassword } from './auth';

type SeedProduct = Pick<IProduct, 'nombre' | 'descripcion' | 'precio' | 'categoria' | 'imagen'> & { destacado?: boolean };

const PRODUCTOS: SeedProduct[] = [
  { nombre: 'Hamburguesa Clásica', descripcion: 'Carne de res 180 g, queso cheddar, lechuga, tomate, cebolla y salsa de la casa en pan brioche.', precio: 55, categoria: 'Hamburguesas', imagen: 'img/productos/hamburguesa-clasica.jpg', destacado: true },
  { nombre: 'Hamburguesa BBQ', descripcion: 'Doble carne, tocino crujiente, aros de cebolla, cheddar y salsa BBQ ahumada.', precio: 68, categoria: 'Hamburguesas', imagen: 'img/productos/hamburguesa-bbq.jpg' },
  { nombre: 'Pizza Margarita', descripcion: 'Salsa de tomate italiana, mozzarella fresca, albahaca y aceite de oliva extra virgen.', precio: 75, categoria: 'Pizzas', imagen: 'img/productos/pizza-margarita.jpg' },
  { nombre: 'Pizza Pepperoni', descripcion: 'Pepperoni crujiente en copa, mozzarella gratinada y orégano sobre masa artesanal.', precio: 85, categoria: 'Pizzas', imagen: 'img/productos/pizza-pepperoni.jpg', destacado: true },
  { nombre: 'Tacos al Pastor (3)', descripcion: 'Tortilla de maíz, cerdo marinado al pastor, piña asada, cebolla, cilantro y limón.', precio: 48, categoria: 'Mexicana', imagen: 'img/productos/tacos-pastor.jpg', destacado: true },
  { nombre: 'Burrito de Res', descripcion: 'Res deshebrada, arroz, frijoles negros, queso y pico de gallo. Incluye guacamole.', precio: 58, categoria: 'Mexicana', imagen: 'img/productos/burrito-res.jpg' },
  { nombre: 'Bowl de Pollo Teriyaki', descripcion: 'Pollo glaseado teriyaki, arroz, edamame, aguacate, zanahoria y ajonjolí.', precio: 62, categoria: 'Saludable', imagen: 'img/productos/bowl-teriyaki.jpg' },
  { nombre: 'Ensalada César', descripcion: 'Lechuga romana, pechuga a la parrilla, crutones, parmesano y aderezo César.', precio: 45, categoria: 'Saludable', imagen: 'img/productos/ensalada-cesar.jpg' },
  { nombre: 'Limonada de Hierbabuena', descripcion: 'Limonada natural frappé con hojas de hierbabuena fresca. 500 ml.', precio: 20, categoria: 'Bebidas', imagen: 'img/productos/limonada-hierbabuena.jpg' },
  { nombre: 'Batido de Fresa', descripcion: 'Batido cremoso de fresas naturales con crema batida. 450 ml.', precio: 28, categoria: 'Bebidas', imagen: 'img/productos/batido-fresa.jpg' },
  { nombre: 'Brownie con Helado', descripcion: 'Brownie tibio de chocolate semiamargo con bola de helado de vainilla y fudge.', precio: 35, categoria: 'Postres', imagen: 'img/productos/brownie-helado.jpg' },
  { nombre: 'Cheesecake de Frutos Rojos', descripcion: 'Cheesecake estilo New York con compota de frutos rojos y base de galleta.', precio: 38, categoria: 'Postres', imagen: 'img/productos/cheesecake-frutos.jpg', destacado: true },
];

/** Usuarios demo (credenciales documentadas en el README). */
const USUARIOS = [
  { nombre: 'Administrador FoodExpress', email: 'admin@foodexpress.com', password: 'Admin123', rol: 'admin' as const },
  { nombre: 'Cliente Demo', email: 'cliente@foodexpress.com', password: 'Cliente123', rol: 'cliente' as const, telefono: '5555-5555', direccion: 'Ciudad de Guatemala, Zona 10, 5a Avenida 12-31' },
];

interface SeedOptions {
  reset?: boolean;
  silentIfSeeded?: boolean;
}

/**
 * Carga productos y usuarios de prueba. Es idempotente:
 *  - Productos: solo si la colección está vacía (o con reset).
 *  - Usuarios: crea los que no existan (por email).
 */
export async function seedDatabase({ reset = false, silentIfSeeded = false }: SeedOptions = {}): Promise<void> {
  if (reset) {
    await Promise.all([Product.deleteMany({}), Order.deleteMany({}), User.deleteMany({ email: { $in: USUARIOS.map((u) => u.email) } })]);
    console.log(colors.yellow('⟲ Colecciones reiniciadas (productos, pedidos y usuarios demo).'));
  }

  let creados = 0;

  if ((await Product.estimatedDocumentCount()) === 0) {
    await Product.insertMany(PRODUCTOS);
    creados += PRODUCTOS.length;
    console.log(colors.green(`✔ ${PRODUCTOS.length} productos cargados.`));
  }

  for (const u of USUARIOS) {
    if (await User.exists({ email: u.email })) continue;
    await User.create({ ...u, password: await hashPassword(u.password) });
    creados++;
    console.log(colors.green(`✔ Usuario ${u.rol}: ${u.email} / ${u.password}`));
  }

  if (creados === 0 && !silentIfSeeded) console.log(colors.gray('• La base de datos ya tenía datos; no se insertó nada.'));
}

// ---------- Ejecución directa: npm run seed [-- --reset] ----------
if (require.main === module) {
  (async () => {
    (await import('dotenv')).config();
    const { connectDB, disconnectDB } = await import('../config/db');
    await connectDB();
    await seedDatabase({ reset: process.argv.includes('--reset') });
    await disconnectDB();
  })().catch((err) => {
    console.error(colors.red('✖ Error en el seeder:'), err);
    process.exit(1);
  });
}
