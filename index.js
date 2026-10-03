/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { handleBackgroundMessage } from './src/services/notificationService';

// Handles push messages that arrive while the app is in the background or closed.
// This must be registered here, outside of any component.
messaging().setBackgroundMessageHandler(handleBackgroundMessage);

// Notifee requires a background event handler to be registered.
// Taps on notifications are handled by getInitialNotification in initNotifications.
notifee.onBackgroundEvent(async () => {});

AppRegistry.registerComponent(appName, () => App);