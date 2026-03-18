import { useState, useEffect } from 'react'
import { Package, MapPin, AlertCircle, Tag } from 'lucide-react'
import { useCatalogue } from '../context/CatalogueContext'

/**
 * WarehouseLocationSelector - Reusable component for selecting warehouse location
 * @param {Object} props
 * @param {number} props.warehouseId - Selected warehouse ID
 * @param {string} props.zone - Selected zone
 * @param {string} props.specificLocation - Specific location text
 * @param {function} props.onWarehouseChange - Callback when warehouse changes
 * @param {function} props.onZoneChange - Callback when zone changes
 * @param {function} props.onSpecificLocationChange - Callback when specific location changes
 * @param {boolean} props.required - Whether fields are required
 * @param {boolean} props.disabled - Whether fields are disabled
 * @param {string} props.suggestedWarehouseId - Auto-suggested warehouse
 * @param {string} props.suggestedZone - Auto-suggested zone
 */
const WarehouseLocationSelector = ({
  warehouseId,
  zone,
  specificLocation,
  onWarehouseChange,
  onZoneChange,
  onSpecificLocationChange,
  required = true,
  disabled = false,
  suggestedWarehouseId = null,
  suggestedZone = null,
}) => {
  const [warehouses, setWarehouses] = useState([])
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Pull location presets from global catalogue context
  const { locationPresetsRaw } = useCatalogue()
  const presets = locationPresetsRaw.map(p => p.name)

  // Fetch warehouses on mount
  useEffect(() => {
    fetchWarehouses()
  }, [])

  // Fetch zones when warehouse changes
  useEffect(() => {
    if (warehouseId) {
      fetchZones(warehouseId)
    } else {
      setZones([])
    }
  }, [warehouseId])

  const fetchWarehouses = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/warehouses', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      })
      
      if (!response.ok) throw new Error('Failed to fetch warehouses')
      
      const data = await response.json()
      setWarehouses(data.filter(w => w.isActive))
      setLoading(false)
    } catch (err) {
      console.error('Error fetching warehouses:', err)
      setError('Failed to load warehouses')
      setLoading(false)
    }
  }

  const fetchZones = async (whId) => {
    try {
      const response = await fetch(`/api/warehouses/${whId}/zones`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      })
      
      if (!response.ok) throw new Error('Failed to fetch zones')
      
      const data = await response.json()
      setZones(data.filter(z => z.isActive))
    } catch (err) {
      console.error('Error fetching zones:', err)
      setError('Failed to load zones')
    }
  }

  const handleWarehouseChange = (e) => {
    const newWarehouseId = e.target.value
    onWarehouseChange(newWarehouseId)
    onZoneChange('') // Reset zone when warehouse changes
  }

  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent"></div>
          <span className="text-sm">Loading warehouse data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      </div>
    )
  }

  const showSuggestion = suggestedWarehouseId && !warehouseId

  return (
    <div className="space-y-4">
      {showSuggestion && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-blue-900 font-medium">Suggested location</p>
              <p className="text-xs text-blue-700 mt-1">
                Based on previous location history
              </p>
              <button
                type="button"
                onClick={() => {
                  onWarehouseChange(suggestedWarehouseId)
                  if (suggestedZone) onZoneChange(suggestedZone)
                }}
                className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Use suggested location →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warehouse Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Warehouse {required && <span className="text-red-500">*</span>}
        </label>
        <select
          value={warehouseId || ''}
          onChange={handleWarehouseChange}
          disabled={disabled}
          required={required}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Select warehouse...</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} {w.city && `- ${w.city}`}
            </option>
          ))}
        </select>
      </div>

      {/* Zone Selector */}
      {warehouseId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Zone <span className="text-gray-400 text-xs">(Optional)</span>
          </label>
          <select
            value={zone || ''}
            onChange={(e) => onZoneChange(e.target.value)}
            disabled={disabled || zones.length === 0}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Select zone...</option>
            {zones.map((z) => (
              <option key={z.id} value={z.name}>
                {z.name} {z.description && `- ${z.description}`}
              </option>
            ))}
          </select>
          {zones.length === 0 && warehouseId && (
            <p className="text-xs text-gray-400 mt-1">
              No zones configured for this warehouse — zone is optional.
            </p>
          )}
        </div>
      )}

      {/* Specific Location (Optional) — presets + free text */}
      {warehouseId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Specific Location <span className="text-gray-400 text-xs">(Optional)</span>
          </label>

          {/* Preset chips — only rendered when manager has defined presets */}
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {presets.map(preset => {
                const active = specificLocation === preset
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSpecificLocationChange(active ? '' : preset)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      active
                        ? 'bg-primary-100 border-primary-300 text-primary-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300 hover:bg-primary-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Tag className="w-2.5 h-2.5" />
                    {preset}
                  </button>
                )
              })}
            </div>
          )}

          {/* Free-text input — always editable, chip click just fills it */}
          <input
            type="text"
            value={specificLocation || ''}
            onChange={(e) => onSpecificLocationChange(e.target.value)}
            disabled={disabled}
            placeholder="e.g., Rack 5, Shelf 3, Bin 12"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">
            {presets.length > 0
              ? 'Tap a preset above or type a custom location'
              : 'Add more details to help locate the device within the zone'}
          </p>
        </div>
      )}
    </div>
  )
}

export default WarehouseLocationSelector