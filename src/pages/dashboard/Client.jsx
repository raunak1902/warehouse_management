import { useState, Fragment } from 'react'
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  Mail,
  Phone,
  Building2,
  Calendar,
  Smartphone,
  AlertTriangle,
  CheckCircle,
  XCircle,
  LayoutGrid,
  Monitor,
  Tablet,
} from 'lucide-react'
import {
  useInventory,
  DEVICE_TYPES,
  getSubscriptionFilterStatus,
  getSubscriptionStatus,
} from '../../context/InventoryContext'

const ALERT_DAYS = 30
const URGENT_DAYS = 7

const defaultForm = {
  name: '',
  phone: '',
  email: '',
  company: '',
  address: '',
  notes: '',
  deviceIds: [],
  subscriptionStart: '',
  subscriptionEnd: '',
  durationMonths: '',
}

const DURATION_OPTIONS = [
  { value: '', label: 'Custom (pick end date)' },
  { value: 1, label: '1 month' },
  { value: 3, label: '3 months' },
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
  { value: 24, label: '24 months' },
]

const addMonths = (dateStr, months) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + Number(months))
  return d.toISOString().slice(0, 10)
}

const FILTER_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'upcoming', label: 'Upcoming' },
]

const statusStyles = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  urgent: 'bg-red-100 text-red-800 border-red-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
}

const DeviceTypeIcon = ({ type }) => {
  if (type === 'stand') return <LayoutGrid className="w-3.5 h-3.5" />
  if (type === 'istand') return <Monitor className="w-3.5 h-3.5" />
  return <Tablet className="w-3.5 h-3.5" />
}

