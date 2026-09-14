import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL;

const client = axios.create({ baseURL: API_BASE_URL });

export class ApiError extends Error {
  constructor(status, data) {
    const serverMessage = [data?.message, data?.msg, data?.error]
      .find(value => typeof value === 'string' && value.trim());
    super(serverMessage || (status === undefined
      ? 'Unable to reach the server. Please try again.'
      : 'Request failed. Please try again.'));
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Transport only: callers own navigation, session clearing, and presentation.
export async function apiRequest(path, { method = 'GET', data, params, auth = true } = {}) {
  const headers = {};
  if (auth) {
    const token = localStorage.getItem('authToken');
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  try {
    const response = await client.request({ url: path, method, data, params, headers });
    return response.data;
  } catch (error) {
    throw new ApiError(error.response?.status, error.response?.data);
  }
}
