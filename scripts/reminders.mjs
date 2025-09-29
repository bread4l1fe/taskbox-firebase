// scripts/reminders.mjs
import admin from 'firebase-admin';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!sa || !sa.project_id) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT secret with service account JSON');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(sa),
});
const db = admin.firestore();
const fcm = admin.messaging();

// Helper: round to minute (so we can de-dupe consistently)
function startOfMinute(d) { const x = new Date(d); x.setSeconds(0,0); return x; }

async function main() {
  // Window to tolerate GitHub Actions jitter (runs every ~5 min)
  const now = startOfMinute(new Date());
  const windowMins = 30; // +/-30 minutes
  const lower = new Date(now.getTime() - windowMins * 60000);
  const upper = new Date(now.getTime() + windowMins * 60000);

  // Also bound tasks we scan to +/- 7 days around now
  const days = 7;
  const scanStart = new Date(now.getTime() - days*24*60*60000);
  const scanEnd   = new Date(now.getTime() + days*24*60*60000);

  const usersSnap = await db.collection('users').get();
  let sent = 0;

  for (const u of usersSnap.docs) {
    const uid = u.id;

    // Fetch tokens once per user
    const tokensSnap = await db.collection('users').doc(uid).collection('tokens').get();
    const tokens = tokensSnap.docs.map(d => d.id);
    if (tokens.length === 0) continue;

    // Tasks with due_at_utc roughly in range
    const tasksSnap = await db.collection('users').doc(uid).collection('tasks')
      .where('due_at_utc', '>=', admin.firestore.Timestamp.fromDate(scanStart))
      .where('due_at_utc', '<=', admin.firestore.Timestamp.fromDate(scanEnd))
      .get();

    for (const t of tasksSnap.docs) {
      const task = t.data();
      const dueTs = task.due_at_utc;
      const offsets = Array.isArray(task.reminder_offsets_minutes) ? task.reminder_offsets_minutes : [];
      if (!dueTs || !dueTs.toDate || offsets.length === 0) continue;
      const due = dueTs.toDate();

      for (const m of offsets) {
        const sched = startOfMinute(new Date(due.getTime() - m*60000));
        if (sched >= lower && sched <= upper) {
          // de-dupe using reminderLog
          const key = `${t.id || t._id || 'task'}_${sched.getTime()}`;
          const logRef = db.collection('users').doc(uid).collection('reminderLog').doc(key);
          const exists = await logRef.get();
          if (exists.exists) continue;

          try {
            await fcm.sendEachForMulticast({
              tokens,
              notification: { title: `Reminder: ${task.title || 'Task'}`, body: `Due soon` },
              data: { taskId: t.id || '' }
            });
            await logRef.set({
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              taskId: t.id || '',
              time: sched
            });
            sent++;
          } catch (e) {
            console.error('FCM send error', e);
          }
        }
      }
    }
  }
  console.log(JSON.stringify({ ok: true, sent }));
}

main().catch(e => { console.error(e); process.exit(1); });
