# RebelX CRM - Google Voice Auto Dialer Extension

This Chrome extension automatically clicks the "Call" button in Google Voice when you initiate a call from your RebelX CRM.

## 🚀 Installation Instructions

### Step 1: Load the Extension in Chrome

1. **Open Chrome** and navigate to:
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode**
   - Toggle the switch in the top-right corner

3. **Load Unpacked Extension**
   - Click "Load unpacked"
   - Navigate to and select this folder: `chrome-extension-gv-autodialer`

4. **Verify Installation**
   - You should see "RebelX CRM - Google Voice Auto Dialer" in your extensions list
   - Make sure it's enabled (toggle switch is blue)

### Step 2: Test the Extension

1. Go to your RebelX CRM
2. Click on any phone number's "Call" button
3. Google Voice will open in a popup
4. The extension will **automatically click the Call button** for you
5. Your phone should start ringing immediately

## 📋 How It Works

- Detects when Google Voice opens with the `?a=nc,` parameter (from CRM)
- Waits for the Google Voice UI to fully load
- Finds the "Call" button using multiple detection strategies
- Automatically clicks it after 1 second
- Logs all actions to the browser console for debugging

## 🐛 Troubleshooting

**Extension not working?**
1. Open Chrome DevTools (F12) on the Google Voice page
2. Check the Console tab for `[RebelX Auto-Dialer]` messages
3. Verify the extension is enabled at `chrome://extensions/`

**Still not clicking?**
- Google Voice occasionally updates their UI, which may require updating the button selectors
- Check the console logs to see which step is failing

## 🔄 Future Enhancements

Potential improvements:
- Add a visual indicator when auto-dial is triggered
- Configurable delay before clicking
- Support for other VoIP services (Twilio, RingCentral, etc.)

## ⚠️ Privacy Note

This extension:
- ✅ Only runs on `voice.google.com`
- ✅ Does not collect or transmit any data
- ✅ Only automates clicking the Call button
- ✅ All code is local to your browser

## 📝 Version

Current version: **1.0.0**

---

Built for RebelX Headquarters CRM System
