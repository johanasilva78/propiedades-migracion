import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate } from '../src/services/authClient.js';
import { listInspections } from '../src/services/apiClient.js';

test('authentication posts credentials and returns the token and user', async () => {
  const previousFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      message: 'Login exitoso',
      token: 'jwt-token',
      value: { userName: 'SUSER', name: 'Seguros User' },
    }), { status: 200 });
  };
  try {
    const session = await authenticate('SUSER', 'password');
    assert.equal(request.url, 'https://odiseo.seguroscrecer.com/devauthorizer/api/v1/account/authenticate');
    assert.equal(request.options.method, 'POST');
    assert.deepEqual(JSON.parse(request.options.body), { userName: 'SUSER', password: 'password' });
    assert.deepEqual(session, { token: 'jwt-token', user: { userName: 'SUSER', name: 'Seguros User' } });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('authentication retries one transient network failure without prompting again', async () => {
  const previousFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) throw new TypeError('Failed to fetch');
    return new Response(JSON.stringify({
      message: 'Login exitoso',
      token: 'jwt-token',
      value: { userName: 'SUSER' },
    }), { status: 200 });
  };
  try {
    const session = await authenticate('SUSER', 'password');
    assert.equal(attempts, 2);
    assert.equal(session.token, 'jwt-token');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('authentication rejects API errors and malformed successful responses', async () => {
  const previousFetch = globalThis.fetch;
  try {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts += 1;
      return new Response(JSON.stringify({ message: 'Credenciales inválidas' }), { status: 401 });
    };
    await assert.rejects(authenticate('SUSER', 'wrong'), /Credenciales inválidas/);
    assert.equal(attempts, 1);

    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Login exitoso' }), { status: 200 });
    await assert.rejects(authenticate('SUSER', 'password'), /sin un token o nombre de usuario válido/);

    globalThis.fetch = async () => new Response(JSON.stringify({
      title: 'One or more validation errors occurred.',
      errors: { login: ['The login field is required.'] },
    }), { status: 400 });
    await assert.rejects(authenticate('SUSER', 'password'), /login: The login field is required/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('inspection requests forward the stored bearer token', async () => {
  const previousFetch = globalThis.fetch;
  const previousStorage = globalThis.sessionStorage;
  const stored = new Map([['propiedades.authSession', JSON.stringify({ token: 'jwt-token' })]]);
  globalThis.sessionStorage = {
    getItem: (key) => stored.get(key) || null,
  };
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ inspections: [] }), { status: 200 });
  };
  try {
    await listInspections('SUSER');
    assert.equal(request.options.headers.Authorization, 'Bearer jwt-token');
    assert.equal(request.options.headers['X-Operator-Id'], 'SUSER');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previousStorage;
  }
});
