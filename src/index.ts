import 'dotenv/config'; // Debe ir primero: carga .env antes de importar el resto
import colors from 'colors';
import app from './server';
import { connectDB, disconnectDB } from './config/db';
import { seedDatabase } from './utils/seed';

const PORT = Number(process.env.PORT) || 4000;

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'foodexpress_dev_jwt_secret_key_2026_progra2';
    console.warn(colors.yellow('⚠ JWT_SECRET no definido en .env; usando clave de desarrollo por defecto.'));
  }

  await connectDB();

  if (process.env.AUTO_SEED !== 'false') {
    await seedDatabase({ silentIfSeeded: true });
  }

  const server = app.listen(PORT, () => {
    console.log(colors.magenta.bold(`🚀 Servidor listo en http://localhost:${PORT}`));
    console.log(colors.gray(`   API: http://localhost:${PORT}/api/health`));
  });

  if (PORT !== 4000) {
    const mirror = app.listen(4000, () => {
      console.log(colors.magenta.bold(`🚀 También disponible en http://localhost:4000`));
    });
    mirror.on('error', () => {
      // Si el puerto 4000 está ocupado por otro proceso, se ignora silenciosamente.
    });
  }

  const shutdown = (signal: string) => {
    console.log(colors.yellow(`\n${signal} recibido. Cerrando...`));
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error(colors.red('✖ Error fatal al iniciar:'), err);
  process.exit(1);
});
