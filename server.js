// Servidor backend local para el nuevo proyecto (proxy a DANA y recursos mock).
// Ejecuta: node server.js   (usa por defecto puerto 3000)

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carga sencilla de .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  });
}

const PORT = process.env.PORT || 3000;
const PROJECT_ID = process.env.PROJECT_ID || '192683';
const API_URL =
  process.env.DANA_URL ||
  `https://appserv.danaconnect.com/api/1.0/rest/conversation/ProjectID/${PROJECT_ID}/start/data`;
const DANA_UPLOAD_URL =
  process.env.DANA_UPLOAD_URL ||
  'https://appserv.danaconnect.com/dana/conversation/http/rest/file/upload';
const DANA_DOC_URL =
  process.env.DANA_DOC_URL ||
  'https://appserv.danaconnect.com/danadms/api/1.0/rest/document-manager/upload';
const DANA_USER = process.env.DANA_USER || 'afpapi';
const DANA_PASSWORD = process.env.DANA_PASSWORD || '2026Luna**';
const DANA_EMPRESA = process.env.DANA_EMPRESA || 'afpcrecer';

const authUser = `${DANA_USER}@${DANA_EMPRESA}`;
const authHeader = 'Basic ' + Buffer.from(`${authUser}:${DANA_PASSWORD}`).toString('base64');

const app = express();

app.use(express.json({ limit: '25mb' }));

app.get('/ping', (_req, res) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString(), requestId: 'local-mock', source: 'local' });
});

app.post('/api/dana/start', async (req, res) => {
  try {
    const payload = req.body || {};
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authHeader,
        'X-Empresa': DANA_EMPRESA,
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let idRow = null;
    try {
      const parsed = JSON.parse(text);
      const findId = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        if (Array.isArray(obj)) return obj.map(findId).find(Boolean) || null;
        for (const [k, v] of Object.entries(obj)) {
          const key = k.toLowerCase();
          if (key === 'idrow' || key === 'uid') return v;
          const nested = findId(v);
          if (nested) return nested;
        }
        return null;
      };
      idRow = parsed.idRow || parsed.UID || parsed.uid || findId(parsed) || null;
    } catch (_) {
      idRow = null;
    }
    res.status(response.status).json({ ok: response.ok, status: response.status, body: text, idRow });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/dana/file-upload', async (req, res) => {
  try {
    const dataUrl = req.body?.dataUrl || '';
    const kind = req.body?.kind || 'file';
    const originalName = req.body?.name || `${kind}.jpg`;
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) return res.status(400).json({ ok: false, error: 'dataUrl inválido' });
    const contentType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');
    const ext = contentType.includes('zip')
      ? 'zip'
      : contentType.includes('png')
      ? 'png'
      : contentType.includes('jpeg')
      ? 'jpg'
      : 'bin';
    const filename = originalName.includes('.') ? originalName : `${kind}-${Date.now()}.${ext}`;

    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: contentType }), filename);

    const response = await fetch(DANA_UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: authHeader, 'X-Empresa': DANA_EMPRESA },
      body: formData,
    });
    const text = await response.text();
    let fileId = null;
    try {
      const parsed = JSON.parse(text);
      const findFileId = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === 'object') {
            const nested = findFileId(v);
            if (nested) return nested;
          }
          const keyLower = k.toLowerCase();
          if (keyLower === 'fileid' || keyLower === 'id') return v;
        }
        return null;
      };
      fileId =
        parsed.fileId ||
        parsed.fileID ||
        parsed.id ||
        parsed.wsResult?.fileId ||
        parsed.wsResult?.fileID ||
        parsed.wsResult?.id ||
        findFileId(parsed);
    } catch (_) {
      fileId = null;
    }
    if (!fileId) {
      const m = text.match(/<fileID>([^<]+)<\/fileID>/i);
      if (m?.[1]) fileId = m[1];
    }
    res.status(response.status).json({ ok: response.ok, status: response.status, body: text, fileId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/dana/doc-upload', async (req, res) => {
  try {
    const dataUrl = req.body?.dataUrl || '';
    const kind = req.body?.kind || 'doc';
    const originalName = req.body?.name || `${kind}.jpg`;
    const idRow = req.body?.idRow;
    if (!idRow) return res.status(400).json({ ok: false, error: 'idRow requerido' });
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) return res.status(400).json({ ok: false, error: 'dataUrl inválido' });
    const contentType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');
    const ext = contentType.includes('zip')
      ? 'zip'
      : contentType.includes('png')
      ? 'png'
      : contentType.includes('jpeg')
      ? 'jpg'
      : 'bin';
    const filename = originalName.includes('.') ? originalName : `${kind}-${Date.now()}.${ext}`;

    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: contentType }), filename);
    formData.append('idRow', idRow);

    const response = await fetch(DANA_DOC_URL, {
      method: 'POST',
      headers: { Authorization: authHeader, 'X-Empresa': DANA_EMPRESA },
      body: formData,
    });
    const text = await response.text();
    res.status(response.status).json({ ok: response.ok, status: response.status, body: text });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Servir estáticos de dist si existen
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Servidor local escuchando en http://localhost:${PORT}`);
});
