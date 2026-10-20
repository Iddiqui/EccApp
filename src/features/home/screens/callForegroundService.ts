// callForegroundService.ts
// Android stops the microphone of an app that goes to the background (home button, another app,
// screen off) unless it runs a foreground service. This keeps the mic and speaker alive during a
// call. It uses @notifee/react-native when it is installed and does nothing when it is not.
import { Platform } from 'react-native';

let notifee: any = null;
let AndroidImportance: any = null;
let AndroidForegroundServiceType: any = null;
try {
  const m = require('@notifee/react-native');
  notifee = m.default || m;
  AndroidImportance = m.AndroidImportance;
  AndroidForegroundServiceType = m.AndroidForegroundServiceType;
} catch (e) {
  console.log('@notifee/react-native is not installed: the call will pause when the app goes to the background.');
}

// TEST SWITCH: false = no background notification/service at all (to check if it disturbs the microphone)
const ENABLE_CALL_SERVICE = false;

const CHANNEL_ID = 'ecc_call_channel';
const NOTIFICATION_ID = 'ecc_call_active';
let registered = false;

const ensureRegistered = () => {
  if (registered || !notifee || Platform.OS !== 'android') return;
  registered = true;
  try {
    // The service lives until stopCallForegroundService() is called
    notifee.registerForegroundService(() => new Promise<void>(() => {}));
  } catch (e) {}
};
ensureRegistered();

export const startCallForegroundService = async (title?: string) => {
  if (!ENABLE_CALL_SERVICE) return;
  if (!notifee || Platform.OS !== 'android') return;
  ensureRegistered();
  try {
    try { await notifee.requestPermission(); } catch (e) {}
    const channelId = await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Active call',
      importance: AndroidImportance?.LOW ?? 2,
    });
    const types = AndroidForegroundServiceType
      ? [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE,
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
        ].filter((x: any) => x !== undefined)
      : undefined;
    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title: 'ECC call in progress',
      body: title ? `${title} - tap to return` : 'Tap to return to your call',
      android: {
        channelId,
        asForegroundService: true,
        ongoing: true,
        onlyAlertOnce: true,
        ...(types && types.length ? { foregroundServiceTypes: types } : {}),
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    });
  } catch (e) {
    console.log('Could not start the call foreground service:', e);
  }
};

export const stopCallForegroundService = async () => {
  if (!notifee || Platform.OS !== 'android') return;
  try {
    await notifee.stopForegroundService();
    await notifee.cancelNotification(NOTIFICATION_ID);
  } catch (e) {}
};