const Client = () => {
  const {
    clients,
    devices,
    getDevicesByClientId,
    addClient,
    updateClient,
    removeClient,
    setClientDevices,
  } = useInventory()

  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [formData, setFormData] = useState(defaultForm)
  const [expandedClientId, setExpandedClientId] = useState(null)
  const [selectedDeviceTypeInForm, setSelectedDeviceTypeInForm] = useState('stand')
  const [showNotesField, setShowNotesField] = useState(false)

  const getDeviceCountByType = (deviceList) => {
    const counts = { stand: 0, istand: 0, tablet: 0 }
    deviceList.forEach((d) => {
      if (counts[d.type] !== undefined) counts[d.type]++
    })
    return counts
  }

  const formatDeviceCountSummary = (deviceList) => {
    const c = getDeviceCountByType(deviceList)
    const parts = []
    if (c.stand) parts.push(`${c.stand} A stand${c.stand > 1 ? 's' : ''}`)
    if (c.istand) parts.push(`${c.istand} I stand${c.istand > 1 ? 's' : ''}`)
    if (c.tablet) parts.push(`${c.tablet} tablet${c.tablet > 1 ? 's' : ''}`)
    return parts.length ? parts.join(', ') : null
  }

  const filteredBySearch = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.phone.includes(searchTerm)
  )

  const filteredClients = filteredBySearch.filter((c) => {
    const status = getSubscriptionFilterStatus(c.subscriptionStart, c.subscriptionEnd)
    return status === statusFilter
  })

  const clientsNeedingAlert = clients.filter((c) => {
    const status = getSubscriptionStatus(c.subscriptionEnd)
    return status.type === 'urgent' || status.type === 'warning'
  })

  const handleOpenModal = (client = null) => {
    if (client) {
      const assignedDevices = getDevicesByClientId(client.id)
      setEditingClient(client)
      setFormData({
        name: client.name,
        phone: client.phone,
        email: client.email,
        company: client.company || '',
        address: client.address || '',
        notes: client.notes || '',
        deviceIds: assignedDevices.map((d) => d.id),
        subscriptionStart: client.subscriptionStart || '',
        subscriptionEnd: client.subscriptionEnd || '',
        durationMonths: '',
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

  const handleStartDateChange = (newStart) => {
    const months = formData.durationMonths ? Number(formData.durationMonths) : null
    setFormData((prev) => ({
      ...prev,
      subscriptionStart: newStart,
      ...(months ? { subscriptionEnd: addMonths(newStart, months) } : {}),
    }))
  }

  const handleDurationChange = (value) => {
    const months = value === '' ? '' : Number(value)
    setFormData((prev) => ({
      ...prev,
      durationMonths: months,
      ...(months && prev.subscriptionStart
        ? { subscriptionEnd: addMonths(prev.subscriptionStart, months) }
        : {}),
    }))
  }

  const toggleDevice = (deviceId) => {
    setFormData((prev) =>
      prev.deviceIds.includes(deviceId)
        ? { ...prev, deviceIds: prev.deviceIds.filter((id) => id !== deviceId) }
        : { ...prev, deviceIds: [...prev.deviceIds, deviceId] }
    )
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
      subscriptionStart: formData.subscriptionStart,
      subscriptionEnd: formData.subscriptionEnd,
    }
    if (editingClient) {
      updateClient(editingClient.id, payload)
      setClientDevices(
        editingClient.id,
        formData.deviceIds,
        formData.subscriptionStart,
        formData.subscriptionEnd
      )
    } else {
      const newId = addClient(payload)
      setClientDevices(newId, formData.deviceIds, formData.subscriptionStart, formData.subscriptionEnd)
    }
    handleCloseModal()
  }

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to remove this client? Assigned devices will be unassigned.')) {
      removeClient(id)
    }
  }

  const availableDevices = devices.filter(
    (d) => !d.clientId || (editingClient && d.clientId === editingClient.id)
  )

  // By type: only devices available for rent (unassigned or assigned to this client when editing)
  const availableByType = {
    stand: availableDevices.filter((d) => d.type === 'stand'),
    istand: availableDevices.filter((d) => d.type === 'istand'),
    tablet: availableDevices.filter((d) => d.type === 'tablet'),
  }
  const listForSelectedType = availableByType[selectedDeviceTypeInForm] || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-8 h-8 text-primary-600" />
            Clients
          </h1>
          <p className="text-gray-600 mt-1">
            Manage clients, their contact details, rented devices (by unique code), and subscription dates.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Client
        </button>
      </div>

      {clientsNeedingAlert.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900">Subscription alerts</h3>
            <p className="text-sm text-amber-800 mt-1">
              {clientsNeedingAlert.length} client(s) have subscriptions ending within {ALERT_DAYS} days.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-800">
              {clientsNeedingAlert.map((c) => {
                const status = getSubscriptionStatus(c.subscriptionEnd)
                return (
                  <li key={c.id}>
                    <strong>{c.name}</strong> — {status.label}
                    {status.days >= 0 && ` (${status.days} days left)`}
                    {status.days < 0 && ' (expired)'}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, company, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Client</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Devices</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Subscription</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Notes</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    No clients in this filter. Try another filter or add a client.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const clientDevices = getDevicesByClientId(client.id)
                  const status = getSubscriptionStatus(client.subscriptionEnd)
                  return (
                    <Fragment key={client.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{client.name}</p>
                          {client.company && (
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5" />
                              {client.company}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1 text-sm">
                          <p className="flex items-center gap-1.5 text-gray-700">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            {client.phone}
                          </p>
                          <p className="flex items-center gap-1.5 text-gray-700">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            {client.email}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setExpandedClientId(expandedClientId === client.id ? null : client.id)}
                          className="text-left w-full"
                        >
                          {clientDevices.length === 0 ? (
                            <span className="text-gray-400 text-sm">No devices</span>
                          ) : (
                            <span className="text-primary-600 hover:text-primary-700 font-medium text-sm">
                              {formatDeviceCountSummary(clientDevices)}
                              <span className="text-gray-400 ml-1">
                                (click to see list)
                              </span>
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {client.subscriptionStart} → {client.subscriptionEnd}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusStyles[status.type]}`}
                        >
                          {status.type === 'active' && <CheckCircle className="w-3.5 h-3.5" />}
                          {(status.type === 'warning' || status.type === 'urgent') && (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          {status.type === 'expired' && <XCircle className="w-3.5 h-3.5" />}
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-[180px]">
                        {client.notes && client.notes.trim() ? (
                          <span className="text-sm text-gray-700" title={client.notes}>
                            {client.notes.length > 50 ? `${client.notes.slice(0, 50)}…` : client.notes}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(client)}
                            className="p-2 text-gray-600 hover:bg-primary-50 hover:text-primary-600 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(client.id)}
                            className="p-2 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedClientId === client.id && clientDevices.length > 0 && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="py-3 px-4">
                          <div className="pl-4 border-l-2 border-primary-200">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Products rented by {client.name}
                            </p>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left py-1.5 pr-4 font-medium text-gray-600">Unique ID</th>
                                    <th className="text-left py-1.5 font-medium text-gray-600">Type</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {clientDevices.map((d) => (
                                    <tr key={d.id} className="border-b border-gray-100">
                                      <td className="py-1.5 pr-4 font-mono text-gray-900">{d.code}</td>
                                      <td className="py-1.5 text-gray-700">{DEVICE_TYPES[d.type]}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleCloseModal}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingClient ? 'Edit Client' : 'Add New Client'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Assign devices by unique code. Device details are managed in the Devices page.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Client name"
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
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Full address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Devices to assign for rent</label>
                <p className="text-xs text-gray-500 mb-2">
                  Same pool as Dashboard &quot;Available&quot; — only unassigned devices appear here. When you assign, that device moves to &quot;Deployed&quot; on the Dashboard.
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  Click a type (ATV / ITV / TAB) to see items, then select the item codes to assign to this client.
                </p>
                <div className="flex gap-2 mb-3">
                  {(['stand', 'istand', 'tablet']).map((type) => {
                    const count = availableByType[type].length
                    const label = type === 'stand' ? 'A stand (ATV)' : type === 'istand' ? 'I stand (ITV)' : 'Tablet (TAB)'
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSelectedDeviceTypeInForm(type)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          selectedDeviceTypeInForm === type
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {label}
                        {count > 0 && (
                          <span className={`ml-1 ${selectedDeviceTypeInForm === type ? 'text-primary-100' : 'text-gray-400'}`}>
                            ({count})
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {listForSelectedType.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No {selectedDeviceTypeInForm === 'stand' ? 'A stand' : selectedDeviceTypeInForm === 'istand' ? 'I stand' : 'Tablet'} items available for rent. Add devices in the Devices page.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        Available for rent — select item codes to assign:
                      </p>
                      {listForSelectedType.map((d) => (
                        <label key={d.id} className="flex items-center gap-2 cursor-pointer hover:bg-primary-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={formData.deviceIds.includes(d.id)}
                            onChange={() => toggleDevice(d.id)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="font-mono text-sm font-medium text-gray-900">{d.code}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {formData.deviceIds.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Assigned: {formData.deviceIds.map((id) => devices.find((d) => d.id === id)?.code).filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subscription start *</label>
                    <input
                      type="date"
                      required
                      value={formData.subscriptionStart}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subscription end *</label>
                    <input
                      type="date"
                      required
                      value={formData.subscriptionEnd}
                      onChange={(e) => setFormData({ ...formData, subscriptionEnd: e.target.value, durationMonths: '' })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (months)</label>
                  <select
                    value={formData.durationMonths === '' ? '' : String(formData.durationMonths)}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.value === '' ? 'custom' : opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Pick a duration to auto-fill the end date from the start date.
                  </p>
                </div>
              </div>
              {(showNotesField || (formData.notes && formData.notes.trim())) ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Additional info"
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
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
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
