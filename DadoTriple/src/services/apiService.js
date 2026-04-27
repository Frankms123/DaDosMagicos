import { CONFIG } from '../config';
export const API_URL = CONFIG.API_URL;

export const authApi = {
  register: async (name, email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al registrarse');
      return data;
    } catch (error) {
      throw error;
    }
  },
  login: async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al iniciar sesión');
      return data;
    } catch (error) {
      throw error;
    }
  }
};
