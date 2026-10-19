import { Platform, PermissionsAndroid } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
export const CHANNEL_ID = 'default';
const CACHE_KEY = 'notifications_cache_v1';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
export type NotificationType =
  | 'streak'
  | 'room'
  | 'badge'
  | 'like'
  | 'session'
  | 'audio'
  | 'payment'
  | 'community'
  | 'mention'
  | 'challenge'
  | 'review';

const NOTIFICATION_TYPES: NotificationType[] = [
  'streak', 'room', 'badge', 'like', 'session', 'audio', 'payment', 'community', 'mention', 'challenge', 'review',
];

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  desc: string;
  createdAt: string; // ISO date string
  unread: boolean;
  targetRoomId?: string;
  targetBadgeId?: string;
  targetScreen?: string;
  targetGroupId?: string; // mention: the community group
  targetMessageId?: string; // mention: the message to open
  targetTab?: string; // VoiceRoomScreen: public | official, Dashboard: Home | Practice | Community | Profile
}

// ─────────────────────────────────────────────
// FIRESTORE HELPERS
// Data lives at: users/{uid}/notifications/{notificationId}
// Fields: type, title, body, createdAt (Timestamp), isRead (boolean),
//         targetRoomId (optional), targetBadgeId (optional)
// ─────────────────────────────────────────────
const getUid = () => {
  const uid = auth().currentUser?.uid;
  if (!uid) throw new Error('User is not logged in');
  return uid;
};

const notificationsCollection = () =>
  firestore().collection('users').doc(getUid()).collection('notifications');

// Converts a Firestore document or push payload into the app's notification format
const normalize = (raw: any): AppNotification => {
  const created = raw.createdAt;
  const createdAt =
    typeof created === 'string'
      ? created
      : created?.toDate
      ? created.toDate().toISOString()
      : new Date().toISOString();

  return {
    id: String(raw.id),
    type: NOTIFICATION_TYPES.includes(raw.type) ? raw.type : 'room',
    title: raw.title ?? 'New Update',
    desc: raw.body ?? raw.desc ?? '',
    createdAt,
    unread: raw.isRead !== undefined ? !raw.isRead : true,
    targetRoomId: raw.targetRoomId,
    targetBadgeId: raw.targetBadgeId,
    targetScreen: raw.targetScreen,
    targetTab: raw.targetTab,
    targetGroupId: raw.targetGroupId,
    targetMessageId: raw.targetMessageId,
  };
};

// ─────────────────────────────────────────────
// NOTIFICATION LIST APIs
// ─────────────────────────────────────────────
let lastDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot | null = null;

export async function fetchNotifications(page = 1, limit = 20) {
  if (page === 1) lastDoc = null;

  let query = notificationsCollection().orderBy('createdAt', 'desc').limit(limit);
  if (page > 1 && lastDoc) query = query.startAfter(lastDoc);

  const snap = await query.get();
  if (snap.docs.length > 0) lastDoc = snap.docs[snap.docs.length - 1];

  const items: AppNotification[] = snap.docs.map(d => normalize({ id: d.id, ...d.data() }));
  const hasMore = snap.docs.length === limit;

  if (page === 1) {
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(items)).catch(() => {});
  }
  return { items, hasMore };
}

export async function getCachedNotifications(): Promise<AppNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Real-time listener: every change in the logged-in user's notifications is pushed
// to the screen instantly (new notification, mark as read from another device, etc.)
export function subscribeToNotifications(
  onData: (items: AppNotification[]) => void,
  onError: (error: Error) => void,
  limit = 50,
): () => void {
  try {
    const unsubscribe = notificationsCollection()
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .onSnapshot(
        snap => {
          const items: AppNotification[] = snap.docs.map(d =>
            normalize({ id: d.id, ...d.data() }),
          );
          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(items)).catch(() => {});
          onData(items);
        },
        err => onError(err),
      );
    return unsubscribe;
  } catch (e) {
    onError(e as Error);
    return () => {};
  }
}

export const markNotificationRead = (id: string) =>
  notificationsCollection().doc(id).update({ isRead: true });

