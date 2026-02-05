import { useState } from 'react'
import { Plus, Edit, Trash2, Search, Key, Shield } from 'lucide-react'

const PermissionManagement = () => {
  const [permissions, setPermissions] = useState([
    { id: 1, name: 'users.create', description: 'Create new users', module: 'Users', crud: 'Create' },
    { id: 2, name: 'users.read', description: 'View user list and details', module: 'Users', crud: 'Read' },
    { id: 3, name: 'users.update', description: 'Edit user information', module: 'Users', crud: 'Update' },
    { id: 4, name: 'users.delete', description: 'Delete users', module: 'Users', crud: 'Delete' },
    { id: 5, name: 'inventory.create', description: 'Add new inventory items', module: 'Inventory', crud: 'Create' },
    { id: 6, name: 'inventory.read', description: 'View inventory items', module: 'Inventory', crud: 'Read' },
    { id: 7, name: 'inventory.update', description: 'Update inventory items', module: 'Inventory', crud: 'Update' },
    { id: 8, name: 'inventory.delete', description: 'Delete inventory items', module: 'Inventory', crud: 'Delete' },
    { id: 9, name: 'roles.manage', description: 'Manage roles and permissions', module: 'Roles', crud: 'All' },
    { id: 10, name: 'reports.view', description: 'View reports and analytics', module: 'Reports', crud: 'Read' },
  ])

  const [showModal, setShowModal] = useState(false)
  const [editingPermission, setEditingPermission] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterModule, setFilterModule] = useState('All')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    module: 'Users',
    crud: 'Read'
  })

  const modules = ['All', 'Users', 'Inventory', 'Roles', 'Reports', 'Warehouse']

  const filteredPermissions = permissions.filter(permission => {
    const matchesSearch = permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesModule = filterModule === 'All' || permission.module === filterModule
    return matchesSearch && matchesModule
  })

  const handleOpenModal = (permission = null) => {
    if (permission) {
      setEditingPermission(permission)
      setFormData({
        name: permission.name,
        description: permission.description,
        module: permission.module,
        crud: permission.crud
      })
    } else {
      setEditingPermission(null)
      setFormData({
        name: '',
        description: '',
        module: 'Users',
        crud: 'Read'
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingPermission(null)
    setFormData({
      name: '',
      description: '',
      module: 'Users',
      crud: 'Read'
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingPermission) {
      setPermissions(permissions.map(p => p.id === editingPermission.id ? { ...editingPermission, ...formData } : p))
    } else {
      const newPermission = {
        id: permissions.length + 1,
        ...formData
      }
      setPermissions([...permissions, newPermission])
    }
    handleCloseModal()
  }

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this permission?')) {
      setPermissions(permissions.filter(p => p.id !== id))
    }
  }

  const getCrudColor = (crud) => {
    const colors = {
      'Create': 'bg-green-100 text-green-800',
      'Read': 'bg-blue-100 text-blue-800',
      'Update': 'bg-yellow-100 text-yellow-800',
      'Delete': 'bg-red-100 text-red-800',
      'All': 'bg-purple-100 text-purple-800'
    }
    return colors[crud] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Permission Management</h1>
          <p className="text-gray-600 mt-1">Create and manage system permissions</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={20} />
          Create Permission
        </button>
      </div>

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

      {/* Permissions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permission</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CRUD</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPermissions.map((permission) => (
                <tr key={permission.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-primary-600" />
                      <span className="text-sm font-medium text-gray-900">{permission.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <Shield size={12} />
                      {permission.module}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getCrudColor(permission.crud)}`}>
                      {permission.crud}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{permission.description}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(permission)}
                        className="text-primary-600 hover:text-primary-900 p-2 hover:bg-primary-50 rounded"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(permission.id)}
                        className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingPermission ? 'Edit Permission' : 'Create New Permission'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permission Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="e.g., users.create, inventory.read"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  rows="2"
                  placeholder="Describe what this permission allows"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Module</label>
                <select
                  value={formData.module}
                  onChange={(e) => setFormData({ ...formData, module: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  {modules.filter(m => m !== 'All').map(module => (
                    <option key={module} value={module}>{module}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CRUD Operation</label>
                <select
                  value={formData.crud}
                  onChange={(e) => setFormData({ ...formData, crud: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="Create">Create</option>
                  <option value="Read">Read</option>
                  <option value="Update">Update</option>
                  <option value="Delete">Delete</option>
                  <option value="All">All</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingPermission ? 'Update' : 'Create'}
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
