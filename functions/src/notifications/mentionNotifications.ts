// functions/src/notifications/mentionNotifications.ts
//
// When someone is @mentioned in a community group chat, that user gets a notification
// (saved in users/{uid}/notifications + a push). Tapping it opens the group chat at that message.
// admin.initializeApp() is already called in functions/src/index.ts.

import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

// Firestore triggers must run in the same region as the Firestore database
const FIRESTORE_REGION = 'asia-south2';

const INVALID_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
];

const clip = (s: any, n: number): string => {
  const text = typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '';
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
};

async function notifyMentionedUser(
  uid: string,
  title: string,
  body: string,
  groupId: string,
  messageId: string,
): Promise<void> {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);

  const notifRef = userRef.collection('notifications').doc();
  await notifRef.set({
    type: 'mention',
    title,
    body,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    targetScreen: 'Dashboard',
    targetTab: 'Community',
    targetGroupId: groupId,
    targetMessageId: messageId,
  });

  const userSnap = await userRef.get();
  const tokens: string[] = userSnap.data()?.fcmTokens ?? [];
  if (tokens.length === 0) return;

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: {
      type: 'mention',
      notificationId: notifRef.id,
      targetScreen: 'Dashboard',
      targetTab: 'Community',
      targetGroupId: groupId,
      targetMessageId: messageId,
    },
    android: { priority: 'high', notification: { channelId: 'default' } },
  });

  const invalid: string[] = [];
  res.responses.forEach((r, i) => {
    if (!r.success && r.error && INVALID_TOKEN_CODES.includes(r.error.code)) invalid.push(tokens[i]);
  });
  if (invalid.length > 0) {
    await userRef.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalid) });
  }
}

export const onCommunityMention = onDocumentCreated(
  { document: 'community_groups/{groupId}/messages/{messageId}', region: FIRESTORE_REGION },
  async event => {
    const msg = event.data?.data();
    if (!msg || typeof msg.senderId !== 'string') return;

    const mentions: string[] = Array.isArray(msg.mentions)
      ? Array.from(new Set(msg.mentions.filter((x: any) => typeof x === 'string' && x && x !== msg.senderId)))
      : [];
    if (mentions.length === 0) return;

    const groupId = event.params.groupId;
    const messageId = event.params.messageId;
    const groupSnap = await admin.firestore().collection('community_groups').doc(groupId).get();
    const groupTitle: string = groupSnap.data()?.title || 'Community chat';

    const title = `${msg.senderName || 'Someone'} mentioned you in ${groupTitle}`;
    const body = clip(msg.text, 100) || 'Tap to view the message';

    await Promise.allSettled(mentions.slice(0, 20).map(uid => notifyMentionedUser(uid, title, body, groupId, messageId)));
  },
);