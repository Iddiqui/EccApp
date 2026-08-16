require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const admin = require('firebase-admin');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = express();
app.use(express.json());
app.use(cors());

// 1. Load Firebase Service Account
let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
} catch (err) {
  console.error("❌ 'serviceAccountKey.json' file not found. Ensure it exists in the root directory.");
}

// 2. Safe Firebase Initialization
if (!getApps().length && serviceAccount) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

// Environment Variables (with Fallbacks for Local Testing)
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://eccapp-4hmra95b.livekit.cloud';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'YOUR_LIVEKIT_API_KEY';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'YOUR_LIVEKIT_API_SECRET';

// LiveKit Room Service Client (To close active rooms on server)
// Convert 'wss://' or 'ws://' to 'https://' or 'http://' for REST API calls
const LIVEKIT_HTTP_URL = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');
const roomService = new RoomServiceClient(LIVEKIT_HTTP_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

// Health Check Route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'LiveKit Token Server Running' });
});

/**
 * 🔑 Token Generation Endpoint
 */
app.get('/getToken', async (req, res) => {
  try {
    const { roomName, participantName } = req.query;

    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName are required.' });
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: String(participantName).trim(),
      ttl: '2h',
    });

    at.addGrant({
      roomJoin: true,
      room: String(roomName).trim(),
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    return res.status(200).json({ token, serverUrl: LIVEKIT_URL });
  } catch (error) {
    console.error('Error generating token:', error);
    return res.status(500).json({ error: 'Failed to generate token' });
  }
});

/**
 * 🗑️ Room End/Delete API Route
 * Deletes from Firestore & ends the room on LiveKit Media Server
 */
app.post('/api/rooms/end/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!roomId) {
      return res.status(400).json({ error: 'roomId is required.' });
    }

    const livekitRoomName = `room_${roomId}`;

    // 1. LiveKit Media Server se Room close karein (Disconnect all users)
    try {
      await roomService.deleteRoom(livekitRoomName);
      console.log(`✅ LiveKit room session ${livekitRoomName} ended.`);
    } catch (lkErr) {
      // Room ho sakta hai already active na ho, isliye warning log karke aage badhenge
      console.warn(`⚠️ LiveKit room delete notice: ${lkErr.message || lkErr}`);
    }

    // 2. Delete document from Firestore 'voice_rooms' collection
    await db.collection('voice_rooms').doc(roomId).delete();
    console.log(`✅ Room ${roomId} deleted successfully from Firestore.`);

    return res.status(200).json({ success: true, message: 'Room ended and deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting room:', error);
    return res.status(500).json({ error: 'Failed to delete room from database' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Token Server active on http://0.0.0.0:${PORT}`);
});