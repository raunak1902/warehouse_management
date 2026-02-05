import { Package, TrendingUp, AlertCircle, Warehouse, ArrowUp, ArrowDown, Activity } from 'lucide-react'
import { Link } from 'react-router-dom'

const Dashboard = ({ userRole }) => {
  const stats = [
    { 
      title: 'Total Items', 
      value: '1,234', 
      icon: Package, 
      color: 'bg-blue-500',
      change: '+12%',
      changeType: 'up'
    },
    { 
      title: 'Low Stock Items', 
      value: '23', 
      icon: AlertCircle, 
      color: 'bg-red-500',
      change: '-5%',
      changeType: 'down'
    },
    { 
      title: 'Total Value', 
      value: '$45,678', 
      icon: TrendingUp, 
      color: 'bg-green-500',
      change: '+8%',
      changeType: 'up'
    },
    { 
      title: 'Warehouses', 
      value: '4', 
      icon: Warehouse, 
      color: 'bg-purple-500',
      change: '0%',
      changeType: 'neutral'
    },
  ]

  const recentActivities = [
    { id: 1, action: 'New item added', item: 'LED Display Panel 55"', time: '2 hours ago', type: 'add' },
    { id: 2, action: 'Stock updated', item: 'Mounting Bracket Set', time: '5 hours ago', type: 'update' },
    { id: 3, action: 'Low stock alert', item: 'HDMI Cable 10ft', time: '1 day ago', type: 'alert' },
    { id: 4, action: 'Item moved', item: 'Power Supply Unit', time: '2 days ago', type: 'move' },
  ]

  const lowStockItems = [
    { id: 1, name: 'HDMI Cable 10ft', current: 5, min: 10, location: 'Warehouse A' },
    { id: 2, name: 'Mounting Bracket Set', current: 8, min: 15, location: 'Warehouse B' },
    { id: 3, name: 'Power Supply Unit', current: 3, min: 10, location: 'Warehouse A' },
    { id: 4, name: 'VGA Adapter', current: 12, min: 20, location: 'Warehouse C' },
  ]

  const topItems = [
    { id: 1, name: 'LED Display Panel 55"', quantity: 45, value: '$12,450' },
    { id: 2, name: 'Media Player Pro', quantity: 32, value: '$8,960' },
    { id: 3, name: 'Touch Screen Overlay', quantity: 28, value: '$7,840' },
    { id: 4, name: 'Digital Signage Software License', quantity: 15, value: '$4,500' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {userRole}! Here's your inventory overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.title}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                {stat.changeType !== 'neutral' && (
                  <div className={`flex items-center gap-1 text-sm font-medium ${
                    stat.changeType === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.changeType === 'up' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    {stat.change}
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Low Stock Alerts
            </h2>
            <Link
              to="/inventory"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {lowStockItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-600">{item.location}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-red-600">
                    {item.current} / {item.min}
                  </p>
                  <p className="text-xs text-gray-500">Current / Min</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-600" />
              Recent Activities
            </h2>
            <Link
              to="/activities"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View All
            </Link>
          </div>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0">
                <div className={`p-2 rounded-lg ${
                  activity.type === 'add' ? 'bg-green-100' :
                  activity.type === 'update' ? 'bg-blue-100' :
                  activity.type === 'alert' ? 'bg-red-100' :
                  'bg-yellow-100'
                }`}>
                  <AlertCircle className={`w-4 h-4 ${
                    activity.type === 'add' ? 'text-green-600' :
                    activity.type === 'update' ? 'text-blue-600' :
                    activity.type === 'alert' ? 'text-red-600' :
                    'text-yellow-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{activity.action}</p>
                  <p className="text-sm text-gray-600">{activity.item}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Items by Value */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Top Items by Value</h2>
          <Link
            to="/inventory"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            View All Items
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary-100 rounded-lg">
                        <Package className="w-4 h-4 text-primary-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600">{item.quantity} units</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/inventory/add"
            className="block px-4 py-3 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors font-medium text-center"
          >
            Add New Item
          </Link>
          <Link
            to="/inventory"
            className="block px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium text-center"
          >
            View Inventory
          </Link>
          <Link
            to="/reports"
            className="block px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors font-medium text-center"
          >
            Generate Report
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
