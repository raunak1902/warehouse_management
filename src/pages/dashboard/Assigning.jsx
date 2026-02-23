import { useState, useMemo } from 'react'
import {
  Link2, User, Package, Calendar, CheckCircle, AlertCircle, Search,
  Monitor, Tablet as TabletIcon, Building2, Phone, Mail, Eye,
  RotateCcw, ChevronDown, Filter, X, Layers, Send,
} from 'lucide-react'
import { useInventory, DEVICE_TYPES } from '../../context/InventoryContext'
import { normaliseRole, ROLES } from '../../App'

const DeviceTypeIcon = ({ type }) => {
  if (type === 'stand' || type === 'istand') return <Monitor className="w-4 h-4" />
  return <TabletIcon className="w-4 h-4" />
}

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

const Assigning = ({ userRole }) => {
  const role         = normaliseRole(userRole)
  const isGroundTeam = role === ROLES.GROUNDTEAM

  const { clients, devices, getDevicesByClientId, bulkAssignDevices, getClientById, unassignDevice } = useInventory()

  const [activeTab,          setActiveTab]          = useState('assign')
  const [selectedClientId,   setSelectedClientId]   = useState('')
  const [selectedState,      setSelectedState]      = useState('')
  const [selectedDistrict,   setSelectedDistrict]   = useState('')
  const [selectedLocation,   setSelectedLocation]   = useState('')
  const [deliveryDate,       setDeliveryDate]       = useState('')
  const [selectedDevices,    setSelectedDevices]    = useState([])
  const [deviceSearchTerm,   setDeviceSearchTerm]   = useState('')
  const [selectedDeviceType, setSelectedDeviceType] = useState('all')
  const [showSuccess,        setShowSuccess]        = useState(false)
  const [submitting,         setSubmitting]         = useState(false)
  const [submitError,        setSubmitError]        = useState(null)
  const [assignedSearchTerm,   setAssignedSearchTerm]   = useState('')
  const [assignedClientFilter, setAssignedClientFilter] = useState('all')
  const [assignedTypeFilter,   setAssignedTypeFilter]   = useState('all')
  const [showFilters,          setShowFilters]          = useState(false)
  const [detailDevice,         setDetailDevice]         = useState(null)

  const availableDevices = useMemo(() => devices.filter(d => !d.clientId), [devices])
  const assignedDevices  = useMemo(() => devices.filter(d => d.clientId),  [devices])

  const filteredAvailableDevices = useMemo(() => {
    let f = availableDevices
    if (selectedDeviceType !== 'all') f = f.filter(d => d.type === selectedDeviceType)
    if (deviceSearchTerm.trim()) {
      const s = deviceSearchTerm.toLowerCase()
      f = f.filter(d =>
        d.code.toLowerCase().includes(s) ||
        d.brand?.toLowerCase().includes(s) ||
        d.model?.toLowerCase().includes(s)
      )
    }
    return f
  }, [availableDevices, selectedDeviceType, deviceSearchTerm])

  const filteredAssignedDevices = useMemo(() => {
    let f = assignedDevices
    if (assignedClientFilter !== 'all') f = f.filter(d => d.clientId === Number(assignedClientFilter))
    if (assignedTypeFilter   !== 'all') f = f.filter(d => d.type === assignedTypeFilter)
    if (assignedSearchTerm.trim()) {
      const s = assignedSearchTerm.toLowerCase()
      f = f.filter(d => {
        const c = getClientById(d.clientId)
        return d.code.toLowerCase().includes(s) || d.brand?.toLowerCase().includes(s) ||
               d.model?.toLowerCase().includes(s) || c?.name.toLowerCase().includes(s)
      })
    }
    return f
  }, [assignedDevices, assignedClientFilter, assignedTypeFilter, assignedSearchTerm, getClientById])

  const availableStates = useMemo(() => {
    const s = new Set(); availableDevices.forEach(d => d.state?.trim() && s.add(d.state)); return [...s].sort()
  }, [availableDevices])

  const availableDistricts = useMemo(() => {
    if (!selectedState) return []
    const s = new Set(); availableDevices.forEach(d => d.state === selectedState && d.district?.trim() && s.add(d.district)); return [...s].sort()
  }, [availableDevices, selectedState])

  const availableLocations = useMemo(() => {
    if (!selectedState || !selectedDistrict) return []
    const s = new Set(); availableDevices.forEach(d => d.state === selectedState && d.district === selectedDistrict && d.location?.trim() && s.add(d.location)); return [...s].sort()
  }, [availableDevices, selectedState, selectedDistrict])

  const selectedClient = useMemo(() => clients.find(c => c.id === Number(selectedClientId)) || null, [clients, selectedClientId])

  const toggleDevice      = (id) => setSelectedDevices(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const selectAllFiltered = ()   => setSelectedDevices(filteredAvailableDevices.map(d => d.id))
  const clearSelection    = ()   => setSelectedDevices([])

  const resetForm = () => {
    setSelectedClientId(''); setSelectedState(''); setSelectedDistrict(''); setSelectedLocation('')
    setDeliveryDate(''); setSelectedDevices([]); setDeviceSearchTerm(''); setSelectedDeviceType('all')
    setSubmitError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)

    if (!selectedClientId || selectedDevices.length === 0 || !deliveryDate) {
      alert('Please fill all required fields'); return
    }
    const client = clients.find(c => c.id === Number(selectedClientId))
    if (!client) { alert('Invalid client selected'); return }

    // ── Ground Team: POST a request for each device → manager reviews it ──────
    if (isGroundTeam) {
      setSubmitting(true)
      try {
        const selectedDeviceObjects = devices.filter(d => selectedDevices.includes(d.id))

        // Build the changes array that will be stored as Json in TeamRequest.changes
        const changes = [
          { field: 'clientId',     to: String(selectedClientId) },
          { field: 'deliveryDate', to: deliveryDate              },
          ...(selectedState    ? [{ field: 'state',    to: selectedState    }] : []),
          ...(selectedDistrict ? [{ field: 'district', to: selectedDistrict }] : []),
          ...(selectedLocation ? [{ field: 'location', to: selectedLocation }] : []),
        ]

        // One request per device so manager can approve/reject individually
        await Promise.all(
          selectedDeviceObjects.map(device =>
            fetch('/api/ground-requests', {
              method: 'POST',
              headers: authHeaders(),
              body: JSON.stringify({
                requestType: 'assignment',
                deviceId:    device.id,
                note: `Assign ${device.code} → client "${client.name}" (ID ${selectedClientId}). Delivery: ${deliveryDate}`,
                changes,
              }),
            }).then(async r => {
              const data = await r.json()
              if (!r.ok) throw new Error(data.message || `Failed for device ${device.code}`)
              return data
            })
          )
        )

        setShowSuccess(true)
        setTimeout(() => { setShowSuccess(false); resetForm() }, 3000)
      } catch (err) {
        setSubmitError(err.message)
      } finally {
        setSubmitting(false)
      }
      return
    }

    // ── Manager / SuperAdmin: assign directly via context ─────────────────────
    // Manager/SuperAdmin: directly assign devices
    try {
      await bulkAssignDevices(selectedDevices, Number(selectedClientId))
    } catch (err) {
      setSubmitError(err.message || 'Assignment failed')
      return
    }
    setShowSuccess(true)
    setTimeout(() => { setShowSuccess(false); resetForm() }, 2000)
  }

  const handleUnassign = (deviceId) => {
    const device = devices.find(d => d.id === deviceId)
    const client = device ? getClientById(device.clientId) : null
    if (confirm(`Unassign device ${device?.code} from ${client?.name}?`)) unassignDevice(deviceId)
  }

  const getCountByType = (list) => {
    const c = { stand: 0, istand: 0, tablet: 0 }
    list.forEach(d => c[d.type] !== undefined && c[d.type]++)
    return c
  }

  const selectedDeviceObjects = devices.filter(d => selectedDevices.includes(d.id))
  const selectedCounts = getCountByType(selectedDeviceObjects)

  const devicesByClient = useMemo(() => {
    const g = {}
    filteredAssignedDevices.forEach(d => { if (!g[d.clientId]) g[d.clientId] = []; g[d.clientId].push(d) })
    return g
  }, [filteredAssignedDevices])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Link2 className="w-8 h-8 text-primary-600" /> Device Assignment
        </h1>
        <p className="text-gray-600 mt-1">
          {isGroundTeam ? 'Submit assignment requests for manager approval' : 'Assign available devices to clients and manage assigned devices'}
        </p>
      </div>

      {/* Ground Team info banner */}
      {isGroundTeam && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>As Ground Team, your assignment requests will be sent to a Manager for approval. Track them on the <strong>Requests</strong> page.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {[
            { key: 'assign',   icon: <Package className="w-5 h-5" />, label: isGroundTeam ? 'Request Assignment' : 'Assign Devices', count: availableDevices.length, countClass: 'bg-gray-100 text-gray-700' },
            { key: 'assigned', icon: <Layers  className="w-5 h-5" />, label: 'Assigned Devices',                                     count: assignedDevices.length,  countClass: 'bg-primary-100 text-primary-700' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
              <div className="flex items-center justify-center gap-2">
                {tab.icon} <span>{tab.label}</span>
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${tab.countClass}`}>{tab.count}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Success */}
      {showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <div>
            <p className="font-semibold text-green-900">{isGroundTeam ? 'Request Submitted!' : 'Devices Assigned!'}</p>
            <p className="text-sm text-green-800">{isGroundTeam ? 'Your assignment request was sent to the Manager for approval.' : 'Devices have been assigned to the client.'}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div><p className="font-medium text-red-800">Submission failed</p><p className="text-sm text-red-700">{submitError}</p></div>
        </div>
      )}

      {/* ── ASSIGN TAB ── */}
      {activeTab === 'assign' && (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Step 1: Client */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">1</div>
              <h2 className="text-xl font-semibold text-gray-900">Select Client</h2>
            </div>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select required value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 appearance-none bg-white">
                <option value="">Select a client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company && ` (${c.company})`}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
            {selectedClient && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-blue-600" /><span className="text-gray-700">{selectedClient.phone}</span></div>
                <div className="flex items-center gap-2"><Mail  className="w-4 h-4 text-blue-600" /><span className="text-gray-700">{selectedClient.email}</span></div>
                {selectedClient.company && <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-600" /><span className="text-gray-700">{selectedClient.company}</span></div>}
              </div>
            )}
          </div>

          {/* Step 2: Location */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">2</div>
              <div><h2 className="text-xl font-semibold text-gray-900">Deployment Location</h2><p className="text-sm text-gray-500">Optional</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                <select value={selectedState} onChange={e => { setSelectedState(e.target.value); setSelectedDistrict(''); setSelectedLocation('') }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500">
                  <option value="">Select state...</option>
                  {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">District</label>
                <select value={selectedDistrict} onChange={e => { setSelectedDistrict(e.target.value); setSelectedLocation('') }}
                  disabled={!selectedState} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100">
                  <option value="">Select district...</option>
                  {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}
                  disabled={!selectedDistrict} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100">
                  <option value="">Select location...</option>
                  {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Step 3: Devices */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">3</div>
              <h2 className="text-xl font-semibold text-gray-900">Select Devices</h2>
            </div>
            <div className="space-y-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" value={deviceSearchTerm} onChange={e => setDeviceSearchTerm(e.target.value)}
                  placeholder="Search by code, brand, or model..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { v: 'all',    l: `All (${availableDevices.length})` },
                  { v: 'stand',  l: `A Stand (${availableDevices.filter(d => d.type === 'stand').length})` },
                  { v: 'istand', l: `I Stand (${availableDevices.filter(d => d.type === 'istand').length})` },
                  { v: 'tablet', l: `Tablet (${availableDevices.filter(d => d.type === 'tablet').length})` },
                ].map(({ v, l }) => (
                  <button key={v} type="button" onClick={() => setSelectedDeviceType(v)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${selectedDeviceType === v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <span className="text-sm text-gray-600">{selectedDevices.length} selected</span>
              <div className="flex gap-2">
                <button type="button" onClick={selectAllFiltered} className="text-sm text-primary-600 hover:text-primary-700 font-medium">Select All</button>
                {selectedDevices.length > 0 && <button type="button" onClick={clearSelection} className="text-sm text-red-600 hover:text-red-700 font-medium">Clear</button>}
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
              {filteredAvailableDevices.length === 0 ? (
                <div className="p-8 text-center"><Package className="w-12 h-12 text-gray-400 mx-auto mb-3" /><p className="text-gray-500">No available devices found</p></div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredAvailableDevices.map(device => (
                    <label key={device.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                      <input type="checkbox" checked={selectedDevices.includes(device.id)} onChange={() => toggleDevice(device.id)}
                        className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                      <DeviceTypeIcon type={device.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-semibold text-gray-900">{device.code}</p>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">{DEVICE_TYPES[device.type]}</span>
                        </div>
                        <p className="text-sm text-gray-600">{device.brand} {device.model} {device.size && `(${device.size})`}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Delivery Date */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">4</div>
              <h2 className="text-xl font-semibold text-gray-900">Delivery Date</h2>
            </div>
            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">Expected Delivery Date *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="date" required value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {selectedClient && (
              <div className="text-sm text-gray-600 space-y-1 mb-6">
                <p>• Client: <strong>{selectedClient.name}</strong></p>
                <p>• Devices: <strong>{selectedDevices.length} selected</strong></p>
                {deliveryDate && <p>• Delivery: <strong>{new Date(deliveryDate).toLocaleDateString()}</strong></p>}
                {isGroundTeam && <p className="text-amber-600 mt-1">⚠ This will be submitted as a request pending Manager approval.</p>}
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={resetForm} className="px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Reset</button>
              <button type="submit" disabled={!selectedClientId || selectedDevices.length === 0 || !deliveryDate || submitting}
                className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting...</>
                  : isGroundTeam
                    ? <><Send className="w-4 h-4" /> Submit Assignment Request</>
                    : 'Assign Devices to Client'
                }
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── ASSIGNED TAB ── */}
      {activeTab === 'assigned' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <button onClick={() => setShowFilters(!showFilters)} className="w-full flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><Filter className="w-5 h-5 text-gray-600" /><h3 className="text-lg font-semibold text-gray-900">Filters</h3></div>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {showFilters && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" value={assignedSearchTerm} onChange={e => setAssignedSearchTerm(e.target.value)}
                    placeholder="Search..." className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
                    <select value={assignedClientFilter} onChange={e => setAssignedClientFilter(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500">
                      <option value="all">All Clients</option>
                      {clients.filter(c => getDevicesByClientId(c.id).length > 0).map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({getDevicesByClientId(c.id).length})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                    <select value={assignedTypeFilter} onChange={e => setAssignedTypeFilter(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500">
                      <option value="all">All Types</option>
                      <option value="stand">A Stand</option>
                      <option value="istand">I Stand</option>
                      <option value="tablet">Tablet</option>
                    </select>
                  </div>
                </div>
                {(assignedSearchTerm || assignedClientFilter !== 'all' || assignedTypeFilter !== 'all') && (
                  <button onClick={() => { setAssignedSearchTerm(''); setAssignedClientFilter('all'); setAssignedTypeFilter('all') }}
                    className="flex items-center gap-2 text-sm text-primary-600 font-medium">
                    <X className="w-4 h-4" /> Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          {filteredAssignedDevices.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No assigned devices found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(devicesByClient).map(([clientId, clientDevices]) => {
                const client = getClientById(Number(clientId))
                if (!client) return null
                const counts = getCountByType(clientDevices)
                return (
                  <div key={clientId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary-50 to-blue-50 p-6 border-b border-gray-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">{client.name}</h3>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            {client.company && <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{client.company}</span>}
                            <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{client.phone}</span>
                            <span className="flex items-center gap-1"><Mail  className="w-4 h-4" />{client.email}</span>
                          </div>
                          <div className="mt-3 flex gap-4 text-sm text-gray-700">
                            {counts.stand  > 0 && <span className="flex items-center gap-1"><Monitor className="w-4 h-4" />{counts.stand} A stand{counts.stand > 1 ? 's' : ''}</span>}
                            {counts.istand > 0 && <span className="flex items-center gap-1"><Monitor className="w-4 h-4" />{counts.istand} I stand{counts.istand > 1 ? 's' : ''}</span>}
                            {counts.tablet > 0 && <span className="flex items-center gap-1"><TabletIcon className="w-4 h-4" />{counts.tablet} tablet{counts.tablet > 1 ? 's' : ''}</span>}
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700 border border-primary-200">
                          {clientDevices.length} device{clientDevices.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>{['Device','Type','Details','Location','Subscription','Actions'].map(h => (
                            <th key={h} className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${h==='Actions'?'text-right':'text-left'}`}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {clientDevices.map(device => (
                            <tr key={device.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2"><DeviceTypeIcon type={device.type} /><span className="font-mono font-semibold">{device.code}</span></div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">{DEVICE_TYPES[device.type]}</span></td>
                              <td className="px-6 py-4"><p className="text-sm">{device.brand} {device.model}</p>{device.size && <p className="text-xs text-gray-500">{device.size}</p>}</td>
                              <td className="px-6 py-4">
                                {device.state && device.district
                                  ? <div className="text-sm"><p>{device.state}, {device.district}</p>{device.location && <p className="text-xs text-gray-500">{device.location}</p>}</div>
                                  : <span className="text-xs text-gray-400">Not set</span>}
                              </td>
                              <td className="px-6 py-4">
                                {device.subscriptionStart && device.subscriptionEnd
                                  ? <div className="text-xs"><p>{new Date(device.subscriptionStart).toLocaleDateString()}</p><p className="text-gray-500">to {new Date(device.subscriptionEnd).toLocaleDateString()}</p></div>
                                  : <span className="text-xs text-gray-400">Not set</span>}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => setDetailDevice(device)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Eye className="w-4 h-4" /></button>
                                  {!isGroundTeam && (
                                    <button onClick={() => handleUnassign(device.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><RotateCcw className="w-4 h-4" /></button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Detail modal */}
      {detailDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Device Details</h2>
              <button onClick={() => setDetailDevice(null)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ['Code',  detailDevice.code],
                ['Type',  DEVICE_TYPES[detailDevice.type]],
                ['Brand', detailDevice.brand || '—'],
                ['Model', detailDevice.model || '—'],
                ['Size',  detailDevice.size  || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-gray-500">{k}</span><span className="font-medium">{v}</span></div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDetailDevice(null)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Close</button>
              {!isGroundTeam && (
                <button onClick={() => { handleUnassign(detailDevice.id); setDetailDevice(null) }}
                  className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Unassign
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Assigning