export async function markAllNotificationsRead() {
  // Not `where('isRead', '==', false)`: notifications that have no isRead field at all would be missed
  // and the red dot on Home would never go away. Take the latest ones and mark every unread one.
  const snap = await notificationsCollection().orderBy('createdAt', 'desc').limit(200).get();
  const unread = snap.docs.filter(d => d.data()?.isRead !== true);
  if (unread.length === 0) return;
  const batch = firestore().batch();
  unread.forEach(d => batch.update(d.ref, { isRead: true }));
  await batch.commit();
}

// ─────────────────────────────────────────────
// PERMISSION AND DEVICE TOKEN
// ─────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (result !== PermissionsAndroid.RESULTS.GRANTED) return false;
  }
  const status = await messaging().requestPermission();
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}

// Saves the device token on the user document so the server can send pushes
async function saveTokenToFirestore(token: string) {
  await firestore()
    .collection('users')
    .doc(getUid())
    .set({ fcmTokens: firestore.FieldValue.arrayUnion(token) }, { merge: true });
}

export async function registerDeviceToken() {
  const token = await messaging().getToken();
  if (token) await saveTokenToFirestore(token);
}

// Call this right BEFORE signing the user out. It removes this device's token from the
// user's document and deletes it, so pushes meant for this account are no longer
// delivered to this device after logout or account switch.
export async function unregisterDeviceToken() {
  try {
    const token = await messaging().getToken();
    const uid = auth().currentUser?.uid;
    if (token && uid) {
      await firestore()
        .collection('users')
        .doc(uid)
        .update({ fcmTokens: firestore.FieldValue.arrayRemove(token) });
    }
    await messaging().deleteToken();
  } catch (e) {
    console.warn('Device token cleanup failed', e);
  }
}

// ─────────────────────────────────────────────
// IN-APP EVENT BUS (lets the screen know when a new push arrives)
// ─────────────────────────────────────────────
type Listener = (n: AppNotification) => void;
const listeners = new Set<Listener>();

export const subscribeToIncoming = (cb: Listener) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

const fromRemoteMessage = (msg: FirebaseMessagingTypes.RemoteMessage): AppNotification =>
  normalize({
    id: msg.data?.notificationId ?? msg.messageId ?? String(Date.now()),
    type: msg.data?.type,
    title: msg.notification?.title ?? msg.data?.title,
    body: msg.notification?.body ?? msg.data?.body,
    createdAt: new Date().toISOString(),
    isRead: false,
    targetRoomId: msg.data?.targetRoomId,
    targetBadgeId: msg.data?.targetBadgeId,
    targetScreen: msg.data?.targetScreen,
    targetTab: msg.data?.targetTab,
    targetGroupId: msg.data?.targetGroupId,
    targetMessageId: msg.data?.targetMessageId,
  });

// ─────────────────────────────────────────────
// DISPLAY AND NAVIGATION
// ─────────────────────────────────────────────
export async function displayLocalNotification(msg: FirebaseMessagingTypes.RemoteMessage) {
  const title = String(msg.notification?.title ?? msg.data?.title ?? '').trim();
  const body = String(msg.notification?.body ?? msg.data?.body ?? '').trim();

  // A silent push with no text must never show up as an empty notification
  if (!title && !body) return;

  await notifee.displayNotification({
    // Same id for the same notification, so one push can never show twice
    id: msg.data?.notificationId ? String(msg.data.notificationId) : undefined,
    title: title || 'ECC',
    body,
    data: (msg.data as Record<string, string>) ?? {},
    android: { channelId: CHANNEL_ID, pressAction: { id: 'default' } },
  });
}

// Screens a notification is allowed to open (all registered in AppNavigator)
const ALLOWED_SCREENS = [
  'OneToOneSessionsScreen',
  'UpcomingSessionsListScreen',
  'SubscriptionScreen',
  'AudioSessionsScreen',
  'TeacherAudioSessionsScreen',
  'TeacherDashboardScreen',
  'ProgramFlowScreen',
  'VoiceRoomScreen',
  'Dashboard',
];
const DASHBOARD_TABS = ['Home', 'Practice', 'Community', 'Profile'];

