import { useState } from 'react';
import Home from './pages/Home';
import { AUTH_SESSION_KEY, authenticate, readAuthSession } from './services/authClient';

function Login({ onLogin }) {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await authenticate(userName.trim(), password);
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      setPassword('');
      onLogin(session);
    } catch (loginError) {
      setError(loginError.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-background">
      <section className="auth-card" aria-labelledby="login-title">
        <header className="auth-header">
          <img src="/seguros-crecer-blanco.png" alt="Seguros Crecer" />
          <h1 id="login-title">Inspección de Riesgos</h1>
          <p>Inicia sesión para continuar</p>
        </header>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="login-user">Usuario</label>
          <input id="login-user" type="text" autoComplete="username" required
            value={userName} onChange={(event) => setUserName(event.target.value)} disabled={loading} />
          <label htmlFor="login-password">Contraseña</label>
          <input id="login-password" type="password" autoComplete="current-password" required
            value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Validando…' : 'Iniciar sesión'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(readAuthSession);

  const logout = () => {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    setSession(null);
  };

  return session
    ? <Home user={session.user} onLogout={logout} />
    : <Login onLogin={setSession} />;
}
