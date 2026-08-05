# Mobile Testing & Debugging Guide

## Quick Mobile Testing Setup

### Using Browser DevTools

#### Chrome DevTools
1. Open DevTools: `F12` or `Ctrl+Shift+I`
2. Click "Toggle device toolbar" (Ctrl+Shift+M)
3. Select device: iPhone 12/13/14/15 or Galaxy S21/S22/S23
4. Rotate device: `Ctrl+Shift+R`
5. Throttle network: Devtools > Network > Throttle to "Slow 3G"

#### Safari DevTools
1. Enable Developer Mode: Preferences > Advanced > Show Develop menu
2. Use Simulator: Xcode > Open > Simulators > iPhone/iPad
3. Inspect Remote Elements: Develop > iPhone > Select Page

#### Firefox DevTools
1. Press `Ctrl+Shift+M` for responsive design mode
2. Select device preset
3. Rotate and resize as needed

### Physical Device Testing

#### iOS Testing
```bash
# Using iPhone/iPad directly
1. Connect to same WiFi as development machine
2. Open Safari on device
3. Navigate to: http://<your-ip>:3000
4. Test email fetching and link opening
5. Test landscape/portrait modes
6. Check safe area rendering (notched devices)
```

#### Android Testing
```bash
# Using Android device or emulator
1. Enable USB Debugging: Settings > Developer Options > USB Debugging
2. Connect via USB or same WiFi
3. Open Chrome on device
4. Navigate to: http://<your-ip>:3000
5. Test all features
6. Check notification drawer and system UI
```

## Device-Specific Testing Checklist

### iOS (iPhone)
- [ ] Homescreen app added via "Add to Home Screen"
- [ ] Status bar displays correctly
- [ ] Safe area respected on notched devices (iPhone X, 11, 12, 13, 14, 15)
- [ ] Links open in new Safari tab
- [ ] Form inputs don't trigger zoom
- [ ] Keyboard displays correctly
- [ ] Landscape mode works
- [ ] Double-tap doesn't zoom
- [ ] Pull-to-refresh doesn't interfere
- [ ] Battery/signal display correct

### Android (Chrome)
- [ ] All touches register properly
- [ ] Links open in new Chrome tab
- [ ] Bottom system navigation doesn't overlap content
- [ ] Font sizes appropriate
- [ ] Landscape mode responsive
- [ ] Long scrolling works smoothly
- [ ] Memory usage reasonable
- [ ] No console errors

### Tablet Testing
- [ ] Content uses full width without clipping
- [ ] Max-width constraint respected (xl)
- [ ] Touch targets not too small
- [ ] Landscape/portrait transitions smooth
- [ ] Keyboard appearance handled gracefully

## Browser Console Debugging

### Check for Device Type
```javascript
// In browser console
console.log({
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
  isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
  isAndroid: /Android/.test(navigator.userAgent),
  userAgent: navigator.userAgent
});
```

### Test Link Opening
```javascript
// Try opening a test URL
const compat = {
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
  isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
  openURL: function(url) {
    if (this.isIOS && this.isSafari) {
      window.open(url, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }
};

// Test it
compat.openURL('https://www.google.com');
```

### Check Viewport
```javascript
// View current viewport
console.log({
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  outerWidth: window.outerWidth,
  outerHeight: window.outerHeight,
  devicePixelRatio: window.devicePixelRatio,
  orientation: window.orientation || screen.orientation.type
});
```

### Check Safe Area (iOS)
```javascript
// View safe area insets
const styles = getComputedStyle(document.body);
console.log({
  top: 'env(safe-area-inset-top)',
  bottom: 'env(safe-area-inset-bottom)',
  left: 'env(safe-area-inset-left)',
  right: 'env(safe-area-inset-right)'
});
```

## Performance Testing

### Lighthouse Audit (Mobile)
1. Open DevTools > Lighthouse
2. Select "Mobile"
3. Audit: Performance, Accessibility, Best Practices
4. View report and fix issues

### Network Throttling
```
Preset Throttles:
- Slow 3G: 400 Kbps, 20s latency
- Fast 3G: 1.6 Mbps, 2s latency
- 4G: 4 Mbps, 50ms latency
- WiFi: 30 Mbps, 2ms latency
```

### Web Vitals Testing
```javascript
// In browser console
import web-vitals:
https://web.dev/vitals/ tools for measuring:
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)
```

## Common Issues & Debugging

### Issue: Links Not Opening

**Debugging Steps:**
```javascript
// 1. Check device detection
console.log('iOS:', /iPad|iPhone|iPod/.test(navigator.userAgent));
console.log('Safari:', /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent));

// 2. Check pop-up blocker
console.log('Pop-ups blocked?', (window.chrome && window.chrome.webstore));

// 3. Try opening manually
window.open('https://www.netflix.com', '_blank');

// 4. Check if links have href
document.querySelectorAll('a').forEach(a => console.log(a.href));
```

**Solutions:**
- [ ] Check Safari settings: Settings > Websites > Pop-ups > Allow
- [ ] Try different browser
- [ ] Refresh page (Ctrl+Shift+R)
- [ ] Clear browser cache
- [ ] Disable browser extensions

