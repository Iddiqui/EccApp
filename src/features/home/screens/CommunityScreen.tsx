import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Dimensions, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Flame, Trophy, MessageSquare, Heart, Share2, Award as MedalIcon, Zap } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = ['Feed', 'Challenges', 'Leaderboard'];

// Dummy Data
const feedData = [
  {
    id: '1',
    name: 'Yuki Tanaka',
    avatar: 'YT',
    avatarBg: '#F9A825',
    time: '12m ago',
    streak: '🏆 7-day streak',
    text: "Just finished my first live room without freezing! Six months ago I couldn't say a sentence. Thank you ECC community 💙",
    likes: 128,
    comments: 24,
  },
  {
    id: '2',
    name: 'Omar Farouk',
    avatar: 'OF',
    avatarBg: '#448AFF',
    time: '48m ago',
    contributorTag: '👑 Top Contributor',
    text: 'Tip that changed everything for me: record yourself for 2 minutes daily and listen back. Painful at first, magic after 3 weeks.',
    likes: 342,
    comments: 51,
  },
  {
    id: '3',
    name: 'Diego Ramos',
    avatar: 'DR',
    avatarBg: '#7E57C2',
    time: '2h ago',
    ieltsTag: '🏆 IELTS 7.5',
    text: 'Scored Band 7.5 in IELTS Speaking! The daily challenges kept me consistent. Happy to answer questions.',
    likes: 511,
    comments: 88,
  },
];

const challengesData = [
  {
    id: '1',
    type: 'Daily Challenge',
    title: 'Describe your dream vacation',
    subtitle: '60-second speaking challenge',
    avatars: ['AK', 'MS', 'YT', 'PN'],
    takeChallengeText: 'Take challenge',
    gradient: true,
  },
  {
    id: '2',
    title: '7-Day Speaking Streak',
    subtitle: '+200',
    iconType: 'flame',
    progress: 0.6,
  },
  {
    id: '3',
    title: 'Pronounce 50 Words',
    subtitle: '+150',
    iconType: 'zap',
    progress: 0.3,
  },
  {
    id: '4',
    title: 'Join 5 Live Rooms',
    subtitle: '+100',
    iconType: 'trophy',
    progress: 0.9,
  },
];

const leaderboardData = [
  { id: '1', name: 'Omar Farouk', xp: '4,820 XP', avatar: 'OF', avatarBg: '#448AFF', rank: 1, medalColor: '#FDD835' },
  { id: '2', name: 'Priya Nair', xp: '4,610 XP', avatar: 'PN', avatarBg: '#66BB6A', rank: 2, medalColor: '#B0BEC5' },
  { id: '3', name: 'Aisha Khan', xp: '4,390 XP', avatar: 'AK', avatarBg: '#E57373', rank: 3, medalColor: '#CD7F32' },
  { id: '4', name: 'You', xp: '3,980 XP', avatar: 'YO', avatarBg: '#00BFA5', rank: 4, highlight: true },
  { id: '5', name: 'Diego Ramos', xp: '3,720 XP', avatar: 'DR', avatarBg: '#7E57C2', rank: 5 },
];

