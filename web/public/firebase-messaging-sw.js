/* firebase-messaging-sw.js */
// Loaded at root: /firebase-messaging-sw.js
// Uses compat for simplicity.
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyDaQbllxi5SiWD-brBP8jyfegoWfxC7lz8",
  authDomain: "taskbox-matt.firebaseapp.com",
  projectId: "taskbox-matt",
  storageBucket: "taskbox-matt.firebasestorage.app",
  messagingSenderId: "232444501415",
  appId: "1:232444501415:web:ad1fd5c291033a82d6ea82"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Taskbox'
  const body = (payload.notification && payload.notification.body) || ''
  self.registration.showNotification(title, { body })
})
