import { useState, useEffect } from 'react'
import './App.css'
import PatientPage from './pages/PatientPage'
import DoctorPage from './pages/DoctorPage'
import DisplayScreen from './pages/DisplayScreen'

const API = 'http://localhost:5001'
export const APP_NAME = 'Clinic Queue'

export const DEMO_PATIENTS = [
  { _id: 'd1', tokenNumber: 1, patientName: 'Ahmad Raza', phone: '03001234567', notes: 'Fever', status: 'waiting' },
  { _id: 'd2', tokenNumber: 2, patientName: 'Fatima Bibi', phone: '03019876543', notes: 'Follow-up', status: 'waiting' },
  { _id: 'd3', tokenNumber: 3, patientName: 'Usman Khan', phone: '', notes: 'Headache', status: 'waiting' },
  { _id: 'd4', tokenNumber: 4, patientName: 'Zara Malik', phone: '03331112233', notes: '', status: 'waiting' },
  { _id: 'd5', tokenNumber: 5, patientName: 'Bilal Ahmed', phone: '', notes: 'Checkup', status: 'waiting' },
  { _id: 'd6', tokenNumber: 6, patientName: 'Sana Iqbal', phone: '03451234567', notes: 'BP issue', status: 'done' },
  { _id: 'd7', tokenNumber: 7, patientName: 'Tariq Mehmood', phone: '', notes: 'Diabetes', status: 'done' },
]

