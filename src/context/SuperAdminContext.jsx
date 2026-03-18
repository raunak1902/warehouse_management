import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config/api'

const SuperAdminContext = createContext(null)

const API_BASE = `${API_URL}/api`

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

const apiFetch = async (url, options = {}) => {
  const res = await fetch(url, { ...options, headers: authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || data.error || `Request failed: ${res.status}`)
  return data
}

export const SuperAdminProvider = ({ children }) => {
  const [users,            setUsers]            = useState([])
  const [roles,            setRoles]            = useState([])
  const [permissions,      setPermissions]      = useState([])
  // { [roleId]: [permissionId, ...] } — local pending state before save
  const [rolePermissions,  setRolePermissions]  = useState({})

  const [loading, setLoading] = useState({ users: true, roles: true, permissions: true })
  const [errors,  setErrors]  = useState({ users: null, roles: null, permissions: null })

  // ── Loaders ────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(p => ({ ...p, users: true }))
    setErrors(p => ({ ...p, users: null }))
    try {
      const data = await apiFetch(`${API_BASE}/users`)
      setUsers(data)
    } catch (err) {
      setErrors(p => ({ ...p, users: err.message }))
    } finally {
      setLoading(p => ({ ...p, users: false }))
    }
  }, [])

  const fetchRoles = useCallback(async () => {
    setLoading(p => ({ ...p, roles: true }))
    setErrors(p => ({ ...p, roles: null }))
    try {
      const data = await apiFetch(`${API_BASE}/roles`)
      setRoles(data)
    } catch (err) {
      setErrors(p => ({ ...p, roles: err.message }))
    } finally {
      setLoading(p => ({ ...p, roles: false }))
    }
  }, [])

  const fetchPermissions = useCallback(async () => {
    setLoading(p => ({ ...p, permissions: true }))
    setErrors(p => ({ ...p, permissions: null }))
    try {
      const data = await apiFetch(`${API_BASE}/permissions`)
      setPermissions(data)
    } catch (err) {
      setErrors(p => ({ ...p, permissions: err.message }))
    } finally {
      setLoading(p => ({ ...p, permissions: false }))
    }
  }, [])

  // Fetch permissions for a specific role and merge into local state
  const fetchRolePermissions = useCallback(async (roleId) => {
    try {
      const data = await apiFetch(`${API_BASE}/roles/${roleId}/permissions`)
      setRolePermissions(prev => ({
        ...prev,
        [roleId]: data.map(p => p.id),
      }))
    } catch (err) {
      console.error('fetchRolePermissions error', err)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchRoles()
    fetchPermissions()
  }, [fetchUsers, fetchRoles, fetchPermissions])

  // ── USER CRUD ──────────────────────────────────────────────────────────────
  const createUser = async (formData) => {
    const data = await apiFetch(`${API_BASE}/users`, {
      method: 'POST',
      body: JSON.stringify(formData),
    })
    setUsers(prev => [data, ...prev])
    return data
  }

  const updateUser = async (id, formData) => {
    const data = await apiFetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(formData),
    })
    setUsers(prev => prev.map(u => u.id === id ? data : u))
    return data
  }

  // SAFE delete — backend already blocks SuperAdmin deletion and orphaned users
  const deleteUser = async (id) => {
    await apiFetch(`${API_BASE}/users/${id}`, { method: 'DELETE' })
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  const toggleUserStatus = async (user) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active'
    return updateUser(user.id, {
      name: user.name, email: user.email, role: user.role, status: newStatus,
    })
  }

  // ── ROLE CRUD ──────────────────────────────────────────────────────────────
  const createRole = async (formData) => {
    const data = await apiFetch(`${API_BASE}/roles`, {
      method: 'POST',
      body: JSON.stringify(formData),
    })
    setRoles(prev => [...prev, data])
    setRolePermissions(prev => ({ ...prev, [data.id]: [] }))
    return data
  }

  const updateRole = async (id, formData) => {
    const data = await apiFetch(`${API_BASE}/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(formData),
    })
    setRoles(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
    return data
  }

  const deleteRole = async (id) => {
    await apiFetch(`${API_BASE}/roles/${id}`, { method: 'DELETE' })
    setRoles(prev => prev.filter(r => r.id !== id))
    setRolePermissions(prev => { const c = { ...prev }; delete c[id]; return c })
  }

  // ── PERMISSION CRUD ────────────────────────────────────────────────────────
  const createPermission = async (formData) => {
    const data = await apiFetch(`${API_BASE}/permissions`, {
      method: 'POST',
      body: JSON.stringify(formData),
    })
    setPermissions(prev => [...prev, data])
    return data
  }

  const updatePermission = async (id, formData) => {
    const data = await apiFetch(`${API_BASE}/permissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(formData),
    })
    setPermissions(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
    return data
  }

  const deletePermission = async (id) => {
    await apiFetch(`${API_BASE}/permissions/${id}`, { method: 'DELETE' })
    setPermissions(prev => prev.filter(p => p.id !== id))
    // Remove from all local role assignments
    setRolePermissions(prev => {
      const copy = {}
      Object.keys(prev).forEach(roleId => {
        copy[roleId] = prev[roleId].filter(pId => pId !== id)
      })
      return copy
    })
  }

  // ── ASSIGN PERMISSIONS ─────────────────────────────────────────────────────
  const saveRolePermissions = async (roleId, permissionIds) => {
    const data = await apiFetch(`${API_BASE}/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionIds }),
    })
    setRolePermissions(prev => ({ ...prev, [roleId]: permissionIds }))
    setRoles(prev => prev.map(r => r.id === roleId
      ? { ...r, permissionCount: data.permissionCount }
      : r
    ))
    return data
  }

  const toggleRolePermission = (roleId, permissionId) => {
    setRolePermissions(prev => {
      const current = prev[roleId] || []
      return {
        ...prev,
        [roleId]: current.includes(permissionId)
          ? current.filter(id => id !== permissionId)
          : [...current, permissionId],
      }
    })
  }

  const getRolePermissionIds = (roleId) => rolePermissions[roleId] || []

  return (
    <SuperAdminContext.Provider value={{
      users, roles, permissions, rolePermissions,
      loading, errors,
      // user
      createUser, updateUser, deleteUser, toggleUserStatus, fetchUsers,
      // role
      createRole, updateRole, deleteRole, fetchRoles, fetchRolePermissions,
      // permission
      createPermission, updatePermission, deletePermission, fetchPermissions,
      // assign
      saveRolePermissions, toggleRolePermission, getRolePermissionIds,
    }}>
      {children}
    </SuperAdminContext.Provider>
  )
}

export const useSuperAdmin = () => {
  const ctx = useContext(SuperAdminContext)
  if (!ctx) throw new Error('useSuperAdmin must be used within SuperAdminProvider')
  return ctx
}