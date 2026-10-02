const API_BASE_URL =
  window.INNOVA_API_URL ||
  localStorage.getItem("innova_api_url") ||
  "http://127.0.0.1:8000";

const TOKEN_KEY = "innova_access_token";

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
  }

  if (!response.ok) {
    let detail = `Erro HTTP ${response.status}`;
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function login(username, password) {
  const body = new URLSearchParams({ username, password });
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error("Usuário ou senha inválidos.");
  }

  const data = await response.json();
  setToken(data.access_token);
  return data;
}

export const api = {
  health: () => request("/health"),
  me: () => request("/auth/me"),

  vehicles: {
    list: () => request("/vehicles"),
    create: (data) => request("/vehicles", { method: "POST", body: JSON.stringify(data) }),
    update: (id, data) => request(`/vehicles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id) => request(`/vehicles/${id}`, { method: "DELETE" }),
  },

  leads: {
    list: () => request("/leads"),
    create: (data) => request("/leads", { method: "POST", body: JSON.stringify(data) }),
    setStatus: (id, status) =>
      request(`/leads/${id}/status?lead_status=${encodeURIComponent(status)}`, { method: "PATCH" }),
    remove: (id) => request(`/leads/${id}`, { method: "DELETE" }),
  },

  config: {
    get: () => request("/config"),
    update: (data) => request("/config", { method: "PUT", body: JSON.stringify(data) }),
  },
};
