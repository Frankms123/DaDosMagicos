/**
 * Central configuration for the app.
 * Configured to ALWAYS use Render.com backend.
 */

const API_BASE = 'https://dado-triple-backend.onrender.com';

export const CONFIG = {
  API_URL: `${API_BASE}/api`,
  WS_URL: API_BASE.replace('https', 'wss'),
};
