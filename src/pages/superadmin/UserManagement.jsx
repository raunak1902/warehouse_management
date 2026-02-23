import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Search, Mail, User, Shield, Eye, EyeOff } from 'lucide-react'

const API = '/api/users'

const ROLE_OPTIONS = [
  { value: 'Manager',    label: 'Manager',    desc: 'Full CRUD, can approve ground team requests, no SuperAdmin access' },
  { value: 'GroundTeam', label: 'Ground Team', desc: 'View-only on Devices/MakeSets/Assigning — all changes via approval requests' },
]

const ROLE_COLORS = {
  SuperAdmin: 'bg-purple-100 text-purple-800',
  Manager:    'bg-blue-100 text-blue-800',
  GroundTeam: 'bg-green-100 text-green-800',
}

const UserManagement = () => {
  const [users,        setUsers]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [apiError,     setApiError]     = useState(null)
  const [showModal,    setShowModal]    = useState(false)
  const [editingUser,  setEditingUser]  = useState(null)
  const [searchTerm,   setSearchTerm]   = useState('')
  const [filterRole,   setFilterRole]   = useState('All')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [formError,    setFormError]    = useState(null)
  const [formData,     setFormData]     = useState({ name: '', email: '', password: '', role: 'GroundTeam', status: 'Active' })

  // ── Helpers ────────────────────────────────────────────────────────────────
  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  })

  // ── Fetch users on mount ───────────────────────────────────────────────────
  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    setApiError(null)
    try {
      const res = await fetch(API, { headers: authHeaders() })
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to load users')
      setUsers(await res.json())
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchRole   = filterRole === 'All' || u.role === filterRole
    return matchSearch && matchRole
  })

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const handleOpenModal = (user = null) => {
    setFormError(null)
    if (user) {
      setEditingUser(user)
      setFormData({ name: user.name, email: user.email, password: '', role: user.role, status: user.status })
    } else {
      setEditingUser(null)
      setFormData({ name: '', email: '', password: '', role: 'GroundTeam', status: 'Active' })
    }
    setShowPassword(false)
    setShowModal(true)
  }

  const handleClose = () => { setShowModal(false); setEditingUser(null); setFormError(null) }

  // ── Create / Update ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      const url    = editingUser ? `${API}/${editingUser.id}` : API
      const method = editingUser ? 'PUT' : 'POST'
      const body   = { ...formData }
      if (editingUser && !body.password) delete body.password   // don't send empty password on edit

      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Request failed')

      if (editingUser) {
        setUsers(users.map(u => u.id === editingUser.id ? data : u))
      } else {
        setUsers([data, ...users])
      }
      handleClose()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) return
    try {
      const res = await fetch(`${API}/${id}`, { method: 'DELETE', headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Delete failed')
      setUsers(users.filter(u => u.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  // ── Toggle Status ──────────────────────────────────────────────────────────
  const toggleStatus = async (user) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active'
    try {
      const res = await fetch(`${API}/${user.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ name: user.name, email: user.email, role: user.role, status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Update failed')
      setUsers(users.map(u => u.id === user.id ? data : u))
    } catch (err) {
      alert(err.message)
    }
  }

  const counts = {
    total:     users.length,
    managers:  users.filter(u => u.role === 'Manager').length,
    groundTeam:users.filter(u => u.role === 'GroundTeam').length,
    active:    users.filter(u => u.status === 'Active').length,
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-500 mt-0.5 text-sm">Create and manage Manager and Ground Team accounts</p>
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium">
          <Plus size={18} /> Create User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',  value: counts.total,     color: 'bg-gray-50 border-gray-200' },
          { label: 'Managers',     value: counts.managers,  color: 'bg-blue-50 border-blue-200' },
          { label: 'Ground Team',  value: counts.groundTeam,color: 'bg-green-50 border-green-200' },
          { label: 'Active',       value: counts.active,    color: 'bg-emerald-50 border-emerald-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Search by name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="All">All Roles</option>
          <option value="Manager">Manager</option>
          <option value="GroundTeam">Ground Team</option>
        </select>
      </div>

      {/* API Error Banner */}
      {apiError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex justify-between">
          <span>Error: {apiError}</span>
          <button onClick={fetchUsers} className="underline font-medium">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400 text-sm">Loading users…</td></tr>
              )}
              {!loading && filteredUsers.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400 text-sm">No users found</td></tr>
              )}
              {!loading && filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <User size={16} className="text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><Mail size={11} />{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-700'}`}>
                      <Shield size={11} />{user.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => toggleStatus(user)}
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${user.status === 'Active' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
                      title="Click to toggle">
                      {user.status}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">{user.createdAt?.split('T')[0] ?? '—'}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleOpenModal(user)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(user.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role legend */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-amber-800 mb-2">Role Access Summary</p>
        <div className="space-y-1.5">
          <p className="text-xs text-amber-700"><span className="font-semibold">Manager:</span> Full CRUD on all data, approves/rejects Ground Team requests, no SuperAdmin panel</p>
          <p className="text-xs text-amber-700"><span className="font-semibold">Ground Team:</span> View Devices, Make Sets, Assigning only — all changes submitted as requests needing approval</p>
          <p className="text-xs text-amber-700"><span className="font-semibold">Note:</span> SuperAdmin accounts can only be created via database seed, not from this panel</p>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">{editingUser ? 'Edit User' : 'Create New User'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="e.g. Rahul Verma" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="user@edsignage.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{editingUser ? 'New Password (leave blank to keep)' : 'Password'}</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="Min 8 characters" required={!editingUser} minLength={editingUser ? 0 : 8} />
                  <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1.5">{ROLE_OPTIONS.find(r => r.value === formData.role)?.desc}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-60">
                  {submitting ? 'Saving…' : editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement