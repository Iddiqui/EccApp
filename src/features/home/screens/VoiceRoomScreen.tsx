import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, StatusBar, Platform, Dimensions } from 'react-native';
import { Users, ChevronRight, MessageSquare, Volume2 } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Dynamic dummy data based exactly on your snapshot layouts
const publicRooms = [
  {
    id: 1,
    title: 'English Fluency & Pronunciation Practice',
    host: 'Aman Sharma',
    listeners: 14,
    bgColor: '#EEF2FF', // Soft Indigo
    accentColor: '#4F46E5',
    tag: 'Beginner',
    speakers: ['A', 'R', 'S'],
  },
  {
    id: 2,
    title: 'Business Communication Secrets',
    host: 'Sneha Patel',
    listeners: 28,
    bgColor: '#F0FDF4', // Soft Emerald
    accentColor: '#16A34A',
    tag: 'Advanced',
    speakers: ['S', 'P', 'V'],
  },
  {
    id: 3,
    title: 'Daily Vocab & Idiom Mastery',
    host: 'Rohit Verma',
    listeners: 9,
    bgColor: '#FFF7ED', // Soft Orange/Amber
    accentColor: '#EA580C',
    tag: 'Intermediate',
    speakers: ['R', 'M'],
  }
];

const myRooms = [
  {
    id: 1,
    title: 'My Custom Speaking Workspace',
    host: 'Anas (You)',
    listeners: 1,
    bgColor: '#FDF2F8', // Soft Pink
    accentColor: '#DB2777',
    tag: 'Private',
    speakers: ['Y'],
  }
];

export default function VoiceRoomScreen() {
  const [activeTab, setActiveTab] = useState<'public' | 'my'>('public');

  const onlineCreators = [
    { id: 1, name: 'Aman', active: true },
    { id: 2, name: 'Rohit', active: true },
    { id: 3, name: 'Sneha', active: true },
    { id: 4, name: 'Priya', active: true },
    { id: 5, name: 'Vikram', active: false },
  ];

  const currentRooms = activeTab === 'public' ? publicRooms : myRooms;

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" translucent={true} />
      
      {/* FIXED HEADER SECTION */}
      <View style={styles.fixedHeader}>
        <Text style={styles.title}>Voice Rooms</Text>
        <Text style={styles.subtitle}>Practice live audio communication instantly</Text>

        {/* Custom Segmented Control */}
        <View style={styles.tabBarContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'public' && styles.activeTabButton]}
            onPress={() => setActiveTab('public')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'public' && styles.activeTabText]}>Public Rooms</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'my' && styles.activeTabButton]}
            onPress={() => setActiveTab('my')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>My Rooms</Text>
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
          <Text style={styles.sectionHeading}>Active Speakers</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.creatorsScroll}>
            {onlineCreators.map((creator) => (
              <View key={creator.id} style={styles.creatorCircleContainer}>
                <View style={[styles.avatarBorder, creator.active && styles.activeAvatarBorder]}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{creator.name[0]}</Text>
                  </View>
                </View>
                <Text style={styles.creatorName} numberOfLines={1}>{creator.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <Text style={styles.sectionHeading}>Live Now</Text>

        {/* Dynamic Card Feed mapping */}
        {currentRooms.map((room) => (
          <TouchableOpacity 
            key={room.id} 
            style={[styles.roomCard, { backgroundColor: room.bgColor }]} 
            activeOpacity={0.95}
          >
            {/* Header section inside card */}
            <View style={styles.roomCardHeader}>
              <View style={[styles.liveBadge, { backgroundColor: room.accentColor }]}>
                <Volume2 color="#FFFFFF" size={12} style={{ marginRight: 4 }} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
              <View style={styles.listenerCountContainer}>
                <Users color="#475569" size={14} />
                <Text style={styles.listenerCountText}>{room.listeners} listening</Text>
              </View>
            </View>

            {/* Core Split Body Area */}
            <View style={styles.cardContentContainer}>
              {/* Left Column: Title and details */}
              <View style={styles.leftColumn}>
                <Text style={styles.roomTitle} numberOfLines={2}>{room.title}</Text>
                <Text style={styles.roomHost}>
                  Hosted by <Text style={styles.boldHostText}>{room.host}</Text>
                </Text>
              </View>

              {/* Right Column: Stacked Avatars Visualizer */}
              <View style={styles.rightColumn}>
                <View style={styles.stackedAvatarsContainer}>
                  {room.speakers.map((initial, index) => (
                    <View 
                      key={index} 
                      style={[
                        styles.miniAvatar, 
                        { 
                          backgroundColor: room.accentColor,
                          marginLeft: index === 0 ? 0 : -14, // Overlap offset shift
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

            {/* Card Footer actions */}
            <View style={styles.roomCardFooter}>
              <View style={styles.tagsContainer}>
                <View style={[styles.tag, { borderColor: room.accentColor }]}>
                  <Text style={[styles.tagText, { color: room.accentColor }]}>{room.tag}</Text>
                </View>
                <View style={styles.interactiveBubble}>
                  <MessageSquare color="#64748B" size={14} />
                  <Text style={styles.bubbleText}>Ask to join</Text>
                </View>
              </View>
              <View style={[styles.arrowButton, { backgroundColor: room.accentColor }]}>
                <ChevronRight color="#FFFFFF" size={18} strokeWidth={2.5} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight : 0;

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  fixedHeader: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingTop: (STATUSBAR_HEIGHT || 0) + 20,
    paddingBottom: 4,
    zIndex: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 4,
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#0F172A',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 110, // Margin to protect Center Plus Tab bar overlap layout heights
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
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
    borderColor: '#E2E8F0',
  },
  activeAvatarBorder: {
    borderColor: '#2563EB',
  },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
  },
  creatorName: {
    fontSize: 12,
    color: '#475569',
    marginTop: 6,
    fontWeight: '500',
  },
  // Re-designed card block with soft dynamic structures
  roomCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
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
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  listenerCountText: {
    fontSize: 12,
    color: '#334155',
    marginLeft: 5,
    fontWeight: '600',
  },
  // Main split body section styling
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
    color: '#0F172A',
    lineHeight: 24,
  },
  roomHost: {
    fontSize: 13,
    color: '#475569',
    marginTop: 6,
  },
  boldHostText: {
    fontWeight: '700',
    color: '#1E293B',
  },
  // Stacked speaking users circles style
  stackedAvatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  // Re-designed footer section elements
  roomCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
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
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  interactiveBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bubbleText: {
    fontSize: 11,
    color: '#475569',
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