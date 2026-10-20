/* Capacitor loads the live Stay site (the app has server routes for voice tokens, so it cannot be bundled as static files).
 * STAY_MOBILE_URL points a debug build at a dev server instead, e.g. http://10.0.2.2:3000 from the Android emulator. */
const tokens = require('./theme.json');

const origin = (process.env.STAY_MOBILE_URL || tokens.app.origin).replace(/\/$/, '');
const insecure = origin.startsWith('http://');

/** @type {import('@capacitor/cli').CapacitorConfig} */
module.exports = {
  appId: 'app.stay.mobile',
  appName: 'Stay',
  webDir: 'www',
  server: {
    url: origin + '/app/today',
    androidScheme: 'https',
    cleartext: insecure,
    allowNavigation: [new URL(origin).hostname],
    errorPath: 'offline.html', // shown from the app bundle when the site cannot be reached
  },
  android: { backgroundColor: tokens.color.canvas, allowMixedContent: false },
  ios: { backgroundColor: tokens.color.canvas, contentInset: 'automatic' },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1400,
      launchAutoHide: true,
      launchFadeOutDuration: 250,
      backgroundColor: tokens.color.canvas,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false,
    },
    StatusBar: { style: 'LIGHT', backgroundColor: tokens.color.canvas, overlaysWebView: false },
    LocalNotifications: { smallIcon: 'ic_stat_stay', iconColor: tokens.color.accent },
  },
};
