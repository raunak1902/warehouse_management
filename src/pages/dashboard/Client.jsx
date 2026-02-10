import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  Mail,
  Phone,
  Building2,
  Package,
} from 'lucide-react'
import {
  useInventory,
} from '../../context/InventoryContext'

const defaultForm = {
  name: '',
  phone: '',
  email: '',
  company: '',
  address: '',
  notes: '',
}

const Client = () => {
  const {
    clients,
    devices,
    getDevicesByClientId,
    addClient,
    updateClient,
    removeClient,
  } = useInventory()

  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState(defaultForm)
  const [showNotesField, setShowNotesField] = useState(false)

  const formatDeviceCountSummary = (deviceList) => {
    const counts = { stand: 0, istand: 0, tablet: 0 }
    deviceList.forEach((d) => {
      if (counts[d.type] !== undefined) counts[d.type]++
    })
    const parts = []
    if (counts.stand) parts.push(`${counts.stand} A stand${counts.stand > 1 ? 's' : ''}`)
    if (counts.istand) parts.push(`${counts.istand} I stand${counts.istand > 1 ? 's' : ''}`)
    if (counts.tablet) parts.push(`${counts.tablet} tablet${counts.tablet > 1 ? 's' : ''}`)
    return parts.length ? parts.join(', ') : 'No devices assigned'
  }

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.phone.includes(searchTerm)
  )

  const handleOpenModal = (client = null) => {
    if (client) {
      setEditingClient(client)
      setFormData({
        name: client.name,
        phone: client.phone,
        email: client.email,
        company: client.company || '',
        address: client.address || '',
        notes: client.notes || '',
      })
      setShowNotesField(!!(client.notes && client.notes.trim()))
    } else {
      setEditingClient(null)
      setFormData({ ...defaultForm })
      setShowNotesField(false)
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingClient(null)
    setFormData({ ...defaultForm })
    setShowNotesField(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      company: formData.company.trim(),
      address: formData.address.trim(),
      notes: formData.notes.trim(),
      // Keep existing subscription dates if editing, or set defaults for new clients
      subscriptionStart: editingClient?.subscriptionStart || '',
      subscriptionEnd: editingClient?.subscriptionEnd || '',
    }
    
    if (editingClient) {
      updateClient(editingClient.id, payload)
    } else {
      addClient(payload)
    }
    handleCloseModal()
  }

  const handleDelete = (client) => {
    const assignedDevices = getDevicesByClientId(client.id)
    if (assignedDevices.length > 0) {
      if (!confirm(`${client.name} has ${assignedDevices.length} device(s) assigned. Deleting will unassign them. Continue?`)) {
        return
      }
    }
    removeClient(client.id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-8 h-8 text-primary-600" />
              Clients
            </h1>
            <p className="text-gray-600 mt-1">
              Manage client information. Assign devices in the <Link to="/dashboard/assigning" className="text-primary-600 hover:text-primary-700 font-medium">Assigning</Link> module.
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium shadow-sm transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Client
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, company, or phone..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Client List */}
      <div className="space-y-4">
        {filteredClients.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No clients found matching your criteria</p>
          </div>
        ) : (
          filteredClients.map((client) => {
            const assignedDevices = getDevicesByClientId(client.id)

            return (
              <div key={client.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{client.name}</h3>
                        {assignedDevices.length > 0 && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700 border border-primary-200">
                            {assignedDevices.length} device{assignedDevices.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        {client.company && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span>{client.company}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{client.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{client.email}</span>
                        </div>
                      </div>

                      {client.address && (
                        <p className="text-sm text-gray-600 mt-2">{client.address}</p>
                      )}

                      {assignedDevices.length > 0 ? (
                        <div className="mt-3 flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <p className="text-sm text-gray-600">{formatDeviceCountSummary(assignedDevices)}</p>
                        </div>
                      ) : (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-900">
                            No devices assigned yet. Go to <Link to="/dashboard/assigning" className="font-semibold underline">Assigning</Link> to assign devices.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-start gap-2 ml-4">
                      <button
                        onClick={() => handleOpenModal(client)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit client"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(client)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete client"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {client.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">{client.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingClient ? 'Edit Client' : 'Add New Client'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {editingClient 
                  ? 'Update client information' 
                  : 'Create a new client profile. Assign devices later in the Assigning module.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., Domino's Pizza"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="+1 555-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Full address"
                />
              </div>

              {(showNotesField || (formData.notes && formData.notes.trim())) ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Additional information about the client..."
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNotesField(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  + Add notes (optional)
                </button>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
                >
                  {editingClient ? 'Update Client' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Client