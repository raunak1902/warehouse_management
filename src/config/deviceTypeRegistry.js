/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║              DEVICE TYPE REGISTRY — Single Source of Truth          ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Every device type in the system is defined here.                   ║
 * ║  Built-in types are hardcoded. Custom types live in localStorage.   ║
 * ║                                                                      ║
 * ║  Each type has a canonical TYPE ID (e.g. "MB" for Media Box).       ║
 * ║  This ID is used everywhere: device codes, set slot matching,       ║
 * ║  filtering, display, and barcode generation.                        ║
 * ║                                                                      ║
 * ║  MIGRATION: All legacy type strings (e.g. "mediaBox", "a-stand",   ║
 * ║  "stand", "custom-MBX") are listed as aliases and auto-resolve      ║
 * ║  to the canonical ID via resolveTypeId().                           ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// ─── localStorage key for custom types ───────────────────────────────────────
export const CUSTOM_TYPES_STORAGE_KEY = 'edsignage_device_type_registry'

// ─── BUILT-IN TYPE DEFINITIONS ───────────────────────────────────────────────
// id        : canonical type ID — stored in DB going forward, used for all matching
// label     : human-readable display name
// codePrefix: prefix for device codes (e.g. TV-001, MB-001)
// icon      : lucide icon name (string, resolved at render time)
// color     : tailwind color key for UI theming
// aliases   : ALL legacy/variant strings that map to this type (for migration + normalisation)
// isBuiltin : true = cannot be deleted by users

export const BUILTIN_DEVICE_TYPES = [
  {
    id: 'TV',
    label: 'TV',
    codePrefix: 'TV',
    icon: 'Tv',
    color: 'orange',
    aliases: ['tv', 'TV'],
    isBuiltin: true,
  },
  {
    id: 'TAB',
    label: 'Tablet',
    codePrefix: 'TAB',
    icon: 'Tablet',
    color: 'sky',
    aliases: ['tablet', 'TAB', 'Tablet'],
    isBuiltin: true,
  },
  {
    id: 'TTV',
    label: 'Touch TV',
    codePrefix: 'TTV',
    icon: 'Monitor',
    color: 'teal',
    aliases: ['touch-tv', 'touchtv', 'TTV', 'Touch TV', 'touchscreen'],
    isBuiltin: true,
  },
  {
    id: 'AST',
    label: 'A-Frame Stand',
    codePrefix: 'ATV',
    icon: 'LayoutGrid',
    color: 'amber',
    aliases: ['stand', 'a-stand', 'astand', 'AST', 'ATV', 'A stand', 'A-Frame Stand', 'aframe', 'aframestand'],
    isBuiltin: true,
  },
  {
    id: 'IST',
    label: 'I-Frame Stand',
    codePrefix: 'ITV',
    icon: 'Monitor',
    color: 'blue',
    aliases: ['istand', 'i-stand', 'IST', 'ITV', 'I stand', 'I-Frame Stand', 'iframe', 'iframestand'],
    isBuiltin: true,
  },
  {
    id: 'TST',
    label: 'Tablet Stand',
    codePrefix: 'TST',
    icon: 'Tablet',
    color: 'purple',
    aliases: ['tablet-stand', 'tabletstand', 'TST', 'Tablet Stand', 'fabrication', 'fab', 'tabstand'],
    isBuiltin: true,
  },
  {
    id: 'MB',
    label: 'Media Box',
    codePrefix: 'MB',
    icon: 'Box',
    color: 'violet',
    aliases: ['mediaBox', 'MB', 'Media Box', 'media-box', 'mediabox', 'media', 'MBX', 'custom-MBX', 'custom-MB'],
    isBuiltin: true,
  },
  {
    id: 'BAT',
    label: 'Battery Pack',
    codePrefix: 'BAT',
    icon: 'Battery',
    color: 'green',
    aliases: ['battery', 'BAT', 'Battery Pack', 'batterypack', 'batt', 'Battery'],
    isBuiltin: true,
  },
  {
    id: 'MSE',
    label: 'Mouse',
    codePrefix: 'MSE',
    icon: 'Mouse',
    color: 'gray',
    aliases: ['MSE', 'mse', 'mouse', 'Mouse', 'custom-MSE'],
    isBuiltin: true,
  },
  {
    id: 'W',
    label: 'Wires',
    codePrefix: 'W',
    icon: 'Zap',
    color: 'yellow',
    aliases: ['W', 'w', 'wire', 'wires', 'Wires', 'Wire', 'custom-W'],
    isBuiltin: true,
  },
]

// ─── CUSTOM TYPE STORAGE ─────────────────────────────────────────────────────

/** Load custom types from localStorage */
export function loadCustomTypes() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_TYPES_STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

/** Save custom types to localStorage */
export function saveCustomTypes(types) {
  localStorage.setItem(CUSTOM_TYPES_STORAGE_KEY, JSON.stringify(types))
}

/**
 * Add a new custom device type.
 * id and codePrefix are derived from the user-supplied short code (e.g. "MSE" → id: "MSE", codePrefix: "MSE")
 */
export function addCustomType({ id, label, icon = 'Package', color = 'gray' }) {
  const existing = loadCustomTypes()
  // Prevent duplicate IDs
  if (getAllTypes().some(t => t.id === id.toUpperCase())) {
    throw new Error(`Type ID "${id}" already exists.`)
  }
  const newType = {
    id: id.toUpperCase(),
    label,
    codePrefix: id.toUpperCase(),
    icon,
    color,
    aliases: [id.toUpperCase(), id.toLowerCase(), label],
    isBuiltin: false,
  }
  saveCustomTypes([...existing, newType])
  return newType
}

