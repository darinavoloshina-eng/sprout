// useNetworkStatus.ts
// Real connectivity state (screen 5e) via NetInfo's reachability checks,
// rather than trusting only OS-reported connection type — a device can be
// "connected" to Wi-Fi with no actual internet. Any screen can call this to
// react to being offline; there's no global store in this app (state is
// just the profile, lifted to App.tsx), so a hook is the right level here
// rather than introducing one for a single boolean.

import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable can be null while NetInfo is still determining
      // it — treat "unknown" as online so we don't flash an offline banner
      // on every cold start before the first real check resolves.
      setIsOnline(state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  return { isOnline };
}
