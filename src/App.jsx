import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Spline from '@splinetool/react-spline'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, LogOut, LogIn, UserPlus, Menu, Ticket, CalendarDays, MapPin, DollarSign, ShieldCheck, BadgeCheck, Check, X, Search } from 'lucide-react'
import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore'

// --- Firebase Config (replace with your own keys if deploying) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE || 'demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123:web:demo'
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

// Utility: generate human friendly ticket id
const genTicketId = () => `T-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,7).toUpperCase()}`

// Seed: ensure an admin and a hoster exist (idempotent)
async function ensureSeedUsers() {
  const seed = [
    { uid: 'admin-seed-uid', email: 'admin@eventhub.dev', role: 'Admin' },
    { uid: 'hoster-seed-uid', email: 'hoster@eventhub.dev', role: 'Hoster' },
  ]
  for (const u of seed) {
    const ref = doc(db, 'users', u.uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, { email: u.email, role: u.role, createdAt: serverTimestamp() })
    }
  }
}

function useAuthRole() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const uref = doc(db, 'users', u.uid)
        const usnap = await getDoc(uref)
        if (usnap.exists()) setRole(usnap.data().role)
        else {
          // if first login and no profile, create as User
          await setDoc(uref, { email: u.email || '', role: 'User', createdAt: serverTimestamp() })
          setRole('User')
        }
      } else {
        setRole(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  return { user, role, loading }
}

function Navbar({ authed, onShowLogin, onShowSignup, goto, onLogout }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="fixed top-0 left-0 right-0 z-40 backdrop-blur bg-black/30 border-b border-white/10">
      <nav className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between text-white">
        <button onClick={() => goto('home')} className="flex items-center gap-2 font-semibold">
          <Ticket className="w-5 h-5 text-teal-300" /> EventHub
        </button>
        <div className="hidden md:flex items-center gap-4">
          <button onClick={() => goto('home')} className="hover:text-teal-300 transition flex items-center gap-1"><Home className="w-4 h-4"/>Home</button>
          {!authed && (
            <>
              <button onClick={onShowLogin} className="hover:text-teal-300 transition flex items-center gap-1"><LogIn className="w-4 h-4"/>Login</button>
              <button onClick={onShowSignup} className="px-3 py-1 rounded bg-teal-500 hover:bg-teal-400 text-black font-medium flex items-center gap-1"><UserPlus className="w-4 h-4"/>Sign Up</button>
            </>
          )}
          {authed && (
            <>
              <button onClick={() => goto('dashboard')} className="hover:text-teal-300 transition">Dashboard</button>
              <button onClick={onLogout} className="hover:text-rose-300 transition flex items-center gap-1"><LogOut className="w-4 h-4"/>Logout</button>
            </>
          )}
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          <Menu />
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="md:hidden overflow-hidden bg-black/60 text-white">
            <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-3">
              <button onClick={() => { goto('home'); setOpen(false) }} className="text-left">Home</button>
              {!authed ? (
                <>
                  <button onClick={() => { onShowLogin(); setOpen(false) }} className="text-left">Login</button>
                  <button onClick={() => { onShowSignup(); setOpen(false) }} className="text-left">Sign Up</button>
                </>
              ) : (
                <>
                  <button onClick={() => { goto('dashboard'); setOpen(false) }} className="text-left">Dashboard</button>
                  <button onClick={() => { onLogout(); setOpen(false) }} className="text-left">Logout</button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function AuthModal({ mode, onClose, onAuthed }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await setDoc(doc(db, 'users', cred.user.uid), { email, role: 'User', createdAt: serverTimestamp() })
      }
      onAuthed()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-xl bg-gradient-to-br from-slate-900 to-black border border-white/10 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">{mode === 'login' ? 'Login' : 'Create account'}</h3>
          <button className="text-white/60 hover:text-white" onClick={onClose}><X /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input required type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full px-3 py-2 bg-white/5 rounded border border-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400"/>
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input required type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full px-3 py-2 bg-white/5 rounded border border-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400"/>
          </div>
          {error && <p className="text-rose-400 text-sm">{error}</p>}
          <button disabled={loading} className="w-full py-2 rounded bg-teal-500 hover:bg-teal-400 text-black font-semibold">
            {loading ? 'Please wait...' : (mode === 'login' ? 'Login' : 'Sign Up')}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

function Hero({ onShowSignup }) {
  return (
    <section className="relative min-h-[70vh] grid place-items-center text-white">
      <div className="absolute inset-0">
        <Spline scene="https://prod.spline.design/zks9uYILDPSX-UX6/scene.splinecode" style={{ width: '100%', height: '100%' }} />
      </div>
      <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight drop-shadow-xl">Your gateway to unforgettable events</h1>
        <p className="mt-4 text-white/80">Discover, host, and manage events with a secure ticketing workflow. Built with a futuristic vibe.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={onShowSignup} className="px-5 py-2 rounded bg-teal-500 hover:bg-teal-400 text-black font-semibold">Get Started</button>
          <a href="#events" className="px-5 py-2 rounded border border-white/20 hover:bg-white/10">Browse Events</a>
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none" />
    </section>
  )
}

function EventCard({ ev, onView }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 text-white flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2"><CalendarDays className="w-4 h-4 text-teal-300"/>{ev.title}</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/30 text-emerald-200">{ev.status}</span>
      </div>
      <p className="text-white/70 text-sm mt-2 line-clamp-2">{ev.description}</p>
      <div className="mt-3 text-sm text-white/80 space-y-1">
        <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4"/> {ev.date} {ev.time && `• ${ev.time}`}</div>
        <div className="flex items-center gap-2"><MapPin className="w-4 h-4"/> {ev.location}</div>
        <div className="flex items-center gap-2"><DollarSign className="w-4 h-4"/> ${ev.ticketPrice}</div>
      </div>
      <button onClick={() => onView(ev)} className="mt-4 w-full py-2 rounded bg-white text-black font-medium hover:bg-teal-400">View Details</button>
    </div>
  )
}

function HomePage({ onViewEvent }) {
  const [events, setEvents] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  useEffect(() => {
    const fetch = async () => {
      const q = query(collection(db, 'events'), where('status', '==', 'Approved'), orderBy('date', 'asc'))
      const snap = await getDocs(q)
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setEvents(list)
    }
    fetch()
  }, [])

  const filtered = useMemo(() => events.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())), [events, searchTerm])

  return (
    <section id="events" className="relative py-16 bg-gradient-to-b from-black to-slate-900">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between text-white mb-6">
          <h2 className="text-2xl font-bold">Approved Events</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50"/>
            <input value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} placeholder="Search events" className="pl-9 pr-3 py-2 rounded bg-white/5 border border-white/10 text-white placeholder:text-white/50"/>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(ev => (
            <EventCard key={ev.id} ev={ev} onView={onViewEvent} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-white/70">No events yet. Be the first to host!</div>
          )}
        </div>
      </div>
    </section>
  )
}

