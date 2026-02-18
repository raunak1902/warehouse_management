/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  deviceConfig.js — updated to use deviceTypeRegistry     ║
 * ║  All type identity logic now lives in deviceTypeRegistry  ║
 * ║  This file keeps sizes, brands, colors, code validators  ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

// ─── Re-export everything from the registry ──────────────────────────────────
export {
  getAllTypes,
  getTypeById,
  resolveTypeId,
  getTypeLabel,
  getCodePrefixForType,
  deviceMatchesSlot,
  buildMigrationMap,
  loadCustomTypes,
  saveCustomTypes,
  addCustomType,
  deleteCustomType,
  BUILTIN_DEVICE_TYPES,
  TYPE_COLOR_CLASSES,
  getColorClasses,
} from './deviceTypeRegistry.js'

import {
  getAllTypes as _getAllTypes,
  resolveTypeId as _resolveTypeId,
  getCodePrefixForType as _getCodePrefixForType,
  BUILTIN_DEVICE_TYPES as _BUILTIN,
} from './deviceTypeRegistry.js'

// ─── Legacy shims — keep old imports working ─────────────────────────────────

/** @deprecated  Use resolveTypeId() */
export function normalizeDeviceType(type) {
  return _resolveTypeId(type) || type
}

/** @deprecated  Use getCodePrefixForType() */
export function getCodePrefix(productType) {
  return _getCodePrefixForType(productType)
}

/** @deprecated  Use getAllTypes() */
export const ALL_PRODUCT_TYPES = Object.fromEntries(
  _getAllTypes().map(t => [t.id, t.label])
)

/** @deprecated  Use BUILTIN_DEVICE_TYPES */
export const PRODUCT_TYPES = Object.fromEntries(
  _BUILTIN.map(t => [t.id, t.label])
)

/** @deprecated  Alias for backward compat */
export const LEGACY_DEVICE_TYPES = { stand: 'A stand', istand: 'I stand', tablet: 'Tablet' }

/** @deprecated  Alias for backward compat */
export const CANONICAL_TYPES = {
  TV: 'TV', TABLET: 'TAB', TOUCH_TV: 'TTV',
  A_STAND: 'AST', I_STAND: 'IST', TABLET_STAND: 'TST',
  MEDIA_BOX: 'MB', BATTERY: 'BAT',
}

// Which product types use TV sizes vs tablet sizes vs stand sizes
const SIZE_CATEGORY = {
  tv: 'tv',
  'touch-tv': 'tv',
  tablet: 'tablet',
  'a-stand': 'stand',
  'i-stand': 'stand',
  'tablet-stand': 'stand',
  stand: 'stand',
  istand: 'stand',
}

// Sizes by category — only show sizes for selected product type
export const SIZES_BY_CATEGORY = {
  tv: ['32"', '43"', '50"', '55"', '65"', '75"'],
  tablet: ['8"', '9"', '10"', '10.5"', '10.9"', '11"', '12.9"'],
  stand: ['Standard', 'Large', 'Compact'],
}

export function getSizesForProductType(productType) {
  const category = SIZE_CATEGORY[productType] || 'stand'
  return SIZES_BY_CATEGORY[category] || SIZES_BY_CATEGORY.stand
}

// Brands by product category (TV/Tablet/Stands) — dropdown shows only brands for selected type
const BRANDS_BY_CATEGORY = {
  tv: ['Samsung', 'LG', 'Sony', 'TCL', 'Hisense', 'Philips', 'Panasonic'],
  tablet: ['Samsung', 'Apple', 'Lenovo', 'Huawei', 'Amazon', 'Microsoft'],
  stand: ['EDSignage', 'Generic', 'Samsung', 'LG'],
}

export function getBrandsForProductType(productType) {
  const category = SIZE_CATEGORY[productType] || 'stand'
  return BRANDS_BY_CATEGORY[category] || BRANDS_BY_CATEGORY.stand
}

// All unique brands (for filter dropdown)
export const ALL_BRANDS = [...new Set(Object.values(BRANDS_BY_CATEGORY).flat())].sort()

// Colors
export const DEVICE_COLORS = [
  'Black',
  'White',
  'Silver',
  'Gray',
  'Space Gray',
  'Gold',
  'Rose Gold',
  'Blue',
  'Red',
]


