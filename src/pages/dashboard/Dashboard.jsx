import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useInventory } from '../../context/InventoryContext'
import { ChevronDown, ChevronUp, Smartphone, Layout, Monitor } from 'lucide-react'

const Dashboard = ({ userRole }) => {
  const { devices, componentInventory } = useInventory()
  const [setsView, setSetsView] = useState('available') // 'available' | 'deployed'
  const [showIndividualItems, setShowIndividualItems] = useState(false)

  // Available = devices not assigned to any client (same pool as "Devices to assign for rent" in Client module)
  const availableSets = useMemo(() => {
    const unassigned = (type) => devices.filter((d) => d.type === type && !d.clientId).length
    return {
      tablet: unassigned('tablet'),
      aFrame: unassigned('stand'),
      iFrame: unassigned('istand'),
    }
  }, [devices])

  // Deployed = devices assigned to a client (by type). When you assign in Client, count moves from Available to Deployed.
  const deployedSets = useMemo(() => {
    const assigned = (type) => devices.filter((d) => d.type === type && d.clientId).length
    return {
      tablet: assigned('tablet'),
      aFrame: assigned('stand'),
      iFrame: assigned('istand'),
    }
  }, [devices])

  const combinations = [
    {
      id: 'tablet',
      label: 'Tablet',
      sublabel: 'Tablet + Battery + Fabrication (stand)',
      image: '/images/tablet-combo.svg',
      available: availableSets.tablet,
      deployed: deployedSets.tablet,
    },
    {
      id: 'a-frame',
      label: 'A frame Standee',
      sublabel: '43" TV (or more) + Media box + A stand',
      image: '/images/a-frame-standee.svg',
      available: availableSets.aFrame,
      deployed: deployedSets.aFrame,
    },
    {
      id: 'i-frame',
      label: 'I frame Standee',
      sublabel: '43" TV (or more) + Media box + I stand',
      image: '/images/i-frame-standee.svg',
      available: availableSets.iFrame,
      deployed: deployedSets.iFrame,
    },
  ]

  const individualItems = [
    { key: 'tablets', label: 'Tablets', value: componentInventory.tablets },
    { key: 'batteries', label: 'Batteries', value: componentInventory.batteries },
    { key: 'fabricationTablet', label: 'Fabrication (Tablet stand)', value: componentInventory.fabricationTablet },
    { key: 'tvs', label: 'LEDs / TVs (43" or more)', value: componentInventory.tvs },
    { key: 'mediaBoxes', label: 'Media box', value: componentInventory.mediaBoxes },
    { key: 'aFrameStands', label: 'A stand (fabrication)', value: componentInventory.aFrameStands },
    { key: 'iFrameStands', label: 'I stand (fabrication)', value: componentInventory.iFrameStands },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {userRole}!</p>
      </div>

      {/* Toggle: Available vs Deployed sets — same source as Client "Devices to assign for rent" / assigned devices */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-gray-700">Sets / Combinations:</span>
        <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => setSetsView('available')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              setsView === 'available'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Available
          </button>
          <button
            type="button"
            onClick={() => setSetsView('deployed')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              setsView === 'deployed'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Deployed
          </button>
        </div>
      </div>

      {/* Combination cards with images */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {combinations.map((combo) => (
          <div
            key={combo.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="relative aspect-[3/4] max-h-64 bg-gray-100 flex items-center justify-center p-4">
              <img
                src={combo.image}
                alt={combo.label}
                className="max-h-full w-auto object-contain relative z-10"
                onError={(e) => {
                  e.target.onerror = null
                  e.target.style.visibility = 'hidden'
                  const fallback = e.target.parentElement?.querySelector('.img-fallback')
                  if (fallback) fallback.classList.remove('hidden')
                }}
              />
              <div className="img-fallback hidden absolute inset-0 items-center justify-center bg-gray-200 text-gray-500">
                <Smartphone className="w-16 h-16" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100">
              <h3 className="font-semibold text-gray-900">{combo.label}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{combo.sublabel}</p>
              <p className="mt-3 text-2xl font-bold text-primary-600">
                {setsView === 'available' ? combo.available : combo.deployed}
                <span className="text-sm font-normal text-gray-500 ml-1">
                  {setsView === 'available' ? 'available' : 'deployed'}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Individual items (interlinked with Devices) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowIndividualItems(!showIndividualItems)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="font-semibold text-gray-900">Individual items count</span>
          {showIndividualItems ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
        {showIndividualItems && (
          <div className="border-t border-gray-200 p-4 bg-gray-50/50">
            <p className="text-sm text-gray-600 mb-4">
              Raw component stock (tablets, batteries, TVs, etc.) — editable in Devices. Available/Deployed above are based on devices: only unassigned devices can be assigned to clients; when you assign in Client, that count moves from Available to Deployed.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {individualItems.map((item) => (
                <div
                  key={item.key}
                  className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3"
                >
                  {item.key === 'tvs' && <Monitor className="w-5 h-5 text-primary-600 shrink-0" />}
                  {(item.key === 'aFrameStands' || item.key === 'iFrameStands') && (
                    <Layout className="w-5 h-5 text-primary-600 shrink-0" />
                  )}
                  {['tablets', 'batteries', 'fabricationTablet'].includes(item.key) && (
                    <Smartphone className="w-5 h-5 text-primary-600 shrink-0" />
                  )}
                  {item.key === 'mediaBoxes' && <Layout className="w-5 h-5 text-primary-600 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 truncate">{item.label}</p>
                    <p className="text-lg font-semibold text-gray-900">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              to="/dashboard/devices"
              className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Manage in Devices →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
