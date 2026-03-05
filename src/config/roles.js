// ─── Role constants — single source of truth ─────────────────────────────────
// Kept in a dedicated config file (not App.jsx) so that Vite Fast Refresh
// can correctly identify App.jsx as a pure React component module.

export const ROLES = {
  SUPERADMIN: 'superadmin',
  MANAGER:    'manager',
  GROUNDTEAM: 'groundteam',
}

// Normalise role string from backend (removes spaces, lowercases)
export const normaliseRole = (role) => role?.toLowerCase().replace(/[\s_-]/g, '') ?? ''

// Check if user has one of the given roles
export const hasRole = (userRole, ...allowed) =>
  allowed.map(r => r.toLowerCase().replace(/[\s_-]/g, '')).includes(normaliseRole(userRole))