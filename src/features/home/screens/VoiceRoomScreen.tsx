import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  Platform 
} from 'react-native';
import { Users, ChevronRight, MessageSquare, Volume2, ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';

const publicRooms = [
  {
    id: 'room_123',
    title: 'English Fluency & Pronunciation Practice',
    host: 'Aman Sharma',
    listeners: 14,
    bgColorLight: '#EEF2FF',
    bgColorDark: '#1E1B4B',
    accentColor: '#6366F1',
    tag: 'Beginner',
    speakers: ['A', 'R', 'S'],
  },
  {
    id: 'room_456',
    title: 'Business Communication Secrets',
    host: 'Sneha Patel',
    listeners: 28,
    bgColorLight: '#F0FDF4',
    bgColorDark: '#064E3B',
    accentColor: '#10B981',
    tag: 'Advanced',
    speakers: ['S', 'P', 'V'],
  },
  {
    id: 'room_789',
    title: 'Daily Vocab & Idiom Mastery',
    host: 'Rohit Verma',
    listeners: 9,
    bgColorLight: '#FFF7ED',
    bgColorDark: '#451A03',
    accentColor: '#F97316',
    tag: 'Intermediate',
    speakers: ['R', 'M'],
  }
];

const myRooms = [
  {
    id: 'room_my_1',
    title: 'My Custom Speaking Workspace',
    host: 'Anas (You)',
    listeners: 1,
    bgColorLight: '#FDF2F8',
    bgColorDark: '#831843',
    accentColor: '#EC4899',
    tag: 'Private',
    speakers: ['Y'],
  }
];

export default function VoiceRoomScreen({ navigation, route }: any) {
  // ✅ ALL HOOKS AT THE VERY TOP (STRICT ORDER)
  const themeHook = useTheme();
  const [activeTab, setActiveTab] = useState<'public' | 'my'>('public');
  const [highlightedRoomId, setHighlightedRoomId] = useState<string | null>(null);

  // Fallback theme colors
  const isDarkMode = themeHook?.isDarkMode || false;
  const colors = themeHook?.theme?.colors || themeHook?.colors || {
    bgLight: '#F8FAFC',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    primary: '#2563EB',
    bgCard: '#FFFFFF',
    border: '#E2E8F0',
  };

  // Notification Params Handler
  useEffect(() => {
    const targetRoomId = route?.params?.roomId;
    if (targetRoomId) {
      setHighlightedRoomId(targetRoomId);
      const timer = setTimeout(() => setHighlightedRoomId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [route?.params?.roomId]);

  const onlineCreators = [
    { id: 1, name: 'Aman', active: true },
    { id: 2, name: 'Rohit', active: true },
    { id: 3, name: 'Sneha', active: true },
    { id: 4, name: 'Priya', active: true },
    { id: 5, name: 'Vikram', active: false },
  ];

  const currentRooms = activeTab === 'public' ? publicRooms : myRooms;

  return (
    <View style={[styles.mainContainer, { backgroundColor: colors.bgLight }]}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={colors.bgLight} 
        translucent={true} 
      />
      
      {/* FIXED HEADER SECTION */}
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
          <Text style={[styles.title, { color: colors.textPrimary }]}>Voice Rooms</Text>
        </View>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Practice live audio communication instantly</Text>

        {/* Segmented Tab Control */}
        <View style={[styles.tabBarContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
          <TouchableOpacity 
            style={[
              styles.tabButton, 
              activeTab === 'public' && [styles.activeTabButton, { backgroundColor: colors.bgCard }]
            ]}
            onPress={() => setActiveTab('public')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.tabText, 
              { color: colors.textSecondary },
              activeTab === 'public' && { color: colors.textPrimary, fontWeight: '700' }
            ]}>Public Rooms</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.tabButton, 
              activeTab === 'my' && [styles.activeTabButton, { backgroundColor: colors.bgCard }]
            ]}
            onPress={() => setActiveTab('my')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.tabText, 
              { color: colors.textSecondary },
              activeTab === 'my' && { color: colors.textPrimary, fontWeight: '700' }
            ]}>My Rooms</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CONTENT SCROLLABLE FEED */}
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Horizontal Active Speakers list */}
        <View style={styles.creatorsSection}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Active Speakers</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.creatorsScroll}>
            {onlineCreators.map((creator) => (
              <View key={creator.id} style={styles.creatorCircleContainer}>
                <View style={[
                  styles.avatarBorder, 
                  { borderColor: colors.border },
                  creator.active && { borderColor: colors.primary || '#2563EB' }
                ]}>
                  <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                    <Text style={[styles.avatarText, { color: colors.textPrimary }]}>{creator.name[0]}</Text>
                  </View>
                </View>
                <Text style={[styles.creatorName, { color: colors.textSecondary }]} numberOfLines={1}>{creator.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Live Now</Text>

        {/* Dynamic Card Feed */}
        {currentRooms.map((room) => {
          const cardBg = isDarkMode ? room.bgColorDark : room.bgColorLight;
          const isTargeted = room.id === highlightedRoomId;

          return (
            <TouchableOpacity 
              key={room.id} 
              style={[
                styles.roomCard, 
                { backgroundColor: cardBg, borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
                isTargeted && { borderWidth: 2, borderColor: colors.primary }
              ]} 
              activeOpacity={0.95}
            >
              <View style={styles.roomCardHeader}>
                <View style={[styles.liveBadge, { backgroundColor: room.accentColor }]}>
                  <Volume2 color="#FFFFFF" size={12} style={{ marginRight: 4 }} />
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
                <View style={[styles.listenerCountContainer, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.7)' }]}>
                  <Users color={isDarkMode ? '#94A3B8' : '#475569'} size={14} />
                  <Text style={[styles.listenerCountText, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                    {room.listeners} listening
                  </Text>
                </View>
              </View>

              <View style={styles.cardContentContainer}>
                <View style={styles.leftColumn}>
                  <Text style={[styles.roomTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]} numberOfLines={2}>
                    {room.title}
                  </Text>
                  <Text style={[styles.roomHost, { color: isDarkMode ? '#94A3B8' : '#475569' }]}>
                    Hosted by <Text style={[styles.boldHostText, { color: isDarkMode ? '#F1F5F9' : '#1E293B' }]}>{room.host}</Text>
                  </Text>
                </View>

                <View style={styles.rightColumn}>
                  <View style={styles.stackedAvatarsContainer}>
                    {room.speakers.map((initial, index) => (
                      <View 
                        key={index} 
                        style={[
                          styles.miniAvatar, 
                          { 
                            backgroundColor: room.accentColor,
                            borderColor: cardBg,
                            marginLeft: index === 0 ? 0 : -14,
                            zIndex: 5 - index 
                          }
                        ]}
                      >
                        <Text style={styles.miniAvatarText}>{initial}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <View style={[styles.roomCardFooter, { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <View style={styles.tagsContainer}>
                  <View style={[styles.tag, { borderColor: room.accentColor, backgroundColor: isDarkMode ? 'rgba(0,0,0,0.3)' : '#FFFFFF' }]}>
                    <Text style={[styles.tagText, { color: room.accentColor }]}>{room.tag}</Text>
                  </View>
                  <View style={[styles.interactiveBubble, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.3)' : '#FFFFFF', borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                    <MessageSquare color={isDarkMode ? '#94A3B8' : '#64748B'} size={14} />
                    <Text style={[styles.bubbleText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>Ask to join</Text>
                  </View>
                </View>
                <View style={[styles.arrowButton, { backgroundColor: room.accentColor }]}>
                  <ChevronRight color="#FFFFFF" size={18} strokeWidth={2.5} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight : 0;

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  fixedHeader: {
    paddingHorizontal: 20,
    paddingTop: (STATUSBAR_HEIGHT || 0) + 16,
    paddingBottom: 4,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  tabBarContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginTop: 18,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTabButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 110,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },
  creatorsSection: {
    marginBottom: 16,
  },
  creatorsScroll: {
    paddingVertical: 4,
  },
  creatorCircleContainer: {
    alignItems: 'center',
    marginRight: 16,
    width: 68,
  },
  avatarBorder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 2,
    borderWidth: 2,
  },
  avatarPlaceholder: {
    flex: 1,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  creatorName: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  roomCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  roomCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  listenerCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  listenerCountText: {
    fontSize: 12,
    marginLeft: 5,
    fontWeight: '600',
  },
  cardContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 10,
  },
  rightColumn: {
    alignItems: 'flex-end',
  },
  roomTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  roomHost: {
    fontSize: 13,
    marginTop: 6,
  },
  boldHostText: {
    fontWeight: '700',
  },
  stackedAvatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  roomCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tag: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 30,
    marginRight: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  interactiveBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 30,
    borderWidth: 1,
  },
  bubbleText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
});