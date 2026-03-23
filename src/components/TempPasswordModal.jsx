import { useState } from 'react'
import { X, Copy, Check, KeyRound, AlertTriangle } from 'lucide-react'

/**
 * TempPasswordModal
 * Shown after SuperAdmin creates a user or resets a password.
 * Displays the one-time temp password so the admin can copy and share it.
 *
 * Props:
 *   isOpen   — boolean
 *   onClose  — () => void
 *   userData — { name, email, tempPassword, ... }
 */
const TempPasswordModal = ({ isOpen, onClose, userData }) => {
  const [copied, setCopied] = useState(false)

  if (!isOpen || !userData) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(userData.tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers that block clipboard
      const el = document.createElement('textarea')
      el.value = userData.tempPassword
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Icon + Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-100 rounded-full mb-3">
            <KeyRound className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Temporary Password</h2>
          <p className="text-sm text-gray-500 mt-1">
            Share this password with <span className="font-medium text-gray-700">{userData.name}</span>
          </p>
        </div>

        {/* User info */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-sm text-gray-600">
          <span className="font-medium">Email:</span> {userData.email}
        </div>

        {/* Temp password display */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Temporary Password
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-900 text-green-400 font-mono text-lg px-4 py-3 rounded-xl tracking-widest select-all">
              {userData.tempPassword}
            </code>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${
                copied
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
            </button>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>
            This password is shown <strong>only once</strong>. The user must change it on first login.
          </span>
        </div>

        {/* Done button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}

export default TempPasswordModal