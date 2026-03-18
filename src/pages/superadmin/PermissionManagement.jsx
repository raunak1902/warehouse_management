import { useState, useMemo } from 'react'
import { Plus, Edit, Trash2, Search, Key, Shield, RefreshCw, AlertCircle } from 'lucide-react'
import { useSuperAdmin } from '../../context/SuperAdminContext'

// Colors for known operations — unknown ones fall back to gray
const OPERATION_COLORS = {
  create:       'bg-green-100 text-green-800',
  read:         'bg-blue-100 text-blue-800',
  update:       'bg-yellow-100 text-yellow-800',
  delete:       'bg-red-100 text-red-800',
  approve:      'bg-emerald-100 text-emerald-800',
  reject:       'bg-rose-100 text-rose-800',
  disassemble:  'bg-orange-100 text-orange-800',
  view_history: 'bg-indigo-100 text-indigo-800',
}

const PermissionManagement = () => {
  const {
    permissions, loading, errors,
    createPermission, updatePermission, deletePermission, fetchPermissions,
  } = useSuperAdmin()

  const [showModal,         setShowModal]         = useState(false)
  const [editingPermission, setEditingPermission] = useState(null)
  const [searchTerm,        setSearchTerm]        = useState('')
  const [filterModule,      setFilterModule]      = useState('All')
  const [submitting,        setSubmitting]        = useState(false)
  const [formError,         setFormError]         = useState(null)

  // Free-text inputs so user is never locked to a hardcoded list
  const [formData, setFormData] = useState({ module: '', operation: '', description: '' })

  // ── Derive unique modules + operations dynamically from DB ──────────────────
  const existingModules = useMemo(() =>
    [...new Set(permissions.map(p => p.module))].sort(),
    [permissions]
  )

  const existingOperations = useMemo(() =>
    [...new Set(permissions.map(p => p.operation))].sort(),
    [permissions]
  )

  // ── Filtered + grouped permissions ─────────────────────────────────────────
  const filteredPermissions = useMemo(() =>
    permissions.filter(p => {
      const q = searchTerm.toLowerCase()
      const matchSearch =
        p.module?.toLowerCase().includes(q) ||
        p.operation?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      const matchModule = filterModule === 'All' || p.module === filterModule
      return matchSearch && matchModule
    }),
    [permissions, searchTerm, filterModule]
  )

  const groupedByModule = useMemo(() =>
    filteredPermissions.reduce((acc, p) => {
      if (!acc[p.module]) acc[p.module] = []
      acc[p.module].push(p)
      return acc
    }, {}),
    [filteredPermissions]
  )

  // ── Modal helpers ───────────────────────────────────────────────────────────
  const handleOpenModal = (permission = null) => {
    setFormError(null)
    if (permission) {
      setEditingPermission(permission)
      setFormData({
        module:      permission.module,
        operation:   permission.operation,
        description: permission.description || '',
      })
    } else {
      setEditingPermission(null)
      setFormData({ module: '', operation: '', description: '' })
    }
    setShowModal(true)
  }

  const handleClose = () => {
    setShowModal(false)
    setEditingPermission(null)
    setFormError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.module.trim() || !formData.operation.trim()) {
      setFormError('Module and Operation are required.')
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      if (editingPermission) {
        await updatePermission(editingPermission.id, formData)
      } else {
        await createPermission(formData)
      }
      handleClose()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this permission? It will be removed from all roles automatically.')) return
    try { await deletePermission(id) } catch (err) { alert(err.message) }
  }

  const getOpColor = (op) => OPERATION_COLORS[op?.toLowerCase()] || 'bg-gray-100 text-gray-800'

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Permission Management</h2>
          <p className="text-gray-500 mt-0.5 text-sm">
            Permissions are defined as{' '}
            <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">Module + Operation</span>
            {' '}— auto-seeded from the registry on every deploy
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPermissions}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            <Plus size={18} /> Create Permission
          </button>
        </div>
      </div>

      {errors.permissions && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{errors.permissions}</span>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-2xl font-bold text-gray-900">{permissions.length}</p>
          <p className="text-sm text-gray-500 mt-0.5">Total Permissions</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-2xl font-bold text-gray-900">{existingModules.length}</p>
          <p className="text-sm text-gray-500 mt-0.5">Modules</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-2xl font-bold text-gray-900">{existingOperations.length}</p>
          <p className="text-sm text-gray-500 mt-0.5">Unique Operations</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by module, operation, description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          {/* Filter dropdown — built dynamically from DB */}
          <select
            value={filterModule}
            onChange={e => setFilterModule(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="All">All Modules ({permissions.length})</option>
            {existingModules.map(m => (
              <option key={m} value={m}>
                {m} ({permissions.filter(p => p.module === m).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Permissions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Module</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Operation</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading.permissions && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-gray-400 text-sm">
                    Loading permissions…
                  </td>
                </tr>
              )}
              {!loading.permissions && filteredPermissions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-gray-400 text-sm">
                    {permissions.length === 0
                      ? 'No permissions yet. Click "Create Permission" to add the first one.'
                      : 'No permissions match your filters.'}
                  </td>
                </tr>
              )}
              {!loading.permissions && Object.entries(groupedByModule).map(([module, perms]) =>
                perms.map((p, i) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 whitespace-nowrap">
                      {i === 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <Shield size={11} />{module}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs pl-2">↳</span>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Key className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getOpColor(p.operation)}`}>
                          {p.operation}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{p.description || '—'}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleOpenModal(p)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading.permissions && filteredPermissions.length > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            Showing {filteredPermissions.length} of {permissions.length} permission{permissions.length !== 1 ? 's' : ''}
            {filterModule !== 'All' && ` in module "${filterModule}"`}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">
                {editingPermission ? 'Edit Permission' : 'Create New Permission'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Type a new module/operation or pick an existing one from the suggestions
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                  {formError}
                </div>
              )}

              {/* Live preview */}
              <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-2">
                <Key size={14} className="text-primary-500" />
                <span className="text-sm font-mono text-gray-700">
                  {formData.module || <span className="text-gray-400">Module</span>}
                  <span className="text-gray-400">.</span>
                  {formData.operation || <span className="text-gray-400">operation</span>}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Module — free text with datalist suggestions from DB */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Module</label>
                  <input
                    list="module-suggestions"
                    value={formData.module}
                    onChange={e => setFormData({ ...formData, module: e.target.value })}
                    placeholder="e.g. Devices"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    required
                  />
                  <datalist id="module-suggestions">
                    {existingModules.map(m => <option key={m} value={m} />)}
                  </datalist>
                  <p className="text-xs text-gray-400 mt-1">Pick existing or type new</p>
                </div>

                {/* Operation — free text with datalist suggestions from DB */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Operation</label>
                  <input
                    list="operation-suggestions"
                    value={formData.operation}
                    onChange={e => setFormData({ ...formData, operation: e.target.value.toLowerCase() })}
                    placeholder="e.g. approve"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    required
                  />
                  <datalist id="operation-suggestions">
                    {existingOperations.map(op => <option key={op} value={op} />)}
                  </datalist>
                  <p className="text-xs text-gray-400 mt-1">Pick existing or type new</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="e.g. Allows approving lifecycle requests"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-60"
                >
                  {submitting ? 'Saving…' : editingPermission ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default PermissionManagement