import { useState } from 'react'
import { Plus, Edit, Trash2, Search, Mail, User, Shield, Eye, EyeOff, RefreshCw, KeyRound, AlertTriangle } from 'lucide-react'
import { useSuperAdmin } from '../../context/SuperAdminContext'

const ROLE_COLORS = {
  SuperAdmin: 'bg-purple-100 text-purple-800',
  Manager:    'bg-blue-100 text-blue-800',
  GroundTeam: 'bg-green-100 text-green-800',
}

const UserManagement = () => {
  const {
    users, roles,
    loading, errors,
    createUser, updateUser, deleteUser, toggleUserStatus, fetchUsers,
  } = useSuperAdmin()

  const [showModal,    setShowModal]    = useState(false)
  const [editingUser,  setEditingUser]  = useState(null)
  const [searchTerm,   setSearchTerm]   = useState('')
  const [filterRole,   setFilterRole]   = useState('All')
  const [submitting,   setSubmitting]   = useState(false)
  const [formError,    setFormError]    = useState(null)
  const [resetingId,   setResetingId]   = useState(null)
  const [resetMsg,     setResetMsg]     = useState(null)
  const [formData,     setFormData]     = useState({
    name: '', email: '',
    role: roles[0]?.name || 'GroundTeam', status: 'Active',
  })

  const isLoading = loading.users

  const filteredUsers = users.filter(u => {
    const matchSearch = u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchRole   = filterRole === 'All' || u.role === filterRole
    return matchSearch && matchRole
  })

  const handleOpenModal = (user = null) => {
    setFormError(null)
    if (user) {
      setEditingUser(user)
      setFormData({ name: user.name, email: user.email, role: user.role, status: user.status })
    } else {
      setEditingUser(null)
      setFormData({ name: '', email: '', role: roles[0]?.name || 'GroundTeam', status: 'Active' })
    }
    setShowModal(true)
  }

  const handleClose = () => { setShowModal(false); setEditingUser(null); setFormError(null) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      const body = { ...formData }
      if (editingUser) {
        await updateUser(editingUser.id, body)
      } else {
        await createUser(body)
      }
      handleClose()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) return
    try { await deleteUser(id) } catch (err) { alert(err.message) }
  }

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Reset password for ${user.name}? A new temporary password will be emailed to ${user.email}.`)) return
    setResetingId(user.id)
    setResetMsg(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to reset password')
      setResetMsg({ id: user.id, msg: data.message, ok: true })
      setTimeout(() => setResetMsg(null), 5000)
    } catch (err) {
      setResetMsg({ id: user.id, msg: err.message, ok: false })
      setTimeout(() => setResetMsg(null), 5000)
    } finally {
      setResetingId(null)
    }
  }

  // Unique roles from actual roles list for filter dropdown
  const roleFilterOptions = ['All', ...roles.map(r => r.name)]

  const counts = {
    total:  users.length,
    active: users.filter(u => u.status === 'Active').length,
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-500 mt-0.5 text-sm">Create and manage user accounts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
            <RefreshCw size={18} />
          </button>
          <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium">
            <Plus size={18} /> Create User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-gray-50 border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Users</p>
        </div>
        <div className="rounded-xl border bg-emerald-50 border-emerald-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{counts.active}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active</p>
        </div>
        <div className="rounded-xl border bg-blue-50 border-blue-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{roles.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Roles Available</p>
        </div>
        <div className="rounded-xl border bg-red-50 border-red-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.status !== 'Active').length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Inactive</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Search by name or email..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
          {roleFilterOptions.map(r => <option key={r} value={r}>{r === 'All' ? 'All Roles' : r}</option>)}
        </select>
      </div>

      {/* API Error Banner */}
      {errors.users && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex justify-between">
          <span>Error: {errors.users}</span>
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
              {isLoading && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400 text-sm">Loading users…</td></tr>
              )}
              {!isLoading && filteredUsers.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400 text-sm">No users found</td></tr>
              )}
              {!isLoading && filteredUsers.map(user => (
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
                    <button onClick={() => toggleUserStatus(user)}
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        user.status === 'Active'
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`} title="Click to toggle">
                      {user.status}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">{user.createdAt?.split('T')[0] ?? '—'}</td>
                  <td className="px-5 py-4">
                    {resetMsg?.id === user.id && (
                      <p className={`text-xs mb-1 ${resetMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{resetMsg.msg}</p>
                    )}
                    <div className="flex items-center justify-end gap-1">
                      {user.mustChangePassword && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium mr-1">Temp pw</span>
                      )}
                      <button onClick={() => handleResetPassword(user)} disabled={resetingId === user.id} title="Reset password — sends temp password to user's email"
                        className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-40">
                        {resetingId === user.id ? <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /> : <KeyRound size={16} />}
                      </button>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="e.g. Rahul Verma" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="user@edsignage.com" required />
              </div>
              {!editingUser && (
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">A temporary password will be generated and emailed to the user. They will be required to change it on first login.</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                  {roles.filter(r => r.name !== 'SuperAdmin').map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
                {roles.find(r => r.name === formData.role)?.description && (
                  <p className="text-xs text-gray-500 mt-1.5">{roles.find(r => r.name === formData.role).description}</p>
                )}
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
                <button type="button" onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-60">
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