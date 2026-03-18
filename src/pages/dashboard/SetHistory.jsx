/**
 * src/pages/dashboard/SetHistory.jsx
 * ─────────────────────────────────────
 * Disassembled Set History — permanent log of all sets that have been broken down.
 * Manager+ can delete individual log entries.
 * Accessible via "Set History" button on the Makesets page.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers, ArrowLeft, RefreshCw, Search, X, Trash2,
  Package, MapPin, Calendar, ChevronDown, ChevronUp,
  AlertTriangle, ArrowRight, ChevronLeft, ChevronRight,
} from 'lucide-react'

const authHdr = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` })
const fmt = (dt) => dt ? new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const PAGE_SIZE = 20

const HEALTH_MAP = {
  ok:      { label: '✓ OK',      cls: 'bg-emerald-100 text-emerald-700' },
  repair:  { label: '🔧 Repair',  cls: 'bg-amber-100 text-amber-700'    },
  damage:  { label: '⚠ Damaged', cls: 'bg-red-100 text-red-700'        },
  damaged: { label: '⚠ Damaged', cls: 'bg-red-100 text-red-700'        },
}

function SetHistoryCard({ record, isManager, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const components = Array.isArray(record.componentSnapshot) ? record.componentSnapshot : []
  const whParts = [record.warehouseName, record.warehouseZone, record.warehouseSpecificLocation].filter(Boolean)

  // Determine who requested vs who executed the disassembly
  const requestedBy   = record.requestedByName   || null
  const disassembledBy = record.disassembledByName || null
  // If same person (manager acted directly), show one "Done by" line.
  // If different (ground team requested, manager approved), show both.
  const isSamePerson = requestedBy && disassembledBy && requestedBy === disassembledBy
  const wasGroundTeamRequest = requestedBy && disassembledBy && !isSamePerson

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Layers className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">

              {/* Set code + type + name */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-gray-900">{record.setCode}</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{record.setTypeName}</span>
                {record.setName && <span className="text-xs text-gray-400 italic">"{record.setName}"</span>}
                {record.lifecycleSnapshot && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    was {record.lifecycleSnapshot}
                  </span>
                )}
              </div>

              {/* Timestamp + component count */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" /> {fmt(record.disassembledAt)}
                </span>
                <span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                  {components.length} component{components.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Who requested + who approved */}
              <div className="mt-2 space-y-0.5">
                {wasGroundTeamRequest ? (
                  <>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                      <span className="text-gray-400">Requested by</span>
                      <span className="font-semibold text-blue-700">{requestedBy}</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-full font-bold">Ground Team</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                      <span className="text-gray-400">Approved &amp; executed by</span>
                      <span className="font-semibold text-green-700">{disassembledBy}</span>
                    </div>
                  </>
                ) : disassembledBy ? (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                    <span className="text-gray-400">Done by</span>
                    <span className="font-semibold text-gray-700">{disassembledBy}</span>
                  </div>
                ) : null}
              </div>

              {/* Reason */}
              {record.reason && (
                <p className="text-xs text-gray-500 mt-1.5 italic">"{record.reason}"</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {isManager && (
              <button
                onClick={() => onDelete(record)}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete this history entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Last warehouse location of the set */}
        {whParts.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 ml-13">
            <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <div className="flex items-center gap-1 flex-wrap">
              {whParts.map((p, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ArrowRight className="w-2.5 h-2.5 text-gray-300" />}
                  <span className="px-1.5 py-0.5 bg-gray-50 border border-gray-200 text-gray-600 rounded text-[11px] font-medium">{p}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Expanded: component list */}
      {expanded && components.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <Package className="w-3.5 h-3.5" /> Components at disassembly
          </p>
          <div className="space-y-2">
            {components.map((comp, i) => {
              const badge = HEALTH_MAP[comp.healthStatus || 'ok'] || HEALTH_MAP.ok
              // restoredZone/restoredSpecific may also be available
              const restoreParts = [
                comp.restoredWarehouseName || (comp.restoredWarehouseId ? `Warehouse #${comp.restoredWarehouseId}` : null),
                comp.restoredZone,
                comp.restoredSpecific,
              ].filter(Boolean)
              return (
                <div key={comp.id || i} className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-medium text-gray-800">{comp.code}</p>
                    <p className="text-xs text-gray-400">{[comp.type, comp.brand, comp.model, comp.size].filter(Boolean).join(' · ') || 'N/A'}</p>
                    {restoreParts.length > 0 ? (
                      <p className="text-[11px] text-teal-600 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                        Returned to: {restoreParts.join(' › ')}
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-400 mt-0.5 italic">Return location not recorded</p>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SetHistory({ userRole }) {
  const navigate = useNavigate()
  const [records,  setRecords]  = useState([])
  const [total,    setTotal]    = useState(0)
  const [pages,    setPages]    = useState(1)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error,    setError]    = useState('')

  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } })()
  const userRoleNorm = (currentUser.role ?? '').toLowerCase().replace(/[\s_-]/g, '')
  const isManager = ['manager', 'superadmin'].includes(userRoleNorm)

  const fetchHistory = useCallback(async (pg = 1) => {
    setLoading(true); setError('')
    try {
      const p = new URLSearchParams({ page: pg, pageSize: PAGE_SIZE })
      if (search.trim()) p.set('search', search.trim())
      const r = await fetch(`/api/sets/history?${p}`, { headers: authHdr() })
      if (!r.ok) throw new Error('Failed')
      const json = await r.json()
      
      // Handle missing table case
      if (json._tableNotReady) {
        setError('Set history is not yet available. Please ask your system administrator to run database migrations.')
        setRecords([]); setTotal(0); setPages(1); setPage(pg)
        return
      }
      
      setRecords(json.records || []); setTotal(json.total || 0); setPages(json.pages || 1); setPage(pg)
    } catch (err) { 
      console.error('Set history fetch error:', err)
      setError('Failed to load set history.') 
    }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { fetchHistory(1) }, [search]) // eslint-disable-line

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const r = await fetch(`/api/sets/history/${deleteTarget.id}`, { method: 'DELETE', headers: authHdr() })
      if (!r.ok) throw new Error('Failed')
      setDeleteTarget(null)
      fetchHistory(page)
    } catch { alert('Failed to delete history entry.') }
    finally { setDeleteLoading(false) }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard/makesets')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-7 h-7 text-orange-500" /> Set History
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Permanent log of all disassembled sets and their components</p>
          </div>
        </div>
        <button onClick={() => fetchHistory(page)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search set code, type, name…"
          className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Count */}
      <p className="text-sm text-gray-500">
        {loading ? 'Loading…' : `${total.toLocaleString()} disassembled set${total !== 1 ? 's' : ''} in history`}
      </p>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Records */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400 gap-3">
          <Layers className="w-12 h-12 opacity-30" />
          <p className="font-medium text-gray-500">No disassembled sets yet</p>
          {search && <button onClick={() => setSearch('')} className="text-sm text-orange-600 hover:underline">Clear search</button>}
        </div>
      ) : (
        <div className="space-y-4">
          {records.map(record => (
            <SetHistoryCard
              key={record.id}
              record={record}
              isManager={isManager}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <button onClick={() => fetchHistory(page - 1)} disabled={page <= 1} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} of {pages}</span>
          <button onClick={() => fetchHistory(page + 1)} disabled={page >= pages} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Delete History Entry</h3>
                <p className="text-sm text-gray-500">{deleteTarget.setCode}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              This will permanently remove this set history entry. The actual devices are unaffected. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50 text-sm">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                {deleteLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Trash2 className="w-4 h-4" /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}