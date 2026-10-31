import express from 'express';
import cors, { type CorsOptions } from 'cors';
import path from 'node:path';
import router from './router';
import { errorHandler, notFound } from './middlewares/errorHandler';

const app = express();

// ---------- CORS ----------
const origins = (process.env.CORS_ORIGIN ?? '*').split(',').map((o) => o.trim()).filter(Boolean);
const corsOptions: CorsOptions = {
  origin: origins.includes('*') ? true : origins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.disable('x-powered-by');
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));

// ---------- API ----------
app.use('/api', router);
app.use('/api', notFound);

// ---------- Frontend estático (public/) ----------
const publicDir = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicDir, { extensions: ['html'] }));
app.use((_req, res) => res.status(404).sendFile(path.join(publicDir, 'index.html')));

// ---------- Errores ----------
app.use(errorHandler);

export default app;
