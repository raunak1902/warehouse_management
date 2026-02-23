import { useState, useEffect } from 'react'
import {
  ClipboardList, Plus, CheckCircle, XCircle, Clock, ChevronDown,
  ChevronUp, AlertCircle, RefreshCw, Send,
} from 'lucide-react'
import { normaliseRole, ROLES } from '../../App'
import { useInventory } from '../../context/InventoryContext'

const REQUEST_TYPES = [
  { value: 'health_change',   label: 'Health Status Change', icon: '🏥' },
  { value: 'location_change', label: 'Location Change',      icon: '📍' },
  { value: 'inventory_add',   label: 'Add to Inventory',     icon: '📦' },
  { value: 'set_change',      label: 'Make Set Change',      icon: '🔧' },
  { value: 'assignment',      label: 'Device Assignment',    icon: '🔗' },
  { value: 'other',           label: 'Other',                icon: '📝' },
]

const HEALTH_OPTIONS = ['ok', 'damaged', 'needs_repair', 'critical']

const STATUS_COLORS = {
  pending:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100  text-green-800  border-green-200',
  rejected: 'bg-red-100    text-red-800    border-red-200',
}
const STATUS_ICONS = {
  pending:  <Clock size={14} />,
  approved: <CheckCircle size={14} />,
  rejected: <XCircle size={14} />,
}

