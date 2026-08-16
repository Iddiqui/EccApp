import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { AccessToken } from 'livekit-server-sdk';

admin.initializeApp();

// LiveKit Credentials (cloud.livekit.io se copy karke paste karein)
const LIVEKIT_API_KEY = 'YOUR_LIVEKIT_API_KEY';
const LIVEKIT_API_SECRET = 'YOUR_LIVEKIT_API_SECRET';

export const getLiveKitToken = functions.https.onCall(async (data: any, context: any) => {
  // Ensure user authenticated hai
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be logged in to join the room.'
    );
  }

  const { roomName, participantName } = data;

  if (!roomName || !participantName) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'roomName and participantName are required.'
    );
  }

  // LiveKit Access Token Banayein
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantName,
    ttl: '2h',
  });

  // Permissions grant karein
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  return { token };
});