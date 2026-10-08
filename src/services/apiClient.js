const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

async function request(path, { operatorId, method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(operatorId ? { 'X-Operator-Id': operatorId } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const error = new Error(data?.error || `No se pudo completar la solicitud (HTTP ${res.status}).`);
    error.status = res.status;
    error.invalidFields = data?.invalidFields || [];
    throw error;
  }
  return data;
}

export async function ping() {
  try {
    return { data: await request('/ping'), error: null, from: 'api' };
  } catch (error) {
    return { data: null, error: error.message, from: 'api' };
  }
}

export const createInspection = (operatorId) => request('/api/inspections', { operatorId, method: 'POST', body: {} });
export const listInspections = (operatorId, offset = 0) => request(`/api/inspections?offset=${offset}`, { operatorId });
export const getInspection = (id, operatorId) => request(`/api/inspections/${encodeURIComponent(id)}`, { operatorId });
export const saveInspection = (id, operatorId, body, sectionId) => request(
  `/api/inspections/${encodeURIComponent(id)}${sectionId ? `/sections/${sectionId}` : ''}`,
  { operatorId, method: 'PATCH', body }
);
