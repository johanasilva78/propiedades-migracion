exports.helloWorldHandler = async (event) => {
  const now = new Date().toISOString();
  const requestId = event?.requestContext?.requestId || `local-${Date.now()}`;
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'pong', timestamp: now, requestId }),
  };
};
