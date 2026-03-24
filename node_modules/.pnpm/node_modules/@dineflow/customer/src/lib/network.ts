const DEV_FRONTEND_PORTS = new Set(['3000', '3001', '3002']);

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '');
}

function withPort(port: string) {
  const current = new URL(window.location.origin);

  if (!current.port) {
    return normalizeBaseUrl(current.origin);
  }

  if (DEV_FRONTEND_PORTS.has(current.port) || current.port === '4000') {
    current.port = port;
  }

  return normalizeBaseUrl(current.origin);
}

export function getApiBaseUrl() {
  const override = import.meta.env.VITE_API_URL;
  return normalizeBaseUrl(override || withPort('4000'));
}

export function getSocketUrl() {
  const override = import.meta.env.VITE_SOCKET_URL;
  return normalizeBaseUrl(override || getApiBaseUrl());
}
