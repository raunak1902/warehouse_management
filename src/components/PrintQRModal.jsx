import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  X, Printer, Download, Search, ChevronRight, ChevronLeft,
  Smartphone, Box, Check, Scissors, FileText, AlertCircle,
  Layers, Trash2, Plus, Minus,
} from 'lucide-react'

// ── Page size presets (width × height in inches) ──────────────────────────────
const PAGE_SIZES = [
  { id: 'shipping-4x6',  label: '4" × 6"',      sub: 'Shipping Label',  w: 4,    h: 6,    popular: true },
  { id: 'shipping-2x4',  label: '2" × 4"',      sub: 'Small Label',     w: 2,    h: 4    },
  { id: 'shipping-4x4',  label: '4" × 4"',      sub: 'Square Label',    w: 4,    h: 4    },
  { id: 'a4',            label: 'A4',            sub: '8.27" × 11.69"',  w: 8.27, h: 11.69 },
  { id: 'letter',        label: 'US Letter',     sub: '8.5" × 11"',      w: 8.5,  h: 11   },
  { id: 'a5',            label: 'A5',            sub: '5.83" × 8.27"',   w: 5.83, h: 8.27 },
]

const DPI = 96 // screen DPI for sizing

// Convert inches to px for layout calculations
const inToPx = (inches) => inches * DPI

// ── Build QR data identical to existing BarcodeResultCard ─────────────────────
const buildQRData = (item) =>
  JSON.stringify({
    barcode:    item.barcode    || item.code,
    deviceCode: item.code,
    type:       item.type       || item.setType,
    brand:      item.brand      || null,
    model:      item.model      || null,
  })

