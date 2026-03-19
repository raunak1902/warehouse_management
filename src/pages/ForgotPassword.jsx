import { useState } from 'react'
import { Mail, KeyRound, Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

// Step 1 — Enter email
const StepEmail = ({ onNext, loading, setLoading }) => {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, { email })
      onNext(email)
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center mb-2">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-3">
          <Mail className="w-7 h-7 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Forgot Password?</h2>
        <p className="text-sm text-gray-500 mt-1">Enter your registered email address and we'll send you an OTP.</p>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
          placeholder="your@email.com" required />
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">
        {loading
          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending OTP...</>
          : 'Send OTP'
        }
      </button>
    </form>
  )
}

// Step 2 — Enter OTP
const StepOtp = ({ email, onNext, onBack, loading, setLoading }) => {
  const [otp, setOtp]     = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await axios.post(`${API_URL}/api/auth/verify-otp`, { email, otp })
      onNext(res.data.resetToken)
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center mb-2">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-100 rounded-full mb-3">
          <KeyRound className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Enter OTP</h2>
        <p className="text-sm text-gray-500 mt-1">
          A 6-digit OTP was sent to <span className="font-semibold text-gray-700">{email}</span>. Valid for 10 minutes.
        </p>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">6-Digit OTP</label>
        <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-center text-2xl font-bold tracking-widest"
          placeholder="000000" maxLength={6} required />
      </div>
      <button type="submit" disabled={loading || otp.length !== 6}
        className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">
        {loading
          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Verifying...</>
          : 'Verify OTP'
        }
      </button>
      <button type="button" onClick={onBack} className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
        <ArrowLeft size={14} /> Try a different email
      </button>
    </form>
  )
}

// Step 3 — Set new password
const StepNewPassword = ({ email, resetToken, onSuccess, loading, setLoading }) => {
  const [form, setForm]     = useState({ newPassword: '', confirmPassword: '' })
  const [showPw, setShowPw] = useState({ new: false, confirm: false })
  const [error, setError]   = useState('')

  const rules = [
    { label: 'At least 8 characters', ok: form.newPassword.length >= 8 },
    { label: 'Contains a letter',     ok: /[A-Za-z]/.test(form.newPassword) },
    { label: 'Contains a number',     ok: /[0-9]/.test(form.newPassword) },
    { label: 'Passwords match',       ok: form.newPassword.length > 0 && form.newPassword === form.confirmPassword },
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.newPassword !== form.confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await axios.post(`${API_URL}/api/auth/reset-password`, {
        email, resetToken, newPassword: form.newPassword, confirmPassword: form.confirmPassword,
      })
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please start over.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-2">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-100 rounded-full mb-3">
          <Lock className="w-7 h-7 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Set New Password</h2>
        <p className="text-sm text-gray-500 mt-1">Choose a strong password for your account.</p>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
        <div className="relative">
          <input type={showPw.new ? 'text' : 'password'} value={form.newPassword}
            onChange={e => setForm({ ...form, newPassword: e.target.value })}
            className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
            placeholder="Choose a strong password" required />
          <button type="button" onClick={() => setShowPw(p => ({ ...p, new: !p.new }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPw.new ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
        <div className="relative">
          <input type={showPw.confirm ? 'text' : 'password'} value={form.confirmPassword}
            onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
            className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
            placeholder="Repeat your new password" required />
          <button type="button" onClick={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPw.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      {form.newPassword && (
        <ul className="space-y-1 bg-gray-50 rounded-xl p-3">
          {rules.map((r, i) => (
            <li key={i} className={`flex items-center gap-2 text-xs font-medium ${r.ok ? 'text-emerald-600' : 'text-gray-400'}`}>
              <CheckCircle size={12} className={r.ok ? 'text-emerald-500' : 'text-gray-300'} />
              {r.label}
            </li>
          ))}
        </ul>
      )}
      <button type="submit" disabled={loading || !rules.every(r => r.ok)}
        className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">
        {loading
          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Resetting...</>
          : 'Reset Password'
        }
      </button>
    </form>
  )
}

// ── Main ForgotPassword page ──────────────────────────────────────────────────
const ForgotPassword = () => {
  const navigate          = useNavigate()
  const [step, setStep]   = useState(1)  // 1=email, 2=otp, 3=new password, 4=done
  const [email, setEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [loading, setLoading]       = useState(false)

  if (step === 4) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h2>
          <p className="text-gray-500 mb-6">Your password has been reset successfully.</p>
          <button onClick={() => navigate('/login')}
            className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700">
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step > s ? 'bg-emerald-500 text-white' : step === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {step > s ? <CheckCircle size={14} /> : s}
              </div>
              {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <StepEmail
            onNext={(em) => { setEmail(em); setStep(2) }}
            loading={loading} setLoading={setLoading}
          />
        )}
        {step === 2 && (
          <StepOtp
            email={email}
            onNext={(token) => { setResetToken(token); setStep(3) }}
            onBack={() => setStep(1)}
            loading={loading} setLoading={setLoading}
          />
        )}
        {step === 3 && (
          <StepNewPassword
            email={email} resetToken={resetToken}
            onSuccess={() => setStep(4)}
            loading={loading} setLoading={setLoading}
          />
        )}

        <button onClick={() => navigate('/login')}
          className="w-full mt-4 text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
          <ArrowLeft size={13} /> Back to Login
        </button>
      </div>
    </div>
  )
}

export default ForgotPassword