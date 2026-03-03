import express from 'express';

export function createLocalServer(port = 4173) {
  const app = express();
  app.get('/ping', (_req, res) => {
    res.json({ message: 'pong', timestamp: new Date().toISOString(), requestId: 'local-mock' });
  });
  const server = app.listen(port, () => {
    console.log(`Mock API escuchando en http://localhost:${port}`);
  });
  return server;
}