const CommunityScreen = () => {
  const [activeTab, setActiveTab] = useState(0);

  // 1. Render Feed Posts
  const renderFeedPost = ({ item }: { item: typeof feedData[0] }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={[styles.avatarCircle, { backgroundColor: item.avatarBg }]}>
          <Text style={styles.avatarText}>{item.avatar}</Text>
        </View>
        <View style={styles.postInfo}>
          <Text style={styles.posterName}>{item.name}</Text>
          <Text style={styles.postTime}>{item.time}</Text>
        </View>
        {item.streak && (
          <View style={[styles.tag, styles.streakTag]}>
            <Text style={[styles.tagText, styles.streakTagText]}>{item.streak}</Text>
          </View>
        )}
        {item.contributorTag && (
          <View style={[styles.tag, styles.contributorTag]}>
            <Text style={[styles.tagText, styles.contributorTagText]}>{item.contributorTag}</Text>
          </View>
        )}
        {item.ieltsTag && (
          <View style={[styles.tag, styles.ieltsTag]}>
            <Text style={[styles.tagText, styles.ieltsTagText]}>{item.ieltsTag}</Text>
          </View>
        )}
      </View>
      <Text style={styles.postText}>{item.text}</Text>
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Heart size={20} color="#718096" />
          <Text style={styles.actionText}>{item.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <MessageSquare size={20} color="#718096" />
          <Text style={styles.actionText}>{item.comments}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Share2 size={20} color="#718096" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Helper function to render correct challenge icon
  const renderChallengeIcon = (type: string) => {
    if (type === 'flame') return <Flame size={22} color="#448AFF" />;
    if (type === 'zap') return <Zap size={22} color="#448AFF" />;
    return <Trophy size={22} color="#448AFF" />;
  };

  // 2. Render Challenges
  const renderChallengeItem = ({ item }: { item: any }) => {
    if (item.gradient) {
      return (
        <LinearGradient
          colors={['#2563EB', '#1D4ED8', '#0D9488']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.challengeGradientCard}
        >
          <View style={styles.gradientHeader}>
            <View style={styles.typeBadge}>
              <Flame size={14} color="#FFF" />
              <Text style={styles.typeText}>{item.type}</Text>
            </View>
          </View>
          <Text style={styles.gradientTitle}>{item.title}</Text>
          <Text style={styles.gradientSubtitle}>{item.subtitle}</Text>
          <View style={styles.gradientFooter}>
            <View style={styles.avatarStack}>
              {item.avatars.map((av: string, index: number) => (
                <View key={index} style={[styles.avatarStackItem, { marginLeft: index === 0 ? 0 : -12 }]}>
                  <View style={[styles.avatarCircleSmall, { backgroundColor: ['#EF4444', '#10B981', '#F59E0B', '#3B82F6'][index % 4] }]}>
                    <Text style={styles.avatarTextSmall}>{av}</Text>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.takeChallengeButton}>
              <Text style={styles.takeChallengeButtonText}>{item.takeChallengeText}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      );
    }

    return (
      <View style={styles.challengeItem}>
        <View style={styles.challengeIconBg}>
          {renderChallengeIcon(item.iconType)}
        </View>
        <View style={styles.challengeItemMiddle}>
          <Text style={styles.challengeItemTitle}>{item.title}</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBar, { width: `${item.progress * 100}%` }]} />
          </View>
        </View>
        <View style={styles.challengeItemRight}>
          <Text style={styles.challengePoints}>{item.subtitle}</Text>
        </View>
      </View>
    );
  };

  // 3. Render Leaderboard
  const renderLeaderboardItem = ({ item }: { item: any }) => {
    const isTop3 = item.rank <= 3;

    return (
      <View style={[styles.leaderboardRow, item.highlight && styles.leaderboardHighlightRow]}>
        <View style={styles.rankContainer}>
          {isTop3 ? (
            <MedalIcon size={24} color={item.medalColor} />
          ) : (
            <Text style={styles.rankText}>{item.rank}</Text>
          )}
        </View>
        <View style={[styles.avatarCircleMed, { backgroundColor: item.avatarBg }]}>
          <Text style={styles.avatarText}>{item.avatar}</Text>
        </View>
        <View style={styles.leaderboardInfo}>
          <Text style={[styles.leaderboardName, item.highlight && styles.leaderboardHighlightText]}>
            {item.name}
          </Text>
          <Text style={styles.leaderboardXP}>{item.xp}</Text>
        </View>
        {item.highlight && (
          <View style={styles.youBadge}>
            <Text style={styles.youBadgeText}>You</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
        <Text style={styles.subtitleText}>Learn together, grow together</Text>
      </View>

      <View style={styles.tabsContainer}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === index && styles.activeTab]}
            onPress={() => setActiveTab(index)}
          >
            <Text style={[styles.tabText, activeTab === index && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 0 && (
        <FlatList
          data={feedData}
          renderItem={renderFeedPost}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollList}
        />
      )}

      {activeTab === 1 && (
        <FlatList
          data={challengesData}
          renderItem={renderChallengeItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollList}
        />
      )}

      {activeTab === 2 && (
        <FlatList
          data={leaderboardData}
          renderItem={renderLeaderboardItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollList}
          ListFooterComponent={() => (
            <Text style={styles.footerInfo}>Resets every Monday · Top 3 win Premium</Text>
          )}
        />
      )}
    </View>
  );
};

export default CommunityScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitleText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 30,
    padding: 4,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  activeTab: {
    backgroundColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#0F172A',
  },
  scrollList: {
    paddingBottom: 120,
  },
  postCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  postInfo: {
    flex: 1,
  },
  posterName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  postTime: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 1,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  streakTag: { backgroundColor: '#E8F5E9' },
  streakTagText: { color: '#2E7D32' },
  contributorTag: { backgroundColor: '#FFFDE7' },
  contributorTagText: { color: '#E65100' },
  ieltsTag: { backgroundColor: '#E3F2FD' },
  ieltsTagText: { color: '#1565C0' },
  postText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
    marginBottom: 14,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 6,
  },
  challengeGradientCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  gradientHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 11,
  },
  gradientTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  gradientSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 20,
  },
  gradientFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarStackItem: {
    borderWidth: 2,
    borderColor: '#1D4ED8',
    borderRadius: 18,
  },
  avatarCircleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextSmall: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  takeChallengeButton: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  takeChallengeButtonText: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 14,
  },
  challengeItem: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  challengeIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  challengeItemMiddle: {
    flex: 1,
  },
  challengeItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  challengeItemRight: {
    marginLeft: 14,
  },
  challengePoints: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  leaderboardHighlightRow: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
    marginRight: 8,
  },
  rankText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  avatarCircleMed: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  leaderboardHighlightText: {
    color: '#2563EB',
  },
  leaderboardXP: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  youBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  youBadgeText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 12,
  },
  footerInfo: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
});