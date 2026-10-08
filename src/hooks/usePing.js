import { useCallback, useEffect, useRef, useState } from 'react';
import { ping } from '../services/apiClient';

export function usePing() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const requestRef = useRef(null);

  const run = useCallback(() => {
    if (requestRef.current) return requestRef.current;
    setLoading(true);
    setError(null);
    requestRef.current = ping().then((response) => {
      setResult(response.data);
      setError(response.error);
      return response;
    }).finally(() => {
      requestRef.current = null;
      setLoading(false);
    });
    return requestRef.current;
  }, []);

  useEffect(() => {
    run();
    const interval = window.setInterval(run, 60000);
    window.addEventListener('online', run);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', run);
    };
  }, [run]);

  return { loading, result, error, run };
}
