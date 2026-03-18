import { useState, useEffect, useMemo } from 'react'
import { MapPin, Globe, Link2, AlertCircle, Plus, CheckCircle } from 'lucide-react'
import indianLocationsData from '../data/indian-locations.json'

/**
 * DeploymentLocationSelector - Component for selecting client deployment location
 * Includes Indian states/districts + manual entry + Google Maps integration
 */
const DeploymentLocationSelector = ({
  state,
  district,
  site,
  googleMapsLink,
  onStateChange,
  onDistrictChange,
  onSiteChange,
  onGoogleMapsLinkChange,
  onCoordinatesExtracted,
  required = true,
  disabled = false,
}) => {
  const [showManualState, setShowManualState] = useState(false)
  const [showManualDistrict, setShowManualDistrict] = useState(false)
  const [showManualSite, setShowManualSite] = useState(false)
  const [customSites, setCustomSites] = useState([])
  const [extractingCoords, setExtractingCoords] = useState(false)
  const [coordsExtracted, setCoordsExtracted] = useState(false)
  const [mapError, setMapError] = useState(null)

  // Get states list
  const states = useMemo(() => {
    return indianLocationsData.states.map(s => s.name).sort()
  }, [])

  // Get districts for selected state
  const districts = useMemo(() => {
    if (!state || showManualState) return []
    const stateData = indianLocationsData.states.find(s => s.name === state)
    return stateData ? stateData.districts.sort() : []
  }, [state, showManualState])

  // Fetch custom sites when state and district are selected
  useEffect(() => {
    if (state && district && !showManualState && !showManualDistrict) {
      fetchCustomSites(state, district)
    }
  }, [state, district, showManualState, showManualDistrict])

  // Extract coordinates when Google Maps link changes
  useEffect(() => {
    if (googleMapsLink && googleMapsLink.trim()) {
      extractCoordinates(googleMapsLink)
    } else {
      setCoordsExtracted(false)
      setMapError(null)
    }
  }, [googleMapsLink])

  const fetchCustomSites = async (stateVal, districtVal) => {
    try {
      const response = await fetch(
        `/api/custom-locations?state=${encodeURIComponent(stateVal)}&district=${encodeURIComponent(districtVal)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        setCustomSites(data.map(loc => loc.site))
      }
    } catch (err) {
      console.error('Error fetching custom sites:', err)
    }
  }

  const extractCoordinates = (link) => {
    setExtractingCoords(true)
    setMapError(null)
    
    try {
      // Extract coordinates from various Google Maps link formats
      let lat = null
      let lng = null

      // Format 1: https://maps.app.goo.gl/... or https://goo.gl/maps/...
      // Format 2: https://www.google.com/maps/@lat,lng,zoom
      // Format 3: https://www.google.com/maps/place/.../@lat,lng
      // Format 4: https://maps.google.com/?q=lat,lng

      // Try to find @lat,lng pattern
      const atPattern = /@(-?\d+\.\d+),(-?\d+\.\d+)/
      const atMatch = link.match(atPattern)
      
      if (atMatch) {
        lat = parseFloat(atMatch[1])
        lng = parseFloat(atMatch[2])
      } else {
        // Try ?q=lat,lng pattern
        const qPattern = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/
        const qMatch = link.match(qPattern)
        
        if (qMatch) {
          lat = parseFloat(qMatch[1])
          lng = parseFloat(qMatch[2])
        }
      }

      if (lat !== null && lng !== null) {
        // Validate coordinates (rough check for India)
        if (lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98) {
          onCoordinatesExtracted({ latitude: lat, longitude: lng })
          setCoordsExtracted(true)
          setMapError(null)
        } else {
          setMapError('Coordinates extracted but seem outside India')
          setCoordsExtracted(false)
        }
      } else {
        setMapError('Could not extract coordinates from this link')
        setCoordsExtracted(false)
      }
    } catch (err) {
      setMapError('Invalid Google Maps link format')
      setCoordsExtracted(false)
    } finally {
      setExtractingCoords(false)
    }
  }

  const handleStateChange = (e) => {
    const value = e.target.value
    if (value === '__manual__') {
      setShowManualState(true)
      onStateChange('')
      onDistrictChange('')
      onSiteChange('')
    } else {
      setShowManualState(false)
      onStateChange(value)
      onDistrictChange('')
      onSiteChange('')
    }
  }

  const handleDistrictChange = (e) => {
    const value = e.target.value
    if (value === '__manual__') {
      setShowManualDistrict(true)
      onDistrictChange('')
      onSiteChange('')
    } else {
      setShowManualDistrict(false)
      onDistrictChange(value)
      onSiteChange('')
    }
  }

  const handleSiteChange = (e) => {
    const value = e.target.value
    if (value === '__manual__') {
      setShowManualSite(true)
      onSiteChange('')
    } else {
      setShowManualSite(false)
      onSiteChange(value)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-gray-700 font-medium mb-3">
        <Globe className="w-5 h-5 text-primary-600" />
        <span>Deployment Location {required && <span className="text-red-500">*</span>}</span>
      </div>

      {/* State Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          State {required && <span className="text-red-500">*</span>}
        </label>
        {showManualState ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={state}
              onChange={(e) => onStateChange(e.target.value)}
              placeholder="Enter state name"
              required={required}
              disabled={disabled}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              type="button"
              onClick={() => {
                setShowManualState(false)
                onStateChange('')
              }}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
            >
              Use List
            </button>
          </div>
        ) : (
          <select
            value={state || ''}
            onChange={handleStateChange}
            required={required}
            disabled={disabled}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
          >
            <option value="">Select state...</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="__manual__" className="text-primary-600 font-medium">
              + Add state manually
            </option>
          </select>
        )}
      </div>

      {/* District Selector */}
      {state && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            District {required && <span className="text-red-500">*</span>}
          </label>
          {showManualDistrict || showManualState ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={district}
                onChange={(e) => onDistrictChange(e.target.value)}
                placeholder="Enter district name"
                required={required}
                disabled={disabled}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              {!showManualState && (
                <button
                  type="button"
                  onClick={() => {
                    setShowManualDistrict(false)
                    onDistrictChange('')
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
                >
                  Use List
                </button>
              )}
            </div>
          ) : (
            <select
              value={district || ''}
              onChange={handleDistrictChange}
              required={required}
              disabled={disabled || districts.length === 0}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
            >
              <option value="">Select district...</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
              <option value="__manual__" className="text-primary-600 font-medium">
                + Add district manually
              </option>
            </select>
          )}
        </div>
      )}

      {/* Site/Pinpoint Selector */}
      {state && district && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Site / Branch {required && <span className="text-red-500">*</span>}
          </label>
          {showManualSite || showManualState || showManualDistrict ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={site}
                onChange={(e) => onSiteChange(e.target.value)}
                placeholder="e.g., Andheri West Branch"
                required={required}
                disabled={disabled}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              {!showManualState && !showManualDistrict && (
                <button
                  type="button"
                  onClick={() => {
                    setShowManualSite(false)
                    onSiteChange('')
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
                >
                  Use List
                </button>
              )}
            </div>
          ) : (
            <select
              value={site || ''}
              onChange={handleSiteChange}
              required={required}
              disabled={disabled}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select or enter site...</option>
              {customSites.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="__manual__" className="text-primary-600 font-medium">
                + Add new site
              </option>
            </select>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Previously used sites will appear in this list for quick selection
          </p>
        </div>
      )}

      {/* Google Maps Link (Optional) */}
      {state && district && site && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Google Maps Link <span className="text-gray-400 text-xs">(Optional)</span>
          </label>
          <div className="relative">
            <input
              type="url"
              value={googleMapsLink || ''}
              onChange={(e) => onGoogleMapsLinkChange(e.target.value)}
              disabled={disabled}
              placeholder="https://maps.app.goo.gl/..."
              className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
            />
            {extractingCoords && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent"></div>
              </div>
            )}
            {coordsExtracted && !extractingCoords && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            )}
          </div>
          {coordsExtracted && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Coordinates extracted successfully
            </p>
          )}
          {mapError && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {mapError}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Paste a Google Maps link to automatically extract coordinates for map view
          </p>
        </div>
      )}
    </div>
  )
}

export default DeploymentLocationSelector