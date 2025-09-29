import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, doc, setDoc } from 'firebase/firestore'
import { firebaseConfig } from './firebaseConfig'

const VAPID_PUBLIC_KEY = 'BANeEjGhJVXQWGpW447T2lEpUAm_Y4utHl3q4ct-nKJrtKuy__ioG1PS_Bsl9yyuEMWFwKJ3z3s4BlVVuIKxvuY	' // from Firebase Console > Cloud Messaging

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

export async function enablePush() {
  const supported = await isSupported()
  if (!supported) { alert('Push not supported on this device/browser.'); return }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') { alert('Permission denied'); return }

  const messaging = getMessaging(app)
  const token = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY })
  const user = auth.currentUser
  if (!user) { alert('Login first'); return }

  if (token) {
    await setDoc(doc(db, 'users', user.uid, 'tokens', token), {
      createdAt: new Date().toISOString(),
      userAgent: navigator.userAgent
    })
    alert('Notifications enabled')
  } else {
    alert('No token retrieved')
  }

  onMessage(messaging, (payload) => {
    // Foreground handler if needed
    console.log('Message in foreground:', payload)
  })
}