### Issue: Blank Screen

**Debugging Steps:**
```javascript
// 1. Check if DOM loaded
console.log('DOM Ready:', document.readyState);

// 2. Check for JS errors
window.onerror = (msg, url, line) => console.error(msg, url, line);

// 3. Check iframe status
console.log('Iframe src:', document.getElementById('emailFrame').srcdoc ? 'Set' : 'Not set');

// 4. Check visible elements
console.log('Body innerHTML chars:', document.body.innerHTML.length);
```

**Solutions:**
- [ ] Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
- [ ] Close all tabs and reopen
- [ ] Restart browser
- [ ] Check network in DevTools
- [ ] Try incognito/private mode

### Issue: Slow Loading

**Debugging Steps:**
```javascript
// 1. Measure API response time
console.time('fetch-email');
fetch('/api/fetch-latest-code', {...}).then(() => console.timeEnd('fetch-email'));

// 2. Check network: DevTools > Network tab
// 3. Throttle to slow 3G to simulate
// 4. Check what files are loading slowly
```

**Solutions:**
- [ ] Check network connection speed
- [ ] Disable browser extensions
- [ ] Clear browser cache
- [ ] Try WiFi instead of mobile data
- [ ] Try different time of day (server load)

### Issue: Keyboard Covers Content

**This is Normal Browser Behavior**
```
Solutions:
- Scroll down manually
- Rotate to landscape
- Tap outside keyboard to close
- Use auto-scroll (browser feature)
```

## Emulator vs Real Device

### Android Emulator (Better)
- Fast performance
- Easy to test multiple devices
- Can simulate network conditions
- Built-in debugging tools
- Free via Android Studio

### iOS Simulator (Better)
- Very accurate to real devices
- Built into Xcode
- Fast for development
- Good for quick testing

### Real Devices (Best for Final Testing)
- Actual performance metrics
- Real network conditions
- Real user experience
- Catch device-specific bugs
- Test on actual hardware user will use

## Continuous Testing Strategy

### Daily Testing
- [ ] Test on current latest iOS device
- [ ] Test on current latest Android device
- [ ] Test on desktop browser
- [ ] Quick link opening test
- [ ] Email fetch test

### Weekly Testing
- [ ] Test on multiple device sizes
- [ ] Test slow network (throttle)
- [ ] Test offline functionality
- [ ] Test on different browsers
- [ ] Run Lighthouse audit

### Monthly Testing
- [ ] Test on variety of older devices
- [ ] Test on rare screen sizes
- [ ] Test landscape/portrait transitions
- [ ] Performance regression check
- [ ] Accessibility audit

## Test Case Scenarios

### Scenario 1: Basic Email Fetch
```
1. Open app on iPhone
2. Select first email
3. Click "Fetch Email"
4. Wait for result
5. Verify email displays
6. Expected: Email shows correctly with all info
```

### Scenario 2: Link Opening
```
1. Fetch an email with a link
2. Click on the link in email
3. Verify new tab opens
4. Expected: Netflix link opens in new browser tab
```

### Scenario 3: Landscape Rotation
```
1. Open app in portrait
2. Fetch an email
3. Rotate device to landscape
4. Expected: Layout adjusts, email still readable
```

### Scenario 4: Slow Connection
```
1. Open DevTools > Network
2. Throttle to "Slow 3G"
3. Fetch an email
4. Expected: Loading state shows, no timeout errors
```

### Scenario 5: Error Handling
```
1. Select an email
2. Disable internet/simulate offline
3. Try to fetch
4. Expected: Error message shows, can retry
```

## Browser Extension Impact

### Known Issues
- AdBlock Plus: May block API calls
- Privacy Badger: May block tracking pixels in emails
- uBlock Origin: May block form elements
- Dark Mode extensions: May override styles

### Testing Without Extensions
```
Firefox: Create new profile
Chrome: Incognito mode (disables extensions)
Safari: Private mode
```

## CI/CD Testing Recommendations

### GitHub Actions Example
```yaml
- name: Run Mobile Tests
  uses: cypress-io/github-action@v2
  with:
    browser: chrome
    spec: "cypress/e2e/mobile/**/*.cy.js"
    config: viewportWidth=375,viewportHeight=667
```

### Automated Testing Platforms
- BrowserStack (real devices)
- Sauce Labs (cross-browser)
- LambdaTest (parallel testing)
- Appetize (mobile emulation)

## Developer Quick Commands

### Start Server
```bash
npm start
```

### Build for Production
```bash
npm run build
```

### Run Tests
```bash
npm test
```

### Check Device
```bash
# Get your IP for mobile testing
ipconfig getifaddr en0  # macOS
hostname -I            # Linux
```

### Test with Mock
```javascript
// Mock slow API response
const mockFetch = (time = 3000) => {
  const originalFetch = window.fetch;
  window.fetch = (...args) => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(originalFetch(...args)), time);
    });
  };
};

mockFetch(3000); // 3 second delay
```

---

**Last Updated**: August 5, 2026
**Maintained By**: Development Team
