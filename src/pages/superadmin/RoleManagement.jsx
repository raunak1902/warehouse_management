import { useState } from 'react'
import { Plus, Edit, Trash2, Search, Shield, RefreshCw, AlertCircle } from 'lucide-react'
import { useSuperAdmin } from '../../context/SuperAdminContext'

const RoleManagement = () => {
  const { roles, loading, errors, createRole, updateRole, deleteRole, fetchRoles, getRolePermissionIds } = useSuperAdmin()

  const [showModal,    setShowModal]    = useState(false)
  const [editingRole,  setEditingRole]  = useState(null)
  const [searchTerm,   setSearchTerm]   = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [formError,    setFormError]    = useState(null)
  const [formData,     setFormData]     = useState({ name: '', description: '' })

  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleOpenModal = (role = null) => {
    setFormError(null)
    if (role) {
      setEditingRole(role)
      setFormData({ name: role.name, description: role.description || '' })
    } else {
      setEditingRole(null)
      setFormData({ name: '', description: '' })
    }
    setShowModal(true)
  }

  const handleClose = () => { setShowModal(false); setEditingRole(null); setFormError(null) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      if (editingRole) {
        await updateRole(editingRole.id, formData)
      } else {
        await createRole(formData)
      }
      handleClose()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this role? This cannot be undone.')) return
    try { await deleteRole(id) } catch (err) { alert(err.message) }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Role Management</h2>
          <p className="text-gray-500 mt-0.5 text-sm">Create and manage user roles — changes sync instantly across all tabs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchRoles} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Refresh">
            <RefreshCw size={18} />
          </button>
          <button onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium">
            <Plus size={18} /> Create Role
          </button>
        </div>
      </div>

      {/* Error */}
      {errors.roles && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{errors.roles}</span>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Search roles..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
      </div>

      {/* Roles Grid */}
      {loading.roles ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading roles…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoles.map(role => (
            <div key={role.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <Shield className="w-5 h-5 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{role.name}</h3>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenModal(role)}
                    className="text-primary-600 hover:text-primary-900 p-1.5 hover:bg-primary-50 rounded">
                    <Edit size={16} />
                  </button>
                  {role.name !== 'SuperAdmin' && (
                    <button onClick={() => handleDelete(role.id)}
                      className="text-red-600 hover:text-red-900 p-1.5 hover:bg-red-50 rounded">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">{role.description || 'No description'}</p>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">Permissions</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {role.permissionCount ?? getRolePermissionIds(role.id).length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Users</p>
                  <p className="text-lg font-semibold text-gray-900">{role.userCount ?? role.users ?? 0}</p>
                </div>
              </div>
            </div>
          ))}

          {filteredRoles.length === 0 && !loading.roles && (
            <div className="col-span-3 text-center py-12 text-gray-400 text-sm">
              No roles found
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">{editingRole ? 'Edit Role' : 'Create New Role'}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {editingRole ? 'Update role details' : 'New role will immediately appear in Assign Permissions tab'}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role Name</label>
                <input type="text" value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="e.g. Manager, Viewer, Auditor" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  rows="3" placeholder="Describe this role's purpose and access level" required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-60">
                  {submitting ? 'Saving…' : editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default RoleManagement