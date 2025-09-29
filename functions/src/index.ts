import * as functions from 'firebase-functions'
import admin from 'firebase-admin'

admin.initializeApp()

const db = admin.firestore()
const fcm = admin.messaging()

function startOfMinute(date: Date) {
  const d = new Date(date)
  d.setSeconds(0,0)
  return d
}

export const checkReminders = functions
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    const key = functions.config().cron?.key
    const hdr = req.header('X-CRON-KEY')
    if (!key || hdr !== key) {
      res.status(403).send('forbidden')
      return
    }

    const now = startOfMinute(new Date()) // current minute
    const nowMs = now.getTime()

    // Window: due within +/- 7 days, to limit reads
    const start = new Date(nowMs - 7*24*60*60000)
    const end = new Date(nowMs + 7*24*60*60000)

    // Query all users (you likely have just one)
    const usersSnap = await db.collection('users').get()

    let sent = 0
    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id

      const tasksSnap = await db.collection('users').doc(uid).collection('tasks')
        .where('due_at_utc', '>=', admin.firestore.Timestamp.fromDate(start))
        .where('due_at_utc', '<=', admin.firestore.Timestamp.fromDate(end))
        .get()

      // Fetch tokens once per user
      const tokensSnap = await db.collection('users').doc(uid).collection('tokens').get()
      const tokens = tokensSnap.docs.map(d => d.id)
      if (tokens.length === 0) continue

      for (const t of tasksSnap.docs) {
        const task = t.data() as any
        const due = task.due_at_utc?.toDate()
        const offsets: number[] = task.reminder_offsets_minutes || []
        if (!due || offsets.length === 0) continue

        for (const m of offsets) {
          const sched = new Date(due.getTime() - m*60000)
          const schedMinute = startOfMinute(sched).getTime()
          if (schedMinute === nowMs) {
            // check duplicate
            const key = `${t.id}_${schedMinute}`
            const logRef = db.collection('users').doc(uid).collection('reminderLog').doc(key)
            const logDoc = await logRef.get()
            if (logDoc.exists) continue

            const message: admin.messaging.MulticastMessage = {
              tokens,
              notification: {
                title: `Reminder: ${task.title}`,
                body: `Due soon`,
              },
              data: {
                taskId: t.id
              }
            }
            await fcm.sendEachForMulticast(message).catch(()=>{})
            await logRef.set({ createdAt: admin.firestore.FieldValue.serverTimestamp(), taskId: t.id, time: sched })
            sent++
          }
        }
      }
    }

    res.json({ ok: true, sent })
  })
