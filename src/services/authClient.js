export const AUTH_SESSION_KEY = 'propiedades.authSession';
const AUTH_URL = 'https://odiseo.seguroscrecer.com/devauthorizer/api/v1/account/authenticate';

async function requestAuthentication(userName, password) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetch(AUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userName, password }),
      });
    } catch (error) {
      if (!(error instanceof TypeError) || attempt === 1) {
        if (error instanceof TypeError) {
          throw new Error('No se pudo conectar con el servicio de autenticación. Verifica tu conexión e intenta de nuevo.', { cause: error });
        }
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error('No se pudo completar la autenticación.');
}

export async function authenticate(userName, password) {
  const response = await requestAuthentication(userName, password);

  const rawBody = await response.text();
  let data = null;
  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = rawBody.trim() || null;
    }
  }

  if (!response.ok) {
    const validationDetails = data?.errors && typeof data.errors === 'object'
      ? Object.entries(data.errors)
        .flatMap(([field, messages]) => (Array.isArray(messages) ? messages : [messages])
          .filter((message) => typeof message === 'string')
          .map((message) => `${field}: ${message}`))
        .join(' ')
      : '';
    const message = typeof data === 'string'
      ? data
      : data?.message || data?.error || data?.messages?.[0]?.message
        || (validationDetails ? `${data?.title || 'Error de validación.'} ${validationDetails}` : '')
        || data?.title
        || `No se pudo iniciar sesión (HTTP ${response.status}).`;
    throw new Error(message);
  }

  if (typeof data?.token !== 'string' || !data.token || typeof data?.value?.userName !== 'string' || !data.value.userName) {
    throw new Error('El servicio de autenticación respondió sin un token o nombre de usuario válido.');
  }

  return { token: data.token, user: data.value };
}

export function readAuthSession() {
  const stored = sessionStorage.getItem(AUTH_SESSION_KEY);
  if (!stored) return null;

  try {
    const session = JSON.parse(stored);
    return typeof session?.token === 'string' && session.token
      && typeof session?.user?.userName === 'string' && session.user.userName
      ? session
      : null;
  } catch {
    return null;
  }
}