export default function App() {
  const [role, setRole] = useState(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [verifyError, setVerifyError] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  // demoRoleScreen = true means show the demo role picker
  const [demoRoleScreen, setDemoRoleScreen] = useState(false)

  useEffect(() => {
    const savedRole = sessionStorage.getItem('userRole')
    const token = sessionStorage.getItem('doctorToken')
    const demo = sessionStorage.getItem('demoMode') === 'true'

    if (demo) {
      setIsDemo(true)
      if (savedRole === 'patient') { setRole('patient'); setCheckingAuth(false) }
      else if (savedRole === 'doctor') { setRole('doctor'); setIsLoggedIn(true); setCheckingAuth(false) }
      else if (savedRole === 'display') { setRole('display'); setCheckingAuth(false) }
      else { setDemoRoleScreen(true); setCheckingAuth(false) }
      return
    }

    if (savedRole === 'patient') {
      setRole('patient'); setCheckingAuth(false)
    } else if (savedRole === 'display') {
      setRole('display'); setCheckingAuth(false)
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
        setRole('doctor'); setIsLoggedIn(true)
      } else {
        sessionStorage.removeItem('doctorToken')
        sessionStorage.removeItem('userRole')
        setRole(null); setIsLoggedIn(false)
      }
    } catch {
      setVerifyError(true); setRole(null); setIsLoggedIn(false)
    }
    setCheckingAuth(false)
  }

  const handleLogin = async () => {
    if (!password.trim()) { setLoginError('Please enter password'); return }
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      if (!res.ok) { setLoginError('Server error. Please try again.'); setLoginLoading(false); return }
      const data = await res.json()
      if (data.success) {
        sessionStorage.setItem('doctorToken', data.token)
        sessionStorage.setItem('userRole', 'doctor')
        setIsLoggedIn(true); setPassword(''); setLoginError('')
      } else {
        setLoginError(data.message || 'Incorrect password')
      }
    } catch {
      setLoginError('Cannot reach server. Check your connection.')
    }
    setLoginLoading(false)
  }

  const handleLogout = () => {
    sessionStorage.clear()
    setIsLoggedIn(false); setRole(null)
    setPassword(''); setLoginError('')
    setIsDemo(false); setDemoRoleScreen(false)
  }

  const handlePatientChoice = () => {
    sessionStorage.setItem('userRole', 'patient')
    setRole('patient')
  }

  const handleDoctorChoice = () => { setRole('doctor') }

  const handleDisplayChoice = () => {
    sessionStorage.setItem('userRole', 'display')
    setRole('display')
  }

  // Enter demo — show demo role picker
  const handleDemoMode = () => {
    sessionStorage.setItem('demoMode', 'true')
    setIsDemo(true)
    setDemoRoleScreen(true)
    setRole(null)
  }

  // Demo role picker choices
  const handleDemoDoctor = () => {
    sessionStorage.setItem('userRole', 'doctor')
    setDemoRoleScreen(false)
    setRole('doctor')
    setIsLoggedIn(true)
  }

  const handleDemoPatient = () => {
    sessionStorage.setItem('userRole', 'patient')
    setDemoRoleScreen(false)
    setRole('patient')
  }

  const handleDemoDisplay = () => {
    sessionStorage.setItem('userRole', 'display')
    setDemoRoleScreen(false)
    setRole('display')
  }

  const handleBack = () => {
    sessionStorage.clear()
    setRole(null); setIsLoggedIn(false)
    setPassword(''); setLoginError('')
    setVerifyError(false); setIsDemo(false)
    setDemoRoleScreen(false)
  }

  // Back inside demo — go back to demo role picker
  const handleDemoBack = () => {
    sessionStorage.removeItem('userRole')
    setRole(null)
    setIsLoggedIn(false)
    setDemoRoleScreen(true)
  }

  // ── LOADING ───────────────────────────────────────────────
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

  // ── SERVER ERROR ──────────────────────────────────────────
  if (verifyError && !isDemo) {
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
            <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 12, padding: '14px 16px', marginBottom: 16, fontSize: 13, color: '#742a2a', lineHeight: 1.6 }}>
              <p>Make sure the backend server is running on <strong>port 5001</strong> and try again.</p>
            </div>
            <button style={{ width: '100%', padding: '13px', background: '#2b6cb0', color: 'white', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 10, border: 'none' }}
              onClick={() => { const token = sessionStorage.getItem('doctorToken'); if (token) verifyToken(token) }}>
              Retry Connection
            </button>
            <button style={{ ...ls.backBtn, marginBottom: 10 }} onClick={handleBack}>← Back to Home</button>
            <button style={{ ...ls.backBtn, background: '#fffbeb', color: '#744210', border: '1.5px solid #fbd38d' }} onClick={handleDemoMode}>
              🎭 Try Demo Mode Instead
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── DISPLAY SCREEN ────────────────────────────────────────
  if (role === 'display') {
    return <DisplayScreen onBack={isDemo ? handleDemoBack : handleBack} isDemo={isDemo} />
  }

  // ── DEMO ROLE PICKER ──────────────────────────────────────
  if (isDemo && demoRoleScreen) {
    return (
      <div className="app">
        <div className="role-screen">
          <div className="role-card">
            <div className="role-header">
              <div style={{ background: '#744210', color: 'white', borderRadius: 10, padding: '4px 14px', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', display: 'inline-block', marginBottom: 12 }}>
                🎭 DEMO MODE
              </div>
              <div className="role-logo">🏥</div>
              <h1 className="role-title">{APP_NAME}</h1>
              <p className="role-sub">Demo — No server needed</p>
              <div className="role-divider" />
              <p className="role-question">What do you want to try?</p>
            </div>

            <div className="role-buttons">
              <button className="role-btn role-btn-patient" onClick={handleDemoPatient}>
                <span className="role-btn-icon">🧍</span>
                <div>
                  <p className="role-btn-title">Patient View</p>
                  <p className="role-btn-sub">Register & get token number</p>
                </div>
              </button>

              <button className="role-btn role-btn-doctor" onClick={handleDemoDoctor}>
                <span className="role-btn-icon">👨‍⚕️</span>
                <div>
                  <p className="role-btn-title">Doctor Panel</p>
                  <p className="role-btn-sub">Manage queue, call patients</p>
                </div>
              </button>

              <button className="role-btn role-btn-display" onClick={handleDemoDisplay}>
                <span className="role-btn-icon">📺</span>
                <div>
                  <p className="role-btn-title">Display Screen</p>
                  <p className="role-btn-sub">Waiting room TV view</p>
                </div>
              </button>
            </div>

            <button style={{ ...ls.backBtn, marginTop: 14 }} onClick={handleBack}>
              ← Exit Demo
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── MAIN ROLE SELECTION ───────────────────────────────────
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

              <button className="role-btn role-btn-demo" onClick={handleDemoMode}>
                <span className="role-btn-icon">🎭</span>
                <div>
                  <p className="role-btn-title">Demo Mode</p>
                  <p className="role-btn-sub">Try the app — no server needed</p>
                </div>
              </button>
            </div>

            {/* ── BUILT BY FOOTER ── */}
            <div style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid #f0f4f8',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 11, color: '#a0aec0', marginBottom: 3 }}>
                Built by <strong style={{ color: '#4a5568' }}>Abdul-Salam</strong>
              </p>
              <p style={{ fontSize: 11, color: '#a0aec0' }}>
                📞 0310-3698984 &nbsp;•&nbsp; ✉️ abdulsalamtech2@gmail.com
              </p>
            </div>

          </div>
        </div>
      </div>
    )
  }

  // ── DOCTOR PASSWORD ───────────────────────────────────────
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
                style={{ ...ls.input, border: loginError ? '1.5px solid #fc8181' : '1.5px solid #e2e8f0' }}
                type="password"
                placeholder="Enter clinic password"
                value={password}
                onChange={e => { setPassword(e.target.value); setLoginError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoFocus
              />
            </div>
            {loginError && <div style={ls.error}>{loginError}</div>}
            <button style={{ ...ls.btn, opacity: loginLoading ? 0.7 : 1 }} onClick={handleLogin} disabled={loginLoading}>
              {loginLoading ? 'Checking...' : 'Login to Doctor Panel'}
            </button>
            <button style={ls.backBtn} onClick={handleBack}>← Back</button>
          </div>
        </div>
      </div>
    )
  }

  // ── MAIN APP ──────────────────────────────────────────────
  return (
    <div className="app">
      {isDemo && (
        <div style={{
          background: '#744210', color: 'white', textAlign: 'center',
          padding: '6px 16px', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px',
        }}>
          🎭 DEMO MODE — Data is not saved. This is a live preview for demonstration.
        </div>
      )}
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
            <button className="nav-tab" onClick={isDemo ? handleDemoBack : handleBack}>
              ← Back
            </button>
          )}
          {role === 'doctor' && isLoggedIn && (
            <button className="nav-tab" onClick={isDemo ? handleDemoBack : handleLogout}
              style={{ background: '#fff5f5', color: '#c53030', border: '1.5px solid #fed7d7' }}>
              {isDemo ? '← Demo Menu' : 'Logout'}
            </button>
          )}
        </div>
      </nav>
      <main>
        {role === 'patient' && <PatientPage isDemo={isDemo} />}
        {role === 'doctor' && isLoggedIn && <DoctorPage isDemo={isDemo} />}
      </main>
    </div>
  )
}

const ls = {
  label: { display: 'block', fontSize: 14, fontWeight: 600, color: '#2d3748', marginBottom: 6 },
  input: { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 15, background: '#f7fafc', color: '#2d3748', outline: 'none', boxSizing: 'border-box' },
  error: { background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 10, padding: '10px 14px', color: '#c53030', fontSize: 14, marginBottom: 14 },
  btn: { width: '100%', padding: '13px', background: '#2b6cb0', color: 'white', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 10, border: 'none' },
  backBtn: { width: '100%', padding: '11px', background: 'white', color: '#718096', borderRadius: 10, fontSize: 14, fontWeight: 500, border: '1.5px solid #e2e8f0', cursor: 'pointer' },
}