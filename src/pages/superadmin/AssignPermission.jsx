import { useState, useEffect } from 'react'
import { Save, Search, Shield, Key, Check, AlertCircle, CheckSquare, Square, Loader } from 'lucide-react'
import { useSuperAdmin } from '../../context/SuperAdminContext'

const OPERATION_COLORS = {
  create: 'bg-green-100 text-green-700',
  read:   'bg-blue-100 text-blue-700',
  update: 'bg-yellow-100 text-yellow-700',
  delete: 'bg-red-100 text-red-700',
  all:    'bg-purple-100 text-purple-700',
}

const AssignPermission = () => {
  const {
    roles, permissions,
    loading, errors,
    rolePermissions,
    toggleRolePermission,
    saveRolePermissions,
    getRolePermissionIds,
    fetchRolePermissions,
  } = useSuperAdmin()

  const [selectedRole,  setSelectedRole]  = useState(null)
  const [searchTerm,    setSearchTerm]    = useState('')
  const [filterModule,  setFilterModule]  = useState('All')
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState(null)
  const [saveSuccess,   setSaveSuccess]   = useState(false)
  const [loadingPerms,  setLoadingPerms]  = useState(false)

  // When a role is selected, load its current permissions from the backend
  const handleSelectRole = async (role) => {
    setSelectedRole(role)
    setSaveError(null)
    setSaveSuccess(false)
    // Only fetch if we haven't loaded them yet
    if (rolePermissions[role.id] === undefined) {
      setLoadingPerms(true)
      await fetchRolePermissions(role.id)
      setLoadingPerms(false)
    }
  }

  const modules = ['All', ...Array.from(new Set(permissions.map(p => p.module))).filter(Boolean).sort()]

  const filteredPermissions = permissions.filter(p => {
    const matchSearch = p.module?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.operation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchModule = filterModule === 'All' || p.module === filterModule
    return matchSearch && matchModule
  })

  const isPermissionAssigned = (permissionId) => {
    if (!selectedRole) return false
    return getRolePermissionIds(selectedRole.id).includes(permissionId)
  }

  const handleToggle = (permissionId) => {
    if (!selectedRole || loadingPerms) return
    toggleRolePermission(selectedRole.id, permissionId)
    setSaveSuccess(false)
  }

  const filteredAllSelected = selectedRole && filteredPermissions.length > 0
    ? filteredPermissions.every(p => isPermissionAssigned(p.id))
    : false

  const handleToggleAll = () => {
    if (!selectedRole) return
    const filteredIds = filteredPermissions.map(p => p.id)
    const currentIds = getRolePermissionIds(selectedRole.id)
    if (filteredAllSelected) {
      // Deselect all filtered
      filteredIds.forEach(id => {
        if (currentIds.includes(id)) toggleRolePermission(selectedRole.id, id)
      })
    } else {
      // Select all filtered
      filteredIds.forEach(id => {
        if (!currentIds.includes(id)) toggleRolePermission(selectedRole.id, id)
      })
    }
    setSaveSuccess(false)
  }

  const handleSave = async () => {
    if (!selectedRole) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const ids = getRolePermissionIds(selectedRole.id)
      await saveRolePermissions(selectedRole.id, ids)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const assignedCount = selectedRole ? getRolePermissionIds(selectedRole.id).length : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Assign Permissions</h2>
          <p className="text-gray-500 mt-0.5 text-sm">
            Select a role, toggle permissions, then save — roles created in Role Management appear here automatically
          </p>
        </div>
        {selectedRole && (
          <button onClick={handleSave} disabled={saving || loadingPerms}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
              saveSuccess ? 'bg-green-600 text-white' : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}>
            {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving…' : saveSuccess ? '✓ Saved!' : 'Save Assignments'}
          </button>
        )}
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{saveError}</span>
        </div>
      )}

      {/* Role Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          Select Role
          {loading.roles && <span className="text-sm font-normal text-gray-400 ml-2">Loading…</span>}
        </h3>
        {errors.roles && <p className="text-sm text-red-600 mb-3">{errors.roles}</p>}
        <div className="flex flex-wrap gap-3">
          {roles.map(role => (
            <button key={role.id} onClick={() => handleSelectRole(role)}
              className={`px-4 py-3 rounded-lg border-2 transition-all text-left flex items-center gap-2.5 min-w-[140px] ${
                selectedRole?.id === role.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}>
              <Shield className={`w-4 h-4 flex-shrink-0 ${selectedRole?.id === role.id ? 'text-primary-600' : 'text-gray-400'}`} />
              <div>
                <p className={`text-sm font-semibold ${selectedRole?.id === role.id ? 'text-primary-700' : 'text-gray-900'}`}>
                  {role.name}
                </p>
                <p className="text-xs text-gray-400">
                  {selectedRole?.id === role.id
                    ? `${assignedCount} assigned`
                    : `${role.permissionCount ?? 0} assigned`}
                </p>
              </div>
            </button>
          ))}
          {roles.length === 0 && !loading.roles && (
            <p className="text-sm text-gray-400">No roles found. Create roles in the Role Management tab first.</p>
          )}
        </div>
      </div>

      {selectedRole ? (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" placeholder="Search permissions..." value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <select value={filterModule} onChange={e => setFilterModule(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                {modules.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Permissions List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Permissions for <span className="text-primary-600">{selectedRole.name}</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {loadingPerms ? 'Loading current assignments…' : `${filteredPermissions.length} shown · ${assignedCount} total assigned`}
                </p>
              </div>
              {filteredPermissions.length > 0 && !loadingPerms && (
                <button onClick={handleToggleAll}
                  className="text-xs font-medium text-primary-600 hover:text-primary-800 flex items-center gap-1.5">
                  {filteredAllSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  {filteredAllSelected ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {loadingPerms ? (
              <div className="p-8 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                <Loader size={16} className="animate-spin" /> Loading current permissions…
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {loading.permissions && (
                  <div className="p-8 text-center text-gray-400 text-sm">Loading permissions…</div>
                )}
                {!loading.permissions && filteredPermissions.length === 0 && (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    {permissions.length === 0
                      ? 'No permissions exist yet. Create some in the Permission Management tab.'
                      : 'No permissions match your filters.'}
                  </div>
                )}
                {!loading.permissions && filteredPermissions.map(p => {
                  const assigned = isPermissionAssigned(p.id)
                  return (
                    <div key={p.id} onClick={() => handleToggle(p.id)}
                      className="p-4 hover:bg-gray-50 transition-colors cursor-pointer select-none">
                      <div className="flex items-center gap-4">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          assigned ? 'bg-primary-600 border-primary-600' : 'border-gray-300 hover:border-primary-400'
                        }`}>
                          {assigned && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium">{p.module}</span>
                            <span className={`text-xs px-2 py-0.5 rounded capitalize ${OPERATION_COLORS[p.operation?.toLowerCase()] || 'bg-gray-100 text-gray-700'}`}>
                              {p.operation}
                            </span>
                          </div>
                          {p.description && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{p.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Save bar */}
          <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 transition-colors ${
            saveSuccess ? 'bg-green-50 border-green-200' : 'bg-primary-50 border-primary-200'
          }`}>
            <div>
              <p className={`text-sm font-medium ${saveSuccess ? 'text-green-700' : 'text-primary-700'}`}>
                {saveSuccess
                  ? `✓ Permissions saved for "${selectedRole.name}"`
                  : `${assignedCount} permission${assignedCount !== 1 ? 's' : ''} assigned to "${selectedRole.name}"`}
              </p>
              <p className={`text-xs mt-0.5 ${saveSuccess ? 'text-green-600' : 'text-primary-600'}`}>
                {saveSuccess
                  ? 'Changes have been persisted to the database'
                  : 'Unsaved — click "Save Assignments" to persist'}
              </p>
            </div>
            <button onClick={handleSave} disabled={saving || loadingPerms}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 disabled:opacity-60 ${
                saveSuccess ? 'bg-green-600 text-white' : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}>
              {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : saveSuccess ? 'Saved!' : 'Save'}
            </button>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Shield className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-gray-900 mb-1">Select a Role to Begin</h3>
          <p className="text-sm text-gray-400">Choose a role above to view and manage its permissions</p>
        </div>
      )}
    </div>
  )
}

export default AssignPermission