import React, { useEffect, useState } from 'react'
import { register as doRegister, login as doLogin, listenTasks, createTask, setProgress } from '../api'
import { enablePush } from '../push'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { initializeApp } from 'firebase/app'
import { firebaseConfig } from '../firebaseConfig'

initializeApp(firebaseConfig)
const auth = getAuth()

type Task = { id:string; title:string; description?:string; due_at_utc?:any; reminder_offsets_minutes?:number[] }

function fmtLocal(ts?: any) {
  if (!ts) return ''
  const d = ts.toDate()
  return d.toLocaleString()
}

export default function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [user, setUser] = useState<any>(null)

  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [due, setDue] = useState('') // YYYY-MM-DDTHH:MM
  const [offsets, setOffsets] = useState('10m,1h')

  useEffect(()=>{
    return onAuthStateChanged(auth, u => {
      setUser(u)
      if (u) {
        const unsub = listenTasks(setTasks)
        return () => unsub()
      } else {
        setTasks([])
      }
    })
  }, [])

  async function handleRegister() {
    await doRegister(email, password, Intl.DateTimeFormat().resolvedOptions().timeZone)
  }
  async function handleLogin() {
    await doLogin(email, password)
  }
  async function addTask() {
    await createTask(title, desc, due || undefined, offsets.split(',').map(s=>s.trim()).filter(Boolean))
    setTitle(''); setDesc(''); setDue(''); setOffsets('10m,1h')
  }
  async function markToday(id:string, done:boolean) {
    const day = new Date().toISOString().slice(0,10)
    await setProgress(id, day, done)
  }

  return <div style={{maxWidth:740, margin:'20px auto', padding:16, fontFamily:'system-ui, sans-serif'}}>
    <h1>Taskbox (Serverless)</h1>
    {!user && <div style={{display:'grid', gap:8, gridTemplateColumns:'1fr 1fr auto'}}>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button onClick={handleLogin}>Log in</button>
      <div style={{gridColumn:'1 / span 3', fontSize:12, opacity:.8}}>New here? <button onClick={handleRegister}>Create account</button></div>
    </div>}

    {user && <div>
      <div style={{display:'flex', gap:8, alignItems:'center', margin:'12px 0'}}>
        <button onClick={()=>enablePush()}>Enable notifications</button>
      </div>

      <div style={{border:'1px solid #333', borderRadius:8, padding:12, marginBottom:12}}>
        <h3>Create Task</h3>
        <div style={{display:'grid', gap:8, gridTemplateColumns:'1fr 1fr'}}>
          <input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
          <input placeholder="Due (YYYY-MM-DDTHH:MM)" value={due} onChange={e=>setDue(e.target.value)} />
          <input placeholder="Reminder offsets (e.g., 10m,1h,1d)" value={offsets} onChange={e=>setOffsets(e.target.value)} />
          <input placeholder="Description (optional)" value={desc} onChange={e=>setDesc(e.target.value)} />
        </div>
        <div style={{marginTop:8}}><button onClick={addTask}>Add</button></div>
      </div>

      <h3>Your Tasks</h3>
      <ul style={{listStyle:'none', padding:0, display:'grid', gap:8}}>
        {tasks.map(t => (
          <li key={t.id} style={{border:'1px solid #333', borderRadius:8, padding:12}}>
            <div style={{display:'flex', justifyContent:'space-between', gap:8}}>
              <strong>{t.title}</strong>
              <small>{fmtLocal(t.due_at_utc)}</small>
            </div>
            {t.description && <div style={{opacity:.8}}>{t.description}</div>}
            <div style={{marginTop:8, display:'flex', gap:8}}>
              <button onClick={()=>markToday(t.id, true)}>Done today</button>
              <button onClick={()=>markToday(t.id, false)}>Not done today</button>
            </div>
            {t.reminder_offsets_minutes && <div style={{fontSize:12, opacity:.7, marginTop:4}}>Reminders: {t.reminder_offsets_minutes.join(', ')} min before</div>}
          </li>
        ))}
      </ul>
    </div>}
  </div>
}
