import { useState, useMemo } from 'react'
import {
  Link2, User, Package, Calendar, CheckCircle, AlertCircle, Search,
  Monitor, Tablet as TabletIcon, Building2, Phone, Mail, Eye,
  RotateCcw, ChevronDown, Filter, X, Layers, Send,
  Clock, Wrench, ArrowRight,
} from 'lucide-react'
import { useInventory, DEVICE_TYPES } from '../../context/InventoryContext'
import { normaliseRole, ROLES } from '../../App'
import DeploymentLocationSelector from '../../components/DeploymentLocationSelector'
import AssignmentHealthCheck from '../../components/AssignmentHealthCheck'

// ── Phase 2 flag ──────────────────────────────────────────────────────────────
// Set to false when bulk assign is ready for ground team.
const COMING_SOON = true

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

  // ── Coming Soon — ground team only, phase 2 ──────────────────────────────
  if (isGroundTeam && COMING_SOON) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">

          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-100 to-violet-100 flex items-center justify-center shadow-sm">
            <Wrench className="w-9 h-9 text-primary-500" />
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Device Assignment
          </h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs font-bold mb-4">
            <Clock className="w-3 h-3" /> Coming Soon
          </div>

          {/* Description */}
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            The device assignment module is currently being upgraded. It will be available in the next update with improved workflows and better tracking.
          </p>

          {/* What to do in the meantime */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-left mb-6">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">
              In the meantime
            </p>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                Use the <strong>Requests</strong> page to submit lifecycle steps for devices
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                Scan a device barcode to confirm actions on the ground
              </li>
            </ul>
          </div>

          <p className="text-xs text-gray-400">
            Contact your manager if you need urgent assignment help.
          </p>
        </div>
      </div>
    )
  }

  const { clients, devices, getDevicesByClientId, bulkAssignDevices, getClientById, unassignDevice } = useInventory()

  const [activeTab,          setActiveTab]          = useState('assign')
  const [selectedClientId,   setSelectedClientId]   = useState('')
  
  // NEW: Deployment location fields
  const [deploymentState,    setDeploymentState]    = useState('')
  const [deploymentDistrict, setDeploymentDistrict] = useState('')
  const [deploymentSite,     setDeploymentSite]     = useState('')
  const [googleMapsLink,     setGoogleMapsLink]     = useState('')
  const [coordinates,        setCoordinates]        = useState({ latitude: null, longitude: null })
  
  // NEW: Assignment health fields
  const [assignmentHealth,     setAssignmentHealth]     = useState('good')
  const [assignmentHealthNote, setAssignmentHealthNote] = useState('')
  
  // NEW: Return date (replaces deliveryDate)
  const [returnDate,         setReturnDate]         = useState('')
  
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

  const selectedClient = useMemo(() => clients.find(c => c.id === Number(selectedClientId)) || null, [clients, selectedClientId])

  const toggleDevice      = (id) => setSelectedDevices(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const selectAllFiltered = ()   => setSelectedDevices(filteredAvailableDevices.map(d => d.id))
  const clearSelection    = ()   => setSelectedDevices([])

  const resetForm = () => {
    setSelectedClientId('')
    setDeploymentState('')
    setDeploymentDistrict('')
    setDeploymentSite('')
    setGoogleMapsLink('')
    setCoordinates({ latitude: null, longitude: null })
    setAssignmentHealth('good')
    setAssignmentHealthNote('')
    setReturnDate('')
    setSelectedDevices([])
    setDeviceSearchTerm('')
    setSelectedDeviceType('all')
    setSubmitError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)

    if (!selectedClientId || selectedDevices.length === 0 || !returnDate || 
        !deploymentState || !deploymentDistrict || !deploymentSite) {
      alert('Please fill all required fields')
      return
    }
    
    const client = clients.find(c => c.id === Number(selectedClientId))
    if (!client) { alert('Invalid client selected'); return }

    // Ground Team: POST a request for each device
    if (isGroundTeam) {
      setSubmitting(true)
      try {
        const selectedDeviceObjects = devices.filter(d => selectedDevices.includes(d.id))

        const changes = [
          { field: 'clientId', to: String(selectedClientId) },
          { field: 'returnDate', to: returnDate },
          { field: 'deploymentState', to: deploymentState },
          { field: 'deploymentDistrict', to: deploymentDistrict },
          { field: 'deploymentSite', to: deploymentSite },
          { field: 'googleMapsLink', to: googleMapsLink || '' },
          { field: 'latitude', to: String(coordinates.latitude || '') },
          { field: 'longitude', to: String(coordinates.longitude || '') },
          { field: 'assignmentHealth', to: assignmentHealth },
          { field: 'assignmentHealthNote', to: assignmentHealthNote || '' },
        ]

        await Promise.all(
          selectedDeviceObjects.map(device =>
            fetch('/api/ground-requests', {
              method: 'POST',
              headers: authHeaders(),
              body: JSON.stringify({
                requestType: 'assignment',
                deviceId:    device.id,
                note: `Assign ${device.code} → client "${client.name}". Return: ${returnDate}`,
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

    // Manager: bulk assign
    setSubmitting(true)
    try {
      const result = await bulkAssignDevices(
        selectedDevices,
        Number(selectedClientId),
        {
          deploymentState,
          deploymentDistrict,
          deploymentSite,
          googleMapsLink,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          returnDate,
          assignmentHealth,
          assignmentHealthNote,
        }
      )

      if (result.success) {
        setShowSuccess(true)
        setTimeout(() => { setShowSuccess(false); resetForm() }, 3000)
      } else {
        setSubmitError(result.message || 'Assignment failed')
      }
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnassign = async (deviceId) => {
    if (!confirm('Are you sure you want to unassign this device?')) return
    try {
      await unassignDevice(deviceId)
    } catch (err) {
      alert('Failed to unassign: ' + err.message)
    }
  }

  const devicesByClient = useMemo(() => {
    const grouped = {}
    filteredAssignedDevices.forEach(d => {
      if (!grouped[d.clientId]) grouped[d.clientId] = []
      grouped[d.clientId].push(d)
    })
    return grouped
  }, [filteredAssignedDevices])

  const getCountByType = (devices) => {
    const counts = { stand: 0, istand: 0, tablet: 0 }
    devices.forEach(d => { if (counts.hasOwnProperty(d.type)) counts[d.type]++ })
    return counts
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Link2 className="w-8 h-8 text-primary-600" />
          Device Assignment
        </h1>
        <p className="text-gray-600 mt-1">
          {isGroundTeam ? 'Submit assignment requests for manager approval' : 'Assign available devices to clients and manage assigned devices'}
        </p>
      </div>

      {isGroundTeam && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>As Ground Team, your assignment requests will be sent to a Manager for approval. Track them on the <strong>Requests</strong> page.</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {[
            { key: 'assign',   icon: <Package className="w-5 h-5" />, label: isGroundTeam ? 'Request Assignment' : 'Assign Devices', count: availableDevices.length, countClass: 'bg-gray-100 text-gray-700' },
            { key: 'assigned', icon: <Layers  className="w-5 h-5" />, label: 'Assigned Devices', count: assignedDevices.length,  countClass: 'bg-primary-100 text-primary-700' },
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

      {showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <div>
            <p className="font-semibold text-green-900">{isGroundTeam ? 'Request Submitted!' : 'Devices Assigned!'}</p>
            <p className="text-sm text-green-800">{isGroundTeam ? 'Your assignment request was sent to the Manager for approval.' : 'Devices have been assigned to the client.'}</p>
          </div>
        </div>
      )}

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div><p className="font-medium text-red-800">Submission failed</p><p className="text-sm text-red-700">{submitError}</p></div>
        </div>
      )}

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

          {/* Step 2: Deployment Location */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">2</div>
              <h2 className="text-xl font-semibold text-gray-900">Deployment Location</h2>
            </div>
            
            <DeploymentLocationSelector
              state={deploymentState}
              district={deploymentDistrict}
              site={deploymentSite}
              googleMapsLink={googleMapsLink}
              onStateChange={setDeploymentState}
              onDistrictChange={setDeploymentDistrict}
              onSiteChange={setDeploymentSite}
              onGoogleMapsLinkChange={setGoogleMapsLink}
              onCoordinatesExtracted={setCoordinates}
              required={true}
            />
          </div>

          {/* Step 3: Health Check */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">3</div>
              <h2 className="text-xl font-semibold text-gray-900">Assignment Health Check</h2>
            </div>
            
            <AssignmentHealthCheck
              componentHealth="ok"
              assignmentHealth={assignmentHealth}
              assignmentHealthNote={assignmentHealthNote}
              onAssignmentHealthChange={setAssignmentHealth}
              onAssignmentHealthNoteChange={setAssignmentHealthNote}
              required={true}
            />
          </div>

          {/* Step 4: Return Date */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">4</div>
              <h2 className="text-xl font-semibold text-gray-900">Return Date</h2>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Return Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Set when the device is expected to return from deployment
              </p>
            </div>
          </div>

          {/* Step 5: Select Devices */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">5</div>
                <h2 className="text-xl font-semibold text-gray-900">Select Devices</h2>
              </div>
              {selectedDevices.length > 0 && (
                <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                  {selectedDevices.length} selected
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by code, brand, or model..."
                  value={deviceSearchTerm}
                  onChange={e => setDeviceSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <select value={selectedDeviceType} onChange={e => setSelectedDeviceType(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500">
                <option value="all">All Types</option>
                <option value="stand">A Stand</option>
                <option value="istand">I Stand</option>
                <option value="tablet">Tablet</option>
              </select>
            </div>

            {filteredAvailableDevices.length > 0 && (
              <div className="flex gap-2 mb-4">
                <button type="button" onClick={selectAllFiltered}
                  className="px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg border border-primary-200">
                  Select All ({filteredAvailableDevices.length})
                </button>
                {selectedDevices.length > 0 && (
                  <button type="button" onClick={clearSelection}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200">
                    Clear Selection
                  </button>
                )}
              </div>
            )}

            {filteredAvailableDevices.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No devices available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {filteredAvailableDevices.map(device => (
                  <div
                    key={device.id}
                    onClick={() => toggleDevice(device.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedDevices.includes(device.id)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-lg">{device.code}</span>
                      {selectedDevices.includes(device.id) && (
                        <CheckCircle className="w-5 h-5 text-primary-600" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p className="flex items-center gap-1">
                        <DeviceTypeIcon type={device.type} />
                        {DEVICE_TYPES[device.type]}
                      </p>
                      <p>{device.brand} {device.model}</p>
                      {device.size && <p className="text-xs">{device.size}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={resetForm}
              disabled={submitting}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={submitting || selectedDevices.length === 0}
              className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>Processing...</>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  {isGroundTeam ? 'Submit Request' : 'Assign Devices'} ({selectedDevices.length})
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'assigned' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Filters</h3>
              <button onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-sm text-primary-600 font-medium">
                <Filter className="w-4 h-4" />
                {showFilters ? 'Hide' : 'Show'} Filters
              </button>
            </div>

            {showFilters && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search devices or clients..."
                    value={assignedSearchTerm}
                    onChange={e => setAssignedSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
                    <select value={assignedClientFilter} onChange={e => setAssignedClientFilter(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg">
                      <option value="all">All Clients</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                    <select value={assignedTypeFilter} onChange={e => setAssignedTypeFilter(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg">
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
                          <tr>{['Device','Type','Details','Location','Return Date','Actions'].map(h => (
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
                                {device.deploymentState && device.deploymentDistrict && device.deploymentSite
                                  ? <div className="text-sm"><p>{device.deploymentState}, {device.deploymentDistrict}</p><p className="text-xs text-gray-500">{device.deploymentSite}</p></div>
                                  : <span className="text-xs text-gray-400">Not set</span>}
                              </td>
                              <td className="px-6 py-4">
                                {device.returnDate
                                  ? <div className="text-xs">{new Date(device.returnDate).toLocaleDateString()}</div>
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