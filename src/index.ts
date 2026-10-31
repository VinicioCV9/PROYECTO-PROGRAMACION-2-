import 'dotenv/config'; // Debe ir primero: carga .env antes de importar el resto
import colors from 'colors';
import app from './server';
import { connectDB, disconnectDB } from './config/db';
import { seedDatabase } from './utils/seed';

const PORT = Number(process.env.PORT) || 4000;

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    console.error(colors.bgRed.white.bold(' ✖ JWT_SECRET no está definido en .env '));
    process.exit(1);
  }

  await connectDB();

  if (process.env.AUTO_SEED !== 'false') {
    await seedDatabase({ silentIfSeeded: true });
  }

  const server = app.listen(PORT, () => {
    console.log(colors.magenta.bold(`🚀 Servidor listo en http://localhost:${PORT}`));
    console.log(colors.gray(`   API: http://localhost:${PORT}/api/health`));
  });

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
