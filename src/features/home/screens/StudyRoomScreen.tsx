import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {
  LiveKitRoom,
  useRoomContext,
  useLocalParticipant,
  useParticipants,
  AudioSession,
  registerGlobals,
} from '@livekit/react-native';
import { Mic, MicOff, PhoneOff } from 'lucide-react-native';

registerGlobals();

const StudyParticipantTile = ({ participant }: any) => {
  const isLocal = participant?.isLocal;
  return (
    <View style={styles.studyTile}>
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>{(participant?.identity || 'U')[0].toUpperCase()}</Text>
      </View>
      <Text style={styles.nameText} numberOfLines={1}>
        {isLocal ? `${participant?.identity} (You)` : participant?.identity}
      </Text>
    </View>
  );
};

const StudyRoomView = ({ safeExit, roomTitle, isHost, roomId }: any) => {
  const room = useRoomContext();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  const toggleMic = async () => {
    if (localParticipant) await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  const handleLeaveCall = async () => {
    try {
      if (isHost && roomId) {
        await firestore().collection('voice_rooms').doc(roomId).delete();
      }
      if (room) {
        await room.disconnect();
      }
    } catch (e) {
      console.log('Error leaving call:', e);
    } finally {
      safeExit();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1120" />
      <View style={styles.header}>
        <Text style={styles.roomTitle}>{roomTitle || 'Study Room (Audio Only)'}</Text>
        <Text style={styles.participantCount}>👥 {participants.length} Active Participants</Text>
      </View>

      <View style={styles.mainContent}>
        <FlatList
          data={participants}
          keyExtractor={(item) => item.sid || item.identity}
          renderItem={({ item }) => <StudyParticipantTile participant={item} />}
          numColumns={2}
          contentContainerStyle={styles.gridContainer}
        />
      </View>

      {/* Controls Bar */}
      <View style={styles.controlsWrapper}>
        <View style={styles.controlsBar}>
          <TouchableOpacity
            style={[styles.controlBtn, isMicrophoneEnabled ? styles.btnActive : styles.btnMuted]}
            onPress={toggleMic}
          >
            {isMicrophoneEnabled ? <Mic color="#FFF" size={22} /> : <MicOff color="#FFF" size={22} />}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.controlBtn, styles.endCallBtn]} onPress={handleLeaveCall}>
            <PhoneOff color="#FFF" size={22} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default function StudyRoomScreen({ route, navigation }: any) {
  const { serverUrl, token, roomTitle, isHost, roomId } = route?.params || {};
  const [canConnect, setCanConnect] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const prepare = async () => {
      try {
        if (Platform.OS === 'android') {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        }
        await AudioSession.startAudioSession();
        if (isMounted) setCanConnect(true);
      } catch (err) {
        console.error('Audio Session error:', err);
      }
    };
    prepare();
    return () => {
      isMounted = false;
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, []);

  if (!canConnect || !token) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Connecting to Audio Room...</Text>
      </View>
    );
  }

  return (
    <View style={styles.flexOne}>
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect={canConnect}
        audio={true}
        video={false}
      >
        <StudyRoomView
          safeExit={() => navigation.goBack()}
          roomTitle={roomTitle}
          isHost={isHost}
          roomId={roomId}
        />
      </LiveKitRoom>
    </View>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B1120',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 14,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  roomTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  participantCount: {
    fontSize: 13,
    color: '#94A3B8',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  gridContainer: {
    paddingBottom: 20,
  },
  studyTile: {
    flex: 1,
    margin: 6,
    height: 120,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  nameText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  controlsWrapper: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    paddingTop: 12,
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#334155',
  },
  controlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnActive: {
    backgroundColor: '#2563EB',
  },
  btnMuted: {
    backgroundColor: '#64748B',
  },
  endCallBtn: {
    backgroundColor: '#EF4444',
  },
});