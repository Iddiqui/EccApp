import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// 🔴 1. LUCIDE ICONS IMPORTS (Make sure lucide-react-native is installed)
import { ChevronLeft, ChevronRight, Volume2, Users, MessageSquare } from 'lucide-react-native';

// 🔴 2. HOOK IMPORT
import { useTheme } from '../../../hooks/useTheme'; // Adjust path if needed

// 🔴 3. CONSTANTS & TYPES DEFINITION
const STATUSBAR_HEIGHT = StatusBar.currentHeight || (Platform.OS === 'ios' ? 44 : 0);
const TOKEN_SERVER_BASE_URL = 'http://10.0.2.2:5000';// Replace with your server URL
const LIVEKIT_FALLBACK_URL = 'wss://eccapp-4hmra95b.livekit.cloud'; // Replace with your fallback URL

interface VoiceRoom {
  id: string;
  title: string;
  category?: string;
  hostName?: string;
  activeSpeakersCount?: number;
  totalParticipants?: number;
  livekitRoomId: string;
  createdBy: string;
  type?: 'public' | 'official';
  maxLimit?: number;
  createdAt?: any;
}

export default function VoiceRoomScreen({ navigation, route }: any) {
  // ✅ HOOKS
  const themeHook = useTheme() as any;
  const t = themeHook?.t;
  const currentLang = themeHook?.currentLang || 'en';

  const [activeTab, setActiveTab] = useState<'public' | 'official'>('public');
  const [highlightedRoomId, setHighlightedRoomId] = useState<string | null>(null);

  // Firestore & Admin States
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(true);
  const [isAdminOrSubAdmin, setIsAdminOrSubAdmin] = useState<boolean>(false);
  const [checkingRole, setCheckingRole] = useState<boolean>(true);

  // Modal State
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [roomTitle, setRoomTitle] = useState<string>('');
  const [roomCategory, setRoomCategory] = useState<string>('General English');
  const [creating, setCreating] = useState<boolean>(false);

  const currentUser = auth().currentUser;

  // Fallback theme colors
  const isDarkMode = themeHook?.isDarkMode || false;
  const colors = themeHook?.theme?.colors || {
    bgLight: '#F8FAFC',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    primary: '#2563EB',
    bgCard: '#FFFFFF',
    border: '#E2E8F0',
  };

  // Check Admin / Sub-Admin Rights
  useEffect(() => {
    if (!currentUser || !currentUser.email) {
      setIsAdminOrSubAdmin(false);
      setCheckingRole(false);
      return;
    }

    let isMounted = true;
    const checkAdminRights = async () => {
      try {
        const userEmail = currentUser.email?.toLowerCase().trim();
        const [adminSnap, subAdminSnap] = await Promise.all([
          firestore().collection('admins').where('email', '==', userEmail).get(),
          firestore().collection('sub_admins').where('email', '==', userEmail).get(),
        ]);

        if (isMounted) {
          setIsAdminOrSubAdmin(!adminSnap.empty || !subAdminSnap.empty);
        }
      } catch (error) {
        console.error('Error checking admin rights:', error);
        if (isMounted) setIsAdminOrSubAdmin(false);
      } finally {
        if (isMounted) setCheckingRole(false);
      }
    };

    checkAdminRights();
    return () => { isMounted = false; };
  }, [currentUser]);

  // Fetch Live Voice Rooms (Real-time)
  useEffect(() => {
    if (!currentUser) {
      setLoadingRooms(false);
      return;
    }

    setLoadingRooms(true);
    const unsubscribeRooms = firestore()
      .collection('voice_rooms')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        snapshot => {
          const fetchedRooms: VoiceRoom[] = [];
          snapshot?.docs?.forEach(doc => {
            fetchedRooms.push({
              id: doc.id,
              ...doc.data(),
            } as VoiceRoom);
          });
          setRooms(fetchedRooms);
          setLoadingRooms(false);
        },
        error => {
          console.error('Firestore Fetch Error:', error);
          setLoadingRooms(false);
        }
      );

    return () => unsubscribeRooms();
  }, [currentUser]);

  // Notification Params Handler
  useEffect(() => {
    const targetRoomId = route?.params?.roomId;
    if (targetRoomId) {
      setHighlightedRoomId(targetRoomId);
      const timer = setTimeout(() => setHighlightedRoomId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [route?.params?.roomId]);

  // Handle Modal Open Logic
  const openCreateModal = () => {
    if (activeTab === 'official' && !isAdminOrSubAdmin) {
      Alert.alert('Restricted', 'Only Admins & Sub-Admins can create Class Rooms.');
      return;
    }
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setRoomTitle('');
    setRoomCategory('General English');
  };

  const handleCreateRoom = async () => {
    if (!roomTitle.trim()) {
      Alert.alert('Required', 'Please enter a room title');
      return;
    }

    try {
      setCreating(true);
      const newRoomRef = firestore().collection('voice_rooms').doc();
      const roomId = newRoomRef.id;
      const livekitRoomName = `room_${roomId}`;
      const participantName =
        currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

      const isPublicType = activeTab === 'public';
      const selectedType: 'public' | 'official' = isPublicType ? 'public' : 'official';

      const roomData: Partial<VoiceRoom> = {
        title: roomTitle.trim(),
        category: roomCategory.trim() || 'General English',
        hostName: participantName,
        activeSpeakersCount: 1,
        totalParticipants: 1,
        livekitRoomId: livekitRoomName,
        createdBy: currentUser?.uid || '',
        type: selectedType,
        maxLimit: isPublicType ? 10 : 9999,
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      const url = `${TOKEN_SERVER_BASE_URL}/getToken?roomName=${encodeURIComponent(
        livekitRoomName
      )}&participantName=${encodeURIComponent(participantName)}`;

      const response = await fetch(url);
      const responseText = await response.text();

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Server returned invalid response format.');
      }

      if (!response.ok) {
        throw new Error(data?.error || `Server error with status ${response.status}`);
      }

      await newRoomRef.set(roomData);
      setCreating(false);
      closeModal();

      const targetScreen = selectedType === 'official' ? 'ClassRoomScreen' : 'StudyRoomScreen';
      navigation.navigate(targetScreen, {
        serverUrl: data.serverUrl || LIVEKIT_FALLBACK_URL,
        token: data.token,
        roomTitle: roomData.title,
        isHost: true,
        roomId: roomId,
      });
    } catch (error: any) {
      setCreating(false);
      console.error('Create Room Error:', error);
      Alert.alert('Error', error.message || 'Failed to connect to token server.');
    }
  };

  const joinExistingRoom = async (item: VoiceRoom) => {
    try {
      if (item.type === 'public' && (item.totalParticipants || 0) >= 10) {
        Alert.alert('Room Full', 'This public study room has reached its maximum limit of 10 users.');
        return;
      }

      const participantName =
        currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

      const url = `${TOKEN_SERVER_BASE_URL}/getToken?roomName=${encodeURIComponent(
        item.livekitRoomId
      )}&participantName=${encodeURIComponent(participantName)}`;

      const response = await fetch(url);
      const responseText = await response.text();

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Server returned invalid response format.');
      }

      if (!response.ok || !data.token) {
        throw new Error(data?.error || 'Failed to fetch token');
      }

      const targetScreen = item.type === 'official' ? 'ClassRoomScreen' : 'StudyRoomScreen';
      navigation.navigate(targetScreen, {
        serverUrl: data.serverUrl || LIVEKIT_FALLBACK_URL,
        token: data.token,
        roomTitle: item.title,
        isHost: item.createdBy === currentUser?.uid,
        roomId: item.id,
      });
    } catch (error: any) {
      console.error('Join Room Error:', error);
      Alert.alert('Error', 'Unable to join room. Check token server.');
    }
  };

  const filteredRooms = rooms.filter(room => {
    if (activeTab === 'official') {
      return room.type === 'official';
    }
    return room.type === 'public' || !room.type;
  });

  const canCreateInCurrentTab = activeTab === 'public' || (activeTab === 'official' && isAdminOrSubAdmin);

  return (
    <SafeAreaView style={[styles.mainContainer, { backgroundColor: colors.bgLight }]}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={colors.bgLight} 
        translucent={true} 
      />
      
      {/* HEADER SECTION */}
      <View style={[styles.fixedHeader, { backgroundColor: colors.bgLight }]}>
        <View style={styles.headerTopRow}>
          {navigation?.canGoBack() && (
            <TouchableOpacity 
              style={[styles.backButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]} 
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ChevronLeft size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t?.rooms?.title || 'Voice Rooms'}
          </Text>
        </View>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t?.rooms?.subtitle || 'Practice live audio communication instantly'}
        </Text>

        {/* Tab Control */}
        <View style={[styles.tabBarContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'public' && [styles.activeTabButton, { backgroundColor: colors.bgCard }]]}
            onPress={() => setActiveTab('public')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'public' && { color: colors.textPrimary, fontWeight: '700' }]}>
              Study Rooms (Max 10)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'official' && [styles.activeTabButton, { backgroundColor: colors.bgCard }]]}
            onPress={() => setActiveTab('official')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'official' && { color: colors.textPrimary, fontWeight: '700' }]}>
              Class Rooms
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CONTENT LIST */}
      <View style={styles.scrollContainer}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
            {activeTab === 'public' ? 'Group Study Rooms' : 'Official Classes'}
          </Text>

          {canCreateInCurrentTab && (
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: colors.primary }]}
              onPress={openCreateModal}
              activeOpacity={0.7}
            >
              <Text style={styles.createBtnText}>+ Create Room</Text>
            </TouchableOpacity>
          )}
        </View>

        {loadingRooms || checkingRole ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredRooms}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isFull = item.type === 'public' && (item.totalParticipants || 0) >= 10;
              const isTargeted = item.id === highlightedRoomId;

              return (
                <TouchableOpacity 
                  style={[
                    styles.roomCard, 
                    { backgroundColor: colors.bgCard, borderColor: colors.border },
                    isTargeted && { borderWidth: 2, borderColor: colors.primary }
                  ]} 
                  activeOpacity={0.9}
                  onPress={() => joinExistingRoom(item)}
                >
                  <View style={styles.roomCardHeader}>
                    <View style={[styles.liveBadge, { backgroundColor: isFull ? '#EF4444' : '#10B981' }]}>
                      <Volume2 color="#FFFFFF" size={12} style={{ marginRight: 4 }} />
                      <Text style={styles.liveBadgeText}>
                        {isFull ? 'FULL' : (currentLang === 'hi' ? 'लाइव' : 'LIVE')}
                      </Text>
                    </View>
                    <View style={[styles.listenerCountContainer, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
                      <Users color={colors.textSecondary} size={14} />
                      <Text style={[styles.listenerCountText, { color: colors.textPrimary }]}>
                        {item.totalParticipants || 1}{item.type === 'public' ? '/10' : ''} {t?.rooms?.listening || 'listening'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardContentContainer}>
                    <View style={styles.leftColumn}>
                      <Text style={[styles.roomTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={[styles.roomHost, { color: colors.textSecondary }]}>
                        Hosted by <Text style={[styles.boldHostText, { color: colors.textPrimary }]}>{item.hostName || 'User'}</Text>
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.roomCardFooter, { borderTopColor: colors.border }]}>
                    <View style={styles.tagsContainer}>
                      <View style={[styles.tag, { borderColor: colors.primary }]}>
                        <Text style={[styles.tagText, { color: colors.primary }]}>{item.category || 'General'}</Text>
                      </View>
                    </View>
                    <View style={[styles.arrowButton, { backgroundColor: colors.primary }]}>
                      <ChevronRight color="#FFFFFF" size={18} strokeWidth={2.5} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {activeTab === 'official'
                    ? 'Abhi koi official class room active nahi hai.'
                    : 'Koi study group active nahi hai. Aap pehla room create karein!'}
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* CREATE ROOM MODAL */}
      {isModalVisible && (
        <View style={styles.customModalOverlay}>
          <Pressable style={styles.overlayBackground} onPress={closeModal} />
          <View style={[styles.customModalCard, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Create {activeTab === 'public' ? 'Study' : 'Class'} Room
            </Text>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Room Title</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="e.g. English Grammar Group Discussion"
              placeholderTextColor="#94A3B8"
              value={roomTitle}
              onChangeText={setRoomTitle}
              autoFocus={true}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Category</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="e.g. IELTS / Practice / Debate"
              placeholderTextColor="#94A3B8"
              value={roomCategory}
              onChangeText={setRoomCategory}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={closeModal}
                disabled={creating}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreateRoom}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Create & Join</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  fixedHeader: { paddingHorizontal: 20, paddingTop: (STATUSBAR_HEIGHT || 0) + 12, paddingBottom: 8 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginRight: 12 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4 },
  tabBarContainer: { flexDirection: 'row', borderRadius: 14, padding: 4, marginTop: 14 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTabButton: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '600' },
  scrollContainer: { flex: 1, paddingHorizontal: 20 },
  scrollContent: { paddingBottom: 40, paddingTop: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 },
  sectionHeading: { fontSize: 18, fontWeight: '700' },
  createBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  createBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  roomCard: { borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, elevation: 2 },
  roomCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  liveBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  listenerCountContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  listenerCountText: { fontSize: 12, marginLeft: 5, fontWeight: '600' },
  cardContentContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  leftColumn: { flex: 1 },
  roomTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  roomHost: { fontSize: 13, marginTop: 4 },
  boldHostText: { fontWeight: '700' },
  roomCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1 },
  tagsContainer: { flexDirection: 'row', alignItems: 'center' },
  tag: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 30 },
  tagText: { fontSize: 11, fontWeight: '700' },
  arrowButton: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyText: { textAlign: 'center', fontSize: 14 },
  customModalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  overlayBackground: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  customModalCard: { width: '85%', padding: 20, borderRadius: 20, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14, fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginLeft: 10 },
  cancelBtn: { backgroundColor: '#E2E8F0' },
  cancelBtnText: { color: '#475569', fontWeight: '600' },
  submitBtnText: { color: '#FFFFFF', fontWeight: '700' },
});