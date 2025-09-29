# Taskbox (Serverless Firebase Edition)

A task tracker that works on your phone (as a PWA), syncs across devices, stores **day-by-day progress**, 
and sends **reminders** at custom offsets — **without installing anything on your home PC**.

**Stack**
- **Firebase Hosting** (serves the PWA)
- **Firestore** (real-time DB)
- **Firebase Auth** (email/password)
- **Firebase Cloud Messaging (FCM)** (push notifications)
- **Cloud Functions + Cloud Scheduler** (cron job to send reminders every minute)
- **PWA** (install on your phone; iOS 16.4+ and Android supported)

## One-time setup (no software install on your home PC)

1. Create a Firebase project at https://console.firebase.google.com (free tier is fine).
2. In **Build → Firestore**, create a database in production mode.
3. In **Build → Authentication**, enable **Email/Password**.
4. In **Build → Cloud Messaging**, generate a **Web Push certificate** key pair (VAPID key). Copy the **Public key**.
5. In **Hosting**, click **Get Started** and select **GitHub integration** → “Connect repository” → pick this codebase once you push it to GitHub.
6. In **Functions**, enable billing if prompted for schedulers (the Blaze pay-as-you-go plan often required for Cloud Scheduler; 
   costs are near-zero for this workload). Alternatively, use the Firebase-scheduled functions (2nd gen) with Cloud Scheduler.
7. In **Cloud Scheduler**, create a job that triggers **every minute** and calls the Functions HTTPS endpoint (details below).
   - Schedule: `* * * * *`
   - HTTP Method: `POST`
   - URL: your deployed function URL `/checkReminders`
   - Add a header `X-CRON-KEY: <your-secret>` (also set the same secret in Functions config).

## Configure this repo

- Duplicate `web/src/firebaseConfig.sample.ts` to `web/src/firebaseConfig.ts` and fill with your Firebase web app keys.
- Set the **VAPID public key** in `web/src/firebase-messaging-sw.js` and `web/src/push.ts` where indicated.
- In Cloud Functions, set a shared secret for the scheduler:
  ```bash
  # If using local CLI; otherwise set via Firebase Console > Functions > Environment variables
  firebase functions:config:set cron.key="YOUR_RANDOM_SECRET"
  ```
  Or add `"cron": { "key": "YOUR_RANDOM_SECRET" }` in the Functions runtime config through the console.

### Deploy without installing anything locally
1. Create a new **GitHub repo**, upload this folder.
2. In Firebase Hosting, **Connect to GitHub** and select your repo for automatic deploys.
3. Add a GitHub Action for Functions (or deploy functions from the Firebase Console / Cloud Build).
   - Alternatively, use the “**Manage deployments**” in the Firebase Console to trigger a build.
4. After deploy, note the Functions URL for `checkReminders` and set it as the target for **Cloud Scheduler** (step above).

## How it works
- Tasks live under `users/{uid}/tasks/{taskId}` with fields:
  - `title`, `description`, `due_at_utc` (Timestamp), `reminder_offsets_minutes` (array of numbers).
- Daily progress is `users/{uid}/tasks/{taskId}/progress/{YYYY-MM-DD}` → `{ done: bool, notes?: string }`.
- Device tokens live at `users/{uid}/tokens/{token}` (created by the PWA when you enable notifications).
- The scheduled function runs every minute:
  - For tasks with a `due_at_utc`, it computes each reminder time (`due - offset`).
  - If "now" matches a reminder minute and no log entry exists, it sends an FCM push to all tokens for that user and records it in `reminderLog`.

## Firestore Security Rules (included)
- Users can only read/write their own `users/{uid}/...` documents.
- Tokens are write-once by the logged-in user; reminder logs are read-only for clients.

## PWA notes
- Open your site on your phone → “Add to Home Screen.”
- Then tap the **bell icon** in the app to **Enable notifications**.
- iOS requires the PWA to be installed and notification permission granted in Settings for your site.

---

Default timezone behavior: the client sends your IANA timezone on signup. All due times are converted to UTC on the client before writing, and displayed in your local time.
