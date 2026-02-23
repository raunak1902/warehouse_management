import { useState } from 'react'
import { Users, Shield, Key, Settings } from 'lucide-react'
import { SuperAdminProvider } from '../../context/SuperAdminContext'
import UserManagement from './UserManagement'
import RoleManagement from './RoleManagement'
import PermissionManagement from './PermissionManagement'
import AssignPermission from './AssignPermission'

const tabs = [
  { id: 'users',       label: 'User Management',       icon: Users   },
  { id: 'roles',       label: 'Role Management',        icon: Shield  },
  { id: 'permissions', label: 'Permission Management',  icon: Key     },
  { id: 'assign',      label: 'Assign Permissions',     icon: Settings},
]

const SuperAdmin = () => {
  const [activeTab, setActiveTab] = useState('users')

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':       return <UserManagement />
      case 'roles':       return <RoleManagement />
      case 'permissions': return <PermissionManagement />
      case 'assign':      return <AssignPermission />
      default:            return <UserManagement />
    }
  }

  return (
    <SuperAdminProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Super Admin</h1>
          <p className="text-gray-600 mt-1">Manage users, roles, and permissions</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-1 p-2" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>
          <div>{renderTabContent()}</div>
        </div>
      </div>
    </SuperAdminProvider>
  )
}

export default SuperAdmin