/**
 * Set Health Utilities
 * 
 * Calculates and manages set health status based on component health
 */

// Health priority ranking (higher number = worse condition)
export const HEALTH_PRIORITY = {
  ok: 1,
  repair: 2,
  damage: 3,
  lost: 4
}

// Normalize health status (handle legacy values)
export const normalizeHealth = (health) => {
  if (!health) return 'ok'
  const normalized = health.toLowerCase()
  
  // Map legacy values
  const legacyMap = {
    'damaged': 'damage',
    'needs_repair': 'repair',
    'critical': 'damage',
    'good': 'ok',
    'healthy': 'ok'
  }
  
  return legacyMap[normalized] || normalized
}

/**
 * Calculate set health from components
 * @param {Array} components - Array of device objects with healthStatus
 * @returns {string} - Worst health status among components
 */
export const calculateSetHealth = (components) => {
  if (!components || components.length === 0) {
    return 'lost' // No components = incomplete set
  }
  
  let worstHealth = 'ok'
  let maxPriority = HEALTH_PRIORITY.ok
  
  for (const component of components) {
    const health = normalizeHealth(component.healthStatus)
    const priority = HEALTH_PRIORITY[health] ?? HEALTH_PRIORITY.ok
    
    if (priority > maxPriority) {
      maxPriority = priority
      worstHealth = health
    }
  }
  
  // Special handling: if any component is lost, entire set is incomplete
  const hasLostComponent = components.some(c => normalizeHealth(c.healthStatus) === 'lost')
  if (hasLostComponent) {
    return 'lost'
  }
  
  return worstHealth
}

/**
 * Get component health summary
 * @param {Array} components - Array of device objects
 * @returns {Object} - Health breakdown { ok: 2, repair: 1, damage: 0, lost: 0 }
 */
export const getComponentHealthSummary = (components) => {
  const summary = {
    ok: 0,
    repair: 0,
    damage: 0,
    lost: 0
  }
  
  if (!components) return summary
  
  components.forEach(component => {
    const health = normalizeHealth(component.healthStatus)
    if (summary.hasOwnProperty(health)) {
      summary[health]++
    } else {
      summary.ok++ // Unknown health defaults to ok
    }
  })
  
  return summary
}

/**
 * Get problematic components (not OK)
 * @param {Array} components - Array of device objects
 * @returns {Array} - Components that need attention
 */
export const getProblematicComponents = (components) => {
  if (!components) return []
  
  return components.filter(c => {
    const health = normalizeHealth(c.healthStatus)
    return health !== 'ok'
  })
}

/**
 * Check if set can be deployed
 * @param {string} setHealth - Set health status
 * @returns {Object} - { canDeploy: boolean, warning: string, requiresConfirmation: boolean }
 */
export const canDeploySet = (setHealth) => {
  const normalized = normalizeHealth(setHealth)
  
  if (normalized === 'lost') {
    return {
      canDeploy: false,
      warning: 'Cannot deploy: Set has lost components',
      requiresConfirmation: false,
      blocked: true
    }
  }
  
  if (normalized === 'damage') {
    return {
      canDeploy: true,
      warning: 'Warning: Set has damaged components. Deployment not recommended.',
      requiresConfirmation: true,
      blocked: false
    }
  }
  
  if (normalized === 'repair') {
    return {
      canDeploy: true,
      warning: 'Warning: Set has components that need repair.',
      requiresConfirmation: true,
      blocked: false
    }
  }
  
  return {
    canDeploy: true,
    warning: null,
    requiresConfirmation: false,
    blocked: false
  }
}

/**
 * Get health status display info
 * @param {string} health - Health status
 * @returns {Object} - { label, icon, color, badge, description }
 */
export const getHealthDisplayInfo = (health) => {
  const normalized = normalizeHealth(health)
  
  const info = {
    ok: {
      label: '✓ OK',
      icon: '✓',
      color: 'emerald',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      description: 'All components in good condition'
    },
    repair: {
      label: '🔧 Repair',
      icon: '🔧',
      color: 'amber',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      description: 'One or more components need repair'
    },
    damage: {
      label: '⚠ Damage',
      icon: '⚠',
      color: 'red',
      badge: 'bg-red-100 text-red-800 border-red-200',
      description: 'One or more components are damaged'
    },
    lost: {
      label: '❌ Incomplete',
      icon: '❌',
      color: 'gray',
      badge: 'bg-gray-100 text-gray-800 border-gray-200',
      description: 'Set has missing components'
    }
  }
  
  return info[normalized] || info.ok
}

export default {
  calculateSetHealth,
  getComponentHealthSummary,
  getProblematicComponents,
  canDeploySet,
  getHealthDisplayInfo,
  normalizeHealth,
  HEALTH_PRIORITY
}