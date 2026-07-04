const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const TOKEN_KEY = 'smart_revision_token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      message = errorBody.message || errorBody.error || message;
    } catch {
      // Keep the status message when the server does not return JSON.
    }
    throw new Error(message);
  }

  return response.json();
}

export function requestRegistrationOtp(email) {
  return request('/auth/register/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function completeRegistration({ name, email, password, otp }) {
  return request('/auth/register/verify', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, otp }),
  });
}

export function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function loginWithGoogle(credential) {
  return request('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
}

export function requestPasswordReset(email) {
  return request('/auth/password/request-reset', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword({ email, otp, newPassword }) {
  return request('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ email, otp, newPassword }),
  });
}

export function getDashboard() {
  return request('/dashboard');
}

export function getStatistics() {
  return request('/statistics');
}

export function addTopic(topic) {
  return request('/topics', {
    method: 'POST',
    body: JSON.stringify(topic),
  });
}

export async function deleteTopic(id) {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}/topics/${id}`, {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
}

export async function uploadNoteFiles(topicId, files) {
  if (!files || files.length === 0) {
    return [];
  }
  const token = getStoredToken();
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append('files', file));

  const response = await fetch(`${API_BASE_URL}/topics/${topicId}/files`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function getNoteFileBlob(fileId) {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}/topics/files/${fileId}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.blob();
}

export function completeRevision(id) {
  return request(`/revisions/${id}/complete`, {
    method: 'PATCH',
  });
}

export function getCalendar(from, to) {
  return request(`/revisions/calendar?from=${from}&to=${to}`);
}
