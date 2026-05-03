import { useState, useEffect } from 'react'
import './App.css'
import PatientPage from './pages/PatientPage'
import DoctorPage from './pages/DoctorPage'
import DisplayScreen from './pages/DisplayScreen'

const API = 'http://localhost:5001'
export const APP_NAME = 'Clinic Queue'

export default function App() {
  const [role, setRole] = useState(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [verifyError, setVerifyError] = useState(false)

  useEffect(() => {
    const savedRole = sessionStorage.getItem('userRole')
    const token = sessionStorage.getItem('doctorToken')

    if (savedRole === 'patient') {
      setRole('patient')
      setCheckingAuth(false)
    } else if (savedRole === 'display') {
      setRole('display')
      setCheckingAuth(false)
    } else if (savedRole === 'doctor' && token) {
      verifyToken(token)
    } else {
      setCheckingAuth(false)
    }
  }, [])

  const verifyToken = async (token) => {
    setCheckingAuth(true)
    setVerifyError(false)
    try {
      const res = await fetch(`${API}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Server error')
      const data = await res.json()
      if (data.success) {
        setRole('doctor')
        setIsLoggedIn(true)
      } else {
        sessionStorage.removeItem('doctorToken')
        sessionStorage.removeItem('userRole')
        setRole(null)
        setIsLoggedIn(false)
      }
    } catch {
      setVerifyError(true)
      setRole(null)
      setIsLoggedIn(false)
    }
    setCheckingAuth(false)
  }

  const handleLogin = async () => {
    if (!password.trim()) {
      setLoginError('Please enter password')
      return
    }
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      if (!res.ok) {
        setLoginError('Server error. Please try again.')
        setLoginLoading(false)
        return
      }
      const data = await res.json()
      if (data.success) {
        sessionStorage.setItem('doctorToken', data.token)
        sessionStorage.setItem('userRole', 'doctor')
        setIsLoggedIn(true)
        setPassword('')
        setLoginError('')
      } else {
        setLoginError(data.message || 'Incorrect password')
      }
    } catch {
      setLoginError('Cannot reach server. Check your connection.')
    }
    setLoginLoading(false)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('doctorToken')
    sessionStorage.removeItem('userRole')
    setIsLoggedIn(false)
    setRole(null)
    setPassword('')
    setLoginError('')
  }

  const handlePatientChoice = () => {
    sessionStorage.setItem('userRole', 'patient')
    setRole('patient')
  }

  const handleDoctorChoice = () => {
    setRole('doctor')
  }

  const handleDisplayChoice = () => {
    sessionStorage.setItem('userRole', 'display')
    setRole('display')
  }

  const handleBack = () => {
    sessionStorage.removeItem('userRole')
    sessionStorage.removeItem('doctorToken')
    setRole(null)
    setIsLoggedIn(false)
    setPassword('')
    setLoginError('')
    setVerifyError(false)
  }

  // ── LOADING SCREEN ────────────────────────────────────────
  if (checkingAuth) {
    return (
      <div className="app">
        <div className="role-screen">
          <div className="role-loading">
            <div className="role-logo">🏥</div>
            <p style={{ color: '#a0aec0', fontSize: 14, marginTop: 12 }}>Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  // ── SERVER ERROR ON VERIFY ────────────────────────────────
  if (verifyError) {
    return (
      <div className="app">
        <div className="role-screen">
          <div className="role-card">
            <div className="role-header">
              <div className="role-logo">⚠️</div>
              <h1 className="role-title" style={{ color: '#c53030' }}>Server Unreachable</h1>
              <p className="role-sub">Cannot connect to the clinic server</p>
              <div className="role-divider" />
            </div>
            <div style={{
              background: '#fff5f5',
              border: '1px solid #fed7d7',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 16,
              fontSize: 13,
              color: '#742a2a',
              lineHeight: 1.6,
            }}>
              <p>Make sure the backend server is running on <strong>port 5001</strong> and try again.</p>
            </div>
            <button
              style={{
                width: '100%', padding: '13px',
                background: '#2b6cb0', color: 'white',
                borderRadius: 10, fontSize: 15, fontWeight: 600,
                cursor: 'pointer', marginBottom: 10, border: 'none',
              }}
              onClick={() => {
                const token = sessionStorage.getItem('doctorToken')
                if (token) verifyToken(token)
              }}
            >
              Retry Connection
            </button>
            <button style={ls.backBtn} onClick={handleBack}>
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── DISPLAY SCREEN (fullscreen, no nav) ───────────────────
  if (role === 'display') {
    return <DisplayScreen onBack={handleBack} />
  }

  // ── ROLE SELECTION SCREEN ─────────────────────────────────
  if (!role) {
    return (
      <div className="app">
        <div className="role-screen">
          <div className="role-card">
            <div className="role-header">
              <div className="role-logo">🏥</div>
              <h1 className="role-title">{APP_NAME}</h1>
              <p className="role-sub">Queue Management System</p>
              <div className="role-divider" />
              <p className="role-question">آپ کون ہیں؟ — Who are you?</p>
            </div>

            <div className="role-buttons">
              <button className="role-btn role-btn-patient" onClick={handlePatientChoice}>
                <span className="role-btn-icon">🧍</span>
                <div>
                  <p className="role-btn-title">مریض</p>
                  <p className="role-btn-sub">Patient — Get Token</p>
                </div>
              </button>

              <button className="role-btn role-btn-doctor" onClick={handleDoctorChoice}>
                <span className="role-btn-icon">👨‍⚕️</span>
                <div>
                  <p className="role-btn-title">ڈاکٹر / عملہ</p>
                  <p className="role-btn-sub">Doctor / Staff — Manage Queue</p>
                </div>
              </button>

              <button className="role-btn role-btn-display" onClick={handleDisplayChoice}>
                <span className="role-btn-icon">📺</span>
                <div>
                  <p className="role-btn-title">Display Screen</p>
                  <p className="role-btn-sub">Waiting room TV — Now Serving</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── DOCTOR PASSWORD SCREEN ────────────────────────────────
  if (role === 'doctor' && !isLoggedIn) {
    return (
      <div className="app">
        <div className="role-screen">
          <div className="role-card">
            <div className="role-header">
              <div className="role-logo">🔒</div>
              <h1 className="role-title">Doctor Access</h1>
              <p className="role-sub">ڈاکٹر پینل — پاس ورڈ درکار ہے</p>
              <div className="role-divider" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={ls.label}>Password</label>
              <input
                style={{
                  ...ls.input,
                  border: loginError ? '1.5px solid #fc8181' : '1.5px solid #e2e8f0',
                }}
                type="password"
                placeholder="Enter clinic password"
                value={password}
                onChange={e => { setPassword(e.target.value); setLoginError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoFocus
              />
            </div>

            {loginError && (
              <div style={ls.error}>{loginError}</div>
            )}

            <button
              style={{ ...ls.btn, opacity: loginLoading ? 0.7 : 1 }}
              onClick={handleLogin}
              disabled={loginLoading}
            >
              {loginLoading ? 'Checking...' : 'Login to Doctor Panel'}
            </button>

            <button style={ls.backBtn} onClick={handleBack}>
              ← Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── MAIN APP (role chosen) ────────────────────────────────
  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">
          <div className="logo">🏥</div>
          <div>
            <h1>{APP_NAME}</h1>
            <p>Queue Management System</p>
          </div>
        </div>
        <div className="nav-tabs">
          {role === 'patient' && (
            <button className="nav-tab" onClick={handleBack}>
              ← Back
            </button>
          )}
          {role === 'doctor' && isLoggedIn && (
            <button
              className="nav-tab"
              onClick={handleLogout}
              style={{ background: '#fff5f5', color: '#c53030', border: '1.5px solid #fed7d7' }}
            >
              Logout
            </button>
          )}
        </div>
      </nav>

      <main>
        {role === 'patient' && <PatientPage />}
        {role === 'doctor' && isLoggedIn && <DoctorPage />}
      </main>
    </div>
  )
}

const ls = {
  label: {
    display: 'block',
    fontSize: 14,
    fontWeight: 600,
    color: '#2d3748',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1.5px solid #e2e8f0',
    fontSize: 15,
    background: '#f7fafc',
    color: '#2d3748',
    outline: 'none',
    boxSizing: 'border-box',
  },
  error: {
    background: '#fff5f5',
    border: '1px solid #fed7d7',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#c53030',
    fontSize: 14,
    marginBottom: 14,
  },
  btn: {
    width: '100%',
    padding: '13px',
    background: '#2b6cb0',
    color: 'white',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 10,
    border: 'none',
  },
  backBtn: {
    width: '100%',
    padding: '11px',
    background: 'white',
    color: '#718096',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    border: '1.5px solid #e2e8f0',
    cursor: 'pointer',
  },
}