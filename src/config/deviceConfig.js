/**
 * Device module config: product types, brands, sizes (synced by product), colors.
 * Used by Devices page and Add Device form; can be shared with other modules later.
 */

// Product types: TV, Tablet, Touch TV, A stand, I stand, Tablet stand
export const PRODUCT_TYPES = {
  tv: 'TV',
  tablet: 'Tablet',
  'touch-tv': 'Touch TV',
  'a-stand': 'A stand',
  'i-stand': 'I stand',
  'tablet-stand': 'Tablet stand',
}

// Legacy type keys (existing data) map to display labels
export const LEGACY_DEVICE_TYPES = {
  stand: 'A stand',
  istand: 'I stand',
  tablet: 'Tablet',
}

// All types for dropdown: new + legacy for backward compatibility
export const ALL_PRODUCT_TYPES = { ...LEGACY_DEVICE_TYPES, ...PRODUCT_TYPES }

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

// Code prefix for new product types (for suggested code)
export const DEVICE_CODE_PREFIX_MAP = {
  tv: 'TV',
  tablet: 'TAB',
  'touch-tv': 'TTV',
  'a-stand': 'ATV',
  'i-stand': 'ITV',
  'tablet-stand': 'TST',
  stand: 'ATV',
  istand: 'ITV',
}

export function getCodePrefix(productType) {
  return DEVICE_CODE_PREFIX_MAP[productType] || 'DEV'
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
