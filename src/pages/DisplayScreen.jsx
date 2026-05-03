import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = 'http://localhost:5001'
const API = 'http://localhost:5001/api/patients'

export default function DisplayScreen({ onBack }) {
  const [nowServing, setNowServing] = useState(null)
  const [waitingCount, setWaitingCount] = useState(0)
  const [fetchError, setFetchError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [flash, setFlash] = useState(false)
  const prevTokenRef = useRef(null)
  const socketRef = useRef(null)

  const processPatients = (allPatients) => {
    const waiting = allPatients.filter(p => p.status === 'waiting')
    const current = waiting[0] || null

    if (current && prevTokenRef.current !== null && prevTokenRef.current !== current.tokenNumber) {
      setFlash(true)
      setTimeout(() => setFlash(false), 1000)
    }
    prevTokenRef.current = current ? current.tokenNumber : null

    setNowServing(current)
    setWaitingCount(waiting.length)
    setLastUpdated(new Date())
    setFetchError(false)
  }

  useEffect(() => {
    // initial HTTP fetch
    fetch(API)
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(data => processPatients(data.data))
      .catch(() => setFetchError(true))

    // socket
    const socket = io(SOCKET_URL, { transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => setFetchError(false))
    socket.on('disconnect', () => setFetchError(true))
    socket.on('queueUpdated', (allPatients) => processPatients(allPatients))

    return () => socket.disconnect()
  }, [])

  const timeText = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  return (
    <div style={s.screen}>

      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerLogo}>🏥</span>
          <div>
            <p style={s.headerTitle}>Clinic Queue</p>
            <p style={s.headerSub}>Queue Management System</p>
          </div>
        </div>
        <div style={s.headerRight}>
          <div style={{ ...s.statusDot, background: fetchError ? '#fc8181' : '#68d391' }} />
          <p style={s.headerTime}>{fetchError ? 'Offline' : `Updated ${timeText}`}</p>
          <button style={s.exitBtn} onClick={onBack}>✕ Exit</button>
        </div>
      </div>

      <div style={s.main}>
        {fetchError ? (
          <div style={s.errorBox}>
            <p style={s.errorIcon}>⚠️</p>
            <p style={s.errorTitle}>Cannot reach server</p>
            <p style={s.errorSub}>Reconnecting automatically...</p>
          </div>
        ) : nowServing ? (
          <div style={{
            ...s.tokenBox,
            background: flash
              ? 'linear-gradient(135deg, #276749, #38a169)'
              : 'linear-gradient(135deg, #1a365d, #2b6cb0)',
            transition: 'background 0.5s ease',
          }}>
            <p style={s.nowServingLabel}>NOW SERVING — ابھی بلایا جا رہا ہے</p>
            <div style={s.tokenNumber}>{nowServing.tokenNumber}</div>
            <p style={s.patientName}>{nowServing.patientName}</p>
            {nowServing.notes && <p style={s.patientNotes}>{nowServing.notes}</p>}
            <div style={s.tokenDivider} />
            <p style={s.pleaseText}>Please proceed to the doctor's room</p>
            <p style={s.pleaseTextUrdu}>براہ کرم ڈاکٹر کے کمرے میں تشریف لے جائیں</p>
          </div>
        ) : (
          <div style={s.emptyBox}>
            <p style={s.emptyIcon}>✅</p>
            <p style={s.emptyTitle}>Queue is Empty</p>
            <p style={s.emptyUrdu}>کوئی مریض نہیں — تمام مریض مکمل</p>
          </div>
        )}

        {!fetchError && (
          <div style={s.waitingCard}>
            <span style={s.waitingNum}>{waitingCount}</span>
            <span style={s.waitingLabel}>Patients Waiting — انتظار میں مریض</span>
          </div>
        )}
      </div>

      <div style={s.footer}>
        <p style={s.footerText}>Please wait for your token number to be called</p>
        <p style={s.footerUrdu}>براہ کرم اپنے ٹوکن نمبر کا انتظار کریں</p>
      </div>

    </div>
  )
}

const s = {
  screen: { minHeight: '100vh', background: 'linear-gradient(160deg, #0d1b2a 0%, #1a2f4a 50%, #0d1b2a 100%)', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: 'white', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', flexWrap: 'wrap', gap: 10 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  headerLogo: { fontSize: 32 },
  headerTitle: { fontSize: 16, fontWeight: 700, color: 'white', margin: 0 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  headerTime: { fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 },
  exitBtn: { padding: '6px 14px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', marginLeft: 6 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', gap: 28 },
  tokenBox: { borderRadius: 28, padding: '48px 56px', textAlign: 'center', boxShadow: '0 20px 60px rgba(43,108,176,0.4)', border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: 560 },
  nowServingLabel: { fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 20px 0' },
  tokenNumber: { fontSize: 'clamp(80px, 18vw, 160px)', fontWeight: 900, color: 'white', lineHeight: 1, textShadow: '0 4px 24px rgba(0,0,0,0.3)', marginBottom: 12 },
  patientName: { fontSize: 'clamp(20px, 4vw, 32px)', fontWeight: 700, color: 'rgba(255,255,255,0.9)', margin: '0 0 6px 0' },
  patientNotes: { fontSize: 16, color: 'rgba(255,255,255,0.5)', margin: '0 0 20px 0' },
  tokenDivider: { height: 1, background: 'rgba(255,255,255,0.12)', margin: '20px 0' },
  pleaseText: { fontSize: 16, color: 'rgba(255,255,255,0.7)', margin: '0 0 6px 0' },
  pleaseTextUrdu: { fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 },
  emptyBox: { textAlign: 'center', padding: '48px 40px', background: 'rgba(255,255,255,0.04)', borderRadius: 28, border: '1px solid rgba(255,255,255,0.08)', width: '100%', maxWidth: 560 },
  emptyIcon: { fontSize: 56, margin: '0 0 16px 0' },
  emptyTitle: { fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: '0 0 8px 0' },
  emptyUrdu: { fontSize: 15, color: 'rgba(255,255,255,0.35)', margin: 0 },
  errorBox: { textAlign: 'center', padding: '48px 40px', background: 'rgba(197,48,48,0.1)', borderRadius: 28, border: '1px solid rgba(197,48,48,0.2)', width: '100%', maxWidth: 560 },
  errorIcon: { fontSize: 48, margin: '0 0 16px 0' },
  errorTitle: { fontSize: 22, fontWeight: 700, color: '#fc8181', margin: '0 0 8px 0' },
  errorSub: { fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 },
  waitingCard: { background: 'rgba(43,108,176,0.15)', border: '1px solid rgba(43,108,176,0.3)', borderRadius: 20, padding: '20px 48px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 },
  waitingNum: { fontSize: 48, fontWeight: 900, color: '#90cdf4', lineHeight: 1 },
  waitingLabel: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 },
  footer: { padding: '16px 28px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', background: 'rgba(0,0,0,0.15)' },
  footerText: { fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: '0 0 4px 0' },
  footerUrdu: { fontSize: 12, color: 'rgba(255,255,255,0.2)', margin: 0 },
}