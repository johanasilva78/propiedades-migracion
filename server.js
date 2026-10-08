// Proxy local al API HTTP de borradores en Lambda. No guarda ni simula datos.
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

export function createApp({ upstream = process.env.INSPECTIONS_API_URL, fetchImpl = fetch } = {}) {
  const app = express();
  app.use((req, res, next) => {
    const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((v) => v.trim());
    if (origins.includes(req.headers.origin)) {
      res.set('Access-Control-Allow-Origin', req.headers.origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Operator-Id');
      res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '4500kb' }));
  const proxy = async (req, res) => {
    if (!upstream) return res.status(503).json({ error: 'Configura INSPECTIONS_API_URL con la URL HTTP de tu Lambda para probar desde el navegador.' });
    try {
      const result = await fetchImpl(`${upstream.replace(/\/$/, '')}${req.originalUrl}`, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers['x-operator-id'] ? { 'X-Operator-Id': req.headers['x-operator-id'] } : {}),
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        },
        ...(['POST', 'PATCH'].includes(req.method) ? { body: JSON.stringify(req.body) } : {}),
        signal: AbortSignal.timeout(28000),
      });
      res.status(result.status).type(result.headers.get('content-type') || 'application/json').send(await result.text());
    } catch {
      res.status(502).json({ error: 'No se pudo confirmar la respuesta de Lambda. Comprueba el borrador por su ID antes de volver a guardar.' });
    }
  };
  app.get('/ping', proxy);
  app.use('/api/inspections', proxy);
  app.use('/api/dana', (_req, res) => res.status(410).json({ error: 'El formulario usa la API de borradores. Fileupload se ejecuta desde Lambda.' }));
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.use((error, _req, res, _next) => {
    res.status(error.status === 413 ? 413 : 400).json({ error: error.status === 413 ? 'La solicitud contiene demasiadas fotografías.' : 'Solicitud JSON inválida.' });
  });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => console.log(`Servidor local escuchando en http://localhost:${port}`));
}
