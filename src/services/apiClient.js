const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const PING_URL = `${API_URL}/ping`;
const DATA_URL = `${API_URL}/api/dana/start`;
const UPLOAD_URL = `${API_URL}/api/dana/file-upload`;

export async function ping() {
  try {
    const res = await fetch(PING_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { data, error: null, from: 'api' };
  } catch (error) {
    return {
      data: {
        message: 'pong (mock)',
        timestamp: new Date().toISOString(),
        requestId: 'mock-request-id',
        source: 'mock',
      },
      error: null,
      from: 'mock',
    };
  }
}

export async function uploadFile({ kind, dataUrl, name }) {
  try {
    const res = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, dataUrl, name }),
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      return { fileId: json.fileId || json.id || json.url || null, source: 'api' };
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (_) {
    const fallbackId = `s3://mock/${kind}/${Date.now()}-${name || 'file'}`;
    return { fileId: fallbackId, source: 'mock' };
  }
}

export async function submitInspection(payload) {
  try {
    const res = await fetch(DATA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json().catch(() => ({}));
    return { ok: true, data, from: 'api' };
  } catch (error) {
    return { ok: true, data: { message: 'submitted (mock)', payload }, from: 'mock', error: error.message };
  }
}
