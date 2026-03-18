/**
 * src/config/api.js
 * ─────────────────
 * Single source of truth for the backend base URL.
 * All fetch() and axios calls must import API_URL from here.
 */

export const API_URL = import.meta.env.VITE_API_URL || '';