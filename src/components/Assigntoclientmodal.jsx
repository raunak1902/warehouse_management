import { useState, useMemo, useEffect } from 'react'
import {
  X, Users, Search, Calendar, ChevronRight, ChevronLeft,
  CheckCircle2, Clock, Building2, Phone, Mail, AlertTriangle,
  Wrench, Shield, Package, Send, Loader2, Info, Layers,
  Monitor, Smartphone, LayoutGrid, ArrowRight, Sparkles, MapPin,
} from 'lucide-react'
import { useInventory } from '../context/InventoryContext'
import { normaliseRole, ROLES } from '../App'

const API = '/api/lifecycle-requests'
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

// ── constants ─────────────────────────────────────────────────
const STEPS = [
  { id: 'client',   label: 'Client',    icon: Users },
  { id: 'health',   label: 'Health',    icon: Shield },
  { id: 'location', label: 'Location',  icon: MapPin },
  { id: 'return',   label: 'Return',    icon: Calendar },
  { id: 'confirm',  label: 'Confirm',   icon: CheckCircle2 },
]

const HEALTH_OPTIONS = [
  { value: 'ok',     label: 'Good Condition', sub: 'Device works perfectly',         icon: Shield,        bg: 'bg-emerald-50', border: 'border-emerald-400', iconCls: 'text-emerald-600', ring: 'ring-emerald-300' },
  { value: 'repair', label: 'Needs Repair',   sub: 'Requires maintenance or service', icon: Wrench,        bg: 'bg-amber-50',   border: 'border-amber-400',  iconCls: 'text-amber-600',  ring: 'ring-amber-300'  },
  { value: 'damage', label: 'Damaged',         sub: 'Has physical or functional damage',icon: AlertTriangle, bg: 'bg-red-50',     border: 'border-red-400',    iconCls: 'text-red-600',    ring: 'ring-red-300'    },
]

const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-purple-500 to-violet-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
]

const avatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
const getInitials = (name = '') => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

const DEVICE_ICON = { tv: Monitor, tablet: Smartphone, stand: LayoutGrid, istand: Monitor }
const deviceIcon = (type) => DEVICE_ICON[type] || (type?.includes('set') ? Layers : Package)

const computeReturnDate = (form) => {
  const today = new Date()
  if (form.returnType === 'days' && form.returnDays) {
    const d = new Date(today); d.setDate(d.getDate() + parseInt(form.returnDays)); return d
  }
  if (form.returnType === 'months' && form.returnMonths) {
    const d = new Date(today); d.setMonth(d.getMonth() + parseInt(form.returnMonths)); return d
  }
  if (form.returnType === 'date' && form.returnDate) return new Date(form.returnDate)
  return null
}

const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const daysFrom = (d) => {
  if (!d) return null
  const diff = Math.round((new Date(d) - new Date()) / (1000 * 60 * 60 * 24))
  return diff
}

