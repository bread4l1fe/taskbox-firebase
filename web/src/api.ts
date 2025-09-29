import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, collection, addDoc, doc, getDocs, onSnapshot, query, orderBy, setDoc, Timestamp } from 'firebase/firestore'
import { firebaseConfig } from './firebaseConfig'

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

export async function register(email:string, password:string, timezone:string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await setDoc(doc(db, 'users', cred.user.uid), { email, timezone })
  return cred.user
}

export async function login(email:string, password:string) {
  await signInWithEmailAndPassword(auth, email, password)
}

export function listenTasks(cb:(tasks:any[])=>void) {
  const user = auth.currentUser
  if (!user) return () => {}
  const ref = collection(db, 'users', user.uid, 'tasks')
  const q = query(ref, orderBy('created_at', 'desc'))
  return onSnapshot(q, (snap) => {
    const arr:any[] = []
    snap.forEach(d => arr.push({ id:d.id, ...d.data() }))
    cb(arr)
  })
}

export async function createTask(title:string, description:string, dueLocalISO?:string, reminderOffsets?:string[]) {
  const user = auth.currentUser
  if (!user) throw new Error('Not logged in')
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  let dueAtUtc: Timestamp | null = null
  if (dueLocalISO) {
    const local = new Date(dueLocalISO) // interpret as local
    const utcMs = local.getTime() - (local.getTimezoneOffset() * 60000)
    dueAtUtc = Timestamp.fromMillis(utcMs)
  }
  const minutes = (reminderOffsets||[]).map(s=>s.trim()).filter(Boolean).map(s=>{
    const m = s.toLowerCase()
    if (m.endsWith('m')) return parseInt(m)
    if (m.endsWith('h')) return parseInt(m)*60
    if (m.endsWith('d')) return parseInt(m)*1440
    return parseInt(m)
  })
  const ref = collection(db, 'users', user.uid, 'tasks')
  await addDoc(ref, {
    title, description,
    due_at_utc: dueAtUtc,
    reminder_offsets_minutes: minutes,
    created_at: Timestamp.now(),
    tz
  })
}

export async function setProgress(taskId:string, dayStr:string, done:boolean, notes?:string) {
  const user = auth.currentUser
  if (!user) throw new Error('Not logged in')
  const ref = doc(db, 'users', user.uid, 'tasks', taskId, 'progress', dayStr)
  await setDoc(ref, { done, notes: notes||null }, { merge: true })
}