const API          = '/api/ground-requests'
const authHeaders  = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` })

// ─── Main page ────────────────────────────────────────────────────────────────
const Requests = ({ userRole }) => {
  const role         = normaliseRole(userRole)
  const isGroundTeam = role === ROLES.GROUNDTEAM
  const canApprove   = role === ROLES.SUPERADMIN || role === ROLES.MANAGER

  const [requests,     setRequests]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [filterStatus, setFilter]       = useState('all')
  const [showNewModal, setShowNew]      = useState(false)
  const [expanded,     setExpanded]     = useState(null)
  const [approveModal, setApproveModal] = useState(null)

  const fetchRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      // Ground Team: /mine returns only their own requests
      // Manager/SuperAdmin: / returns all requests
      const endpoint = isGroundTeam ? `${API}/mine` : API
      console.log('[Requests] fetching from:', endpoint, 'isGroundTeam:', isGroundTeam)
      const res = await fetch(endpoint, { headers: authHeaders() })
      console.log('[Requests] response status:', res.status)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message || d.error || `HTTP ${res.status} error fetching requests`)
      }
      const data = await res.json()
      console.log('[Requests] received', data.length, 'requests')
      setRequests(data)
    } catch (err) {
      console.error('[Requests] fetch error:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  const filtered = requests.filter(r => filterStatus === 'all' || r.status === filterStatus)
  const counts   = {
    all:      requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isGroundTeam ? 'My Requests' : 'Request Management'}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isGroundTeam ? 'Submit and track your change requests here.' : 'Review and approve incoming requests from ground team.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRequests} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><RefreshCw size={18} /></button>
          {isGroundTeam && (
            <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              <Plus size={18} /> New Request
            </button>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${filterStatus === s ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${filterStatus === s ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl text-red-700 text-sm">
          <AlertCircle size={18} /> {error}
          <button onClick={fetchRequests} className="ml-auto underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>}

      {/* Cards */}
      {!loading && !error && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No {filterStatus === 'all' ? '' : filterStatus} requests</p>
              {isGroundTeam && filterStatus === 'all' && (
                <button onClick={() => setShowNew(true)} className="mt-4 text-primary-600 text-sm underline">Submit your first request</button>
              )}
            </div>
          )}
          {filtered.map(req => (
            <RequestCard key={req.id} request={req}
              expanded={expanded === req.id}
              onToggle={() => setExpanded(expanded === req.id ? null : req.id)}
              canApprove={canApprove}
              onApprove={action => setApproveModal({ request: req, action })} />
          ))}
        </div>
      )}

      {showNewModal && <NewRequestModal onClose={() => setShowNew(false)} onSubmitted={() => { setShowNew(false); fetchRequests() }} />}
      {approveModal  && <ApproveModal request={approveModal.request} action={approveModal.action} onClose={() => setApproveModal(null)} onDone={() => { setApproveModal(null); fetchRequests() }} />}
    </div>
  )
}

// ─── Request Card ─────────────────────────────────────────────────────────────
const RequestCard = ({ request: req, expanded, onToggle, canApprove, onApprove }) => {
  const typeMeta    = REQUEST_TYPES.find(t => t.value === req.requestType) ?? { label: req.requestType, icon: '📝' }
  const statusClass = STATUS_COLORS[req.status] ?? 'bg-gray-100 text-gray-800 border-gray-200'

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={onToggle}>
        <div className="text-2xl">{typeMeta.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">{typeMeta.label}</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusClass}`}>
              {STATUS_ICONS[req.status]} {req.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {req.deviceId ? `Device ID: ${req.deviceId}` : ''}
            {req.setId    ? ` · Set ID: ${req.setId}`    : ''}
            {' · '}Requested by <span className="font-medium">{req.requestedByName ?? 'Unknown'}</span>
            {' · '}{new Date(req.createdAt).toLocaleDateString()}
          </p>
        </div>
        {expanded ? <ChevronUp size={18} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
          {/* Changes */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Requested Changes</p>
            <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
              {req.changes?.length > 0
                ? req.changes.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-gray-400 mt-0.5">→</span>
                      <div>
                        <span className="font-medium text-gray-700">{c.field}:</span>{' '}
                        {c.from && <span className="text-red-500 line-through mr-1">{c.from}</span>}
                        <span className="text-green-600 font-medium">{c.to}</span>
                      </div>
                    </div>
                  ))
                : <p className="text-sm text-gray-500">{req.notes ?? 'No details provided'}</p>
              }
            </div>
          </div>

          {req.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-700 bg-white rounded-lg border border-gray-200 p-3">{req.notes}</p>
            </div>
          )}

          {req.status !== 'pending' && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{req.status === 'approved' ? 'Approved' : 'Rejected'} by</p>
              <p className="text-sm text-gray-700">{req.approvedByName ?? '—'}{req.approvedAt ? ` · ${new Date(req.approvedAt).toLocaleString()}` : ''}</p>
              {req.rejectionNote && <p className="text-sm text-red-600 mt-1">Reason: {req.rejectionNote}</p>}
            </div>
          )}

          {canApprove && req.status === 'pending' && (
            <div className="flex gap-3 pt-2">
              <button onClick={() => onApprove('reject')} className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium">
                <XCircle size={16} /> Reject
              </button>
              <button onClick={() => onApprove('approve')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                <CheckCircle size={16} /> Approve
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── New Request Modal (Ground Team) ─────────────────────────────────────────
const NewRequestModal = ({ onClose, onSubmitted }) => {
  const { devices, deviceSets } = useInventory()
  const [step,       setStep]       = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [lookupError, setLookupError] = useState(null)
  const [form,       setForm]       = useState({
    requestTypes: [], deviceCode: '', setCode: '', notes: '',
    newHealthStatus: '', newLocation: '', newState: '', newDistrict: '',
    newPinpoint: '', inventoryDetails: '', assignmentDetails: '',
  })

  const toggleType = (type) =>
    setForm(f => ({ ...f, requestTypes: f.requestTypes.includes(type) ? f.requestTypes.filter(t => t !== type) : [...f.requestTypes, type] }))

  const buildChanges = (f) => {
    const c = []
    if (f.requestTypes.includes('health_change')   && f.newHealthStatus)    c.push({ field: 'healthStatus', to: f.newHealthStatus })
    if (f.requestTypes.includes('location_change')) {
      if (f.newLocation) c.push({ field: 'location', to: f.newLocation })
      if (f.newState)    c.push({ field: 'state',    to: f.newState    })
      if (f.newDistrict) c.push({ field: 'district', to: f.newDistrict })
      if (f.newPinpoint) c.push({ field: 'pinpoint', to: f.newPinpoint })
    }
    if (f.requestTypes.includes('inventory_add') && f.inventoryDetails) c.push({ field: 'Inventory Add', to: f.inventoryDetails })
    if (f.requestTypes.includes('assignment')    && f.assignmentDetails) c.push({ field: 'Assignment',    to: f.assignmentDetails })
    if ((f.requestTypes.includes('set_change') || f.requestTypes.includes('other')) && f.notes) c.push({ field: 'Notes', to: f.notes })
    return c
  }

  const handleSubmit = async () => {
    if (!form.deviceCode && !form.setCode) { alert('Please enter a Device Code or Set Code.'); return }
    if (form.requestTypes.length === 0)    { alert('Please select at least one request type.'); return }
    const changes = buildChanges(form)
    if (changes.length === 0) { alert('Please fill in at least one change detail.'); return }

    setLookupError(null)

    // Resolve text codes to numeric DB ids
    let deviceId = null
    let setId = null

    if (form.deviceCode.trim()) {
      const code = form.deviceCode.trim().toUpperCase()
      const found = devices.find(d => d.code.toUpperCase() === code)
      if (!found) {
        setLookupError(`Device code "${form.deviceCode.trim()}" not found. Check the code and try again.`)
        return
      }
      deviceId = found.id
    }

    if (form.setCode.trim()) {
      const code = form.setCode.trim().toUpperCase()
      const found = deviceSets.find(s => s.code.toUpperCase() === code)
      if (!found) {
        setLookupError(`Set code "${form.setCode.trim()}" not found. Check the code and try again.`)
        return
      }
      setId = found.id
    }

    setSubmitting(true)
    const body = {
      requestType: form.requestTypes[0],
      note: `Types: ${form.requestTypes.join(', ')} | Device: ${form.deviceCode || '—'} | Set: ${form.setCode || '—'}${form.notes ? ' | ' + form.notes : ''}`,
      changes,
      ...(deviceId ? { deviceId } : {}),
      ...(setId    ? { setId    } : {}),
    }
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}: submission failed`)
      onSubmitted()
    } catch (err) {
      alert('Submission failed: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const hasType = (t) => form.requestTypes.includes(t)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">New Request</h2>
              <p className="text-sm text-gray-500 mt-0.5">{step === 1 ? 'Select what you want to change' : 'Fill in the details'}</p>
            </div>
            <div className="flex items-center gap-2">
              {[1, 2].map(n => (
                <span key={n} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= n ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{n}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {step === 1 ? (
            <>
              <p className="text-sm text-gray-600">Select <strong>one or more</strong> request types.</p>
              <div className="grid grid-cols-2 gap-2">
                {REQUEST_TYPES.map(t => (
                  <button key={t.value} onClick={() => toggleType(t.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${hasType(t.value) ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className="text-xl">{t.icon}</span>
                    <p className={`text-xs font-medium mt-1 ${hasType(t.value) ? 'text-primary-700' : 'text-gray-700'}`}>{t.label}</p>
                  </button>
                ))}
              </div>
              <div className="space-y-3 pt-2">
                {[{ k: 'deviceCode', l: 'Device Code', p: 'e.g. DEV-001' }, { k: 'setCode', l: 'Set Code (if applicable)', p: 'e.g. SET-042' }].map(({ k, l, p }) => (
                  <div key={k}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                    <input type="text" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" placeholder={p} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {hasType('health_change') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">🏥 New Health Status</label>
                  <select value={form.newHealthStatus} onChange={e => setForm(f => ({ ...f, newHealthStatus: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">Select status</option>
                    {HEALTH_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )}
              {hasType('location_change') && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">📍 New Location Details</p>
                  {[{ k: 'newLocation', l: 'Location Name' }, { k: 'newState', l: 'State' }, { k: 'newDistrict', l: 'District' }, { k: 'newPinpoint', l: 'Pinpoint / Landmark' }].map(({ k, l }) => (
                    <div key={k}>
                      <label className="block text-xs text-gray-500 mb-0.5">{l}</label>
                      <input type="text" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" placeholder={l} />
                    </div>
                  ))}
                </div>
              )}
              {hasType('inventory_add') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">📦 Inventory Details</label>
                  <textarea value={form.inventoryDetails} onChange={e => setForm(f => ({ ...f, inventoryDetails: e.target.value }))} rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" placeholder="Describe what needs to be added..." />
                </div>
              )}
              {hasType('assignment') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">🔗 Assignment Details</label>
                  <textarea value={form.assignmentDetails} onChange={e => setForm(f => ({ ...f, assignmentDetails: e.target.value }))} rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" placeholder="Describe the assignment change needed..." />
                </div>
              )}
              {(hasType('set_change') || hasType('other')) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">📝 Details</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" placeholder="Describe what you need..." />
                </div>
              )}
              {!hasType('set_change') && !hasType('other') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional Notes (optional)</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" placeholder="Any additional context..." />
                </div>
              )}
              <div className="bg-primary-50 rounded-lg border border-primary-100 p-3">
                <p className="text-xs font-semibold text-primary-700 mb-1">Summary</p>
                <p className="text-xs text-primary-600">{form.deviceCode && `Device: ${form.deviceCode}`}{form.setCode && ` · Set: ${form.setCode}`}</p>
                <p className="text-xs text-primary-600 mt-0.5">Types: {form.requestTypes.map(t => REQUEST_TYPES.find(r => r.value === t)?.label).join(', ')}</p>
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Cancel</button>
          {step === 1 ? (
<>
              {lookupError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-1">{lookupError}</p>
              )}
              <button onClick={() => setStep(2)} disabled={form.requestTypes.length === 0 || (!form.deviceCode && !form.setCode)}
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">Next →</button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">← Back</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                {submitting ? 'Submitting...' : <><Send size={16} /> Submit Request</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Approve / Reject Modal ───────────────────────────────────────────────────
const ApproveModal = ({ request: req, action, onClose, onDone }) => {
  const [note,       setNote]       = useState('')
  const [processing, setProcessing] = useState(false)
  const isApprove = action === 'approve'

  const handleAction = async () => {
    if (!isApprove && !note.trim()) { alert('Please enter a reason for rejection.'); return }
    setProcessing(true)
    try {
      const res = await fetch(`${API}/${req.id}/${action}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ rejectionNote: note }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Action failed')
      onDone()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          {isApprove ? <CheckCircle className="text-green-600" size={28} /> : <XCircle className="text-red-500" size={28} />}
          <div>
            <h2 className="text-xl font-bold text-gray-900">{isApprove ? 'Approve' : 'Reject'} Request</h2>
            <p className="text-sm text-gray-500">#{req.id} · {req.requestedByName ?? 'Unknown'}</p>
          </div>
        </div>

        {!isApprove && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason for rejection *</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-400"
              placeholder="Explain why this request is being rejected..." />
          </div>
        )}

        {isApprove && (
          <div className="bg-green-50 rounded-lg border border-green-100 p-3 text-sm text-green-700">
            Approving this request will apply all requested changes to the device/set.
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Cancel</button>
          <button onClick={handleAction} disabled={processing || (!isApprove && !note.trim())}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60 ${isApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {processing ? 'Processing...' : isApprove ? 'Confirm Approval' : 'Confirm Rejection'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Requests