/**
 * src/context/CatalogueContext.jsx
 * ──────────────────────────────────
 * Single source of truth for all catalogue data:
 *   - Product Types (replaces BUILTIN_DEVICE_TYPES + localStorage custom types)
 *   - Set Types (replaces BUILTIN_SET_TYPES + localStorage custom set types)
 *   - Brands, Sizes, Colors (replaces hardcoded arrays in deviceConfig.js)
 *
 * Fetched from DB on app load. Manager mutations update DB then refetch.
 * All dropdowns across the app read from this context — ground team always
 * sees the latest manager-defined catalogue automatically.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { CUSTOM_TYPES_STORAGE_KEY } from '../config/deviceTypeRegistry'
import { API_URL } from '../config/api'

const CatalogueContext = createContext(null)

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY SYNC — keeps deviceTypeRegistry localStorage in sync with DB
// ─────────────────────────────────────────────────────────────────────────────
// Devices.jsx (Add Product dropdown, code generation, deviceMatchesSlot) all
// read from getAllTypes() which reads BUILTIN_DEVICE_TYPES + localStorage.
// When a manager adds a product type via Catalogue it goes to the DB but was
// never written to localStorage, so it never appeared in those dropdowns.
// This function is called after every fetchAll() to keep both systems in sync.
//
// Strategy: DB is authoritative for non-builtins.
//   - Any DB non-builtin type is written into the registry localStorage.
//   - Any registry entry that no longer exists in DB is removed.
//   - Builtin types stay hardcoded in BUILTIN_DEVICE_TYPES — not touched.
//   - After any change, dispatch 'device-types-updated' so Devices.jsx reacts.

function syncRegistryFromDB(dbProductTypes) {
  try {
    // DB non-builtins → the desired registry state
    // (builtins stay hardcoded in BUILTIN_DEVICE_TYPES — we don't touch them)
    const dbNonBuiltins = dbProductTypes.filter(t => !t.isBuiltin)

    // Current registry (localStorage non-builtins)
    const current = JSON.parse(localStorage.getItem(CUSTOM_TYPES_STORAGE_KEY) || '[]')

    // Build the new registry: merge DB types, preserving any aliases already set
    const merged = dbNonBuiltins.map(dbType => {
      const existing = current.find(c => c.id === dbType.typeId)
      return {
        id:          dbType.typeId,
        label:       dbType.label,
        codePrefix:  dbType.prefix || dbType.typeId,
        icon:        dbType.icon   || 'Package',
        color:       dbType.color  || 'gray',
        // Preserve existing aliases; seed with id + lowercase if none
        aliases:     existing?.aliases?.length
          ? existing.aliases
          : [dbType.typeId, dbType.typeId.toLowerCase(), dbType.label],
        isBuiltin:   false,
      }
    })

    // Only write + dispatch if something actually changed
    const prev = JSON.stringify(current.map(c => c.id).sort())
    const next = JSON.stringify(merged.map(c => c.id).sort())
    if (prev !== next || JSON.stringify(current) !== JSON.stringify(merged)) {
      localStorage.setItem(CUSTOM_TYPES_STORAGE_KEY, JSON.stringify(merged))
      window.dispatchEvent(new CustomEvent('device-types-updated'))
    }
  } catch (e) {
    console.warn('[CatalogueContext] Failed to sync registry from DB:', e)
  }
}

const API = (path, opts = {}) => {
  const token = localStorage.getItem('token')
  return fetch(`${API_URL}/api/catalogue${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...opts,
  }).then(async r => {
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'API error')
    return data
  })
}

// ── Icon name → Lucide component map (used across app for dynamic icons) ──────
// Import the icons you need in the consuming component using this map
export const ICON_NAMES = [
  'Tv', 'Tablet', 'Monitor', 'LayoutGrid', 'Box', 'Package',
  'Battery', 'Mouse', 'Zap', 'Layers', 'Smartphone', 'Wifi',
  'Plug', 'HardDrive', 'Camera', 'Speaker', 'Headphones', 'Keyboard',
  'Printer', 'Server', 'Router', 'Cable',
]

export const COLOR_OPTIONS = [
  { value: 'orange', label: 'Orange',  bg: 'bg-orange-100', text: 'text-orange-600' },
  { value: 'sky',    label: 'Sky',     bg: 'bg-sky-100',    text: 'text-sky-600'    },
  { value: 'teal',   label: 'Teal',    bg: 'bg-teal-100',   text: 'text-teal-600'   },
  { value: 'amber',  label: 'Amber',   bg: 'bg-amber-100',  text: 'text-amber-600'  },
  { value: 'blue',   label: 'Blue',    bg: 'bg-blue-100',   text: 'text-blue-600'   },
  { value: 'purple', label: 'Purple',  bg: 'bg-purple-100', text: 'text-purple-600' },
  { value: 'violet', label: 'Violet',  bg: 'bg-violet-100', text: 'text-violet-600' },
  { value: 'green',  label: 'Green',   bg: 'bg-green-100',  text: 'text-green-600'  },
  { value: 'gray',   label: 'Gray',    bg: 'bg-gray-100',   text: 'text-gray-600'   },
  { value: 'yellow', label: 'Yellow',  bg: 'bg-yellow-100', text: 'text-yellow-600' },
  { value: 'rose',   label: 'Rose',    bg: 'bg-rose-100',   text: 'text-rose-600'   },
  { value: 'indigo', label: 'Indigo',  bg: 'bg-indigo-100', text: 'text-indigo-600' },
]

export const TYPE_COLOR_CLASSES = {
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  sky:    { bg: 'bg-sky-100',    text: 'text-sky-600',    border: 'border-sky-200',    badge: 'bg-sky-50 text-sky-700 border-sky-200'       },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-600',   border: 'border-teal-200',   badge: 'bg-teal-50 text-teal-700 border-teal-200'     },
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-600',  border: 'border-amber-200',  badge: 'bg-amber-50 text-amber-700 border-amber-200'  },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-600',   border: 'border-blue-200',   badge: 'bg-blue-50 text-blue-700 border-blue-200'     },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  green:  { bg: 'bg-green-100',  text: 'text-green-600',  border: 'border-green-200',  badge: 'bg-green-50 text-green-700 border-green-200'  },
  gray:   { bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-200',   badge: 'bg-gray-50 text-gray-600 border-gray-200'     },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-200', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  rose:   { bg: 'bg-rose-100',   text: 'text-rose-600',   border: 'border-rose-200',   badge: 'bg-rose-50 text-rose-700 border-rose-200'     },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
}

export function getColorClasses(colorKey) {
  return TYPE_COLOR_CLASSES[colorKey] || TYPE_COLOR_CLASSES.gray
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────
export function CatalogueProvider({ children }) {
  const [productTypes, setProductTypes] = useState([])
  const [setTypes, setSetTypes] = useState([])
  const [brands, setBrands] = useState([])
  const [sizes, setSizes] = useState([])
  const [colors, setColors] = useState([])
  const [locationPresets, setLocationPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      const data = await API('/all')
      setProductTypes(data.productTypes || [])
      setSetTypes(data.setTypes || [])
      setBrands(data.brands || [])
      setSizes(data.sizes || [])
      setColors(data.colors || [])
      setLocationPresets(data.locationPresets || [])
      setError(null)
      // Keep deviceTypeRegistry localStorage in sync so Devices.jsx dropdowns
      // (Add Product, code generation, deviceMatchesSlot) see DB-added types immediately
      syncRegistryFromDB(data.productTypes || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Product Type mutations ─────────────────────────────────────────────────
  const addProductType = useCallback(async ({ typeId, label, prefix, icon, color }) => {
    const result = await API('/product-types', {
      method: 'POST',
      body: JSON.stringify({ typeId, label, prefix, icon, color }),
    })
    await fetchAll()
    return result
  }, [fetchAll])

  const updateProductType = useCallback(async (typeId, updates) => {
    const result = await API(`/product-types/${typeId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    await fetchAll()
    return result
  }, [fetchAll])

  const deleteProductType = useCallback(async (typeId) => {
    const result = await API(`/product-types/${typeId}`, { method: 'DELETE' })
    await fetchAll()
    return result
  }, [fetchAll])

  // Fetch inactive (deactivated) product types — manager only, used by reactivation UI
  const fetchInactiveProductTypes = useCallback(async () => {
    return await API('/product-types?includeInactive=true')
  }, [])

  // ── Set Type mutations ─────────────────────────────────────────────────────
  const addSetType = useCallback(async (data) => {
    const result = await API('/set-types', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await fetchAll()
    return result
  }, [fetchAll])

  const updateSetType = useCallback(async (setTypeId, updates) => {
    const result = await API(`/set-types/${setTypeId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    await fetchAll()
    return result
  }, [fetchAll])

  const deleteSetType = useCallback(async (setTypeId) => {
    const result = await API(`/set-types/${setTypeId}`, { method: 'DELETE' })
    await fetchAll()
    return result
  }, [fetchAll])

  // Fetch inactive (deactivated) set types — manager only, used by reactivation UI
  const fetchInactiveSetTypes = useCallback(async () => {
    return await API('/set-types?includeInactive=true')
  }, [])

  // ── Brand mutations ────────────────────────────────────────────────────────
  const addBrand = useCallback(async (name) => {
    const result = await API('/brands', { method: 'POST', body: JSON.stringify({ name }) })
    setBrands(prev => [...prev, result].sort((a, b) => a.name.localeCompare(b.name)))
    return result
  }, [])

  const deleteBrand = useCallback(async (id) => {
    await API(`/brands/${id}`, { method: 'DELETE' })
    setBrands(prev => prev.filter(b => b.id !== id))
  }, [])

  // ── Size mutations ─────────────────────────────────────────────────────────
  const addSize = useCallback(async (value) => {
    const result = await API('/sizes', { method: 'POST', body: JSON.stringify({ value }) })
    setSizes(prev => [...prev, result].sort((a, b) => a.value.localeCompare(b.value)))
    return result
  }, [])

  const deleteSize = useCallback(async (id) => {
    await API(`/sizes/${id}`, { method: 'DELETE' })
    setSizes(prev => prev.filter(s => s.id !== id))
  }, [])

  // ── Color mutations ────────────────────────────────────────────────────────
  const addColor = useCallback(async (name) => {
    const result = await API('/colors', { method: 'POST', body: JSON.stringify({ name }) })
    setColors(prev => [...prev, result].sort((a, b) => a.name.localeCompare(b.name)))
    return result
  }, [])

  const deleteColor = useCallback(async (id) => {
    await API(`/colors/${id}`, { method: 'DELETE' })
    setColors(prev => prev.filter(c => c.id !== id))
  }, [])

  // ── Location Preset mutations ──────────────────────────────────────────────
  const addLocationPreset = useCallback(async (name) => {
    const result = await API('/location-presets', { method: 'POST', body: JSON.stringify({ name }) })
    setLocationPresets(prev => [...prev, result].sort((a, b) => a.name.localeCompare(b.name)))
    return result
  }, [])

  const deleteLocationPreset = useCallback(async (id) => {
    await API(`/location-presets/${id}`, { method: 'DELETE' })
    setLocationPresets(prev => prev.filter(p => p.id !== id))
  }, [])

  // ── Utility helpers (mirror old deviceTypeRegistry API) ──────────────────
  const getTypeById = useCallback((id) => {
    return productTypes.find(t => t.typeId === id) || null
  }, [productTypes])

  const getTypeLabel = useCallback((typeString) => {
    const t = productTypes.find(t => t.typeId === typeString)
    return t?.label || typeString || 'Unknown'
  }, [productTypes])

  const getCodePrefixForType = useCallback((typeId) => {
    const t = productTypes.find(t => t.typeId === typeId)
    return t?.prefix || typeId || 'DEV'
  }, [productTypes])

  const getSetTypeById = useCallback((id) => {
    return setTypes.find(t => t.setTypeId === id) || null
  }, [setTypes])

  const value = {
    // Data
    productTypes,
    setTypes,
    brands: brands.map(b => b.name),
    sizes: sizes.map(s => s.value),
    colors: colors.map(c => c.name),
    brandsRaw: brands,
    sizesRaw: sizes,
    colorsRaw: colors,
    loading,
    error,

    // Refetch
    refetch: fetchAll,

    // Product type mutations
    addProductType,
    updateProductType,
    deleteProductType,
    fetchInactiveProductTypes,

    // Set type mutations
    addSetType,
    updateSetType,
    deleteSetType,
    fetchInactiveSetTypes,

    // Brand/Size/Color mutations
    addBrand, deleteBrand,
    addSize, deleteSize,
    addColor, deleteColor,

    // Location preset mutations
    locationPresets,
    locationPresetsRaw: locationPresets,
    addLocationPreset,
    deleteLocationPreset,

    // Utility (drop-in replacements for old deviceTypeRegistry functions)
    getTypeById,
    getTypeLabel,
    getCodePrefixForType,
    getSetTypeById,
    getAllTypes: () => productTypes,
    getAllSetTypes: () => setTypes,
  }

  return (
    <CatalogueContext.Provider value={value}>
      {children}
    </CatalogueContext.Provider>
  )
}

export function useCatalogue() {
  const ctx = useContext(CatalogueContext)
  if (!ctx) throw new Error('useCatalogue must be used inside CatalogueProvider')
  return ctx
}

export default CatalogueContext