export function navigateFromData(navigation: any, data?: Record<string, any>) {
  if (!data || !navigation) return;

  const screen = data.targetScreen as string | undefined;
  const tab = data.targetTab as string | undefined;

  // 0. @mention: open the Community tab, the group chat and the mentioned message
  if (data.type === 'mention') {
    navigation.navigate('Dashboard', {
      screen: 'Community',
      params: {
        openGroupId: data.targetGroupId || 'ecc_community_chat',
        messageId: data.targetMessageId || undefined,
        openedAt: Date.now(),
      },
    });
    return;
  }

  // 1. Explicit target screen sent by the backend
  if (screen && ALLOWED_SCREENS.includes(screen)) {
    if (screen === 'Dashboard') {
      // The bottom tabs live inside the "Dashboard" navigator, so they must be nested
      if (tab && DASHBOARD_TABS.includes(tab)) navigation.navigate('Dashboard', { screen: tab });
      else navigation.navigate('Dashboard');
      return;
    }
    if (screen === 'VoiceRoomScreen') {
      navigation.navigate('VoiceRoomScreen', {
        tab: tab === 'official' ? 'official' : undefined,
        roomId: data.targetRoomId || undefined,
      });
      return;
    }
    navigation.navigate(screen);
    return;
  }

  // 2. Defaults by notification type (also covers older notifications without a target)
  switch (data.type) {
    case 'room':
      if (data.targetRoomId) {
        navigation.navigate('VoiceRoomScreen', { roomId: data.targetRoomId });
      } else {
        navigation.navigate('OneToOneSessionsScreen');
      }
      break;
    case 'session':
      navigation.navigate('UpcomingSessionsListScreen');
      break;
    case 'audio':
      navigation.navigate('VoiceRoomScreen', { tab: 'official' });
      break;
    case 'payment':
      navigation.navigate('ProgramFlowScreen');
      break;
    case 'review':
      navigation.navigate('TeacherDashboardScreen');
      break;
    case 'badge':
      // "Profile" is a tab inside the "Dashboard" tab navigator, so it must be nested
      navigation.navigate('Dashboard', {
        screen: 'Profile',
        params: { badgeId: data.targetBadgeId },
      });
      break;
    case 'streak':
      navigation.navigate('Dashboard', { screen: 'Practice' });
      break;
    case 'like':
    case 'community':
    case 'challenge':
      navigation.navigate('Dashboard', { screen: 'Community' });
      break;
  }
}

// ─────────────────────────────────────────────
// INIT: called from AppNavigator after login
// ─────────────────────────────────────────────
export async function initNotifications(navigation: any) {
  const granted = await requestNotificationPermission();

  // The channel is required, otherwise notifications will not show on Android
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'General',
    importance: AndroidImportance.HIGH,
  });

  if (granted) {
    registerDeviceToken().catch(e => console.warn('Device token registration failed', e));
  }

  const unsubs: Array<() => void> = [];

  unsubs.push(
    messaging().onTokenRefresh(token => {
      saveTokenToFirestore(token).catch(() => {});
    }),
  );

  // Push received while the app is in the foreground
  unsubs.push(
    messaging().onMessage(async msg => {
      await displayLocalNotification(msg);
      const n = fromRemoteMessage(msg);
      listeners.forEach(l => l(n));
    }),
  );

  // Notification tapped while the app was in the background
  unsubs.push(
    messaging().onNotificationOpenedApp(msg => navigateFromData(navigation, msg.data)),
  );

  // Notifee notification tapped while the app is in the foreground
  unsubs.push(
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) navigateFromData(navigation, detail.notification?.data);
    }),
  );

  // App was closed and opened by tapping a notification
  const initialFcm = await messaging().getInitialNotification();
  if (initialFcm) navigateFromData(navigation, initialFcm.data);

  const initialNotifee = await notifee.getInitialNotification();
  if (initialNotifee) navigateFromData(navigation, initialNotifee.notification?.data);

  return () => unsubs.forEach(u => u());
}

// ─────────────────────────────────────────────
// BACKGROUND HANDLER: register this in index.js
// ─────────────────────────────────────────────
export async function handleBackgroundMessage(msg: FirebaseMessagingTypes.RemoteMessage) {
  // Messages with a notification payload are shown by the system automatically.
  // Only data-only messages need to be displayed manually.
  if (!msg.notification) {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'General',
      importance: AndroidImportance.HIGH,
    });
    await displayLocalNotification(msg);
  }
}

// ─────────────────────────────────────────────
// TIME FORMAT
// ─────────────────────────────────────────────
export function formatTimeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}