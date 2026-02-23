import { useState, useMemo } from 'react'
import {
  Users, Plus, Edit, Trash2, Search, Mail, Phone, Building2,
  Package, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle,
  Monitor, Smartphone, LayoutGrid, Layers, Calendar, ArrowRight,
  AlertTriangle, Shield, Wrench, History, Box,
} from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'
import { clientApi } from '../../api/clientApi'

// ── helpers ───────────────────────────────────────────────────

const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const getInitials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-purple-500 to-violet-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-sky-600',
]

const avatarColor = (name = '') => {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

const HEALTH_BADGE = {
  ok:     { label: 'OK',      cls: 'bg-emerald-100 text-emerald-700', icon: Shield },
  repair: { label: 'Repair',  cls: 'bg-amber-100 text-amber-700',     icon: Wrench },
  damage: { label: 'Damaged', cls: 'bg-red-100 text-red-700',         icon: AlertTriangle },
}

const STATUS_BADGE = {
  pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
}

const LIFECYCLE_BADGE = {
  warehouse:        { label: 'Warehouse',   cls: 'bg-gray-100 text-gray-600' },
  assign_requested: { label: 'Req. Assign', cls: 'bg-amber-100 text-amber-700' },
  assigned:         { label: 'Assigned',    cls: 'bg-blue-100 text-blue-700' },
  deploy_requested: { label: 'Req. Deploy', cls: 'bg-amber-100 text-amber-700' },
  deployed:         { label: 'Deployed',    cls: 'bg-emerald-100 text-emerald-700' },
  return_requested: { label: 'Req. Return', cls: 'bg-orange-100 text-orange-700' },
  returned:         { label: 'Returned',    cls: 'bg-gray-100 text-gray-500' },
  // legacy
  assigning:        { label: 'Assigning',   cls: 'bg-amber-100 text-amber-700' },
}

const DEVICE_ICON = { tv: Monitor, tablet: Smartphone, stand: LayoutGrid, istand: Monitor, set: Layers }
const deviceIcon = (type) => DEVICE_ICON[type] || Package

// CHANGED: removed subscriptionStart and subscriptionEnd from default form
const defaultForm = {
  name: '', phone: '', email: '', company: '', address: '', notes: '',
}

// ── HistoryRow (unchanged) ────────────────────────────────────
const HistoryRow = ({ req }) => {
  const status = STATUS_BADGE[req.status] || STATUS_BADGE.pending
  const health = HEALTH_BADGE[req.healthStatus] || HEALTH_BADGE.ok
  const HealthIcon = health.icon

  const returnLabel = req.returnType === 'days'
    ? `${req.returnDays} days`
    : req.returnType === 'months'
    ? `${req.returnMonths} months`
    : formatDate(req.returnDate)

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${req.status === 'approved' ? 'bg-emerald-400' : req.status === 'rejected' ? 'bg-red-400' : 'bg-amber-400'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-semibold text-gray-700">
            {req.requestType === 'set' ? 'SET' : 'DEV'} #{req.deviceId || req.setId}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>{status.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${health.cls}`}>
            <HealthIcon className="w-3 h-3" />{health.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(req.createdAt)}</span>
          {returnLabel && <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3" />Return: {returnLabel}</span>}
        </div>
      </div>
    </div>
  )
}

// ── ClientCard ─────────────────────────────────────────────────
const ClientCard = ({ client, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [history, setHistory] = useState(null)

  const currentDevices = client.devices || []
  const currentSets = client.deviceSets || []
  const totalCurrent = currentDevices.length + currentSets.length

  // Lifecycle breakdown counts
  const warehouseCount       = currentDevices.filter(d => d.lifecycleStatus === 'warehouse').length
  const pendingCount         = currentDevices.filter(d => ['assign_requested', 'deploy_requested', 'return_requested'].includes(d.lifecycleStatus)).length
  const deployedCount        = currentDevices.filter(d => d.lifecycleStatus === 'deployed').length

  const handleExpand = async () => {
    if (!expanded && history === null) {
      setHistoryLoading(true)
      try {
        const h = await clientApi.getHistory(client.id)
        setHistory(h)
      } catch {
        setHistory([])
      } finally {
        setHistoryLoading(false)
      }
    }
    setExpanded(e => !e)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 bg-gradient-to-br ${avatarColor(client.name)} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <span className="text-white font-bold text-sm">{getInitials(client.name)}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900 leading-tight">{client.name}</h3>
                {client.company && (
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3.5 h-3.5" />{client.company}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => onEdit(client)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(client)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>
            </div>
          </div>
        </div>

        {/* Stats row — CHANGED: replaced subscription cols with lifecycle cols */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="text-center p-2 bg-blue-50 rounded-xl">
            <p className="text-xl font-bold text-blue-700">{totalCurrent}</p>
            <p className="text-xs text-blue-500 font-medium">Total</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded-xl">
            <p className="text-xl font-bold text-gray-600">{warehouseCount}</p>
            <p className="text-xs text-gray-400 font-medium">In WH</p>
          </div>
          <div className="text-center p-2 bg-amber-50 rounded-xl">
            <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-xs text-amber-500 font-medium">Pending</p>
          </div>
          <div className="text-center p-2 bg-emerald-50 rounded-xl">
            <p className="text-xl font-bold text-emerald-600">{deployedCount}</p>
            <p className="text-xs text-emerald-500 font-medium">Deployed</p>
          </div>
        </div>

        {/* Address if present */}
        {client.address && (
          <p className="mt-3 text-xs text-gray-400 truncate">{client.address}</p>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-100 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <History className="w-4 h-4" />
          {expanded ? 'Hide details' : 'View assigned devices & history'}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-5 pb-5 pt-4 space-y-5 border-t border-gray-100">
          {totalCurrent > 0 ? (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Currently Assigned</p>
              <div className="space-y-2">
                {currentDevices.map(d => {
                  const Icon = deviceIcon(d.type)
                  const lifecycle = d.lifecycleStatus || 'warehouse'
                  const badge = LIFECYCLE_BADGE[lifecycle] || LIFECYCLE_BADGE.warehouse
                  return (
                    <div key={d.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{d.code}</p>
                        <p className="text-xs text-gray-400 capitalize">{d.type}{d.brand ? ` · ${d.brand}` : ''}{d.model ? ` ${d.model}` : ''}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                    </div>
                  )
                })}
                {currentSets.map(s => {
                  const badge = LIFECYCLE_BADGE[s.lifecycleStatus] || LIFECYCLE_BADGE.warehouse
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Layers className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{s.code}</p>
                        <p className="text-xs text-gray-400">{s.setTypeName} · Set</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400">
              <Box className="w-8 h-8 mx-auto mb-1 opacity-40" />
              <p className="text-sm">No devices currently assigned</p>
            </div>
          )}

          {/* Assignment history */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Assignment History</p>
            {historyLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history && history.length > 0 ? (
              <div className="max-h-48 overflow-y-auto">
                {history.map(req => <HistoryRow key={req.id} req={req} />)}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-3">No assignment history yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Client page ───────────────────────────────────────────
const Client = () => {
  const { clients, clientsLoading, addClient, updateClient, removeClient } = useInventory()

  const [showModal, setShowModal]     = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [searchTerm, setSearchTerm]   = useState('')
  const [formData, setFormData]       = useState(defaultForm)
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState(null)

  const filteredClients = useMemo(() => {
    const q = searchTerm.toLowerCase()
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      c.phone.includes(q)
    )
  }, [clients, searchTerm])

  const stats = useMemo(() => {
    const totalDevices = clients.reduce((sum, c) => sum + (c.devices?.length || 0), 0)
    const totalSets    = clients.reduce((sum, c) => sum + (c.deviceSets?.length || 0), 0)
    return { totalClients: clients.length, totalDevices, totalSets }
  }, [clients])

  // CHANGED: no longer reads subscriptionStart/End from client
  const handleOpenModal = (client = null) => {
    setFormError(null)
    if (client) {
      setEditingClient(client)
      setFormData({
        name:    client.name,
        phone:   client.phone,
        email:   client.email,
        company: client.company || '',
        address: client.address || '',
        notes:   client.notes   || '',
      })
    } else {
      setEditingClient(null)
      setFormData({ ...defaultForm })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingClient(null)
    setFormData({ ...defaultForm })
    setFormError(null)
  }

  // CHANGED: payload no longer includes subscription dates
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        name:    formData.name.trim(),
        phone:   formData.phone.trim(),
        email:   formData.email.trim(),
        company: formData.company.trim(),
        address: formData.address.trim(),
        notes:   formData.notes.trim(),
      }
      if (editingClient) {
        await updateClient(editingClient.id, payload)
      } else {
        await addClient(payload)
      }
      handleCloseModal()
    } catch (err) {
      setFormError(err.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (client) => {
    const total = (client.devices?.length || 0) + (client.deviceSets?.length || 0)
    const msg = total > 0
      ? `${client.name} has ${total} device(s)/set(s) assigned. Deleting will unassign them. Continue?`
      : `Delete client "${client.name}"?`
    if (!confirm(msg)) return
    try {
      await removeClient(client.id)
    } catch (err) {
      alert(err.message || 'Failed to delete client')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-8 h-8 text-blue-600" />
            Clients
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage clients and view their device assignments</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Client
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalClients}</p>
              <p className="text-xs text-gray-500">Total Clients</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalDevices}</p>
              <p className="text-xs text-gray-500">Devices Assigned</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Layers className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSets}</p>
              <p className="text-xs text-gray-500">Sets Assigned</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, company, email or phone..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
        />
      </div>

      {/* Client list */}
      {clientsLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {searchTerm ? 'No clients match your search' : 'No clients yet. Add your first client!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredClients.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={handleOpenModal}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal — CHANGED: no subscription date fields */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-5 rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingClient ? 'Edit Client' : 'Add New Client'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {editingClient ? 'Update client details' : 'Fill in client information below'}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Client Name <span className="text-red-500">*</span></label>
                <input
                  type="text" required value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Domino's Pizza"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone <span className="text-red-500">*</span></label>
                  <input
                    type="tel" required value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email" required value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="client@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
                <input
                  type="text" value={formData.company}
                  onChange={e => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                <textarea
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Full address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Any additional notes..."
                />
              </div>

              {/* NOTE: Subscription date fields removed intentionally.
                  Assignment dates are now tracked per-device (assignedAt, deployedAt). */}

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={handleCloseModal}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                    : editingClient ? 'Update Client' : 'Add Client'
                  }
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