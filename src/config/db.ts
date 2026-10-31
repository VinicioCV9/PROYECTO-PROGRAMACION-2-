import mongoose from 'mongoose';
import colors from 'colors';

function resolveMongoUri(): string | undefined {
  const candidates = [process.env.MONGODB_URI, process.env.MONGO_URI];
  for (const candidate of candidates) {
    if (candidate && !candidate.includes('<usuario>') && !candidate.includes('<password>')) {
      return candidate.trim();
    }
  }
  const user = process.env.MONGODB_USERNAME?.trim();
  const pass = process.env.MONGODB_PASSWORD?.trim();
  if (user && pass) {
    return `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@clutserproyecto.gzn4831.mongodb.net/foodexpress?retryWrites=true&w=majority`;
  }
  return undefined;
}

/**
 * Conecta a MongoDB Atlas usando la variable MONGO_URI o MONGODB_URI.
 * Si falla, el proceso termina: la API no puede operar sin base de datos.
 */
export async function connectDB(): Promise<void> {
  const uri = resolveMongoUri();

  if (!uri) {
    console.error(colors.bgRed.white.bold(' ✖ MONGO_URI / MONGODB_URI no está configurada en el archivo .env '));
    process.exit(1);
  }

  try {
    mongoose.set('strictQuery', true);
    const hasDbName = /^mongodb(?:\+srv)?:\/\/[^/]+\/[^?]+/.test(uri);
    const { connection } = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10_000,
      ...(hasDbName ? {} : { dbName: 'foodexpress' }),
    });
    const url = `${connection.host}/${connection.name}`;
    console.log(colors.cyan.bold(`✔ MongoDB Atlas conectado: ${url}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(colors.bgRed.white.bold(` ✖ Error al conectar a MongoDB: ${message} `));
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close();
  console.log(colors.gray('MongoDB desconectado.'));
}
