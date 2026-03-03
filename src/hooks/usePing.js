import { useState } from 'react';
import { ping } from '../services/apiClient';

export function usePing() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    const response = await ping();
    setResult(response.data);
    if (response.error) setError(response.error);
    setLoading(false);
    return response;
  };

  return { loading, result, error, run };
}
