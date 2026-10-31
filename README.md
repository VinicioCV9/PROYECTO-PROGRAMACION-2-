# FoodExpress — Sistema Web de Pedidos de Comida a Domicilio

Proyecto del curso **Programación II**. Es una aplicación web completa para pedir comida a domicilio:

- **Clientes:** ven el menú, arman el carrito, hacen el pedido y siguen su estado en tiempo real.
- **Administradores:** gestionan pedidos y productos desde un panel.

| Capa | Tecnologías |
|---|---|
| Backend | Node.js 18+, TypeScript, Express 5, Mongoose 9 (MongoDB Atlas), JWT, bcrypt |
| Frontend | HTML, JavaScript con módulos ES, Tailwind CSS (Play CDN), Bootstrap 5.3, Bootstrap Icons |

El frontend lo sirve el mismo Express desde `public/`, así que solo hay un servidor que levantar.

---

## 1. Requisitos

- [Node.js](https://nodejs.org/) **18 o superior** (`node -v`)
- Una base de datos **MongoDB**: un clúster gratuito de [MongoDB Atlas](https://www.mongodb.com/atlas) o un MongoDB local.

## 2. Instalación

```bash
git clone <url-del-repositorio>
cd PROYECTO-PROGRAMACION-2-
npm install
```

## 3. Configuración del archivo `.env`

Crea un archivo `.env` en la raíz del proyecto (al lado de `package.json`):

```env
PORT=4000
NODE_ENV=development
# Orígenes permitidos por CORS (separados por coma). "*" = todos
CORS_ORIGIN=*

# ---------- MongoDB Atlas ----------
MONGO_URI=mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/foodexpress?retryWrites=true&w=majority

# ---------- JWT ----------
JWT_SECRET=pon_aqui_una_cadena_larga_y_aleatoria
JWT_EXPIRES_IN=7d

# ---------- Reglas de negocio ----------
COSTO_ENVIO=2.5
TASA_IMPUESTO=0.13

# ---------- Seeder ----------
AUTO_SEED=true
```

### Obtener la `MONGO_URI` en Atlas

1. En Atlas, crea un clúster gratuito (M0).
2. En **Database Access**, crea un usuario de base de datos con contraseña.
3. En **Network Access**, agrega tu IP. Para desarrollo puedes usar `0.0.0.0/0`.
4. Entra a **Database → Connect → Drivers**, copia la cadena de conexión y reemplaza `<usuario>`, `<password>` y `<cluster>`.
   - Agrega el nombre de la base (`/foodexpress`) antes del `?`.
   - Si la contraseña tiene caracteres especiales (`@`, `#`, `/`…), codifícalos en formato URL.

> Si tienes MongoDB instalado localmente, usa `MONGO_URI=mongodb://127.0.0.1:27017/foodexpress`.

### Generar el `JWT_SECRET`

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Si `JWT_SECRET` o `MONGO_URI` no están configurados, el servidor muestra el error y se detiene.

## 4. Ejecución

| Comando | Qué hace |
|---|---|
| `npm run dev` | Modo desarrollo con **nodemon + ts-node**: se reinicia al cambiar `src/` o `.env`. |
| `npm run build` | Compila TypeScript a `dist/`. |
| `npm start` | Ejecuta la versión compilada (`dist/index.js`). |
| `npm run typecheck` | Verifica los tipos sin generar archivos. |
| `npm run seed` | Carga los productos y usuarios demo que falten. |
| `npm run seed:reset` | **Borra** productos y pedidos, y vuelve a cargar los datos demo. |

Con `npm run dev`, abre **http://localhost:4000**.

Al arrancar con `AUTO_SEED=true`, si la base está vacía se cargan 12 platillos y dos usuarios de prueba.

> **Live Server:** si abres las páginas con Live Server (por ejemplo, en el puerto 5500), `public/js/config.js` detecta otro puerto y apunta la API a `http://localhost:4000/api`. Aun así, el backend debe estar encendido.

## 5. Credenciales de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@foodexpress.com` | `Admin123` |
| Cliente | `cliente@foodexpress.com` | `Cliente123` |

En `login.html` hay botones que autocompletan estas credenciales. Las cuentas creadas desde el registro siempre tienen el rol **cliente**.

## 6. Páginas del frontend (`public/`)

| Página | Script | Descripción |
|---|---|---|
| `index.html` | `js/pages/catalogo.js` | Menú con filtros por categoría, búsqueda, orden, modal de detalle y carrito lateral. |
| `carrito.html` | `js/pages/carrito.js` | Carrito y checkout. Autocompleta la entrega con los datos del usuario y envía `POST /api/pedidos`. |
| `confirmacion.html` | `js/pages/confirmacion.js` | Con `?id=` muestra el seguimiento del pedido (línea de tiempo, tiempo estimado y cancelación); sin parámetros muestra **Mis pedidos**. |
| `login.html` | `js/pages/login.js` | Pestañas para iniciar sesión y registrarse. Redirige según el rol: admin → `admin.html`, cliente → `index.html` o la página de `?next=`. |
| `admin.html` | `js/pages/admin.js` | Panel exclusivo para administradores: indicadores, gestión de pedidos y gestión de productos. |

Módulos compartidos en `public/js/`:

- `config.js`: URL de la API, constantes y estados.
- `api.js`: cliente HTTP con JWT.
- `auth.js`: sesión y control de acceso.
- `cart.js`: carrito guardado en `localStorage`.
- `ui.js`: navbar, toasts, modales y formatos.
- `validators.js`: validación de formularios.

## 7. API REST

URL base: `http://localhost:4000/api`. Todas las respuestas tienen la forma `{ ok, data?, message?, error?, details? }`.

🔒 = requiere `Authorization: Bearer <token>`  ·  👑 = requiere rol admin

### General

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servidor. |
| GET | `/config` | Costo de envío y tasa de impuesto. |

### Autenticación

| Método | Ruta | Body / Descripción |
|---|---|---|
| POST | `/auth/register` | `{ nombre, email, password, telefono?, direccion? }` → `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` 🔒 | Usuario actual. |

### Productos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/productos` | Catálogo público (solo productos disponibles). Filtros: `?categoria=&q=` |
| GET | `/productos/categorias` | Lista de categorías. |
| GET | `/productos/:id` | Detalle de un producto. |
| GET | `/admin/productos` 🔒👑 | Todos los productos, incluidos los agotados. |
| POST | `/productos` 🔒👑 | Crear: `{ nombre, precio, categoria, descripcion?, imagen?, disponible?, destacado? }` |
| PUT | `/productos/:id` 🔒👑 | Editar: envía solo los campos que cambian. |
| PATCH | `/productos/:id/disponibilidad` 🔒👑 | Alterna entre disponible y agotado. |
| DELETE | `/productos/:id` 🔒👑 | Eliminar. |

### Pedidos

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/pedidos` 🔒 | Crear: `{ items: [{ producto, cantidad }], entrega: { nombre, telefono, direccion, referencias? }, metodoPago: 'efectivo'\|'tarjeta', notas? }`. El servidor recalcula los precios desde la base de datos. |
| GET | `/pedidos/mis-pedidos` 🔒 | Historial del cliente. |
| GET | `/pedidos/:id` 🔒 | Detalle. Solo lo ven el dueño del pedido y los administradores. |
| PATCH | `/pedidos/:id/cancelar` 🔒 | El cliente cancela su pedido si todavía está `pendiente`. |
| GET | `/pedidos` 🔒👑 | Todos los pedidos. Filtros: `?estado=&q=&page=&limit=` |
| PATCH | `/pedidos/:id/estado` 🔒👑 | `{ estado }`. Solo acepta los cambios permitidos del flujo (ver abajo). |
| GET | `/admin/stats` 🔒👑 | Indicadores: pedidos por estado, ingresos, pedidos de hoy y productos más vendidos. |

### Flujo de estados de un pedido

```
pendiente ──► en_preparacion ──► en_camino ──► entregado
    │               │
    └──► cancelado ◄┘
```

## 8. Estructura del proyecto

```
├── public/                 # Frontend estático (servido por Express)
│   ├── *.html
│   ├── css/styles.css
│   ├── img/
│   └── js/
│       ├── config.js, api.js, auth.js, cart.js, ui.js, validators.js
│       └── pages/          # Un controlador por página
└── src/                    # Backend TypeScript
    ├── index.ts            # Arranque: .env, MongoDB, seed, listen
    ├── server.ts           # App Express (CORS, JSON, rutas, estáticos)
    ├── router.ts           # Definición de endpoints
    ├── config/db.ts
    ├── handlers/           # Controladores (auth, products, orders)
    ├── middlewares/        # JWT, rol admin, validación, errores
    ├── models/             # User, Product, Order (Mongoose)
    └── utils/              # JWT/bcrypt y seeder
```

## 9. Seguridad

- Las contraseñas se guardan con **bcrypt** y nunca se devuelven en las respuestas.
- Las rutas protegidas exigen un **JWT**. El rol se toma de la base de datos, no del token.
- El total del pedido se calcula **en el servidor**; los precios que envía el cliente se ignoran.
- La restricción del panel en el frontend solo mejora la experiencia de uso. La protección real la hacen los middlewares `verifyToken` e `isAdmin`.
