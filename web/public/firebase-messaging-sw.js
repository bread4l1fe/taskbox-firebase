/* firebase-messaging-sw.js */
// Loaded at root: /firebase-messaging-sw.js
// Uses compat for simplicity.
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "YOUR_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Taskbox'
  const body = (payload.notification && payload.notification.body) || ''
  self.registration.showNotification(title, { body })
})
