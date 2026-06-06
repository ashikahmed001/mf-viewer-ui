import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fundsight.app',
  appName: 'FundSight',
  webDir: 'dist',
  server: {
    // During development, point to your local backend so Hot Reload works.
    // Comment this out for a production build — the app will use the bundled dist/.
    // url: 'http://YOUR_LOCAL_IP:5173',
    // allowNavigation: ['*'],
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#ffffff',
  },
};

export default config;
