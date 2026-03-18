import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Health priority: lost (4) > damage (3) > repair (2) > ok (1)
const HEALTH_RANK = { ok: 1, repair: 2, damage: 3, lost: 4 }

/**
 * Recalculates health status for all sets based on their components
 * Runs daily to ensure data consistency
 */
async function syncAllSetHealth() {
  console.log('[Set Health Sync] Starting daily health synchronization...')
  
  try {
    // Get all sets with their components
    const sets = await prisma.deviceSet.findMany({
      include: {
        components: {
          select: { id: true, code: true, healthStatus: true }
        }
      }
    })
    
    console.log(`[Set Health Sync] Found ${sets.length} sets to process`)
    
    let updatedCount = 0
    let unchangedCount = 0
    const updates = []
    
    for (const set of sets) {
      // Skip sets with no components
      if (!set.components || set.components.length === 0) {
        console.log(`[Set Health Sync] Set ${set.code} has no components, marking as lost`)
        updates.push({
          setId: set.id,
          setCode: set.code,
          oldHealth: set.healthStatus,
          newHealth: 'lost',
          reason: 'No components'
        })
        continue
      }
      
      // Calculate worst health from components
      let worstHealth = 'ok'
      let maxRank = HEALTH_RANK.ok
      
      for (const component of set.components) {
        const health = component.healthStatus || 'ok'
        const rank = HEALTH_RANK[health] ?? HEALTH_RANK.ok
        
        if (rank > maxRank) {
          maxRank = rank
          worstHealth = health
        }
      }
      
      // Check for lost components
      const hasLostComponent = set.components.some(c => c.healthStatus === 'lost')
      if (hasLostComponent) {
        worstHealth = 'lost'
      }
      
      // Only update if health has changed
      if (set.healthStatus !== worstHealth) {
        updates.push({
          setId: set.id,
          setCode: set.code,
          oldHealth: set.healthStatus,
          newHealth: worstHealth,
          reason: `Worst component health: ${worstHealth}`
        })
        updatedCount++
      } else {
        unchangedCount++
      }
    }
    
    // Perform batch update
    if (updates.length > 0) {
      console.log(`[Set Health Sync] Updating ${updates.length} sets...`)
      
      for (const update of updates) {
        await prisma.deviceSet.update({
          where: { id: update.setId },
          data: { 
            healthStatus: update.newHealth,
            updatedAt: new Date()
          }
        })
        
        console.log(`[Set Health Sync] ${update.setCode}: ${update.oldHealth} → ${update.newHealth} (${update.reason})`)
      }
    }
    
    console.log('[Set Health Sync] Summary:')
    console.log(`  Total sets: ${sets.length}`)
    console.log(`  Updated: ${updatedCount}`)
    console.log(`  Unchanged: ${unchangedCount}`)
    console.log('[Set Health Sync] Completed successfully')
    
    return {
      success: true,
      totalSets: sets.length,
      updated: updatedCount,
      unchanged: unchangedCount,
      updates
    }
    
  } catch (error) {
    console.error('[Set Health Sync] Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncAllSetHealth()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { syncAllSetHealth }