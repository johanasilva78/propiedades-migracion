import test from 'node:test';
import assert from 'node:assert/strict';
import { createInspection, saveInspection, getInspection, getInspectionPhoto, retryDanaInspection, unlockInspectionConclusions, ping } from '../src/services/apiClient.js';
import { createApp } from '../server.js';

test('draft client persists version, identity and section with no DANA requests', async () => {
  const previous = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ id: 'draft', version: 2, saved: true }), { status: 200 });
  };
  try {
    await createInspection('op-1');
    await saveInspection('draft', 'op-1', { expectedVersion: 1, fields: { nombreRiesgo: 'Riesgo' } }, '1');
    await getInspection('draft', 'op-1');
    await getInspectionPhoto('draft', 'photo-1', 'op-1');
    assert.equal(requests[0].options.method, 'POST');
    assert.ok(requests[1].url.endsWith('/api/inspections/draft/sections/1'));
    assert.equal(requests[1].options.headers['X-Operator-Id'], 'op-1');
    assert.equal(JSON.parse(requests[1].options.body).expectedVersion, 1);
    assert.ok(requests[3].url.endsWith('/api/inspections/draft/photos/photo-1'));
    assert.equal(requests[3].options.headers['X-Operator-Id'], 'op-1');
    assert.ok(requests.every((req) => !req.url.includes('/dana/')));
  } finally { globalThis.fetch = previous; }
});

test('manual DANA retry sends an explicit duplicate-risk confirmation', async () => {
  const previous = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ dana: { estado: 'confirmado' } }), { status: 200 });
  };
  try {
    const result = await retryDanaInspection('draft', 'op-1');
    assert.ok(request.url.endsWith('/api/inspections/draft/dana/retry'));
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers['X-Operator-Id'], 'op-1');
    assert.deepEqual(JSON.parse(request.options.body), { confirmDuplicateRisk: true });
    assert.equal(result.dana.estado, 'confirmado');
  } finally { globalThis.fetch = previous; }
});

test('unlocking conclusions sends explicit duplicate-risk confirmation', async () => {
  const previous = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ dana: { editableSection: '15' } }), { status: 200 });
  };
  try {
    const result = await unlockInspectionConclusions('draft', 'op-1');
    assert.ok(request.url.endsWith('/api/inspections/draft/dana/unlock-conclusion'));
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers['X-Operator-Id'], 'op-1');
    assert.deepEqual(JSON.parse(request.options.body), { confirmDuplicateRisk: true });
    assert.equal(result.dana.editableSection, '15');
  } finally { globalThis.fetch = previous; }
});

test('HTTP error or offline backend never reports a simulated save', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Versión vieja' }), { status: 409 });
    await assert.rejects(saveInspection('draft', 'op', { fields: {} }), (error) => error.status === 409);
    globalThis.fetch = async () => new Response('Service Unavailable', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    await assert.rejects(saveInspection('draft', 'op', { fields: {} }), (error) => error.status === 503 && error.message === 'Service Unavailable');
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Service Unavailable' }), { status: 503 });
    await assert.rejects(saveInspection('draft', 'op', { fields: {} }), (error) => error.status === 503 && error.message === 'Service Unavailable');
    globalThis.fetch = async () => { throw new Error('Offline'); };
    await assert.rejects(createInspection('op'), /Offline/);
    const health = await ping('op');
    assert.equal(health.data, null);
    assert.equal(health.error, 'Offline');
  } finally { globalThis.fetch = previous; }
});

test('service health checks the authenticated inspection API instead of the CORS-broken ping route', async () => {
  const previousFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ inspections: [], nextOffset: null }), { status: 200 });
  };
  try {
    const health = await ping('SUSER');
    assert.ok(request.url.endsWith('/api/inspections?offset=0'));
    assert.equal(request.options.headers['X-Operator-Id'], 'SUSER');
    assert.equal(health.data.message, 'API de inspecciones y PostgreSQL disponibles');
    assert.equal(health.error, null);
  } finally { globalThis.fetch = previousFetch; }
});

async function withServer(app, work) {
  const server = await new Promise((resolve, reject) => {
    const running = app.listen(0, '127.0.0.1', () => resolve(running));
    running.on('error', reject);
  });
  try { await work(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('local proxy reports missing Lambda URL and disables direct conversation routes', async () => {
  await withServer(createApp({ upstream: '' }), async (url) => {
    const result = await fetch(`${url}/api/inspections`);
    assert.equal(result.status, 503);
    assert.match((await result.json()).error, /INSPECTIONS_API_URL/);
    assert.equal((await fetch(`${url}/api/dana/start`, { method: 'POST' })).status, 410);
  });
});

test('proxy preserves Lambda conflicts, operator and PATCH body', async () => {
  let request;
  const app = createApp({ upstream: 'https://example.invalid/test', fetchImpl: async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ error: 'Conflicto' }), { status: 409 });
  } });
  await withServer(app, async (url) => {
    const result = await fetch(`${url}/api/inspections/draft`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Operator-Id': 'op-1' },
      body: JSON.stringify({ expectedVersion: 3, fields: { nombreRiesgo: 'Risk' } }),
    });
    assert.equal(result.status, 409);
    assert.equal(request.options.headers['X-Operator-Id'], 'op-1');
    assert.equal(request.url, 'https://example.invalid/test/api/inspections/draft');
    assert.equal(JSON.parse(request.options.body).expectedVersion, 3);
  });
});
