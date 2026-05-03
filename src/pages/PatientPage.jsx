import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'

const API = 'http://localhost:5001/api/patients'
const SOCKET_URL = 'http://localhost:5001'
const MINS_PER_PATIENT = 5

export default function PatientPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [myToken, setMyToken] = useState(null)
  const [queue, setQueue] = useState([])
  const [error, setError] = useState('')
  const [fetchError, setFetchError] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const socketRef = useRef(null)

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480)
  const [isTiny, setIsTiny] = useState(window.innerWidth <= 360)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 480)
      setIsTiny(window.innerWidth <= 360)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ── SOCKET CONNECTION ─────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => {
      setFetchError(false)
    })

    socket.on('disconnect', () => {
      setFetchError(true)
    })

    socket.on('queueUpdated', (allPatients) => {
      setQueue(allPatients.filter(p => p.status === 'waiting'))
      setFetchError(false)
    })

    // initial fetch via HTTP as backup
    fetchQueue()

    return () => {
      socket.disconnect()
    }
  }, [])

  const fetchQueue = async () => {
    try {
      const res = await axios.get(API)
      setQueue(res.data.data.filter(p => p.status === 'waiting'))
      setFetchError(false)
    } catch (err) {
      console.error(err)
      setFetchError(true)
    }
  }

  const handleRetry = async () => {
    setRetrying(true)
    await fetchQueue()
    setRetrying(false)
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('براہ کرم اپنا نام لکھیں — Please enter your name')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${API}/add-patient`, {
        patientName: name, phone, notes,
      })
      setMyToken(res.data.data)
    } catch (err) {
      if (!err.response) {
        setError('Server not reachable. Check your connection and try again.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    }
    setLoading(false)
  }

  const myPosition = queue.findIndex(p => p._id === myToken?._id) + 1
  const isMyTurn = myPosition === 1
  const patientsAhead = myPosition > 1 ? myPosition - 1 : 0
  const estimatedMins = patientsAhead * MINS_PER_PATIENT

  const getWaitText = () => {
    if (estimatedMins === 0) return null
    if (estimatedMins < 10) return 'Less than 10 minutes'
    if (estimatedMins < 20) return 'About 10–20 minutes'
    if (estimatedMins < 30) return 'About 20–30 minutes'
    if (estimatedMins < 60) return `About ${Math.round(estimatedMins / 10) * 10} minutes`
    const hrs = Math.floor(estimatedMins / 60)
    const mins = estimatedMins % 60
    if (mins === 0) return `About ${hrs} hour${hrs > 1 ? 's' : ''}`
    return `About ${hrs} hr ${mins} min`
  }

  const waitText = getWaitText()

  if (myToken) {
    return (
      <div className="page">

        {isMyTurn && (
          <div style={s.turnBanner}>
            <div style={s.turnBannerDot} />
            <div>
              <p style={s.turnBannerTitle}>آپ کی باری آ گئی</p>
              <p style={s.turnBannerSub}>Please proceed to the doctor's room</p>
            </div>
          </div>
        )}

        {fetchError && (
          <div style={s.fetchErrBanner}>
            <span style={s.fetchErrText}>⚠️ Connection lost — queue may be outdated</span>
            <button style={s.fetchErrBtn} onClick={handleRetry} disabled={retrying}>
              {retrying ? '...' : 'Retry'}
            </button>
          </div>
        )}

        <div style={s.tokenCard}>
          <div style={{
            ...s.tokenCardTop,
            flexDirection: isTiny ? 'column' : 'row',
            alignItems: isTiny ? 'flex-start' : 'center',
            gap: isTiny ? 12 : undefined,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={s.tokenCardLabel}>Queue Number</p>
              <p style={{ ...s.tokenCardName, fontSize: isMobile ? 17 : 20, wordBreak: 'break-word' }}>
                {myToken.patientName}
              </p>
              {myToken.phone && <p style={s.tokenCardPhone}>{myToken.phone}</p>}
            </div>
            <div style={{
              ...s.tokenBig,
              background: isMyTurn ? '#38a169' : '#2b6cb0',
              width: isTiny ? 60 : 72,
              height: isTiny ? 60 : 72,
              fontSize: isTiny ? 24 : 30,
              borderRadius: isTiny ? 12 : 16,
            }}>
              {myToken.tokenNumber}
            </div>
          </div>

          <div style={s.tokenDivider} />

          {isMyTurn ? (
            <div style={s.statusRow}>
              <div style={{ ...s.statusDot, background: '#38a169' }} />
              <span style={{ ...s.statusText, color: '#276749', fontWeight: 600 }}>
                It's your turn now
              </span>
            </div>
          ) : (
            <div>
              <div style={s.statusRow}>
                <div style={{ ...s.statusDot, background: '#ed8936' }} />
                <span style={s.statusText}>
                  <strong style={{ color: '#2d3748' }}>{patientsAhead}</strong>
                  <span style={{ color: '#718096' }}> patient(s) ahead of you — آپ سے پہلے</span>
                </span>
              </div>

              {waitText && (
                <div style={{
                  ...s.waitTimeBox,
                  flexDirection: isTiny ? 'column' : 'row',
                  gap: isTiny ? 6 : undefined,
                }}>
                  <div style={s.waitTimeLeft}>
                    <p style={s.waitTimeLabel}>Estimated Wait</p>
                    <p style={{ ...s.waitTimeValue, fontSize: isMobile ? 13 : 15 }}>{waitText}</p>
                  </div>
                  <div style={{ ...s.waitTimeRight, textAlign: isTiny ? 'left' : 'right' }}>
                    <p style={s.waitTimeUrdu}>تقریباً انتظار</p>
                    <p style={{ ...s.waitTimeMins, fontSize: isMobile ? 15 : 18 }}>~{estimatedMins} min</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={s.queueCard}>
          <p style={s.queueCardTitle}>Queue Status</p>
          {queue.length === 0 && !fetchError ? (
            <p style={s.queueEmpty}>No patients in queue</p>
          ) : fetchError && queue.length === 0 ? (
            <p style={s.queueEmpty}>Could not load queue</p>
          ) : (
            queue.map((p, i) => (
              <div key={p._id} style={{
                ...s.queueItem,
                background: p._id === myToken._id ? '#f0f7ff' : 'white',
              }}>
                <div style={s.queueItemLeft}>
                  <span style={{
                    ...s.queueNum,
                    background: i === 0 ? '#2b6cb0' : '#edf2f7',
                    color: i === 0 ? 'white' : '#4a5568',
                  }}>
                    {p.tokenNumber}
                  </span>
                  <span style={{
                    ...s.queueItemName,
                    fontWeight: p._id === myToken._id ? 700 : 500,
                    color: p._id === myToken._id ? '#2b6cb0' : '#4a5568',
                    fontSize: isMobile ? 13 : 14,
                  }}>
                    {p.patientName}
                    {p._id === myToken._id && <span style={s.youTag}> — آپ</span>}
                  </span>
                </div>
                {i === 0 && <span style={s.nowTag}>Now</span>}
              </div>
            ))
          )}
        </div>

        <button style={s.newPatientBtn} onClick={() => {
          setMyToken(null)
          setName('')
          setPhone('')
          setNotes('')
          setQueue([])
          setFetchError(false)
        }}>
          Register New Patient
        </button>

      </div>
    )
  }

  return (
    <div className="page">
      <div style={{
        ...s.formCard,
        padding: isTiny ? '20px 14px' : isMobile ? '22px 18px' : '28px 24px',
        borderRadius: isMobile ? 14 : 16,
      }}>
        <div style={s.formTop}>
          <h2 style={{ ...s.formTitle, fontSize: isMobile ? 22 : 26 }}>اپنا نمبر لیں</h2>
          <p style={s.formSub}>Fill in your details to join the queue</p>
        </div>

        <div style={s.field}>
          <label style={s.label}>نام <span style={{ color: '#e53e3e' }}>*</span></label>
          <p style={s.labelSub}>Full Name</p>
          <input
            style={{
              ...s.input,
              border: error && !name.trim() ? '1.5px solid #fc8181' : '1.5px solid #e2e8f0',
            }}
            placeholder="Enter your full name"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>موبائل نمبر</label>
          <p style={s.labelSub}>Phone Number (optional)</p>
          <input
            style={s.input}
            placeholder="03001234567"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>تکلیف</label>
          <p style={s.labelSub}>Problem / Reason for Visit (optional)</p>
          <input
            style={s.input}
            placeholder="e.g. Fever, Headache"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {error && <div style={s.errorBox}>{error}</div>}

        <button
          style={{ ...s.submitBtn, opacity: loading ? 0.8 : 1 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Please wait...' : 'Get Token Number'}
        </button>
      </div>
    </div>
  )
}

const s = {
  turnBanner: {
    background: '#38a169', borderRadius: 14, padding: '14px 18px',
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
  },
  turnBannerDot: { width: 10, height: 10, borderRadius: '50%', background: 'white', flexShrink: 0 },
  turnBannerTitle: { color: 'white', fontWeight: 700, fontSize: 15 },
  turnBannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  fetchErrBanner: {
    background: '#fffbeb', border: '1.5px solid #fbd38d', borderRadius: 12,
    padding: '10px 14px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 10, marginBottom: 10,
  },
  fetchErrText: { fontSize: 13, color: '#744210', fontWeight: 500 },
  fetchErrBtn: {
    padding: '5px 14px', background: '#744210', color: 'white',
    borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none',
    cursor: 'pointer', flexShrink: 0,
  },
  tokenCard: {
    background: 'white', borderRadius: 16, padding: '20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 10,
    border: '1px solid #e2e8f0',
  },
  tokenCardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  tokenCardLabel: { fontSize: 11, color: '#a0aec0', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 },
  tokenCardName: { fontSize: 20, fontWeight: 700, color: '#1a202c' },
  tokenCardPhone: { fontSize: 13, color: '#718096', marginTop: 3 },
  tokenBig: {
    width: 72, height: 72, borderRadius: 16, display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 30,
    fontWeight: 900, color: 'white', flexShrink: 0,
  },
  tokenDivider: { height: 1, background: '#f0f4f8', marginBottom: 14 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  statusText: { fontSize: 14 },
  waitTimeBox: {
    background: '#fffbeb', border: '1px solid #fbd38d', borderRadius: 12,
    padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 4,
  },
  waitTimeLeft: {},
  waitTimeLabel: { fontSize: 11, color: '#975a16', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 },
  waitTimeValue: { fontSize: 15, fontWeight: 700, color: '#744210' },
  waitTimeRight: { textAlign: 'right' },
  waitTimeUrdu: { fontSize: 11, color: '#975a16', marginBottom: 3 },
  waitTimeMins: { fontSize: 18, fontWeight: 800, color: '#c05621' },
  queueCard: {
    background: 'white', borderRadius: 16, padding: '16px 20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 10,
    border: '1px solid #e2e8f0',
  },
  queueCardTitle: { fontSize: 11, color: '#a0aec0', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 12 },
  queueEmpty: { fontSize: 14, color: '#a0aec0', textAlign: 'center', padding: '12px 0' },
  queueItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', borderRadius: 10, marginBottom: 4 },
  queueItemLeft: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  queueNum: { width: 30, height: 30, minWidth: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 },
  queueItemName: { fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  youTag: { fontSize: 12, color: '#2b6cb0', fontWeight: 600 },
  nowTag: { fontSize: 11, fontWeight: 600, color: '#2b6cb0', background: '#ebf4ff', padding: '3px 10px', borderRadius: 20, flexShrink: 0, marginLeft: 6 },
  newPatientBtn: { width: '100%', padding: '12px', background: 'white', color: '#718096', borderRadius: 12, fontSize: 14, fontWeight: 500, border: '1.5px solid #e2e8f0', cursor: 'pointer' },
  formCard: { background: 'white', borderRadius: 16, padding: '28px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  formTop: { textAlign: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid #f0f4f8' },
  formTitle: { fontSize: 26, fontWeight: 700, color: '#1a202c' },
  formSub: { fontSize: 13, color: '#a0aec0', marginTop: 6 },
  field: { marginBottom: 18 },
  label: { fontSize: 15, fontWeight: 600, color: '#2d3748', display: 'block' },
  labelSub: { fontSize: 12, color: '#a0aec0', marginBottom: 6, marginTop: 1 },
  input: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 15, background: '#f7fafc', color: '#2d3748', boxSizing: 'border-box' },
  errorBox: { background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 10, padding: '10px 14px', color: '#c53030', fontSize: 14, marginBottom: 14 },
  submitBtn: { width: '100%', padding: '13px', background: '#2b6cb0', color: 'white', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4, border: 'none' },
}