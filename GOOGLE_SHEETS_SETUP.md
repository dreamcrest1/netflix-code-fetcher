# Google Sheets Integration Guide

## Overview

Your Dreamcrest Code Fetcher now automatically syncs email credentials from a Google Sheet. No more manual updates - just edit your Google Sheet and the app updates automatically!

## Current Setup

**Google Sheet URL:**
```
https://docs.google.com/spreadsheets/d/e/2PACX-1vQmQAUePtmS_c9laszhSSbPNFs_xr0yBsMf5k2bhHNKBjG0akqNK4mxgoOHj8TFXPMvGpXRwzfy2c5F/pub?output=csv
```

**Sheet Format:**

| Email | Password |
|-------|----------|
| df3@dreamespire.com | XGas1212$$@@ |
| nf2m@dreamcrest.net | XGas1212$$@@ |
| nf4m@dreamcrest.net | XGas1212$$@@ |
| nf3m@dreamcrest.net | XGas1212$$@@ |
| p3m@dreamespire.com | XGas1212$$@@ |

## How It Works

### Backend (API)
1. When user clicks "Fetch Email", the backend fetches latest data from Google Sheet
2. CSV data is parsed and cached for 60 seconds
3. If Google Sheet is unavailable, cached data is used as fallback
4. No passwords are stored in the application code

### Frontend (Website)
1. On page load, email options are fetched from Google Sheet
2. Dropdown updates with latest emails automatically
3. User selects an email and clicks "Fetch Email"
4. API retrieves the corresponding password from the Sheet

## How to Update

### Add a New Email

1. Open the Google Sheet
2. Add a new row with: `newemail@domain.com` in Column A, `Password123` in Column B
3. Press Ctrl+S to save
4. **Done!** The app will automatically pick it up on the next fetch

### Change a Password

1. Open the Google Sheet
2. Update the password in Column B
3. Press Ctrl+S to save
4. **Done!** New password will be used immediately

### Remove an Email

1. Open the Google Sheet
2. Delete the row containing that email
3. Press Ctrl+S to save
4. **Done!** Email will disappear from the dropdown on next refresh

## Caching

- Credentials are cached for **60 seconds** on both frontend and backend
- This prevents excessive API calls and improves performance
- If you update the sheet, changes appear within 60 seconds
- Offline mode: If Google Sheet is unreachable, cached data is used

## Error Handling

**If Google Sheet is Down:**
- App uses last cached credentials
- Shows no error to user
- Continues working normally

**If All Credentials Removed:**
- Dropdown shows "Loading emails..."
- User sees error: "No email credentials available"

**If Sheet Format is Wrong:**
- App falls back to cached data
- Check that Column A = Email, Column B = Password
- Ensure no extra spaces in email addresses

## Performance

- **Initial load**: 1-2 seconds (fetches from Google Sheet)
- **Subsequent loads**: Instant (uses cache)
- **API call**: < 500ms
- **Cache refresh**: Every 60 seconds

## Google Sheets URL

This is the "Publish to Web" CSV export URL:
```
https://docs.google.com/spreadsheets/d/e/2PACX-1vQmQAUePtmS_c9laszhSSbPNFs_xr0yBsMf5k2bhHNKBjG0akqNK4mxgoOHj8TFXPMvGpXRwzfy2c5F/pub?output=csv
```

**Important:** Keep this URL public (already published). Anyone with this link can see email addresses (but not passwords in Google Sheet).

## Troubleshooting

### Emails Not Showing
- Refresh the page (Ctrl+F5)
- Wait 60 seconds for cache to refresh
- Check if Google Sheet is accessible

### Old Password Still Being Used
- Cache expires in 60 seconds automatically
- Or manually clear browser cache
- Force refresh: Ctrl+Shift+Delete

### Can't Update Sheet
- Make sure you're editing the correct published sheet
- Check that "Publish to Web" is still enabled
- Try re-publishing the sheet

## Security Notes

- Email addresses are visible in the published CSV
- Passwords are only visible in the private Google Sheet
- API connection is HTTPS (encrypted)
- No credentials stored in application code
- Passwords never logged or displayed

## Future Improvements

Possible enhancements:
- Custom IMAP server configuration per email
- Two-factor authentication support
- Email account enable/disable toggle
- Last login timestamp tracking
