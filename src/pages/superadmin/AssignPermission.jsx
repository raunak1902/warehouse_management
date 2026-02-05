import { useState } from 'react'
import { Save, Search, Shield, Key, Check, X } from 'lucide-react'

const AssignPermission = () => {
  const [roles] = useState([
    { id: 1, name: 'SuperAdmin' },
    { id: 2, name: 'Admin' },
    { id: 3, name: 'Team' },
  ])

  const [permissions] = useState([
    { id: 1, name: 'users.create', module: 'Users', crud: 'Create' },
    { id: 2, name: 'users.read', module: 'Users', crud: 'Read' },
    { id: 3, name: 'users.update', module: 'Users', crud: 'Update' },
    { id: 4, name: 'users.delete', module: 'Users', crud: 'Delete' },
    { id: 5, name: 'inventory.create', module: 'Inventory', crud: 'Create' },
    { id: 6, name: 'inventory.read', module: 'Inventory', crud: 'Read' },
    { id: 7, name: 'inventory.update', module: 'Inventory', crud: 'Update' },
    { id: 8, name: 'inventory.delete', module: 'Inventory', crud: 'Delete' },
    { id: 9, name: 'roles.manage', module: 'Roles', crud: 'All' },
    { id: 10, name: 'reports.view', module: 'Reports', crud: 'Read' },
  ])

  const [selectedRole, setSelectedRole] = useState(null)
  const [assignedPermissions, setAssignedPermissions] = useState({
    1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // SuperAdmin has all
    2: [1, 2, 3, 4, 6, 7, 9], // Admin
    3: [2, 6, 10], // Team
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterModule, setFilterModule] = useState('All')

  const modules = ['All', 'Users', 'Inventory', 'Roles', 'Reports']

  const filteredPermissions = permissions.filter(permission => {
    const matchesSearch = permission.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesModule = filterModule === 'All' || permission.module === filterModule
    return matchesSearch && matchesModule
  })

  const togglePermission = (permissionId) => {
    if (!selectedRole) return

    const current = assignedPermissions[selectedRole.id] || []
    if (current.includes(permissionId)) {
      setAssignedPermissions({
        ...assignedPermissions,
        [selectedRole.id]: current.filter(id => id !== permissionId)
      })
    } else {
      setAssignedPermissions({
        ...assignedPermissions,
        [selectedRole.id]: [...current, permissionId]
      })
    }
  }

  const handleSave = () => {
    if (!selectedRole) return
    // In real app, this would call an API to save assignments
    alert(`Permissions saved for ${selectedRole.name} role!`)
  }

  const getAssignedCount = (roleId) => {
    return (assignedPermissions[roleId] || []).length
  }

  const isPermissionAssigned = (permissionId) => {
    if (!selectedRole) return false
    return (assignedPermissions[selectedRole.id] || []).includes(permissionId)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assign Permissions</h1>
          <p className="text-gray-600 mt-1">Assign permissions to roles</p>
        </div>
        {selectedRole && (
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Save size={20} />
            Save Assignments
          </button>
        )}
      </div>

      {/* Role Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Role</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedRole?.id === role.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className={`w-5 h-5 ${selectedRole?.id === role.id ? 'text-primary-600' : 'text-gray-400'}`} />
                  <span className={`font-semibold ${selectedRole?.id === role.id ? 'text-primary-600' : 'text-gray-900'}`}>
                    {role.name}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                {getAssignedCount(role.id)} permissions assigned
              </p>
            </button>
          ))}
        </div>
      </div>

      {selectedRole ? (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search permissions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <select
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                {modules.map(module => (
                  <option key={module} value={module}>{module}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Permissions List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">
                Assign Permissions to {selectedRole.name}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Select the permissions you want to assign to this role
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              {filteredPermissions.map((permission) => {
                const isAssigned = isPermissionAssigned(permission.id)
                return (
                  <div
                    key={permission.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <button
                          onClick={() => togglePermission(permission.id)}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                            isAssigned
                              ? 'bg-primary-600 border-primary-600'
                              : 'border-gray-300 hover:border-primary-400'
                          }`}
                        >
                          {isAssigned && <Check className="w-4 h-4 text-white" />}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Key className="w-4 h-4 text-primary-600" />
                            <span className="font-medium text-gray-900">{permission.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                              {permission.module}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                              {permission.crud}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-primary-50 rounded-xl border border-primary-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-700 font-medium">
                  Total Permissions Assigned: {getAssignedCount(selectedRole.id)}
                </p>
                <p className="text-xs text-primary-600 mt-1">
                  Changes will be saved when you click "Save Assignments"
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Role</h3>
          <p className="text-gray-600">Please select a role above to assign permissions</p>
        </div>
      )}
    </div>
  )
}

export default AssignPermission
