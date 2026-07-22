import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  Dimensions, 
  Platform, 
  ActivityIndicator, 
  Alert,
  StatusBar 
} from 'react-native';
import { Trash2, Send, Trophy, Flame, Award } from 'lucide-react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../../hooks/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TABS = ['Feed', 'Challenges', 'Leaderboard'];

const formatTimeAgo = (timestamp: any) => {
  if (!timestamp) return 'Just now';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
};

const CommunityScreen = () => {
  const { theme, isDarkMode } = useTheme();
  const colors = theme.colors;

  const [activeTab, setActiveTab] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const [feedData, setFeedData] = useState<any[]>([]);
  const [challengesData, setChallengesData] = useState<any[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  const currentUser = auth().currentUser;

  // 1. Check Admin Status
  useEffect(() => {
    if (!currentUser || !currentUser.email) {
      setIsAdmin(false);
      return;
    }

    const checkAdminRole = async () => {
      try {
        const adminQuery = await firestore()
          .collection('admins')
          .where('email', '==', currentUser.email)
          .get();

        if (!adminQuery.empty) {
          setIsAdmin(true); 
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      }
    };

    checkAdminRole();
  }, [currentUser]);

  // 2. Realtime Feed Fetching
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('posts')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        (querySnapshot) => {
          const posts: any[] = [];
          if (querySnapshot) {
            querySnapshot.forEach((doc) => {
              const data = doc.data();
              posts.push({
                id: doc.id,
                uid: data.uid,
                name: data.name || 'Anonymous',
                avatar: data.name ? data.name.substring(0, 2).toUpperCase() : 'U',
                avatarBg: data.avatarBg || '#7E57C2',
                time: formatTimeAgo(data.createdAt),
                text: data.text || '',
              });
            });
          }
          setFeedData(posts);
          setLoadingFeed(false);
        },
        (error) => {
          console.error("Feed snapshot error:", error);
          setLoadingFeed(false);
        }
      );
    return () => unsubscribe();
  }, []);

  // 3. Challenges Sync
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('challenges')
      .onSnapshot(
        (querySnapshot) => {
          const challenges: any[] = [];
          if (querySnapshot) {
            querySnapshot.forEach((doc) => {
              challenges.push({ id: doc.id, ...doc.data() });
            });
          }
          setChallengesData(challenges);
          setLoadingChallenges(false);
        },
        (error) => {
          console.error("Challenges error:", error);
          setLoadingChallenges(false);
        }
      );
    return () => unsubscribe();
  }, []);

  // 4. Leaderboard Sync
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('users')
      .orderBy('xp', 'desc')
      .limit(20)
      .onSnapshot(
        (querySnapshot) => {
          const board: any[] = [];
          let index = 1;
          if (querySnapshot) {
            querySnapshot.forEach((doc) => {
              const data = doc.data();
              board.push({
                id: doc.id,
                name: data.fullName || data.name || 'Student',
                xp: `${data.xp || 0} XP`,
                avatar: (data.fullName || data.name || 'ST').substring(0, 2).toUpperCase(),
                avatarBg: data.avatarBg || colors.primary,
                rank: index,
                highlight: currentUser ? doc.id === currentUser.uid : false,
              });
              index++;
            });
          }
          setLeaderboardData(board);
          setLoadingLeaderboard(false);
        },
        (error) => {
          console.error("Leaderboard error:", error);
          setLoadingLeaderboard(false);
        }
      );
    return () => unsubscribe();
  }, [currentUser, colors.primary]);

  const handleCreatePost = async () => {
    if (!newPostText.trim() || !currentUser) return;

    setIsPosting(true);
    try {
      const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
      const userData = userDoc.exists ? userDoc.data() : null;

      await firestore().collection('posts').add({
        uid: currentUser.uid,
        name: currentUser.displayName || userData?.fullName || userData?.name || 'ECC Learner',
        text: newPostText.trim(),
        avatarBg: userData?.avatarBg || colors.primary,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      setNewPostText('');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit post.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = (postId: string) => {
    Alert.alert(
      'Delete Post',
      'Remove this post permanently?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await firestore().collection('posts').doc(postId).delete();
            } catch (error) {
              Alert.alert('Error', 'Action unauthorized.');
            }
          }
        }
      ]
    );
  };

  // --- Render Feed Item ---
  const renderFeedPost = ({ item }: { item: any }) => {
    const isOwner = currentUser ? item.uid === currentUser.uid : false;
    const canDelete = isOwner || isAdmin;

    return (
      <View style={[styles.postCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.postHeader}>
          <View style={[styles.avatarCircle, { backgroundColor: item.avatarBg }]}>
            <Text style={styles.avatarText}>{item.avatar}</Text>
          </View>
          <View style={styles.postInfo}>
            <Text style={[styles.posterName, { color: colors.textPrimary }]}>{item.name}</Text>
            <Text style={[styles.postTime, { color: colors.textSecondary }]}>{item.time}</Text>
          </View>
          {canDelete && (
            <TouchableOpacity style={[styles.deleteButton, { backgroundColor: isDarkMode ? '#451A1A' : '#FEF2F2' }]} onPress={() => handleDeletePost(item.id)}>
              <Trash2 size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.postText, { color: colors.textPrimary }]}>{item.text}</Text>
      </View>
    );
  };

  // --- Render Challenge Item ---
  const renderChallengeCard = ({ item }: { item: any }) => (
    <View style={[styles.postCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.postHeader}>
        <View style={[styles.avatarCircle, { backgroundColor: isDarkMode ? '#312E81' : '#EEF2FF' }]}>
          <Flame size={20} color={colors.primary} />
        </View>
        <View style={styles.postInfo}>
          <Text style={[styles.posterName, { color: colors.textPrimary }]}>{item.title || 'Daily Speaking Challenge'}</Text>
          <Text style={[styles.postTime, { color: colors.textSecondary }]}>{item.participantsCount || '100+'} participating</Text>
        </View>
      </View>
      <Text style={[styles.postText, { color: colors.textSecondary }]}>{item.description || 'Practice today\'s prompt and post your response in the feed!'}</Text>
    </View>
  );

  // --- Render Leaderboard Item ---
  const renderLeaderboardItem = ({ item }: { item: any }) => (
    <View style={[
      styles.leaderboardRow, 
      { backgroundColor: item.highlight ? (isDarkMode ? '#1E293B' : '#EFF6FF') : colors.bgCard, borderColor: colors.border }
    ]}>
      <Text style={[styles.rankText, { color: item.rank <= 3 ? '#F59E0B' : colors.textSecondary }]}>#{item.rank}</Text>
      <View style={[styles.avatarCircleSmall, { backgroundColor: item.avatarBg }]}>
        <Text style={styles.avatarTextSmall}>{item.avatar}</Text>
      </View>
      <Text style={[styles.leaderboardName, { color: colors.textPrimary }]}>{item.name}</Text>
      <View style={[styles.xpBadge, { backgroundColor: isDarkMode ? '#312E81' : '#EEF2FF' }]}>
        <Award size={14} color={colors.primary} style={{ marginRight: 4 }} />
        <Text style={[styles.xpBadgeText, { color: colors.primary }]}>{item.xp}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={colors.bgLight} />
      
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Community</Text>
        <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>Learn together, grow together</Text>
      </View>

      <View style={[styles.tabsContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === index && [styles.activeTab, { backgroundColor: colors.bgCard }]]}
            onPress={() => setActiveTab(index)}
          >
            <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === index && [styles.activeTabText, { color: colors.textPrimary }]]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── TAB 1: FEED ─── */}
      {activeTab === 0 && (
        <View style={{ flex: 1 }}>
          <View style={[styles.createPostContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary }]}
              placeholder="Share your learning update..."
              placeholderTextColor={colors.textSecondary}
              value={newPostText}
              onChangeText={setNewPostText}
              multiline
            />
            <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.primary }]} onPress={handleCreatePost} disabled={isPosting}>
              {isPosting ? <ActivityIndicator size="small" color="#FFF" /> : <Send size={18} color="#FFF" />}
            </TouchableOpacity>
          </View>

          {loadingFeed ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <FlatList 
              data={feedData} 
              renderItem={renderFeedPost} 
              keyExtractor={item => item.id} 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={styles.scrollList} 
            />
          )}
        </View>
      )}

      {/* ─── TAB 2: CHALLENGES ─── */}
      {activeTab === 1 && (
        <View style={{ flex: 1 }}>
          {loadingChallenges ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <FlatList 
              data={challengesData.length > 0 ? challengesData : [{ id: '1', title: 'Daily Tongue Twister', description: 'Practice "Peter Piper picked a peck of pickled peppers" 5 times without stuttering!', participantsCount: 142 }]} 
              renderItem={renderChallengeCard} 
              keyExtractor={item => item.id} 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={styles.scrollList} 
            />
          )}
        </View>
      )}

      {/* ─── TAB 3: LEADERBOARD ─── */}
      {activeTab === 2 && (
        <View style={{ flex: 1 }}>
          {loadingLeaderboard ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <FlatList 
              data={leaderboardData} 
              renderItem={renderLeaderboardItem} 
              keyExtractor={item => item.id} 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={styles.scrollList} 
            />
          )}
        </View>
      )}
    </View>
  );
};