/** Delete a custom type by id */
export function deleteCustomType(id) {
  const existing = loadCustomTypes()
  saveCustomTypes(existing.filter(t => t.id !== id))
}

// ─── REGISTRY ACCESSORS ──────────────────────────────────────────────────────

/** All types: built-ins + custom */
export function getAllTypes() {
  return [...BUILTIN_DEVICE_TYPES, ...loadCustomTypes()]
}

/** Get a single type definition by its canonical id (e.g. "MB") */
export function getTypeById(id) {
  if (!id) return null
  return getAllTypes().find(t => t.id === id) || null
}

/**
 * THE KEY FUNCTION — resolve ANY type string to a canonical type ID.
 *
 * Handles ALL legacy formats:
 *   "mediaBox"       → "MB"
 *   "a-stand"        → "AST"
 *   "stand"          → "AST"
 *   "custom-MBX"     → "MB"
 *   "MB"             → "MB"
 *   "MSE"            → "MSE"  (custom type)
 *   "istand"         → "IST"
 *
 * Returns the canonical id string, or the original string if no match found
 * (so unknown types don't silently break).
 */
export function resolveTypeId(typeString) {
  if (!typeString) return null

  const all = getAllTypes()

  // 1. Exact id match (already canonical)
  const exactId = all.find(t => t.id === typeString)
  if (exactId) return exactId.id

  // 2. Check aliases (case-insensitive, stripped of spaces/hyphens/underscores)
  const clean = typeString.toLowerCase().replace(/[\s_-]+/g, '')
  for (const type of all) {
    for (const alias of type.aliases) {
      if (alias.toLowerCase().replace(/[\s_-]+/g, '') === clean) {
        return type.id
      }
    }
  }

  // 3. Handle legacy "custom-XXX" pattern → try to match XXX as an id or alias
  if (typeString.startsWith('custom-')) {
    const inner = typeString.replace('custom-', '')
    const found = all.find(t =>
      t.id === inner.toUpperCase() ||
      t.aliases.some(a => a.toLowerCase() === inner.toLowerCase())
    )
    if (found) return found.id
    // Unknown custom type — return the inner part as the ID (preserves behaviour)
    return inner.toUpperCase()
  }

  // 4. No match — return original so we don't silently lose data
  return typeString
}

/**
 * Get the display label for any type string.
 * Works with canonical IDs, legacy strings, or custom type IDs.
 */
export function getTypeLabel(typeString) {
  const id = resolveTypeId(typeString)
  const type = getTypeById(id)
  return type?.label || typeString || 'Unknown'
}

/**
 * Get the code prefix for any type string.
 * Used for generating device codes like MB-001.
 */
export function getCodePrefixForType(typeString) {
  const id = resolveTypeId(typeString)
  const type = getTypeById(id)
  return type?.codePrefix || id || 'DEV'
}

// ─── MIGRATION ALIAS MAP ─────────────────────────────────────────────────────
/**
 * Returns a flat map of { oldTypeString → canonicalId } for every known alias.
 * Used by the backend migration endpoint and frontend display fixes.
 *
 * Example output:
 *   {
 *     "mediaBox": "MB",
 *     "a-stand": "AST",
 *     "stand": "AST",
 *     "istand": "IST",
 *     "fabrication": "TST",
 *     "custom-MBX": "MB",
 *     ...
 *   }
 */
export function buildMigrationMap() {
  const map = {}
  for (const type of getAllTypes()) {
    for (const alias of type.aliases) {
      if (alias !== type.id) {
        map[alias] = type.id
      }
    }
  }
  return map
}

// ─── MAKE-SET SLOT MATCHING ──────────────────────────────────────────────────
/**
 * Check if a device's type matches a set slot's required type ID.
 * Handles all legacy type strings stored on existing devices.
 *
 * Usage:
 *   deviceMatchesSlot(device, 'MB')    // true if device is any Media Box variant
 *   deviceMatchesSlot(device, 'AST')   // true if device is any A-Frame Stand variant
 */
export function deviceMatchesSlot(device, slotTypeId) {
  const deviceId = resolveTypeId(device.type) || resolveTypeId(device.productType)
  return deviceId === slotTypeId
}

// ─── COLOR UTILITIES ─────────────────────────────────────────────────────────
// Tailwind class sets per color key (for consistent theming everywhere)
export const TYPE_COLOR_CLASSES = {
  orange:  { bg: 'bg-orange-100',  text: 'text-orange-600',  border: 'border-orange-200',  badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  sky:     { bg: 'bg-sky-100',     text: 'text-sky-600',     border: 'border-sky-200',     badge: 'bg-sky-50 text-sky-700 border-sky-200' },
  teal:    { bg: 'bg-teal-100',    text: 'text-teal-600',    border: 'border-teal-200',    badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-600',   border: 'border-amber-200',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-600',    border: 'border-blue-200',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  purple:  { bg: 'bg-purple-100',  text: 'text-purple-600',  border: 'border-purple-200',  badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  violet:  { bg: 'bg-violet-100',  text: 'text-violet-600',  border: 'border-violet-200',  badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  green:   { bg: 'bg-green-100',   text: 'text-green-600',   border: 'border-green-200',   badge: 'bg-green-50 text-green-700 border-green-200' },
  gray:    { bg: 'bg-gray-100',    text: 'text-gray-600',    border: 'border-gray-200',    badge: 'bg-gray-50 text-gray-600 border-gray-200' },
  yellow:  { bg: 'bg-yellow-100',  text: 'text-yellow-600',  border: 'border-yellow-200',  badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
}

export function getColorClasses(colorKey) {
  return TYPE_COLOR_CLASSES[colorKey] || TYPE_COLOR_CLASSES.gray
}