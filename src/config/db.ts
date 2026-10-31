import mongoose from 'mongoose';
import colors from 'colors';

/**
 * Conecta a MongoDB Atlas usando la variable MONGO_URI.
 * Si falla, el proceso termina: la API no puede operar sin base de datos.
 */
export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URI;

  if (!uri || uri.includes('<usuario>')) {
    console.error(colors.bgRed.white.bold(' ✖ MONGO_URI no está configurada en el archivo .env '));
    process.exit(1);
  }

  try {
    mongoose.set('strictQuery', true);
    const { connection } = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
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
