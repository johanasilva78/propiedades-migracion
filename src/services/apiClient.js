const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const AUTH_SESSION_KEY = 'propiedades.authSession';

async function request(path, { operatorId, method = 'GET', body } = {}) {
  const authSession = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(AUTH_SESSION_KEY);
  let token = '';
  if (authSession) {
    try {
      const storedToken = JSON.parse(authSession).token;
      token = typeof storedToken === 'string' ? storedToken : '';
    } catch {
      throw new Error('La sesión de autenticación no es válida. Cierra sesión e inicia nuevamente.');
    }
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(operatorId ? { 'X-Operator-Id': operatorId } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const rawBody = await res.text();
  let data = null;

  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = rawBody.trim() || null;
    }
  }

  if (!res.ok) {
    const message = typeof data === 'string'
      ? data
      : data?.error || data?.message || rawBody.trim() || `No se pudo completar la solicitud (HTTP ${res.status}).`;
    const error = new Error(message);
    error.status = res.status;
    error.invalidFields = Array.isArray(data?.invalidFields) ? data.invalidFields : [];
    throw error;
  }

  return data;
}

export async function ping(operatorId) {
  try {
    const result = await request('/api/inspections?offset=0', { operatorId });
    return { data: { message: 'API de inspecciones y PostgreSQL disponibles', ...result }, error: null, from: 'api' };
  } catch (error) {
    return { data: null, error: error.message, from: 'api' };
  }
}

export const createInspection = (operatorId) => request('/api/inspections', { operatorId, method: 'POST', body: {} });
export const listInspections = (operatorId, offset = 0) => request(`/api/inspections?offset=${offset}`, { operatorId });
export const getInspection = (id, operatorId) => request(`/api/inspections/${encodeURIComponent(id)}`, { operatorId });
export const getInspectionPhoto = (id, photoId, operatorId) => request(
  `/api/inspections/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`,
  { operatorId }
);
export const saveInspection = (id, operatorId, body, sectionId) => request(
  `/api/inspections/${encodeURIComponent(id)}${sectionId ? `/sections/${sectionId}` : ''}`,
  { operatorId, method: 'PATCH', body }
);