// ── component ─────────────────────────────────────────────────
const AssignToClientModal = ({ device, onClose, onSuccess }) => {
  const { clients } = useInventory()

  const [step, setStep] = useState(0)
  const [clientSearch, setClientSearch] = useState('')
  const [form, setForm] = useState({
    clientId: null,
    healthStatus: 'ok',
    healthComment: '',
    state: '',
    district: '',
    site: '',
    returnType: 'days',
    returnDays: '30',
    returnMonths: '',
    returnDate: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [autoApproved, setAutoApproved] = useState(false)
  const [error, setError] = useState(null)
  const [animate, setAnimate] = useState(true)

  // Detect if current user is a Manager (reads from localStorage — no prop drilling needed)
  const isManager = normaliseRole(
    (() => { try { return JSON.parse(localStorage.getItem('user'))?.role ?? '' } catch { return '' } })()
  ) === 'manager'

  const isSet = !!device?._isSet
  const DeviceIcon = isSet ? Layers : deviceIcon(device?.type)

  const selectedClient = useMemo(() => clients.find(c => c.id === form.clientId), [clients, form.clientId])

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase()
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.includes(q)
    )
  }, [clients, clientSearch])

  const computedDate = useMemo(() => computeReturnDate(form), [form])
  const daysLeft = computedDate ? daysFrom(computedDate) : null

  const canProceed = useMemo(() => {
    if (step === 0) return !!form.clientId
    if (step === 1) {
      const needsComment = form.healthStatus === 'repair' || form.healthStatus === 'damage'
      return !needsComment || form.healthComment.trim().length > 0
    }
    if (step === 2) return true // location is optional
    if (step === 3) {
      if (form.returnType === 'days') return !!form.returnDays && parseInt(form.returnDays) > 0
      if (form.returnType === 'months') return !!form.returnMonths && parseInt(form.returnMonths) > 0
      if (form.returnType === 'date') return !!form.returnDate && new Date(form.returnDate) > new Date()
      return false
    }
    return true
  }, [step, form])

  const goStep = (dir) => {
    setAnimate(false)
    setTimeout(() => { setStep(s => s + dir); setAnimate(true) }, 50)
  }

  const handleSubmit = async () => {
    setSubmitting(true); setError(null)
    try {
      const selectedClientObj = clients.find(c => c.id === form.clientId)
      const subscriptionEnd = computeReturnDate(form)

      // Build note embedding all details so manager sees everything in the request
      const note = JSON.stringify({
        clientId:     form.clientId,
        clientName:   selectedClientObj?.name,
        state:        form.state    || null,
        district:     form.district || null,
        site:         form.site     || null,
        returnType:   form.returnType,
        returnDays:   form.returnDays   || null,
        returnMonths: form.returnMonths || null,
        returnDate:   form.returnDate   || null,
        subscriptionEnd: subscriptionEnd ? subscriptionEnd.toISOString() : null,
        label: `Assign ${device.code} → client "${selectedClientObj?.name}"`,
      })

      const body = {
        toStep:       'assigning',
        healthStatus: form.healthStatus,
        healthNote:   form.healthComment?.trim() || undefined,
        note,
        ...(isSet ? { setId: device.id } : { deviceId: device.id }),
      }

      const res = await fetch(API, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || `Error ${res.status}`)

      // Save location + subscription dates directly to the device/set record
      // so they're available immediately regardless of approval status
      if (!isSet) {
        const deviceUpdates = {}
        if (form.state)    deviceUpdates.state    = form.state
        if (form.district) deviceUpdates.district = form.district
        if (form.site)     deviceUpdates.location = form.site
        if (subscriptionEnd) deviceUpdates.subscriptionEndDate = subscriptionEnd.toISOString()

        if (Object.keys(deviceUpdates).length > 0) {
          try {
            await fetch(`/api/devices/${device.id}`, {
              method: 'PUT',
              headers: authHeaders(),
              body: JSON.stringify(deviceUpdates),
            })
          } catch (_) { /* non-critical — lifecycle request already submitted */ }
        }
      } else {
        // For sets, save subscriptionEndDate directly
        if (subscriptionEnd) {
          try {
            await fetch(`/api/sets/${device.id}`, {
              method: 'PUT',
              headers: authHeaders(),
              body: JSON.stringify({ subscriptionEndDate: subscriptionEnd.toISOString() }),
            })
          } catch (_) { /* non-critical */ }
        }
      }

      if (data.autoApproved) setAutoApproved(true)
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className={`w-20 h-20 ${autoApproved ? 'bg-emerald-100' : 'bg-blue-100'} rounded-full flex items-center justify-center`}>
              {autoApproved
                ? <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                : <Send className="w-9 h-9 text-blue-600" />
              }
            </div>
            <div className={`absolute -top-1 -right-1 w-6 h-6 ${autoApproved ? 'bg-emerald-500' : 'bg-blue-500'} rounded-full flex items-center justify-center`}>
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
          </div>

          {autoApproved ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Device Assigned!</h2>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                <span className="font-semibold text-gray-700">{device.code}</span> has been assigned to{' '}
                <span className="font-semibold text-gray-700">{selectedClient?.name}</span> and is now active.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800 rounded-full text-sm font-semibold mb-6">
                <CheckCircle2 className="w-4 h-4" />
                Assigned — Status Updated
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Sent!</h2>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Assignment request for <span className="font-semibold text-gray-700">{device.code}</span> has been sent to the admin.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold mb-6">
                <Clock className="w-4 h-4" />
                Awaiting Admin Approval
              </div>
            </>
          )}

          {/* Mini summary */}
          <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-3 mb-6">
            {[
              ['Client', selectedClient?.name],
              ['Device', device.code],
              ['Health', form.healthStatus === 'ok' ? 'Good Condition' : form.healthStatus === 'repair' ? 'Needs Repair' : 'Damaged'],
              form.state || form.district || form.site
                ? ['Location', [form.state, form.district, form.site].filter(Boolean).join(' → ')]
                : null,
              ['Return By', formatDate(computedDate)],
            ].filter(Boolean).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-400">{k}</span>
                <span className="font-semibold text-gray-800">{v}</span>
              </div>
            ))}
          </div>

          <button onClick={() => { onSuccess && onSuccess(); onClose(); }}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 pt-5 pb-0 rounded-t-3xl flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <DeviceIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Assign {isSet ? 'Set' : 'Device'}</p>
                <p className="text-white font-bold text-lg leading-tight">{device.code}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex items-end gap-0 -mx-6 px-6">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const active = i === step
              const done = i < step
              return (
                <div key={s.id} className={`flex-1 flex flex-col items-center pb-0 relative ${active ? '' : ''}`}>
                  {/* Connector line */}
                  {i > 0 && (
                    <div className={`absolute left-0 top-4 w-full h-0.5 -translate-y-1/2 ${done || active ? 'bg-blue-500' : 'bg-white/10'}`} style={{ width: '50%', left: 0 }} />
                  )}
                  {i < STEPS.length - 1 && (
                    <div className={`absolute right-0 top-4 h-0.5 -translate-y-1/2 ${done ? 'bg-blue-500' : 'bg-white/10'}`} style={{ width: '50%' }} />
                  )}

                  <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center mb-1.5 transition-all ${
                    done ? 'bg-blue-500' : active ? 'bg-white' : 'bg-white/10'
                  }`}>
                    {done
                      ? <CheckCircle2 className="w-4 h-4 text-white" />
                      : <Icon className={`w-4 h-4 ${active ? 'text-slate-800' : 'text-white/40'}`} />
                    }
                  </div>
                  <div className={`h-7 flex items-start transition-all ${active ? 'border-b-2 border-blue-400 w-full flex justify-center' : ''}`}>
                    <span className={`text-xs font-medium pb-1.5 ${active ? 'text-white' : done ? 'text-blue-400' : 'text-white/30'}`}>
                      {s.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Step content ── */}
        <div className={`flex-1 overflow-y-auto p-6 transition-opacity duration-150 ${animate ? 'opacity-100' : 'opacity-0'}`}>

          {/* STEP 0 — Select Client */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Choose Client</h3>
                <p className="text-sm text-gray-400">Who is this {isSet ? 'set' : 'device'} being assigned to?</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text" value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  placeholder="Search clients..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  autoFocus
                />
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredClients.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No clients found</p>
                  </div>
                ) : filteredClients.map(client => {
                  const selected = form.clientId === client.id
                  return (
                    <button key={client.id} onClick={() => setForm(f => ({ ...f, clientId: client.id }))}
                      className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all ${
                        selected
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 bg-gradient-to-br ${avatarColor(client.name)} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                          <span className="text-white font-bold text-sm">{getInitials(client.name)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm ${selected ? 'text-blue-900' : 'text-gray-900'}`}>{client.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {client.company && <span className="text-xs text-gray-400 flex items-center gap-1"><Building2 className="w-3 h-3" />{client.company}</span>}
                            <span className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>
                          </div>
                        </div>
                        {selected && <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 1 — Health Status */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Device Condition</h3>
                <p className="text-sm text-gray-400">Record the health status before assignment</p>
              </div>

              <div className="space-y-2.5">
                {HEALTH_OPTIONS.map(opt => {
                  const Icon = opt.icon
                  const selected = form.healthStatus === opt.value
                  return (
                    <button key={opt.value} onClick={() => setForm(f => ({ ...f, healthStatus: opt.value }))}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                        selected ? `${opt.border} ${opt.bg} ring-2 ${opt.ring}` : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected ? opt.bg : 'bg-gray-100'}`}>
                          <Icon className={`w-5 h-5 ${selected ? opt.iconCls : 'text-gray-400'}`} />
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${selected ? 'text-gray-900' : 'text-gray-700'}`}>{opt.label}</p>
                          <p className="text-xs text-gray-400">{opt.sub}</p>
                        </div>
                        {selected && <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${opt.iconCls}`} />}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Comment
                  {form.healthStatus !== 'ok'
                    ? <span className="text-red-500 ml-1">* required</span>
                    : <span className="text-gray-400 ml-1">(optional)</span>
                  }
                </label>
                <textarea
                  value={form.healthComment}
                  onChange={e => setForm(f => ({ ...f, healthComment: e.target.value }))}
                  rows={3}
                  placeholder={
                    form.healthStatus === 'ok' ? 'Any notes about the device...'
                    : form.healthStatus === 'repair' ? 'What needs to be repaired...'
                    : 'Describe the damage...'
                  }
                  className={`w-full px-3 py-2.5 border rounded-xl focus:ring-2 text-sm resize-none ${
                    form.healthStatus !== 'ok' && !form.healthComment.trim()
                      ? 'border-red-300 focus:ring-red-400'
                      : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {form.healthStatus !== 'ok' && !form.healthComment.trim() && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />Comment required for {form.healthStatus} status
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2 — Location */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Deployment Location</h3>
                <p className="text-sm text-gray-400">Where will this {isSet ? 'set' : 'device'} be deployed? (optional)</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                    placeholder="e.g. Maharashtra"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">District / City</label>
                  <input
                    type="text"
                    value={form.district}
                    onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
                    placeholder="e.g. Mumbai"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Site / Pinpoint</label>
                  <input
                    type="text"
                    value={form.site}
                    onChange={e => setForm(f => ({ ...f, site: e.target.value }))}
                    placeholder="e.g. Andheri West Branch"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              {(form.state || form.district || form.site) && (
                <div className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-100 rounded-2xl">
                  <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-blue-800">
                    {[form.state, form.district, form.site].filter(Boolean).join(' → ')}
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                You can skip this and enter location later when the device arrives on site.
              </p>
            </div>
          )}

          {/* STEP 3 — Return Date */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Return Date</h3>
                <p className="text-sm text-gray-400">When should this {isSet ? 'set' : 'device'} be returned?</p>
              </div>

              {/* Tab switcher */}
              <div className="bg-gray-100 p-1 rounded-xl grid grid-cols-3 gap-1">
                {[{ v: 'days', l: 'By Days' }, { v: 'months', l: 'By Months' }, { v: 'date', l: 'Exact Date' }].map(opt => (
                  <button key={opt.v}
                    onClick={() => setForm(f => ({ ...f, returnType: opt.v, returnDays: '', returnMonths: '', returnDate: '' }))}
                    className={`py-2 text-sm font-medium rounded-lg transition-all ${form.returnType === opt.v ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >{opt.l}</button>
                ))}
              </div>

              {/* Input */}
              {form.returnType === 'days' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input type="number" min="1" max="365" value={form.returnDays}
                      onChange={e => setForm(f => ({ ...f, returnDays: e.target.value }))}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-2xl font-bold text-center"
                      placeholder="30"
                    />
                    <span className="text-gray-500 font-medium text-sm">days from today</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[7, 14, 30, 60, 90, 180].map(d => (
                      <button key={d} onClick={() => setForm(f => ({ ...f, returnDays: String(d) }))}
                        className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${form.returnDays === String(d) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                      >{d}d</button>
                    ))}
                  </div>
                </div>
              )}

              {form.returnType === 'months' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input type="number" min="1" max="24" value={form.returnMonths}
                      onChange={e => setForm(f => ({ ...f, returnMonths: e.target.value }))}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-2xl font-bold text-center"
                      placeholder="3"
                    />
                    <span className="text-gray-500 font-medium text-sm">months from today</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[1, 3, 6, 12, 24].map(m => (
                      <button key={m} onClick={() => setForm(f => ({ ...f, returnMonths: String(m) }))}
                        className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${form.returnMonths === String(m) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                      >{m}mo</button>
                    ))}
                  </div>
                </div>
              )}

              {form.returnType === 'date' && (
                <input type="date" value={form.returnDate}
                  min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                  onChange={e => setForm(f => ({ ...f, returnDate: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                />
              )}

              {/* Preview */}
              {computedDate && (
                <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-500 font-medium">Expected Return</p>
                    <p className="text-lg font-bold text-blue-900">{formatDate(computedDate)}</p>
                    {daysLeft && <p className="text-xs text-blue-500">{daysLeft} days from today</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4 — Confirm */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Review & Confirm</h3>
                <p className="text-sm text-gray-400">Check all details before sending</p>
              </div>

              {/* Summary card */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                {/* Device */}
                <div className="p-4 bg-slate-50 flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                    <DeviceIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{device.code}</p>
                    <p className="text-xs text-gray-500 capitalize">{isSet ? 'Device Set' : device.type}</p>
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {/* Client */}
                  <div className="p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 bg-gradient-to-br ${avatarColor(selectedClient?.name || '')} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white font-bold text-xs">{getInitials(selectedClient?.name || '')}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 font-medium">Client</p>
                      <p className="font-semibold text-gray-900 text-sm">{selectedClient?.name}</p>
                      {selectedClient?.company && <p className="text-xs text-gray-400">{selectedClient.company}</p>}
                    </div>
                  </div>

                  {/* Health */}
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Health Status</p>
                      <p className="font-semibold text-gray-900 text-sm capitalize">
                        {form.healthStatus === 'ok' ? 'Good Condition' : form.healthStatus === 'repair' ? 'Needs Repair' : 'Damaged'}
                      </p>
                      {form.healthComment && <p className="text-xs text-gray-400 mt-0.5 italic">"{form.healthComment}"</p>}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      form.healthStatus === 'ok' ? 'bg-emerald-100 text-emerald-700'
                      : form.healthStatus === 'repair' ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                      {form.healthStatus === 'ok' ? '✓ OK' : form.healthStatus === 'repair' ? '⚠ Repair' : '✕ Damaged'}
                    </span>
                  </div>

                  {/* Location */}
                  {(form.state || form.district || form.site) && (
                    <div className="p-4 flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-gray-300 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-400 font-medium">Deployment Location</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {[form.state, form.district, form.site].filter(Boolean).join(' → ')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Return date */}
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Return By</p>
                      <p className="font-semibold text-gray-900 text-sm">{formatDate(computedDate)}</p>
                      <p className="text-xs text-gray-400">{daysLeft} days from today</p>
                    </div>
                    <Calendar className="w-5 h-5 text-gray-300" />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
                <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  {isManager
                    ? <>This will <strong>immediately assign</strong> the device. Status will update to <strong>Assigning</strong> right away — no approval needed.</>
                    : <>This sends an assignment request to the admin. The device will move to <strong>Assigning</strong> status and count will update once approved.</>
                  }
                </p>
              </div>

              {error && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
                  <div className="pointer-events-auto bg-white border border-red-200 rounded-2xl shadow-2xl p-5 max-w-sm w-full flex flex-col items-center gap-3 animate-bounce-in">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900 text-sm">Request Already Pending</p>
                      <p className="text-sm text-red-600 mt-1">{error}</p>
                    </div>
                    <button
                      onClick={() => setError(null)}
                      className="w-full py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 border-t border-gray-100 p-4 flex gap-3">
          {step > 0 ? (
            <button onClick={() => goStep(-1)}
              className="flex items-center gap-2 px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-all text-sm">
              <ChevronLeft className="w-4 h-4" />Back
            </button>
          ) : (
            <button onClick={onClose}
              className="flex items-center gap-2 px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-all text-sm">
              Cancel
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button onClick={() => goStep(1)} disabled={!canProceed}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm">
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-40 shadow-lg text-sm">
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" />{isManager ? 'Assigning...' : 'Sending...'}</>
                : isManager
                  ? <><CheckCircle2 className="w-4 h-4" />Assign Now</>
                  : <><Send className="w-4 h-4" />Send Request</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AssignToClientModal