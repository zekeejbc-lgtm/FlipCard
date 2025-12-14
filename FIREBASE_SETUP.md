# Firebase Cloud Messaging Setup (100% FREE)

Follow these steps to enable push notifications with Firebase - **no credit card required!**

## Step 1: Create Firebase Project (2 minutes)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter project name: `cumlaude-push` (or any name)
4. **Disable Google Analytics** (not needed) - this keeps it 100% free
5. Click **"Create project"**
6. Wait for setup to complete → Click **"Continue"**

## Step 2: Add Web App to Firebase (1 minute)

1. In Firebase console, click the **Web icon** `</>`
2. App nickname: `CumLaude Web App`
3. **Don't** check "Firebase Hosting" 
4. Click **"Register app"**
5. You'll see your Firebase config - **COPY THIS!** It looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB...",
  authDomain: "cumlaude-push.firebaseapp.com",
  projectId: "cumlaude-push",
  storageBucket: "cumlaude-push.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

6. Click **"Continue to console"**

## Step 3: Enable Cloud Messaging (30 seconds)

1. In Firebase console sidebar, click **⚙️ Settings** → **Project settings**
2. Go to **"Cloud Messaging"** tab
3. Scroll to **"Web configuration"**
4. Click **"Generate key pair"** under "Web Push certificates"
5. Copy the **Key pair** value (looks like: `BN7sJ...`)

## Step 4: Update Your Code (1 minute)

### A. Update `index.tsx` (around line 2480)

Replace the `FIREBASE_CONFIG` object:

```typescript
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",           // ← Paste your apiKey
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",  // ← Paste your authDomain
  projectId: "YOUR_PROJECT_ID",     // ← Paste your projectId
  storageBucket: "YOUR_PROJECT_ID.appspot.com",   // ← Paste your storageBucket
  messagingSenderId: "YOUR_SENDER_ID",  // ← Paste your messagingSenderId
  appId: "YOUR_APP_ID"              // ← Paste your appId
};
```

### B. Update `public/sw.js` (around line 64)

Replace the `firebase.initializeApp()` config with **the same values**:

```javascript
firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
});
```

## Step 5: Update Backend to Send Notifications

### A. Get Server Key

1. In Firebase console: **⚙️ Settings** → **Project settings** → **Cloud Messaging** tab
2. Under **"Cloud Messaging API (Legacy)"**, click the **3 dots menu** → **"Manage API in Google Cloud Console"**
3. Click **"ENABLE"** if not already enabled
4. Go back to Firebase console → **Cloud Messaging** tab
5. Copy your **Server key** (starts with `AAAA...`)

### B. Update `backend.gs`

Add this function at the end of your `backend.gs` file:

```javascript
/**
 * YOUR SERVER KEY - paste it here
 */
const FCM_SERVER_KEY = 'AAAA...YOUR_SERVER_KEY_HERE';

/**
 * Actually send FCM notification (called by trigger)
 */
function sendFCMNotification(token, title, body, url) {
  const payload = {
    notification: {
      title: title,
      body: body,
      icon: '/icon-192.svg'
    },
    data: {
      url: url || '/'
    },
    to: token
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'key=' + FCM_SERVER_KEY
    },
    payload: JSON.stringify(payload)
  };
  
  try {
    const response = UrlFetchApp.fetch('https://fcm.googleapis.com/fcm/send', options);
    return { success: true, response: response.getContentText() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Process push queue and send via FCM
 */
function processPushQueue() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const queueSheet = ss.getSheetByName('PushQueue');
    
    if (!queueSheet) return;
    
    const data = queueSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const status = data[i][7]; // Status column
      
      if (status === 'pending') {
        const userId = data[i][1];
        const title = data[i][2];
        const body = data[i][3];
        const url = data[i][4];
        const subscription = JSON.parse(data[i][6]);
        
        if (subscription.type === 'fcm' && subscription.token) {
          const result = sendFCMNotification(subscription.token, title, body, url);
          
          if (result.success) {
            queueSheet.getRange(i + 1, 8).setValue('sent');
            queueSheet.getRange(i + 1, 10).setValue(new Date().toISOString());
          } else {
            queueSheet.getRange(i + 1, 8).setValue('failed');
          }
        }
      }
    }
    
    Logger.log('Push queue processed');
  } catch (error) {
    Logger.log('Error processing queue: ' + error.message);
  }
}
```

### C. Setup Trigger for Queue Processing

1. In Apps Script editor, click **⏰ Triggers** (clock icon)
2. Click **+ Add Trigger**
3. Function: **`processPushQueue`**
4. Event source: **Time-driven**
5. Type: **Minutes timer**
6. Interval: **Every 5 minutes** (or Every minute for faster notifications)
7. Click **Save**

## Step 6: Test It! 🎉

1. Deploy your updated code
2. Open the app → Click bell icon (🔔)
3. Click **"Enable Notifications"**
4. Allow notifications when browser prompts
5. Add an exam for tomorrow to test
6. Notifications will be sent automatically!

## ✅ What You Get (All FREE)

- ✅ Unlimited push notifications
- ✅ Works when app is closed
- ✅ Automatic exam reminders
- ✅ No credit card required
- ✅ No trial period - free forever

## 🔍 Troubleshooting

**"Firebase not configured" error?**
→ Check that you replaced ALL instances of `YOUR_API_KEY` etc. in both `index.tsx` AND `sw.js`

**Notifications not arriving?**
→ Check Firebase console → Cloud Messaging → Make sure API is enabled
→ Check Apps Script logs to see if triggers are running

**"Authorization key not found"?**
→ Make sure you copied the **Server key** (not the Web Push certificate)

## 💡 Cost Breakdown

- Firebase Spark Plan: **$0/month**
- Cloud Messaging: **Unlimited** messages free
- Google Apps Script: **Free** (within quota)
- Total: **$0** 🎉

No credit card needed, ever!