function EventDetail({ event, role, user, onBack, onBooked }) {
  const [loading, setLoading] = useState(false)
  const canBook = role === 'User'

  const book = async () => {
    if (!user) return
    setLoading(true)
    try {
      const ticketId = genTicketId()
      await addDoc(collection(db, 'tickets'), {
        ticketId,
        eventId: event.id,
        userId: user.uid,
        eventName: event.title,
        status: 'Valid',
        createdAt: serverTimestamp()
      })
      onBooked(ticketId)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="py-12 bg-slate-950 text-white min-h-[60vh]">
      <div className="max-w-4xl mx-auto px-4">
        <button onClick={onBack} className="mb-6 text-white/70 hover:text-white">← Back</button>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <h2 className="text-3xl font-bold">{event.title}</h2>
              <p className="mt-2 text-white/80">{event.description}</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-white/80">
                <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4"/> {event.date} • {event.time}</div>
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4"/> {event.location}</div>
                <div className="flex items-center gap-2"><DollarSign className="w-4 h-4"/> ${event.ticketPrice}</div>
                <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4"/> Status: {event.status}</div>
              </div>
              {canBook && (
                <button disabled={loading} onClick={book} className="mt-6 px-5 py-2 rounded bg-teal-500 hover:bg-teal-400 text-black font-semibold">{loading ? 'Booking...' : 'Book Ticket'}</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function UserDash({ user }) {
  const [tickets, setTickets] = useState([])
  useEffect(() => {
    const run = async () => {
      const q = query(collection(db, 'tickets'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }
    run()
  }, [user])

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-white">My Tickets</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tickets.map(t => (
          <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="font-medium">{t.eventName}</div>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/30">{t.status}</span>
            </div>
            <div className="mt-2 text-sm text-white/80">
              Ticket ID: <span className="font-mono">{t.ticketId}</span>
            </div>
          </div>
        ))}
        {tickets.length === 0 && (
          <div className="text-white/60">No tickets yet.</div>
        )}
      </div>
    </div>
  )
}

function HosterDash({ user }) {
  const [form, setForm] = useState({ title: '', description: '', date: '', time: '', location: '', ticketPrice: '', totalTickets: '' })
  const [mine, setMine] = useState([])

  const submit = async (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      ticketPrice: Number(form.ticketPrice || 0),
      totalTickets: Number(form.totalTickets || 0),
      status: 'Pending',
      hosterId: user.uid,
      createdAt: serverTimestamp()
    }
    const ref = await addDoc(collection(db, 'events'), payload)
    setForm({ title: '', description: '', date: '', time: '', location: '', ticketPrice: '', totalTickets: '' })
    await load()
  }

  const load = async () => {
    const q = query(collection(db, 'events'), where('hosterId', '==', user.uid), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    setMine(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold text-white mb-3">Create Event</h3>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white">
          {['title','description','date','time','location','ticketPrice','totalTickets'].map((k)=> (
            <div key={k} className="col-span-1">
              <label className="block text-sm mb-1 capitalize">{k}</label>
              {k === 'description' ? (
                <textarea required value={form[k]} onChange={(e)=>setForm({...form, [k]: e.target.value})} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10"/>
              ) : (
                <input required type={k.includes('Price') || k.includes('Tickets') ? 'number' : (k==='date'?'date': k==='time'?'time':'text')} value={form[k]} onChange={(e)=>setForm({...form, [k]: e.target.value})} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10"/>
              )}
            </div>
          ))}
          <div className="md:col-span-2">
            <button className="px-4 py-2 rounded bg-teal-500 hover:bg-teal-400 text-black font-semibold">Submit for Approval</button>
          </div>
        </form>
      </div>
      <div>
        <h3 className="text-xl font-semibold text-white mb-3">My Events</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-white/90">
            <thead className="text-left">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {mine.map(ev => (
                <tr key={ev.id} className="border-b border-white/5">
                  <td className="py-2 pr-4">{ev.title}</td>
                  <td className="py-2 pr-4">{ev.date}</td>
                  <td className="py-2 pr-4"><span className={`px-2 py-0.5 rounded text-xs ${ev.status==='Approved'?'bg-emerald-500/20 border border-emerald-400/30':'bg-amber-500/20 border border-amber-400/30'}`}>{ev.status}</span></td>
                </tr>
              ))}
              {mine.length===0 && (
                <tr><td className="py-4 text-white/60" colSpan={3}>No events yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function AdminDash() {
  const [pending, setPending] = useState([])
  const [usersList, setUsersList] = useState([])

  const load = async () => {
    const q1 = query(collection(db, 'events'), where('status', '==', 'Pending'), orderBy('createdAt', 'asc'))
    const s1 = await getDocs(q1)
    setPending(s1.docs.map(d => ({ id: d.id, ...d.data() })))

    const s2 = await getDocs(collection(db, 'users'))
    setUsersList(s2.docs.map(d => ({ id: d.id, ...d.data() })))
  }
  useEffect(() => { load() }, [])

  const act = async (evId, status) => {
    await updateDoc(doc(db, 'events', evId), { status })
    await load()
  }

  const makeHoster = async (uid) => {
    await setDoc(doc(db, 'users', uid), { role: 'Hoster' }, { merge: true })
    await load()
  }

  return (
    <div className="space-y-10">
      <div>
        <h3 className="text-xl font-semibold text-white mb-3">Event Approval Queue</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-white/90">
            <thead className="text-left">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Hoster</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(ev => (
                <tr key={ev.id} className="border-b border-white/5">
                  <td className="py-2 pr-4">{ev.title}</td>
                  <td className="py-2 pr-4">{ev.hosterId}</td>
                  <td className="py-2 pr-4 flex gap-2">
                    <button onClick={()=>act(ev.id,'Approved')} className="px-3 py-1 rounded bg-emerald-500/80 text-black">Approve</button>
                    <button onClick={()=>act(ev.id,'Rejected')} className="px-3 py-1 rounded bg-rose-500/80 text-black">Reject</button>
                  </td>
                </tr>
              ))}
              {pending.length===0 && (
                <tr><td className="py-4 text-white/60" colSpan={3}>No pending events.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold text-white mb-3">User Management</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-white/90">
            <thead className="text-left">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Upgrade</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map(u => (
                <tr key={u.id} className="border-b border-white/5">
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4">{u.role}</td>
                  <td className="py-2 pr-4">
                    {u.role !== 'Hoster' && (
                      <button onClick={()=>makeHoster(u.id)} className="px-3 py-1 rounded bg-teal-500/80 text-black">Make Hoster</button>
                    )}
                  </td>
                </tr>
              ))}
              {usersList.length===0 && (
                <tr><td className="py-4 text-white/60" colSpan={3}>No users.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function VerifyPage() {
  const [ticketId, setTicketId] = useState('')
  const [result, setResult] = useState(null) // { status: 'success'|'error', message }

  const check = async () => {
    setResult(null)
    const q = query(collection(db, 'tickets'), where('ticketId', '==', ticketId), limit(1))
    const snap = await getDocs(q)
    if (snap.empty) {
      setResult({ status: 'error', message: 'Invalid Ticket' })
      return
    }
    const d = snap.docs[0]
    const data = d.data()
    if (data.status === 'CheckedIn') {
      setResult({ status: 'error', message: 'Ticket Already Used' })
      return
    }
    await updateDoc(doc(db, 'tickets', d.id), { status: 'CheckedIn' })
    setResult({ status: 'success', message: 'Success: Valid Ticket' })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-white">
      <h3 className="text-lg font-semibold mb-3">Ticket Verification</h3>
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={ticketId} onChange={(e)=>setTicketId(e.target.value)} placeholder="Enter Ticket ID" className="flex-1 px-3 py-2 rounded bg-white/5 border border-white/10"/>
        <button onClick={check} className="px-4 py-2 rounded bg-teal-500 hover:bg-teal-400 text-black font-semibold">Check Ticket</button>
      </div>
      {result && (
        <div className={`mt-3 text-sm ${result.status==='success'?'text-emerald-300':'text-rose-300'}`}>{result.message}</div>
      )}
    </div>
  )
}

function Dashboard({ role, user }) {
  return (
    <section className="py-14 bg-gradient-to-b from-slate-950 to-black min-h-[70vh]">
      <div className="max-w-6xl mx-auto px-4 text-white">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Dashboard</h2>
          {(role==='Admin' || role==='Hoster') && <VerifyPage />}
        </div>
        {role === 'User' && <UserDash user={user} />}
        {role === 'Hoster' && <HosterDash user={user} />}
        {role === 'Admin' && <AdminDash />}
      </div>
    </section>
  )
}

function App() {
  const [page, setPage] = useState('home') // 'home' | 'dashboard' | 'detail'
  const [showLogin, setShowLogin] = useState(false)
  const [showSignup, setShowSignup] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [toast, setToast] = useState('')

  const { user, role, loading } = useAuthRole()

  useEffect(() => { ensureSeedUsers() }, [])

  const goto = (p) => setPage(p)

  const onViewEvent = (ev) => { setSelectedEvent(ev); setPage('detail') }
  const onBooked = (ticketId) => {
    setToast(`Booked! Your Ticket ID: ${ticketId}`)
  }

  const logout = async () => { await signOut(auth) }

  return (
    <div className="min-h-screen bg-black">
      <Navbar authed={!!user} onShowLogin={()=>setShowLogin(true)} onShowSignup={()=>setShowSignup(true)} goto={goto} onLogout={logout} />

      <main className="pt-16">
        {page === 'home' && (
          <>
            <Hero onShowSignup={()=>setShowSignup(true)} />
            <HomePage onViewEvent={onViewEvent} />
          </>
        )}
        {page === 'detail' && selectedEvent && (
          <EventDetail event={selectedEvent} role={role} user={user} onBack={()=>setPage('home')} onBooked={onBooked} />
        )}
        {page === 'dashboard' && user && (
          <Dashboard role={role} user={user} />
        )}
        {page === 'dashboard' && !user && (
          <section className="py-24 text-center text-white">Please login to access your dashboard.</section>
        )}
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <div className="px-4 py-2 rounded bg-white text-black shadow-lg">{toast}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {showLogin && <AuthModal mode="login" onClose={()=>setShowLogin(false)} onAuthed={()=>setPage('dashboard')} />}
      {showSignup && <AuthModal mode="signup" onClose={()=>setShowSignup(false)} onAuthed={()=>setPage('dashboard')} />}

      <footer className="py-10 text-center text-white/60 bg-black border-t border-white/10">© {new Date().getFullYear()} EventHub</footer>
    </div>
  )
}

export default App