// Health / Status options for devices
export const DEVICE_HEALTH_STATUS = [
  { value: 'ok', label: 'OK', color: 'emerald' },
  { value: 'repair', label: 'Repair', color: 'amber' },
  { value: 'damage', label: 'Damage', color: 'red' },
]

// Code prefix for new product types (for suggested code)
// DEVICE_CODE_PREFIX_MAP and getCodePrefix moved to deviceTypeRegistry.js
// The shim at the top of this file re-exports getCodePrefix for backward compat

/**
 * Normalize a device code to a canonical form for uniqueness comparison.
 * Rules:
 *  - Strip leading/trailing whitespace, uppercase
 *  - Remove leading zeros from the numeric suffix: TV-001 → TV-1, TAB-007 → TAB-7
 *  - This means TV-1, TV-01, TV-001 are all treated as the same code
 * Example: normalizeCode('TV-001') === normalizeCode('TV-1') === 'TV-1'
 */
export function normalizeCode(code) {
  if (!code) return ''
  const upper = code.trim().toUpperCase()
  // Split on the LAST hyphen to separate prefix from numeric suffix
  const lastHyphen = upper.lastIndexOf('-')
  if (lastHyphen === -1) return upper
  const prefix = upper.slice(0, lastHyphen)
  const suffix = upper.slice(lastHyphen + 1)
  // If suffix is purely numeric, strip leading zeros
  if (/^\d+$/.test(suffix)) {
    return `${prefix}-${parseInt(suffix, 10)}`
  }
  return upper
}

/**
 * Get all "occupied" numeric indices for a given prefix from an existing device list.
 * Handles TV-1, TV-01, TV-001 as the same number.
 */
export function getOccupiedNumbers(devices, prefix) {
  const nums = new Set()
  devices.forEach((d) => {
    const code = (d.code || '').toUpperCase()
    if (!code.startsWith(prefix + '-')) return
    const suffix = code.slice(prefix.length + 1)
    if (/^\d+$/.test(suffix)) nums.add(parseInt(suffix, 10))
  })
  return nums
}

/**
 * Compute next auto-assigned code for a product type.
 * Finds the highest occupied number and increments by 1.
 * Returns format: PREFIX-NNN (zero-padded to 3 digits).
 */
export function getNextAutoCode(devices, productType) {
  const prefix = getCodePrefix(productType)
  const occupied = getOccupiedNumbers(devices, prefix)
  // Find first available number starting from 1 (fills gaps if any)
  let next = 1
  while (occupied.has(next)) next++
  return `${prefix}-${String(next).padStart(3, '0')}`
}

/**
 * Validate a device code:
 *  1. Must not be empty
 *  2. Must start with the correct prefix for the given product type
 *  3. Must follow format PREFIX-NNN (with numeric suffix)
 *  4. Must be unique (normalized) among existing devices, excluding the current device (for edits)
 *
 * Returns: { valid: boolean, error: string|null }
 */
export function validateDeviceCode(code, productType, allDevices, excludeCode = null) {
  if (!code || !code.trim()) {
    return { valid: false, error: 'Code is required.' }
  }
  const upper = code.trim().toUpperCase()
  const expectedPrefix = getCodePrefix(productType)

  // Must start with the correct prefix
  if (!upper.startsWith(expectedPrefix + '-')) {
    return {
      valid: false,
      error: `Code must start with "${expectedPrefix}-" for ${PRODUCT_TYPES[productType] || productType}. Example: ${expectedPrefix}-001`,
    }
  }

  // The suffix (after prefix-) must be numeric
  const suffix = upper.slice(expectedPrefix.length + 1)
  if (!suffix || !/^\d+$/.test(suffix)) {
    return {
      valid: false,
      error: `Code suffix must be a number. Example: ${expectedPrefix}-001`,
    }
  }

  // Check uniqueness (normalized)
  const normalizedInput = normalizeCode(upper)
  const isDuplicate = allDevices.some((d) => {
    if (excludeCode && normalizeCode(d.code) === normalizeCode(excludeCode)) return false
    return normalizeCode(d.code) === normalizedInput
  })

  if (isDuplicate) {
    return {
      valid: false,
      error: `Code "${upper}" already exists (codes like TV-1, TV-01, TV-001 are treated as the same).`,
    }
  }

  return { valid: true, error: null }
}

