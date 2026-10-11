import { joinAudioRoom, type AudioSession } from './sessionService';

const LIVEKIT_URL = 'wss://eccapp-4hmra95b.livekit.cloud';
const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/adventurer/png?seed=Oliver&backgroundColor=ffd5dc';

/**
 * Opens the live room of an audio (group) session inside the app's existing call system.
 * The server checks access (plan + same teacher / host) and returns the LiveKit token.
 * `startCall` comes from useCallSession() (CallSessionProvider) - pass it from the screen.
 */
export async function launchAudioRoom(
  startCall: (params: any) => void,
  session: AudioSession
) {
  const conn: any = await joinAudioRoom(session); // throws the server's message if not allowed

  startCall({
    serverUrl: conn.serverUrl || LIVEKIT_URL,
    token: conn.token,
    roomType: 'class',
    roomTitle: session.title,
    isHost: conn.role === 'host',
    roomId: conn.roomName, // 'audio_<id>' - used by the room chat; no voice_rooms doc, so nothing gets deleted
    userAvatarUrl: DEFAULT_AVATAR,
  });
  return conn;
}