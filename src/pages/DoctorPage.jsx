import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import { DEMO_PATIENTS } from '../App'

const API = 'http://localhost:5001/api/patients'
const SOCKET_URL = 'http://localhost:5001'
const DEFAULT_AVG_MINS = 5

const playChime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const playTone = (freq, startTime, duration) => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.frequency.value = freq
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.05)
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
      oscillator.start(startTime)
      oscillator.stop(startTime + duration)
    }
    const now = ctx.currentTime
    playTone(880, now, 0.4)
    playTone(660, now + 0.35, 0.5)
  } catch (e) { console.log('Sound not supported:', e) }
}

const announceToken = (tokenNumber) => {
  try {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(`Token number ${tokenNumber}, please come in`)
    utterance.lang = 'en-US'; utterance.rate = 0.85; utterance.pitch = 1; utterance.volume = 1
    setTimeout(() => window.speechSynthesis.speak(utterance), 700)
  } catch (e) { console.log('Speech not supported:', e) }
}

export default function DoctorPage({ isDemo = false }) {
  const [queue, setQueue] = useState([])
  const [doneList, setDoneList] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [actionError, setActionError] = useState('')
  const [fetchError, setFetchError] = useState(false)
  const [addError, setAddError] = useState('')
  const [wrapError, setWrapError] = useState('')
  const [tab, setTab] = useState('waiting')
  const [showSummary, setShowSummary] = useState(false)
  const [wrapLoading, setWrapLoading] = useState(false)
  const [wrapDone, setWrapDone] = useState(false)
  const [summaryData, setSummaryData] = useState(null)
  const [search, setSearch] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showAddPatient, setShowAddPatient] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [calledToken, setCalledToken] = useState(null)
  const [serviceTimes, setServiceTimes] = useState([])
  const lastCallTime = useRef(null)
  const socketRef = useRef(null)
  const demoNextId = useRef(100)
  const demoNextToken = useRef(8)

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

  const avgServiceMins = serviceTimes.length > 0
    ? Math.round(serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length)
    : DEFAULT_AVG_MINS

  // ── DEMO MODE SETUP ───────────────────────────────────────
  useEffect(() => {
    if (isDemo) {
      setQueue(DEMO_PATIENTS.filter(p => p.status === 'waiting'))
      setDoneList(DEMO_PATIENTS.filter(p => p.status === 'done'))
      setLastUpdated(new Date())
      lastCallTime.current = Date.now()
      return
    }

    // ── REAL MODE ─────────────────────────────────────────
    const socket = io(SOCKET_URL, { transports: ['websocket'] })
    socketRef.current = socket
    socket.on('connect', () => setFetchError(false))
    socket.on('disconnect', () => setFetchError(true))
    socket.on('queueUpdated', (allPatients) => {
      setQueue(allPatients.filter(p => p.status === 'waiting'))
      setDoneList(allPatients.filter(p => p.status === 'done'))
      setLastUpdated(new Date())
      setFetchError(false)
    })
    fetchAll()
    lastCallTime.current = Date.now()
    return () => socket.disconnect()
  }, [isDemo])

  useEffect(() => {
    if (actionError) {
      const t = setTimeout(() => setActionError(''), 4000)
      return () => clearTimeout(t)
    }
  }, [actionError])

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await axios.get(API)
      const all = res.data.data
      setQueue(all.filter(p => p.status === 'waiting'))
      setDoneList(all.filter(p => p.status === 'done'))
      setLastUpdated(new Date())
      setFetchError(false)
    } catch (err) {
      setFetchError(true)
    }
    if (!silent) setLoading(false)
  }, [])

  // ── MARK DONE ─────────────────────────────────────────────
  const markDone = async (id) => {
    setActionLoading(id)
    setActionError('')

    if (isDemo) {
      await new Promise(r => setTimeout(r, 400)) // fake delay
      setQueue(prev => {
        const updated = prev.filter(p => p._id !== id)
        const done = prev.find(p => p._id === id)
        if (done) setDoneList(dl => [...dl, { ...done, status: 'done' }])
        const nextUp = updated[1]
        const now = Date.now()
        if (lastCallTime.current) {
          const mins = (now - lastCallTime.current) / 1000 / 60
          if (mins >= 0.01) setServiceTimes(s => [...s, Math.max(1, Math.round(mins))])
        }
        lastCallTime.current = now
        if (updated[0]) {
          playChime()
          announceToken(updated[0].tokenNumber)
          setCalledToken(updated[0].tokenNumber)
          setTimeout(() => setCalledToken(null), 5000)
        } else {
          playChime()
        }
        setLastUpdated(new Date())
        return updated
      })
      setActionLoading(null)
      return
    }

    try {
      const nextUp = queue[1]
      const now = Date.now()
      await axios.put(`${API}/${id}/done`)
      if (lastCallTime.current) {
        const minutesTaken = (now - lastCallTime.current) / 1000 / 60
        if (minutesTaken >= 1 && minutesTaken <= 60) setServiceTimes(prev => [...prev, Math.round(minutesTaken)])
      }
      lastCallTime.current = now
      if (nextUp) {
        playChime(); announceToken(nextUp.tokenNumber)
        setCalledToken(nextUp.tokenNumber)
        setTimeout(() => setCalledToken(null), 5000)
      } else { playChime() }
    } catch (err) {
      setActionError(!err.response ? 'Server not reachable.' : 'Could not update patient.')
    }
    setActionLoading(null)
  }

  // ── DELETE ────────────────────────────────────────────────
  const deletePatient = async (id) => {
    setActionLoading(id)
    setActionError('')

    if (isDemo) {
      await new Promise(r => setTimeout(r, 300))
      setQueue(prev => prev.filter(p => p._id !== id))
      setLastUpdated(new Date())
      setActionLoading(null)
      return
    }

    try {
      await axios.delete(`${API}/${id}`)
    } catch (err) {
      setActionError(!err.response ? 'Server not reachable.' : 'Could not delete patient.')
    }
    setActionLoading(null)
  }

  // ── ADD PATIENT ───────────────────────────────────────────
  const handleAddPatient = async () => {
    if (!newName.trim()) { setAddError('Patient name is required.'); return }
    setAddLoading(true)
    setAddError('')

    if (isDemo) {
      await new Promise(r => setTimeout(r, 400))
      const newPatient = {
        _id: `demo_${demoNextId.current++}`,
        tokenNumber: demoNextToken.current++,
        patientName: newName,
        phone: newPhone,
        notes: newNotes,
        status: 'waiting',
      }
      setQueue(prev => [...prev, newPatient])
      setNewName(''); setNewPhone(''); setNewNotes('')
      setShowAddPatient(false)
      setLastUpdated(new Date())
      setAddLoading(false)
      return
    }

    try {
      await axios.post(`${API}/add-patient`, { patientName: newName, phone: newPhone, notes: newNotes })
      setNewName(''); setNewPhone(''); setNewNotes('')
      setShowAddPatient(false)
    } catch (err) {
      setAddError(!err.response ? 'Server not reachable.' : 'Could not add patient.')
    }
    setAddLoading(false)
  }

  // ── WRAP UP ───────────────────────────────────────────────
  const handleWrapUp = async () => {
    setWrapLoading(true)
    setWrapError('')

    if (isDemo) {
      await new Promise(r => setTimeout(r, 400))
      setSummaryData({
        totalPatients: queue.length + doneList.length,
        totalDone: doneList.length,
        totalWaiting: queue.length,
        donePatients: doneList,
      })
      setShowSummary(true)
      setWrapLoading(false)
      return
    }

    try {
      const res = await axios.get(`${API}/summary`)
      setSummaryData(res.data.data)
      setShowSummary(true)
    } catch (err) {
      setWrapError(!err.response ? 'Server not reachable.' : 'Could not load summary.')
    }
    setWrapLoading(false)
  }

  const handleClearAll = async () => {
    setWrapLoading(true)
    setWrapError('')

    if (isDemo) {
      await new Promise(r => setTimeout(r, 400))
      setQueue([])
      setDoneList([])
      setServiceTimes([])
      lastCallTime.current = null
      demoNextToken.current = 1
      setWrapDone(true)
      setWrapLoading(false)
      return
    }

    try {
      await axios.delete(`${API}/wrap-up/all`)
      setWrapDone(true)
      setServiceTimes([])
      lastCallTime.current = null
    } catch (err) {
      setWrapError(!err.response ? 'Server not reachable.' : 'Could not clear data.')
    }
    setWrapLoading(false)
  }

  const handleNewDay = () => {
    setShowSummary(false); setWrapDone(false)
    setSummaryData(null); setWrapError('')
    if (!isDemo) fetchAll()
  }

  const today = new Date().toLocaleDateString('en-PK', {
    weekday: isMobile ? 'short' : 'long',
    year: isMobile ? undefined : 'numeric',
    month: 'long', day: 'numeric',
  })

  const lastUpdatedText = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  const nextPatient = queue[0]

  const filteredWaiting = queue.filter(p =>
    p.patientName.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search) ||
    p.notes?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredDone = doneList.filter(p =>
    p.patientName.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search) ||
    p.notes?.toLowerCase().includes(search.toLowerCase())
  )

  // ── SUMMARY SCREEN ────────────────────────────────────────
  if (showSummary) {
    if (wrapDone) {
      return (
        <div className="page">
          <div style={{ ...s.summaryCard, padding: isMobile ? '18px 16px' : 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: '#2d3748' }}>Day Complete</h2>
              <p style={{ color: '#718096', fontSize: 14, marginTop: 6 }}>آج کا کام ختم — سب ڈیٹا صاف ہو گیا</p>
            </div>
            <div style={{ ...s.finalStatsRow, gap: isMobile ? 8 : 12 }}>
              <div style={s.finalStat}>
                <span style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: '#276749' }}>{summaryData?.totalDone || 0}</span>
                <span style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>Patients Seen</span>
              </div>
              <div style={s.finalStat}>
                <span style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: '#2b6cb0' }}>{summaryData?.totalPatients || 0}</span>
                <span style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>Total Registered</span>
              </div>
              {serviceTimes.length > 0 && (
                <div style={s.finalStat}>
                  <span style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: '#744210' }}>{avgServiceMins}m</span>
                  <span style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>Avg Per Patient</span>
                </div>
              )}
            </div>
            <button style={s.newDayBtn} onClick={handleNewDay}>Start New Day — نیا دن شروع کریں</button>
          </div>
        </div>
      )
    }

    return (
      <div className="page">
        <div style={{ ...s.summaryCard, padding: isMobile ? '18px 16px' : 24 }}>
          <div style={{ ...s.summaryHeader, flexDirection: isTiny ? 'column' : 'row', alignItems: isTiny ? 'flex-start' : 'center', gap: isTiny ? 10 : undefined }}>
            <div>
              <h2 style={{ ...s.summaryTitle, fontSize: isMobile ? 17 : 20 }}>End of Day Summary</h2>
              <p style={s.summaryDate}>{today}</p>
            </div>
            {serviceTimes.length > 0 && (
              <div style={s.avgBadge}>
                <p style={s.avgBadgeNum}>{avgServiceMins} min</p>
                <p style={s.avgBadgeLabel}>avg/patient</p>
              </div>
            )}
          </div>
          <div style={{ ...s.summaryStatsRow, gap: isMobile ? 8 : 10 }}>
            <div style={{ ...s.summaryStat, background: '#f0fff4', border: '1.5px solid #9ae6b4' }}>
              <span style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: '#276749' }}>{summaryData?.totalDone || 0}</span>
              <span style={{ fontSize: 12, color: '#276749', fontWeight: 600 }}>Completed</span>
            </div>
            <div style={{ ...s.summaryStat, background: '#fffbeb', border: '1.5px solid #fbd38d' }}>
              <span style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: '#744210' }}>{summaryData?.totalWaiting || 0}</span>
              <span style={{ fontSize: 12, color: '#744210', fontWeight: 600 }}>Still Waiting</span>
            </div>
            <div style={{ ...s.summaryStat, background: '#ebf4ff', border: '1.5px solid #90cdf4' }}>
              <span style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: '#2b6cb0' }}>{summaryData?.totalPatients || 0}</span>
              <span style={{ fontSize: 12, color: '#2b6cb0', fontWeight: 600 }}>Total</span>
            </div>
          </div>
          {summaryData?.donePatients?.length > 0 && (
            <div style={s.summaryList}>
              <p style={s.summaryListTitle}>Patients Seen Today</p>
              {summaryData.donePatients.map((p, i) => (
                <div key={i} style={s.summaryRow}>
                  <div style={s.summaryRowLeft}>
                    <span style={s.summaryToken}>{p.tokenNumber}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#2d3748' }}>{p.patientName || p.name}</p>
                      {p.notes && <p style={{ fontSize: 12, color: '#a0aec0' }}>{p.notes}</p>}
                      {p.phone && <p style={{ fontSize: 12, color: '#a0aec0' }}>{p.phone}</p>}
                    </div>
                  </div>
                  <span style={s.donePill}>Done</span>
                </div>
              ))}
            </div>
          )}
          {wrapError && <div style={s.errBox}>{wrapError}</div>}
          <div style={s.wrapWarning}>
            <p style={{ fontSize: isMobile ? 12 : 13, color: '#744210' }}>
              ⚠️ Clicking <strong>"Clear & Start Fresh"</strong> will permanently delete all patient data.
            </p>
          </div>
          <button style={{ ...s.clearBtn, opacity: wrapLoading ? 0.7 : 1 }} onClick={handleClearAll} disabled={wrapLoading}>
            {wrapLoading ? 'Clearing...' : 'Clear All & Start Fresh'}
          </button>
          <button style={s.cancelBtn} onClick={() => setShowSummary(false)}>← Back to Queue</button>
        </div>
      </div>
    )
  }

  // ── ADD PATIENT SCREEN ────────────────────────────────────
  if (showAddPatient) {
    return (
      <div className="page">
        <div style={{ ...s.summaryCard, padding: isMobile ? '18px 16px' : 24 }}>
          <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f0f4f8' }}>
            <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#1a202c' }}>Add Patient to Queue</h2>
            <p style={{ fontSize: 13, color: '#a0aec0', marginTop: 4 }}>مریض کو قطار میں شامل کریں</p>
          </div>
          <div style={s.addField}>
            <label style={s.addLabel}>Patient Name <span style={{ color: '#e53e3e' }}>*</span></label>
            <input style={{ ...s.addInput, border: addError && !newName.trim() ? '1.5px solid #fc8181' : '1.5px solid #e2e8f0' }}
              placeholder="Enter full name" value={newName} onChange={e => { setNewName(e.target.value); setAddError('') }} />
          </div>
          <div style={s.addField}>
            <label style={s.addLabel}>Phone Number</label>
            <input style={s.addInput} placeholder="03001234567" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
          </div>
          <div style={s.addField}>
            <label style={s.addLabel}>Problem / Notes</label>
            <input style={s.addInput} placeholder="e.g. Fever, Follow-up" value={newNotes} onChange={e => setNewNotes(e.target.value)} />
          </div>
          {addError && <div style={s.errBox}>{addError}</div>}
          <button style={{ ...s.newDayBtn, opacity: addLoading ? 0.7 : 1, marginBottom: 10 }} onClick={handleAddPatient} disabled={addLoading}>
            {addLoading ? 'Adding...' : 'Add to Queue'}
          </button>
          <button style={s.cancelBtn} onClick={() => { setShowAddPatient(false); setAddError('') }}>← Cancel</button>
        </div>
      </div>
    )
  }

  // ── MAIN DOCTOR VIEW ──────────────────────────────────────
  return (
    <div className="page">
      {fetchError && !isDemo && (
        <div style={s.fetchErrBanner}>
          <span style={s.fetchErrText}>⚠️ Cannot reach server — data may be outdated</span>
          <button style={s.fetchErrBtn} onClick={() => fetchAll(false)}>Retry</button>
        </div>
      )}
      {actionError && (
        <div style={s.actionErrBanner}>
          <span style={s.actionErrText}>⚠️ {actionError}</span>
          <button style={s.actionErrClose} onClick={() => setActionError('')}>✕</button>
        </div>
      )}
      {wrapError && !showSummary && <div style={s.errBox}>{wrapError}</div>}

      <div style={{ ...s.topBar, flexDirection: isTiny ? 'column' : 'row', alignItems: isTiny ? 'stretch' : 'flex-start', gap: isTiny ? 8 : 0 }}>
        <div>
          <p style={{ ...s.dateText, fontSize: isMobile ? 11 : 12 }}>{today}</p>
          <p style={s.liveText}>
            <span style={{ ...s.liveDot, background: isDemo ? '#744210' : fetchError ? '#e53e3e' : '#38a169' }} />
            {isDemo ? 'Demo Mode — offline preview' : fetchError ? 'Offline' : `Live — updated ${lastUpdatedText}`}
          </p>
        </div>
        <button style={{ ...s.wrapBtn, opacity: wrapLoading ? 0.7 : 1, alignSelf: isTiny ? 'flex-start' : undefined }}
          onClick={handleWrapUp} disabled={wrapLoading}>
          {wrapLoading ? '...' : 'Wrap Up Day'}
        </button>
      </div>

      {serviceTimes.length > 0 && (
        <div style={s.avgBar}>
          <span style={s.avgBarText}>Avg service time today:</span>
          <span style={s.avgBarValue}>{avgServiceMins} min/patient</span>
          <span style={s.avgBarSub}>(based on {serviceTimes.length} patient{serviceTimes.length > 1 ? 's' : ''})</span>
        </div>
      )}

      {calledToken && (
        <div style={s.calledBanner}>
          <div style={s.calledBannerDot} />
          <p style={{ ...s.calledBannerText, fontSize: isMobile ? 13 : 14 }}>
            Now calling — Token <strong>{calledToken}</strong>
          </p>
        </div>
      )}

      {loading && queue.length === 0 && !fetchError && !isDemo && (
        <div style={s.loadingBox}><p style={s.loadingText}>Loading queue...</p></div>
      )}

      <>
        <div style={s.statsRow}>
          <div style={s.statBox}>
            <span style={{ ...s.statNum, fontSize: isMobile ? 22 : 26 }}>{queue.length}</span>
            <span style={s.statLabel}>Waiting</span>
          </div>
          <div style={{ ...s.statBox, background: 'linear-gradient(135deg,#f0fff4,#c6f6d5)' }}>
            <span style={{ ...s.statNum, color: '#276749', fontSize: isMobile ? 22 : 26 }}>{doneList.length}</span>
            <span style={s.statLabel}>Done</span>
          </div>
          <div style={{ ...s.statBox, background: 'linear-gradient(135deg,#fffbeb,#fefcbf)' }}>
            <span style={{ ...s.statNum, color: '#744210', fontSize: isMobile ? 22 : 26 }}>{queue.length + doneList.length}</span>
            <span style={s.statLabel}>Total</span>
          </div>
        </div>

        {nextPatient ? (
          <div style={s.nextCard}>
            <div style={{ ...s.nextTop, flexDirection: isTiny ? 'column' : 'row', alignItems: isTiny ? 'flex-start' : 'center', gap: isTiny ? 10 : 12 }}>
              <div style={{ ...s.nextLeft, minWidth: 0 }}>
                <p style={s.nextLabel}>NEXT PATIENT</p>
                <h2 style={{ ...s.nextName, fontSize: isMobile ? 18 : 22, wordBreak: 'break-word' }}>{nextPatient.patientName}</h2>
                {nextPatient.phone && <p style={s.nextDetail}>{nextPatient.phone}</p>}
                {nextPatient.notes && <p style={s.nextDetail}>{nextPatient.notes}</p>}
              </div>
              <div style={{ ...s.tokenCircle, width: isTiny ? 52 : 64, height: isTiny ? 52 : 64, flexShrink: 0 }}>
                <span style={{ ...s.tokenNum, fontSize: isTiny ? 20 : 24 }}>{nextPatient.tokenNumber}</span>
                <span style={s.tokenLabel}>No.</span>
              </div>
            </div>
            <button
              style={{ ...s.doneBtn, opacity: actionLoading === nextPatient._id ? 0.7 : 1, fontSize: isMobile ? 14 : 15, padding: isMobile ? '12px' : '14px' }}
              onClick={() => markDone(nextPatient._id)}
              disabled={actionLoading === nextPatient._id}
            >
              {actionLoading === nextPatient._id ? 'Updating...' : 'Done — Call Next Patient'}
            </button>
          </div>
        ) : (
          <div style={s.emptyCard}>
            <p style={s.emptyTitle}>Queue is Empty</p>
            <p style={s.emptySub}>کوئی مریض نہیں — تمام مریض مکمل</p>
          </div>
        )}
      </>

      <div style={{ ...s.searchRow, flexDirection: isTiny ? 'column' : 'row', gap: 8 }}>
        <input style={{ ...s.searchInput, fontSize: isMobile ? 12 : 13 }}
          placeholder={isMobile ? 'Search patients...' : 'Search by name, phone or problem...'}
          value={search} onChange={e => setSearch(e.target.value)} />
        <button style={{ ...s.addBtn, width: isTiny ? '100%' : undefined, fontSize: isMobile ? 12 : 13 }}
          onClick={() => { setShowAddPatient(true); setAddError('') }}>
          + Add Patient
        </button>
      </div>

      <div style={s.tabRow}>
        <button style={{ ...s.tabBtn, ...(tab === 'waiting' ? s.tabWait : {}) }} onClick={() => setTab('waiting')}>
          Waiting <span style={s.tabBadge}>{queue.length}</span>
        </button>
        <button style={{ ...s.tabBtn, ...(tab === 'done' ? s.tabDone : {}) }} onClick={() => setTab('done')}>
          Done <span style={s.tabBadge}>{doneList.length}</span>
        </button>
      </div>

      <div style={s.listBox}>
        {tab === 'waiting' && (
          filteredWaiting.length === 0 ? (
            <p style={s.emptyList}>{search ? `No results for "${search}"` : 'Queue is empty'}</p>
          ) : (
            filteredWaiting.map((p, i) => (
              <div key={p._id} style={{ ...s.row, background: i === 0 && !search ? '#ebf8ff' : 'white', border: i === 0 && !search ? '1.5px solid #90cdf4' : '1.5px solid #e2e8f0' }}>
                <div style={{ ...s.rowLeft, minWidth: 0, flex: 1 }}>
                  <div style={{ ...s.badge, background: i === 0 && !search ? 'linear-gradient(135deg,#2b6cb0,#3182ce)' : '#edf2f7', color: i === 0 && !search ? 'white' : '#4a5568', width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, minWidth: isMobile ? 32 : 36, fontSize: isMobile ? 12 : 14 }}>
                    {p.tokenNumber}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ ...s.rowName, fontSize: isMobile ? 13 : 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.patientName}</p>
                    {p.phone && <p style={s.rowSub}>{p.phone}</p>}
                    {p.notes && <p style={s.rowSub}>{p.notes}</p>}
                    {i > 0 && <p style={s.rowWait}>~{i * avgServiceMins} min wait</p>}
                  </div>
                </div>
                <div style={{ ...s.rowActions, flexShrink: 0 }}>
                  {i === 0 && !search && !isTiny && <span style={s.nowPill}>Now</span>}
                  <button style={{ ...s.doneSmall, opacity: actionLoading === p._id ? 0.5 : 1, padding: isMobile ? '7px 10px' : '7px 11px' }}
                    onClick={() => markDone(p._id)} disabled={!!actionLoading}>✓</button>
                  <button style={{ ...s.delSmall, opacity: actionLoading === p._id ? 0.5 : 1, padding: isMobile ? '7px 10px' : '7px 11px' }}
                    onClick={() => deletePatient(p._id)} disabled={!!actionLoading}>✕</button>
                </div>
              </div>
            ))
          )
        )}
        {tab === 'done' && (
          filteredDone.length === 0 ? (
            <p style={s.emptyList}>{search ? `No results for "${search}"` : 'No patients done yet'}</p>
          ) : (
            filteredDone.map(p => (
              <div key={p._id} style={{ ...s.row, opacity: 0.6, background: '#f7fafc' }}>
                <div style={{ ...s.rowLeft, minWidth: 0, flex: 1 }}>
                  <div style={{ ...s.badge, background: '#c6f6d5', color: '#276749', width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, minWidth: isMobile ? 32 : 36, fontSize: isMobile ? 12 : 14 }}>{p.tokenNumber}</div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ ...s.rowName, textDecoration: 'line-through', color: '#a0aec0', fontSize: isMobile ? 13 : 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.patientName}</p>
                    {p.notes && <p style={s.rowSub}>{p.notes}</p>}
                  </div>
                </div>
                <span style={{ ...s.donePill, flexShrink: 0 }}>Done</span>
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}

const s = {
  fetchErrBanner: { background: '#fff5f5', border: '1.5px solid #fed7d7', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  fetchErrText: { fontSize: 13, color: '#c53030', fontWeight: 500 },
  fetchErrBtn: { padding: '5px 14px', background: '#c53030', color: 'white', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', flexShrink: 0 },
  actionErrBanner: { background: '#fff5f5', border: '1.5px solid #fed7d7', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  actionErrText: { fontSize: 13, color: '#c53030', fontWeight: 500, flex: 1 },
  actionErrClose: { background: 'none', border: 'none', color: '#c53030', fontSize: 14, cursor: 'pointer', fontWeight: 700, flexShrink: 0, padding: '0 4px' },
  errBox: { background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 10, padding: '10px 14px', color: '#c53030', fontSize: 13, marginBottom: 14 },
  loadingBox: { background: 'white', borderRadius: 16, padding: '28px 20px', textAlign: 'center', marginBottom: 14, border: '1px solid #e2e8f0' },
  loadingText: { color: '#a0aec0', fontSize: 14 },
  topBar: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  dateText: { fontSize: 12, color: '#4a5568', fontWeight: 600 },
  liveText: { fontSize: 11, color: '#a0aec0', display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 },
  liveDot: { width: 6, height: 6, borderRadius: '50%', background: '#38a169', display: 'inline-block', flexShrink: 0 },
  wrapBtn: { padding: '7px 14px', background: '#744210', color: 'white', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, border: 'none' },
  avgBar: { background: '#fffbeb', border: '1px solid #fbd38d', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  avgBarText: { fontSize: 12, color: '#744210', fontWeight: 500 },
  avgBarValue: { fontSize: 13, color: '#744210', fontWeight: 700 },
  avgBarSub: { fontSize: 11, color: '#975a16', marginLeft: 'auto' },
  calledBanner: { background: '#2b6cb0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  calledBannerDot: { width: 8, height: 8, borderRadius: '50%', background: 'white', flexShrink: 0 },
  calledBannerText: { color: 'white', fontSize: 14, fontWeight: 500 },
  statsRow: { display: 'flex', gap: 10, marginBottom: 16 },
  statBox: { flex: 1, background: 'linear-gradient(135deg,#ebf4ff,#bee3f8)', borderRadius: 14, padding: '14px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  statNum: { fontSize: 26, fontWeight: 800, color: '#2b6cb0', lineHeight: 1 },
  statLabel: { fontSize: 11, color: '#4a5568', fontWeight: 600 },
  nextCard: { background: 'white', borderRadius: 18, padding: 20, marginBottom: 14, boxShadow: '0 4px 20px rgba(43,108,176,0.1)', border: '1.5px solid #bee3f8' },
  nextTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  nextLeft: { flex: 1 },
  nextLabel: { fontSize: 10, color: '#a0aec0', fontWeight: 700, letterSpacing: '1px', marginBottom: 4 },
  nextName: { fontSize: 22, fontWeight: 700, color: '#2d3748' },
  nextDetail: { fontSize: 13, color: '#718096', marginTop: 3 },
  tokenCircle: { width: 64, height: 64, background: 'linear-gradient(135deg,#2b6cb0,#3182ce)', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(43,108,176,0.3)' },
  tokenNum: { fontSize: 24, fontWeight: 900, color: 'white', lineHeight: 1 },
  tokenLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)' },
  doneBtn: { width: '100%', padding: '14px', background: 'linear-gradient(135deg,#38a169,#48bb78)', color: 'white', borderRadius: 12, fontSize: 15, fontWeight: 700, boxShadow: '0 4px 14px rgba(56,161,105,0.3)', cursor: 'pointer', border: 'none' },
  emptyCard: { background: 'white', borderRadius: 18, padding: '28px 20px', textAlign: 'center', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: '#2d3748' },
  emptySub: { fontSize: 13, color: '#a0aec0', marginTop: 4 },
  searchRow: { display: 'flex', gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, background: 'white', color: '#2d3748', outline: 'none', minWidth: 0, boxSizing: 'border-box' },
  addBtn: { padding: '10px 14px', background: '#2b6cb0', color: 'white', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, border: 'none' },
  tabRow: { display: 'flex', gap: 8, marginBottom: 10 },
  tabBtn: { flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'white', color: '#718096', border: '1.5px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabBadge: { background: '#e2e8f0', color: '#4a5568', fontSize: 11, padding: '2px 7px', borderRadius: 20, fontWeight: 700 },
  tabWait: { background: '#ebf4ff', color: '#2b6cb0', borderColor: '#90cdf4' },
  tabDone: { background: '#f0fff4', color: '#276749', borderColor: '#9ae6b4' },
  listBox: { background: 'white', borderRadius: 16, padding: 8, marginBottom: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', minHeight: 60 },
  emptyList: { textAlign: 'center', color: '#a0aec0', padding: 20, fontSize: 14 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, marginBottom: 6 },
  rowLeft: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  badge: { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 },
  rowName: { fontSize: 14, fontWeight: 600, color: '#2d3748' },
  rowSub: { fontSize: 12, color: '#a0aec0', marginTop: 2 },
  rowWait: { fontSize: 11, color: '#975a16', marginTop: 2, fontWeight: 500 },
  rowActions: { display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginLeft: 6 },
  nowPill: { background: '#2b6cb0', color: 'white', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 },
  doneSmall: { padding: '7px 11px', background: '#f0fff4', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#276749', border: '1px solid #9ae6b4', cursor: 'pointer' },
  delSmall: { padding: '7px 11px', background: '#fff5f5', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#c53030', border: '1px solid #feb2b2', cursor: 'pointer' },
  donePill: { background: '#c6f6d5', color: '#276749', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, flexShrink: 0 },
  summaryCard: { background: 'white', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  summaryHeader: { marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: { fontSize: 20, fontWeight: 700, color: '#2d3748' },
  summaryDate: { fontSize: 12, color: '#a0aec0', marginTop: 2 },
  avgBadge: { background: '#fffbeb', border: '1px solid #fbd38d', borderRadius: 10, padding: '6px 12px', textAlign: 'center', flexShrink: 0 },
  avgBadgeNum: { fontSize: 16, fontWeight: 800, color: '#744210' },
  avgBadgeLabel: { fontSize: 10, color: '#975a16', marginTop: 1 },
  summaryStatsRow: { display: 'flex', gap: 10, marginBottom: 20 },
  summaryStat: { flex: 1, borderRadius: 12, padding: '12px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 },
  summaryList: { marginBottom: 20, maxHeight: 260, overflowY: 'auto' },
  summaryListTitle: { fontSize: 12, fontWeight: 700, color: '#a0aec0', letterSpacing: '0.5px', marginBottom: 10, textTransform: 'uppercase' },
  summaryRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 10, marginBottom: 6, background: '#f7fafc', border: '1px solid #e2e8f0' },
  summaryRowLeft: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  summaryToken: { width: 30, height: 30, minWidth: 30, background: '#c6f6d5', color: '#276749', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 },
  wrapWarning: { background: '#fffbeb', border: '1.5px solid #fbd38d', borderRadius: 12, padding: '12px 14px', marginBottom: 14 },
  clearBtn: { width: '100%', padding: 14, background: '#c53030', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10, border: 'none' },
  cancelBtn: { width: '100%', padding: 12, background: 'white', color: '#718096', borderRadius: 12, fontSize: 14, fontWeight: 600, border: '1.5px solid #e2e8f0', cursor: 'pointer' },
  finalStatsRow: { display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' },
  finalStat: { background: '#f7fafc', borderRadius: 14, padding: '16px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4, border: '1.5px solid #e2e8f0', flex: 1 },
  newDayBtn: { width: '100%', padding: 14, background: '#2b6cb0', color: 'white', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', border: 'none' },
  addField: { marginBottom: 16 },
  addLabel: { display: 'block', fontSize: 14, fontWeight: 600, color: '#2d3748', marginBottom: 6 },
  addInput: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 15, background: '#f7fafc', color: '#2d3748', outline: 'none', boxSizing: 'border-box' },
}