export default CommunityScreen;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingHorizontal: 20 
  },
  header: { marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '800' },
  subtitleText: { fontSize: 16, marginTop: 2 },
  tabsContainer: { 
    flexDirection: 'row', 
    borderRadius: 30, 
    padding: 4, 
    marginBottom: 20, 
    alignSelf: 'flex-start' 
  },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 24 },
  activeTab: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  tabText: { fontSize: 15, fontWeight: '600' },
  activeTabText: { fontWeight: '700' },
  scrollList: { paddingBottom: 120 },
  createPostContainer: { 
    flexDirection: 'row', 
    borderRadius: 20, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    alignItems: 'center', 
    marginBottom: 16, 
    borderWidth: 1 
  },
  inputField: { 
    flex: 1, 
    fontSize: 15, 
    maxHeight: 80, 
    paddingTop: Platform.OS === 'ios' ? 8 : 4 
  },
  sendButton: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginLeft: 10 
  },
  postCard: { 
    borderRadius: 24, 
    padding: 16, 
    marginBottom: 16, 
    elevation: 1, 
    borderWidth: 1 
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  postInfo: { flex: 1 },
  posterName: { fontSize: 16, fontWeight: '700' },
  postTime: { fontSize: 13, marginTop: 1 },
  deleteButton: { padding: 6, borderRadius: 8 },
  postText: { fontSize: 15, lineHeight: 22 },
  
  leaderboardRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14, 
    borderRadius: 20, 
    marginBottom: 10, 
    borderWidth: 1 
  },
  rankText: { fontSize: 16, fontWeight: '800', width: 32 },
  avatarCircleSmall: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarTextSmall: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  leaderboardName: { flex: 1, fontSize: 15, fontWeight: '700' },
  xpBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  xpBadgeText: { fontSize: 13, fontWeight: '700' }
});