// ── Single QR cell — used both in preview and print area ─────────────────────
const QRCell = ({ item, cellW, cellH, forPrint = false }) => {
  const cellPx   = Math.min(cellW, cellH) // use smaller side for QR/font sizing
  const qrSize   = Math.floor(cellPx * 0.62)
  const fontSize = Math.max(8, Math.floor(cellPx * 0.072))
  const subSize  = Math.max(6, Math.floor(cellPx * 0.054))

  return (
    <div
      style={{
        width:          cellW,
        height:         cellH,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            Math.floor(cellPx * 0.03),
        padding:        Math.floor(cellPx * 0.06),
        boxSizing:      'border-box',
        background:     '#fff',
        pageBreakInside: 'avoid',
        breakInside:    'avoid',
      }}
    >
      <QRCodeSVG
        value={buildQRData(item)}
        size={qrSize}
        level="H"
        includeMargin={false}
        bgColor="#ffffff"
        fgColor="#000000"
      />
      <p style={{
        fontSize:    fontSize,
        fontWeight:  '700',
        color:       '#111',
        margin:      0,
        fontFamily:  'monospace',
        textAlign:   'center',
        lineHeight:  1.1,
        wordBreak:   'break-all',
      }}>
        {item.code}
      </p>
      {item.barcode && (
        <p style={{
          fontSize:  subSize,
          color:     '#555',
          margin:    0,
          fontFamily:'monospace',
          textAlign: 'center',
          lineHeight: 1.1,
          wordBreak: 'break-all',
        }}>
          {item.barcode}
        </p>
      )}
    </div>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────────
const StepDot = ({ n, active, done }) => (
  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
    ${done  ? 'bg-primary-600 border-primary-600 text-white'
    : active ? 'bg-white border-primary-600 text-primary-600'
    :          'bg-gray-100 border-gray-200 text-gray-400'}`}>
    {done ? <Check className="w-4 h-4" /> : n}
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const PrintQRModal = ({ onClose, devices = [], deviceSets = [] }) => {
  const [step, setStep]           = useState(1)   // 1, 2, 3
  const [pageSize, setPageSize]   = useState(PAGE_SIZES[0])
  const [qrCount, setQrCount]     = useState('')   // how many QRs user wants
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState([])   // array of item objects
  const printRef                  = useRef(null)

  // All selectable items = devices + sets
  const allItems = useMemo(() => {
    const devs = devices.map(d => ({ ...d, _kind: 'device' }))
    const sets = deviceSets.map(s => ({
      ...s,
      code:  s.code || `SET-${s.id}`,
      brand: null,
      model: null,
      _kind: 'set',
    }))
    return [...devs, ...sets]
  }, [devices, deviceSets])

  const parsedCount = parseInt(qrCount, 10)
  const countValid  = !isNaN(parsedCount) && parsedCount >= 1 && parsedCount <= 200

  // Filtered search results (exclude already selected)
  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return allItems
      .filter(item =>
        !selected.find(s => s.code === item.code && s._kind === item._kind) &&
        (
          item.code?.toLowerCase().includes(q) ||
          item.brand?.toLowerCase().includes(q) ||
          item.model?.toLowerCase().includes(q) ||
          item.type?.toLowerCase().includes(q) ||
          item.setType?.toLowerCase().includes(q)
        )
      )
      .slice(0, 8)
  }, [search, allItems, selected])

  const addItem = (item) => {
    if (selected.length >= parsedCount) return
    setSelected(prev => [...prev, item])
    setSearch('')
  }

  const removeItem = (idx) => {
    setSelected(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Layout calculation ────────────────────────────────────────────────────
  const layout = useMemo(() => {
    if (!countValid) return null
    const n       = parsedCount
    const pageW   = inToPx(pageSize.w)
    const pageH   = inToPx(pageSize.h)
    const margin  = inToPx(0.15)
    const usableW = pageW  - 2 * margin
    const usableH = pageH  - 2 * margin

    // Find best cols/rows to fill the full page with rectangular cells
    // Maximize the minimum dimension of each cell (square-ish) to pick best layout,
    // but then cells stretch to fill the entire usable area (no wasted space)
    let bestCols = 1, bestRows = 1, bestScore = 0
    for (let cols = 1; cols <= n; cols++) {
      const rows  = Math.ceil(n / cols)
      const cellW = usableW / cols
      const cellH = usableH / rows
      // Score: maximize the smaller side (so cells don't become too thin/tall)
      const score = Math.min(cellW, cellH)
      if (score > bestScore) {
        bestScore = score; bestCols = cols; bestRows = rows
      }
    }

    // Cells fill the full usable area — they are rectangular, not square
    const cellW = Math.floor(usableW / bestCols)
    const cellH = Math.floor(usableH / bestRows)

    return { cols: bestCols, rows: bestRows, cellW, cellH, cellPx: Math.min(cellW, cellH), pageW, pageH, margin }
  }, [parsedCount, pageSize, countValid])

  // ── Print handler ──────────────────────────────────────────────────────────
  const handlePrint = () => {
    const w      = layout.pageW
    const h      = layout.pageH
    const margin = layout.margin
    const css    = `
      @page { size: ${pageSize.w}in ${pageSize.h}in; margin: 0; }
      body  { margin: 0; padding: 0; background: #fff; }
      #print-sheet {
        width: ${w}px; height: ${h}px;
        padding: ${margin}px;
        display: grid;
        grid-template-columns: repeat(${layout.cols}, ${layout.cellW}px);
        grid-template-rows: repeat(${layout.rows}, ${layout.cellH}px);
        gap: 0;
        box-sizing: border-box;
      }
      .qr-cell { border: 1px dashed #bbb; box-sizing: border-box; }
    `
    const cells = selected.map(item => {
      const qrSize   = Math.floor(layout.cellPx * 0.62)
      const fontSize = Math.max(8, Math.floor(layout.cellPx * 0.072))
      const subSize  = Math.max(6, Math.floor(layout.cellPx * 0.054))
      return `<div class="qr-cell" style="width:${layout.cellW}px;height:${layout.cellH}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.floor(layout.cellPx*0.03)}px;padding:${Math.floor(layout.cellPx*0.06)}px;box-sizing:border-box;">
        <div id="qr-print-${item.code}" style="width:${qrSize}px;height:${qrSize}px;"></div>
        <p style="font-size:${fontSize}px;font-weight:700;font-family:monospace;margin:0;text-align:center;color:#111;">${item.code}</p>
        ${item.barcode ? `<p style="font-size:${subSize}px;font-family:monospace;margin:0;color:#555;text-align:center;word-break:break-all;">${item.barcode}</p>` : ''}
      </div>`
    }).join('')

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><style>${css}</style></head><body>
      <div id="print-sheet">${cells}</div>
      <script>
        // Render QRs using qrcode-generator (no external deps needed — we load via CDN)
        // Instead we embed SVGs from the parent page
        window.onload = function() { window.print(); window.close(); }
      </script>
    </body></html>`)
    win.document.close()
  }

  // ── Better print: capture SVGs from current DOM ───────────────────────────
  const handlePrintDOM = useCallback(() => {
    if (!printRef.current) return

    // Collect SVG data from rendered QRCodeSVG elements in the preview
    const svgEls = printRef.current.querySelectorAll('svg')
    const svgDataArr = Array.from(svgEls).map(svg =>
      'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg))))
    )

    const w      = layout.pageW
    const h      = layout.pageH
    const margin = layout.margin
    const cellW  = layout.cellW
    const cellH  = layout.cellH
    const cell   = layout.cellPx  // smaller side, for QR/font sizing
    const cols   = layout.cols
    const fontSize = Math.max(8, Math.floor(cell * 0.072))
    const subSize  = Math.max(6, Math.floor(cell * 0.054))
    const qrSize   = Math.floor(cell * 0.62)
    const gap      = Math.floor(cell * 0.03)
    const pad      = Math.floor(cell * 0.06)

    const cells = selected.map((item, i) => {
      const imgTag = svgDataArr[i]
        ? `<img src="${svgDataArr[i]}" width="${qrSize}" height="${qrSize}" style="display:block;" />`
        : ''
      return `<div style="width:${cellW}px;height:${cellH}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${gap}px;padding:${pad}px;box-sizing:border-box;border:1px dashed #bbb;">
        ${imgTag}
        <p style="font-size:${fontSize}px;font-weight:700;font-family:monospace;margin:0;text-align:center;color:#111;line-height:1.1;">${item.code}</p>
        ${item.barcode ? `<p style="font-size:${subSize}px;font-family:monospace;margin:0;color:#555;text-align:center;word-break:break-all;line-height:1.1;">${item.barcode}</p>` : ''}
      </div>`
    }).join('')

    const css = `
      @page { size: ${pageSize.w}in ${pageSize.h}in; margin: 0; }
      body { margin: 0; padding: 0; background: #fff; }
      #sheet { width:${w}px;height:${h}px;padding:${margin}px;display:grid;
        grid-template-columns:repeat(${cols},${cellW}px);
        grid-template-rows:repeat(${layout.rows},${cellH}px);gap:0;box-sizing:border-box; }
    `
    const win = window.open('', '_blank')
    if (!win) { alert('Please allow popups to print.'); return }
    win.document.write(`<!DOCTYPE html><html><head><style>${css}</style></head>
      <body><div id="sheet">${cells}</div>
      <script>window.onload=function(){window.print();setTimeout(()=>window.close(),1000)}<\/script>
      </body></html>`)
    win.document.close()
  }, [selected, layout, pageSize])

  // ── Download as PNG ────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    if (!printRef.current || !layout) return

    const canvas  = document.createElement('canvas')
    const scale   = 3 // 3× for crisp output
    canvas.width  = layout.pageW  * scale
    canvas.height = layout.pageH  * scale
    const ctx     = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)

    const svgEls   = printRef.current.querySelectorAll('svg')
    const { cols, rows, cellW, cellH, cellPx: cell, margin } = layout

    const loadImg = (src) => new Promise(res => {
      const img = new Image()
      img.onload = () => res(img)
      img.onerror = () => res(null)
      img.src = src
    })

    const pad    = Math.floor(cell * 0.06)
    const qrSize = Math.floor(cell * 0.62)
    const gap    = Math.floor(cell * 0.03)
    const fontSize = Math.max(8, Math.floor(cell * 0.072))
    const subSize  = Math.max(6, Math.floor(cell * 0.054))

    for (let i = 0; i < selected.length; i++) {
      const item  = selected[i]
      const col   = i % cols
      const row   = Math.floor(i / cols)
      const x     = margin + col * cellW
      const y     = margin + row * cellH

      // Draw dashed border
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = '#bbb'
      ctx.lineWidth   = 0.5
      ctx.strokeRect(x + 0.25, y + 0.25, cellW - 0.5, cellH - 0.5)
      ctx.setLineDash([])

      // Draw QR (centered horizontally, near top with padding)
      const svgEl = svgEls[i]
      if (svgEl) {
        const svgData = 'data:image/svg+xml;base64,' +
          btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svgEl))))
        const img = await loadImg(svgData)
        if (img) {
          const qrX = x + (cellW - qrSize) / 2
          const qrY = y + pad
          ctx.drawImage(img, qrX, qrY, qrSize, qrSize)
        }
      }

      // Draw code label
      const textY = y + pad + qrSize + gap + fontSize
      ctx.font      = `bold ${fontSize}px monospace`
      ctx.fillStyle = '#111'
      ctx.textAlign = 'center'
      ctx.fillText(item.code, x + cellW / 2, textY)

      // Draw barcode string
      if (item.barcode) {
        ctx.font      = `${subSize}px monospace`
        ctx.fillStyle = '#555'
        const barcodeY = textY + gap + subSize
        // Truncate if too wide
        const maxW = cellW - pad * 2
        let barcodeText = item.barcode
        while (ctx.measureText(barcodeText).width > maxW && barcodeText.length > 4) {
          barcodeText = barcodeText.slice(0, -1)
        }
        if (barcodeText !== item.barcode) barcodeText += '…'
        ctx.fillText(barcodeText, x + cellW / 2, barcodeY)
      }
    }

    canvas.toBlob(blob => {
      const url  = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href     = url
      link.download = `qr-sheet-${pageSize.id}.png`
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }, [selected, layout, pageSize])

  // ── Step validation ────────────────────────────────────────────────────────
  const canGoTo2 = !!pageSize
  const canGoTo3 = countValid
  const readyToPrint = selected.length === parsedCount && selected.length > 0

  // ── Keyboard: close on Escape ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Scissors className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Print QR Labels</h2>
              <p className="text-xs text-gray-400">Generate a print-ready QR sheet</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Step bar ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
          {[
            { n: 1, label: 'Page Size' },
            { n: 2, label: 'QR Count' },
            { n: 3, label: 'Select Devices' },
          ].map(({ n, label }, idx) => (
            <div key={n} className="flex items-center gap-2">
              {idx > 0 && <div className={`h-px w-8 ${step > idx ? 'bg-primary-400' : 'bg-gray-200'}`} />}
              <button
                onClick={() => {
                  if (n === 1) setStep(1)
                  if (n === 2 && canGoTo2) setStep(2)
                  if (n === 3 && canGoTo2 && canGoTo3) setStep(3)
                }}
                className="flex items-center gap-1.5 group"
              >
                <StepDot n={n} active={step === n} done={step > n} />
                <span className={`text-xs font-medium hidden sm:block ${step === n ? 'text-primary-700' : step > n ? 'text-primary-500' : 'text-gray-400'}`}>
                  {label}
                </span>
              </button>
            </div>
          ))}
        </div>

        {/* ── Body ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* STEP 1 — Page Size */}
          {step === 1 && (
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Select the label / paper size you'll print on.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PAGE_SIZES.map(ps => (
                  <button
                    key={ps.id}
                    onClick={() => setPageSize(ps)}
                    className={`relative rounded-xl border-2 p-4 text-left transition-all
                      ${pageSize?.id === ps.id
                        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50'
                      }`}
                  >
                    {ps.popular && (
                      <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Popular
                      </span>
                    )}
                    <div className="flex items-start gap-2">
                      <FileText className={`w-5 h-5 mt-0.5 shrink-0 ${pageSize?.id === ps.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                      <div>
                        <p className={`text-sm font-bold ${pageSize?.id === ps.id ? 'text-indigo-800' : 'text-gray-800'}`}>
                          {ps.label}
                        </p>
                        <p className={`text-xs mt-0.5 ${pageSize?.id === ps.id ? 'text-indigo-500' : 'text-gray-400'}`}>
                          {ps.sub}
                        </p>
                      </div>
                    </div>
                    {/* Visual aspect-ratio indicator */}
                    <div className="mt-3 flex items-end gap-1">
                      <div
                        className={`rounded border ${pageSize?.id === ps.id ? 'border-indigo-400 bg-indigo-100' : 'border-gray-300 bg-gray-100'}`}
                        style={{
                          width:  Math.min(40, (ps.w / Math.max(ps.w, ps.h)) * 40),
                          height: Math.min(40, (ps.h / Math.max(ps.w, ps.h)) * 40),
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 — QR Count */}
          {step === 2 && (
            <div className="p-6 space-y-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  How many QR codes do you want to print on this <span className="font-semibold">{pageSize.label} {pageSize.sub}</span>?
                </p>
                <p className="text-xs text-gray-400">You'll select exactly this many devices in the next step.</p>
              </div>

              {/* Number input with +/- */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQrCount(c => String(Math.max(1, (parseInt(c) || 1) - 1)))}
                  className="w-11 h-11 rounded-xl border-2 border-gray-200 flex items-center justify-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                >
                  <Minus className="w-4 h-4 text-gray-600" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={qrCount}
                  onChange={e => setQrCount(e.target.value)}
                  placeholder="e.g. 4"
                  className="w-28 text-center text-3xl font-bold border-2 border-gray-200 rounded-xl py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                />
                <button
                  onClick={() => setQrCount(c => String(Math.min(200, (parseInt(c) || 0) + 1)))}
                  className="w-11 h-11 rounded-xl border-2 border-gray-200 flex items-center justify-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Quick picks */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Quick pick</p>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 4, 6, 8, 10, 20].map(n => (
                    <button
                      key={n}
                      onClick={() => setQrCount(String(n))}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all
                        ${parsedCount === n
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                        }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout preview */}
              {countValid && layout && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <p className="text-sm font-semibold text-indigo-800 mb-1">Layout preview</p>
                  <p className="text-xs text-indigo-600">
                    {layout.cols} column{layout.cols !== 1 ? 's' : ''} × {layout.rows} row{layout.rows !== 1 ? 's' : ''}
                    {' '}— each QR cell ~{(layout.cellW / DPI).toFixed(2)}" × {(layout.cellH / DPI).toFixed(2)}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — Select Devices */}
          {step === 3 && (
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700 font-medium">
                    Select <span className="text-indigo-700 font-bold">{parsedCount}</span> device{parsedCount !== 1 ? 's' : ''} or sets
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Type a code or name to search</p>
                </div>
                <span className={`text-sm font-bold px-3 py-1 rounded-full
                  ${selected.length === parsedCount ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {selected.length} / {parsedCount}
                </span>
              </div>

              {/* Search input */}
              {selected.length < parsedCount && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    autoFocus
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by code, brand, model…"
                    className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                  {/* Dropdown results */}
                  {searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-10 overflow-hidden">
                      {searchResults.map(item => (
                        <button
                          key={`${item._kind}-${item.id}`}
                          onClick={() => addItem(item)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 text-left transition-colors border-b border-gray-50 last:border-0"
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                            ${item._kind === 'set' ? 'bg-orange-100' : 'bg-indigo-100'}`}>
                            {item._kind === 'set'
                              ? <Layers className="w-3.5 h-3.5 text-orange-600" />
                              : <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono font-bold text-gray-900 text-sm">{item.code}</p>
                            <p className="text-xs text-gray-400 truncate">
                              {item._kind === 'set'
                                ? item.setTypeName || item.setType || 'Set'
                                : [item.type, item.brand, item.model].filter(Boolean).join(' · ')
                              }
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {search.trim() && searchResults.length === 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 px-4 py-3 text-sm text-gray-400">
                      No devices found for "{search}"
                    </div>
                  )}
                </div>
              )}

              {/* Selected chips */}
              {selected.length > 0 && (
                <div className="space-y-2">
                  {selected.map((item, idx) => (
                    <div key={`sel-${idx}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                        ${item._kind === 'set' ? 'bg-orange-100' : 'bg-indigo-100'}`}>
                        {item._kind === 'set'
                          ? <Layers className="w-4 h-4 text-orange-600" />
                          : <Smartphone className="w-4 h-4 text-indigo-600" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono font-bold text-gray-900 text-sm">{item.code}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {item._kind === 'set'
                            ? item.setTypeName || item.setType || 'Set'
                            : [item.type, item.brand, item.model].filter(Boolean).join(' · ')
                          }
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {selected.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-300">
                  <Search className="w-10 h-10 mb-2" />
                  <p className="text-sm">Search and add devices above</p>
                </div>
              )}

              {/* ── Hidden print area — always rendered when devices selected ─ */}
              {selected.length > 0 && layout && (
                <div
                  ref={printRef}
                  style={{
                    position: 'absolute',
                    left: '-9999px',
                    top: 0,
                    width:   layout.pageW,
                    height:  layout.pageH,
                    padding: layout.margin,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${layout.cols}, ${layout.cellW}px)`,
                    gridTemplateRows: `repeat(${layout.rows}, ${layout.cellH}px)`,
                    gap: 0,
                    background: '#fff',
                    boxSizing: 'border-box',
                  }}
                >
                  {selected.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        border: '1px dashed #bbb',
                        boxSizing: 'border-box',
                      }}
                    >
                      <QRCell item={item} cellW={layout.cellW} cellH={layout.cellH} forPrint />
                    </div>
                  ))}
                </div>
              )}

              {/* ── Visual preview ─────────────────────────────────────── */}
              {readyToPrint && layout && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sheet Preview</p>
                    <p className="text-xs text-gray-400">
                      {layout.cols}×{layout.rows} · {pageSize.label} {pageSize.sub}
                    </p>
                  </div>
                  <div className="p-4 flex items-center justify-center bg-gray-50 overflow-auto">
                    {/* Scale preview to fit the panel */}
                    <div
                      style={{
                        width:    layout.pageW,
                        height:   layout.pageH,
                        padding:  layout.margin,
                        display:  'grid',
                        gridTemplateColumns: `repeat(${layout.cols}, ${layout.cellW}px)`,
                        gridTemplateRows: `repeat(${layout.rows}, ${layout.cellH}px)`,
                        gap: 0,
                        background: '#fff',
                        boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
                        transform: `scale(${Math.min(1, 380 / Math.max(layout.pageW, layout.pageH))})`,
                        transformOrigin: 'top center',
                        boxSizing: 'border-box',
                        flexShrink: 0,
                      }}
                    >
                      {selected.map((item, i) => (
                        <div
                          key={i}
                          style={{ border: '1px dashed #bbb', boxSizing: 'border-box' }}
                        >
                          <QRCell item={item} cellW={layout.cellW} cellH={layout.cellH} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 shrink-0 bg-gray-50">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}

          <div className="flex-1" />

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={!canGoTo2}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              disabled={!canGoTo3}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 3 && (
            <>
              {!readyToPrint && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Add {parsedCount - selected.length} more device{parsedCount - selected.length !== 1 ? 's' : ''}
                </p>
              )}
              <button
                onClick={handleDownload}
                disabled={!readyToPrint}
                className="flex items-center gap-2 px-4 py-2.5 border-2 border-indigo-200 text-indigo-700 bg-white rounded-xl text-sm font-semibold hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" /> Download PNG
              </button>
              <button
                onClick={handlePrintDOM}
                disabled={!readyToPrint}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PrintQRModal