// Indian states and places — dummy values for Location filter dropdown (State → District → Pinpoint)
// Format: state -> { districts: string[], locations: { districtKey: string[] } }
export const INDIAN_LOCATION_HIERARCHY = {
  Maharashtra: {
    districts: ['Mumbai', 'Pune', 'Nagpur', 'Thane'],
    locations: {
      Mumbai: ['Andheri Godown A', 'Bandra Warehouse', 'Powai Store'],
      Pune: ['Hinjewadi Warehouse A', 'Hinjewadi Warehouse B', 'Viman Nagar Godown'],
      Nagpur: ['Sitabuldi Godown', 'Civil Lines Warehouse'],
      Thane: ['Wagle Estate Godown', 'Kopri Warehouse'],
    },
  },
  Karnataka: {
    districts: ['Bengaluru', 'Mysuru', 'Mangaluru'],
    locations: {
      Bengaluru: ['Whitefield Godown B', 'Electronic City Warehouse', 'Koramangala Store'],
      Mysuru: ['Mysuru Central Godown', 'Hunsur Road Warehouse'],
      Mangaluru: ['Kadri Warehouse', 'Mangaluru Port Godown'],
    },
  },
  'Tamil Nadu': {
    districts: ['Chennai', 'Coimbatore', 'Madurai'],
    locations: {
      Chennai: ['Anna Nagar Godown A', 'Anna Nagar Godown B', 'T Nagar Store', 'Guindy Warehouse'],
      Coimbatore: ['RS Puram Godown', 'Peelamedu Warehouse'],
      Madurai: ['KK Nagar Godown', 'Madurai Central Warehouse'],
    },
  },
  Delhi: {
    districts: ['Central Delhi', 'South Delhi', 'North Delhi'],
    locations: {
      'Central Delhi': ['Connaught Place Store 101', 'Karol Bagh Godown', 'Sadar Bazaar Warehouse'],
      'South Delhi': ['Saket Warehouse', 'Hauz Khas Godown'],
      'North Delhi': ['Rohini Godown', 'Pitampura Warehouse'],
    },
  },
  Gujarat: {
    districts: ['Ahmedabad', 'Surat', 'Vadodara'],
    locations: {
      Ahmedabad: ['SG Highway Godown', 'Satellite Warehouse', 'Maninagar Store'],
      Surat: ['Varachha Godown', 'Adajan Warehouse'],
      Vadodara: ['Alkapuri Godown', 'Waghodia Warehouse'],
    },
  },
  'West Bengal': {
    districts: ['Kolkata', 'Howrah', 'Durgapur'],
    locations: {
      Kolkata: ['Park Street Godown', 'Salt Lake Warehouse', 'Howrah Station Store'],
      Howrah: ['Howrah Godown A', 'Liluah Warehouse'],
      Durgapur: ['City Centre Godown', 'Benachity Warehouse'],
    },
  },
  Haryana: {
    districts: ['Gurgaon', 'Faridabad', 'Panipat'],
    locations: {
      Gurgaon: ['DLF Cyber City Tower A', 'Sohna Road Warehouse', 'MG Road Mall Unit 12'],
      Faridabad: ['NIT Godown', 'Sector 16 Warehouse'],
      Panipat: ['Panipat Central Godown'],
    },
  },
  // In-warehouse stock: no state/district, just Warehouse A, B, C
  Warehouse: {
    districts: [],
    locations: {
      '': ['Warehouse A', 'Warehouse B', 'Warehouse C'],
    },
  },
}

// Convert to same shape as getLocationHierarchy() for dropdown: { states, districtsByState, locationsByStateDistrict }
export function getIndianLocationHierarchyForFilter() {
  const states = Object.keys(INDIAN_LOCATION_HIERARCHY).sort()
  const districtsByState = {}
  const locationsByStateDistrict = {}
  states.forEach((state) => {
    const data = INDIAN_LOCATION_HIERARCHY[state]
    districtsByState[state] = data.districts || []
    if (data.locations) {
      Object.entries(data.locations).forEach(([district, locs]) => {
        const key = `${state}|${district}`
        locationsByStateDistrict[key] = locs || []
      })
    }
  })
  return { states, districtsByState, locationsByStateDistrict }
}