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
  StatusBar,
  Modal,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { Trash2, Send, Trophy, Plus, X, CheckCircle, Flame, HelpCircle } from 'lucide-react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../../hooks/useTheme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TABS = ['Feed', 'Challenges', 'Leaderboard'];

const AVATAR_COLORS = [
  '#4285F4', '#EA4335', '#FBBC05', '#34A853', 
  '#8E24AA', '#00ACC1', '#F4511E', '#3949AB', '#D81B60'
];

const getAvatarColor = (str: string = 'User') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

const formatTimeAgo = (timestamp: any) => {
  if (!timestamp) return 'Just now';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

interface QuizQuestion {
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

const CommunityScreen = () => {
  // 1. ALL HOOKS CALLS MUST BE AT THE TOP (Unconditional)
  const themeContext = useTheme();
  const isDarkMode = themeContext?.isDarkMode ?? false;
  const colors = themeContext?.theme?.colors || {
    primary: '#6366F1',
    bgLight: '#F8FAFC',
    bgCard: '#FFFFFF',
    border: '#E2E8F0',
    textPrimary: '#0F172A',
    textSecondary: '#64748B'
  };

  const currentUser = auth().currentUser;

  // State Hooks
  const [activeTab, setActiveTab] = useState(0); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [posts, setPosts] = useState<any[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const [challengesData, setChallengesData] = useState<any[]>([]);
  const [completedQuizIds, setCompletedQuizIds] = useState<string[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [isPublishingQuiz, setIsPublishingQuiz] = useState(false);

  const [isAddQuestionModalVisible, setIsAddQuestionModalVisible] = useState(false);
  const [currentQuizQuestions, setCurrentQuizQuestions] = useState<QuizQuestion[]>([]);
  const [tempQuestionText, setTempQuestionText] = useState('');
  const [tempOptions, setTempOptions] = useState<string[]>(['', '', '', '']);
  const [selectedCorrectIndex, setSelectedCorrectIndex] = useState<number>(0);
  const [tempExplanation, setTempExplanation] = useState('');

  const [isStudentQuizModalVisible, setIsStudentQuizModalVisible] = useState(false);
  const [currentTakingQuiz, setCurrentTakingQuiz] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userSelectedOption, setUserSelectedOption] = useState<number | null>(null);
  const [calculatedScore, setCalculatedScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const [leaderboardUsers, setLeaderboardUsers] = useState<any[]>([]);

  // Effect Hooks
  useEffect(() => {
    let isMounted = true;
    const checkAdminRole = async () => {
      if (!currentUser?.email) {
        if (isMounted) setIsAdmin(false);
        return;
      }
      try {
        const adminQuery = await firestore()
          .collection('admins')
          .where('email', '==', currentUser.email)
          .get();
        if (isMounted) setIsAdmin(!adminQuery.empty);
      } catch (error) { 
        if (isMounted) setIsAdmin(false); 
      }
    };

    checkAdminRole();
    return () => { isMounted = false; };
  }, [currentUser?.email]);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('posts')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        (snapshot) => {
          const fetchedPosts: any[] = [];
          if (snapshot) {
            snapshot.forEach((doc) => fetchedPosts.push({ id: doc.id, ...doc.data() }));
          }
          setPosts(fetchedPosts);
          setLoading(false);
        },
        () => setLoading(false)
      );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribeChallenges = firestore()
      .collection('challenges')
      .orderBy('createdAt', 'desc')
      .onSnapshot((snapshot) => {
        const fetched: any[] = [];
        if (snapshot) {
          snapshot.forEach((doc) => fetched.push({ id: doc.id, ...doc.data() }));
        }
        setChallengesData(fetched);
      });

    let unsubscribeResults = () => {};
    if (currentUser?.uid) {
      unsubscribeResults = firestore()
        .collection('quiz_results')
        .where('userId', '==', currentUser.uid)
        .onSnapshot((snapshot) => {
          const doneIds: string[] = [];
          if (snapshot) {
            snapshot.forEach((doc) => doneIds.push(doc.data().quizId));
          }
          setCompletedQuizIds(doneIds);
        });
    }

    return () => {
      unsubscribeChallenges();
      unsubscribeResults();
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('users')
      .orderBy('xp', 'desc')
      .limit(20)
      .onSnapshot((snapshot) => {
        const users: any[] = [];
        if (snapshot) {
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.xp && data.xp > 0) {
              users.push({ id: doc.id, ...data });
            }
          });
        }
        setLeaderboardUsers(users);
      });
    return () => unsubscribe();
  }, []);

  // 2. HELPER FUNCTIONS
  const handleCreatePost = async () => {
    if (!newPostText.trim() || !currentUser) return;
    setIsPosting(true);
    try {
      let senderName = currentUser.displayName;

      if (!senderName) {
        const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
          senderName = userDoc.data()?.fullName || userDoc.data()?.name;
        }
      }

      if (!senderName && currentUser.email) {
        senderName = currentUser.email.split('@')[0];
      }

      if (!senderName) senderName = 'User';

      await firestore().collection('posts').add({
        text: newPostText.trim(),
        uid: currentUser.uid,
        userName: senderName,
        name: senderName,
        createdAt: firestore.FieldValue.serverTimestamp()
      });
      setNewPostText('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = (id: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive', 
        onPress: () => firestore().collection('posts').doc(id).delete() 
      }
    ]);
  };

  const handleDeleteChallenge = (challengeId: string) => {
    Alert.alert(
      'Delete Quiz',
      'This will delete the quiz and reset earned XP for all users who attempted it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const resultsQuery = await firestore()
                .collection('quiz_results')
                .where('quizId', '==', challengeId)
                .get();
              
              const batch = firestore().batch();

              for (const doc of resultsQuery.docs) {
                const resData = doc.data();
                if (resData.userId && resData.earnedXP) {
                  const userRef = firestore().collection('users').doc(resData.userId);
                  batch.update(userRef, {
                    xp: firestore.FieldValue.increment(-resData.earnedXP)
                  });
                }
                batch.delete(doc.ref);
              }

              const challengeRef = firestore().collection('challenges').doc(challengeId);
              batch.delete(challengeRef);

              await batch.commit();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          } 
        }
      ]
    );
  };

  const handleAddQuestion = () => {
    if (!tempQuestionText.trim() || tempOptions.some(opt => !opt.trim())) {
      Alert.alert('Validation Error', 'Question and all 4 options are required.');
      return;
    }

    const newQuestion: QuizQuestion = {
      questionText: tempQuestionText.trim(),
      options: tempOptions.map(o => o.trim()),
      correctAnswerIndex: selectedCorrectIndex,
      explanation: tempExplanation.trim()
    };

    setCurrentQuizQuestions(prev => [...prev, newQuestion]);
    setTempQuestionText('');
    setTempOptions(['', '', '', '']);
    setSelectedCorrectIndex(0);
    setTempExplanation('');
    setIsAddQuestionModalVisible(false);
  };

  const handlePublishQuiz = async () => {
    if (!quizTitle.trim() || currentQuizQuestions.length === 0) {
      Alert.alert('Error', 'Please enter a Quiz Title and add at least 1 question.');
      return;
    }

    setIsPublishingQuiz(true);
    try {
      await firestore().collection('challenges').add({
        title: quizTitle.trim(),
        questions: currentQuizQuestions,
        totalQuestions: currentQuizQuestions.length,
        createdAt: firestore.FieldValue.serverTimestamp()
      });

      setQuizTitle('');
      setCurrentQuizQuestions([]);
      Alert.alert('Success', 'Quiz Published!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsPublishingQuiz(false);
    }
  };

  const handleStartQuiz = (quiz: any) => {
    if (completedQuizIds.includes(quiz.id)) {
      Alert.alert('Already Attempted', 'Aap ye quiz pehle hi de chuke hain.');
      return;
    }
    setCurrentTakingQuiz(quiz);
    setCurrentQuestionIndex(0);
    setUserSelectedOption(null);
    setCalculatedScore(0);
    setQuizCompleted(false);
    setShowExplanation(false);
    setIsStudentQuizModalVisible(true);
  };

  const handleSelectOption = (index: number) => {
    if (showExplanation) return;
    setUserSelectedOption(index);
  };

  const handleConfirmAnswer = () => {
    if (userSelectedOption === null) {
      Alert.alert('Selection Required', 'Kripya ek option select karein.');
      return;
    }

    const activeQuestion = currentTakingQuiz?.questions?.[currentQuestionIndex];
    const isCorrect = userSelectedOption === activeQuestion?.correctAnswerIndex;
    
    if (isCorrect) {
      setCalculatedScore(prev => prev + 1);
    }

    setShowExplanation(true);
  };

  const handleNextQuestion = () => {
    const totalQuestions = currentTakingQuiz?.questions?.length || 0;

    if (currentQuestionIndex + 1 < totalQuestions) {
      setCurrentQuestionIndex(prev => prev + 1);
      setUserSelectedOption(null);
      setShowExplanation(false);
    } else {
      setQuizCompleted(true);
      submitScoreToLeaderboard(calculatedScore, totalQuestions);
    }
  };

  const submitScoreToLeaderboard = async (finalScore: number, totalQ: number) => {
    if (!currentUser || !currentTakingQuiz) return;
    try {
      const earnedXP = finalScore * 10;
      
      let userName = currentUser.displayName;
      if (!userName) {
        const uDoc = await firestore().collection('users').doc(currentUser.uid).get();
        if (uDoc.exists) userName = uDoc.data()?.fullName || uDoc.data()?.name;
      }
      if (!userName && currentUser.email) userName = currentUser.email.split('@')[0];

      await firestore().collection('quiz_results').add({
        quizId: currentTakingQuiz.id,
        quizTitle: currentTakingQuiz.title || 'MCQ Challenge',
        userId: currentUser.uid,
        userName: userName,
        score: finalScore,
        totalQuestions: totalQ,
        earnedXP: earnedXP,
        completedAt: firestore.FieldValue.serverTimestamp()
      });

      await firestore().collection('users').doc(currentUser.uid).set({
        xp: firestore.FieldValue.increment(earnedXP),
        fullName: userName,
        email: currentUser.email || ''
      }, { merge: true });

    } catch (error) {
      console.error('Error submitting score:', error);
    }
  };

  // 3. RENDER FUNCTIONS
 const renderPostCard = ({ item }: { item: any }) => {
    const displayName = item.userName || item.name || 'User';
    const firstLetter = displayName.charAt(0).toUpperCase();
    const avatarBg = getAvatarColor(displayName);
    const timeAgo = formatTimeAgo(item.createdAt);

    // DELETE PERMISSION CHECK: Admin can delete any post, Regular user can ONLY delete their own post
    const canDelete = isAdmin || (currentUser?.uid && item.uid === currentUser.uid);

    return (
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
              <Text style={styles.avatarText}>{firstLetter}</Text>
            </View>
            <View>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>{displayName}</Text>
              <Text style={[styles.timeAgoText, { color: colors.textSecondary }]}>{timeAgo}</Text>
            </View>
          </View>
          
          {/* SHOW DELETE BUTTON ONLY IF ADMIN OR POST OWNER */}
          {canDelete && (
            <TouchableOpacity onPress={() => handleDeletePost(item.id)} style={styles.deleteBtn}>
              <Trash2 size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.postText, { color: colors.textPrimary }]}>{item.text}</Text>
      </View>
    );
  };

  const renderChallengeCard = ({ item }: { item: any }) => {
    const isDone = completedQuizIds.includes(item.id);
    const totalQ = item?.questions?.length || item?.totalQuestions || 0;

    return (
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#312E81' : '#EEF2FF' }]}>
              <Trophy size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>{totalQ} Questions • Up to {totalQ * 10} XP</Text>
            </View>
          </View>
          {isAdmin && (
            <TouchableOpacity onPress={() => handleDeleteChallenge(item.id)} style={styles.deleteBtn}>
              <Trash2 size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        {isDone ? (
          <View style={[styles.attemptedBadge, { backgroundColor: '#F1F5F9' }]}>
            <CheckCircle size={16} color="#10B981" />
            <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 13, marginLeft: 6 }}>Completed</Text>
          </View>
        ) : (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => handleStartQuiz(item)}>
            <Text style={styles.actionBtnText}>Start Quiz Challenge</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderLeaderboardItem = ({ item, index }: { item: any, index: number }) => {
    const displayName = item.fullName || item.name || item.email?.split('@')[0] || 'User';
    const firstLetter = displayName.charAt(0).toUpperCase();
    const avatarBg = getAvatarColor(displayName);

    return (
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }]}>
        <Text style={[styles.rankText, { color: index === 0 ? '#F59E0B' : index === 1 ? '#94A3B8' : index === 2 ? '#D97706' : colors.textSecondary }]}>
          #{index + 1}
        </Text>
        
        <View style={[styles.avatarSmall, { backgroundColor: avatarBg, marginLeft: 8 }]}>
          <Text style={styles.avatarSmallText}>{firstLetter}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{displayName}</Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Flame size={18} color="#EF4444" />
          <Text style={{ fontWeight: '800', color: colors.textPrimary, marginLeft: 4 }}>{item.xp || 0} XP</Text>
        </View>
      </View>
    );
  };

  const activeQuizQuestion = currentTakingQuiz?.questions?.[currentQuestionIndex];
  const activeQuizTotal = currentTakingQuiz?.questions?.length || 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={colors.bgLight} />
      
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Community</Text>
        <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>Connect, Learn & Rank</Text>
      </View>

      <View style={[styles.tabsContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
        {TABS.map((tab, index) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === index && [styles.activeTab, { backgroundColor: colors.bgCard }]]} onPress={() => setActiveTab(index)}>
            <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === index && [styles.activeTabText, { color: colors.textPrimary }]]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* FEED TAB */}
      {activeTab === 0 && (
        <View style={{ flex: 1 }}>
          <View style={[styles.createPostBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <TextInput style={[styles.postInput, { color: colors.textPrimary }]} placeholder="Write a post..." placeholderTextColor={colors.textSecondary} value={newPostText} onChangeText={setNewPostText} multiline />
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primary }, !newPostText.trim() && { opacity: 0.5 }]} onPress={handleCreatePost} disabled={isPosting || !newPostText.trim()}>
              {isPosting ? <ActivityIndicator size="small" color="#FFF" /> : <Send size={16} color="#FFF" />}
            </TouchableOpacity>
          </View>
          <FlatList data={posts} renderItem={renderPostCard} keyExtractor={item => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollList} ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 20 }}>No posts yet.</Text>} />
        </View>
      )}

      {/* CHALLENGES TAB */}
      {activeTab === 1 && (
        <View style={{ flex: 1 }}>
          {isAdmin && (
            <View style={[styles.adminCard, { backgroundColor: colors.bgCard, borderColor: colors.primary }]}>
              <Text style={[styles.adminTitle, { color: colors.primary }]}>👑 Admin: Create New Quiz</Text>
              <TextInput style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} placeholder="Quiz Title (e.g., Tense Master Quiz 1)" placeholderTextColor={colors.textSecondary} value={quizTitle} onChangeText={setQuizTitle} />
              
              <Text style={{ color: colors.textSecondary, marginBottom: 8, fontWeight: '600', fontSize: 12 }}>Questions Added: {currentQuizQuestions.length}</Text>
              
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.primary }]} onPress={() => setIsAddQuestionModalVisible(true)}>
                  <Plus size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, marginLeft: 4 }}>Add Question</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary, flex: 1 }, (currentQuizQuestions.length === 0 || !quizTitle) && { opacity: 0.5 }]} onPress={handlePublishQuiz} disabled={isPublishingQuiz || currentQuizQuestions.length === 0 || !quizTitle}>
                  {isPublishingQuiz ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.actionBtnText}>Publish Quiz</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <FlatList data={challengesData} renderItem={renderChallengeCard} keyExtractor={item => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollList} ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 20 }}>No challenges available.</Text>} />
        </View>
      )}

      {/* LEADERBOARD TAB */}
      {activeTab === 2 && (
        <FlatList data={leaderboardUsers} renderItem={renderLeaderboardItem} keyExtractor={item => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollList} ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 20 }}>No leaderboard data yet.</Text>} />
      )}

      {/* ADMIN MODAL */}
      <Modal visible={isAddQuestionModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsAddQuestionModalVisible(false)}>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Question & Solution</Text>
              <TouchableOpacity onPress={() => setIsAddQuestionModalVisible(false)}><X size={22} color="#000" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput style={styles.modalInput} placeholder="Enter Question..." value={tempQuestionText} onChangeText={setTempQuestionText} multiline />
              
              <Text style={{ fontWeight: '700', marginVertical: 8, color: '#334155', fontSize: 13 }}>
                Tap check icon to mark correct answer:
              </Text>

              {tempOptions.map((optionText, idx) => (
                <View key={idx} style={[styles.optionRow, selectedCorrectIndex === idx && { borderColor: '#10B981', backgroundColor: '#ECFDF5' }]}>
                  <Text style={styles.optionChar}>{String.fromCharCode(65 + idx)}.</Text>
                  <TextInput 
                    style={styles.optionInput} 
                    placeholder={`Option ${idx + 1}`} 
                    value={optionText} 
                    onChangeText={(txt) => {
                      const copy = [...tempOptions];
                      copy[idx] = txt;
                      setTempOptions(copy);
                    }} 
                  />
                  <TouchableOpacity onPress={() => setSelectedCorrectIndex(idx)} style={{ padding: 4 }}>
                    <CheckCircle size={24} color={selectedCorrectIndex === idx ? '#10B981' : '#CBD5E1'} />
                  </TouchableOpacity>
                </View>
              ))}

              <Text style={{ fontWeight: '700', marginTop: 10, marginBottom: 4, color: '#334155', fontSize: 13 }}>
                Description / Correct Solution (Optional):
              </Text>
              <TextInput 
                style={[styles.modalInput, { height: 70 }]} 
                placeholder="Explain why this answer is correct..." 
                value={tempExplanation} 
                onChangeText={setTempExplanation} 
                multiline 
              />

              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981', marginTop: 10 }]} onPress={handleAddQuestion}>
                <Text style={styles.actionBtnText}>Save Question</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* STUDENT MODAL */}
      <Modal visible={isStudentQuizModalVisible && currentTakingQuiz !== null} animationType="fade" transparent={true} onRequestClose={() => setIsStudentQuizModalVisible(false)}>
        <View style={styles.studentModalOverlay}>
          <View style={styles.studentModalContent}>
            {quizCompleted ? (
              <View style={{ alignItems: 'center', padding: 20 }}>
                <CheckCircle size={60} color="#10B981" style={{ marginBottom: 10 }} />
                <Text style={{ fontSize: 20, fontWeight: '800' }}>Quiz Completed!</Text>
                <Text style={{ fontSize: 16, color: colors.primary, fontWeight: '700', marginTop: 8 }}>
                  Score: {calculatedScore} / {activeQuizTotal}
                </Text>
                <Text style={{ fontSize: 14, color: '#EF4444', fontWeight: '700', marginTop: 4 }}>
                  + {calculatedScore * 10} XP
                </Text>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: 20, paddingHorizontal: 30 }]} onPress={() => setIsStudentQuizModalVisible(false)}>
                  <Text style={styles.actionBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={{ fontSize: 16, fontWeight: '700', flex: 1 }}>{currentTakingQuiz?.title}</Text>
                  <TouchableOpacity onPress={() => setIsStudentQuizModalVisible(false)}><X size={20} color="#64748B" /></TouchableOpacity>
                </View>

                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
                  Question {currentQuestionIndex + 1} of {activeQuizTotal}
                </Text>
                
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 }}>
                  {activeQuizQuestion?.questionText}
                </Text>
                
                {activeQuizQuestion?.options?.map((opt: string, index: number) => {
                  const isSelected = userSelectedOption === index;
                  const isCorrectAnswer = index === activeQuizQuestion?.correctAnswerIndex;
                  
                  let optionBg = isDarkMode ? '#1E293B' : '#FFF';
                  let optionBorder = '#CBD5E1';

                  if (showExplanation) {
                    if (isCorrectAnswer) {
                      optionBg = '#ECFDF5';
                      optionBorder = '#10B981';
                    } else if (isSelected && !isCorrectAnswer) {
                      optionBg = '#FEF2F2';
                      optionBorder = '#EF4444';
                    }
                  } else if (isSelected) {
                    optionBg = isDarkMode ? '#1E293B' : '#EEF2FF';
                    optionBorder = colors.primary;
                  }

                  return (
                    <TouchableOpacity 
                      key={index} 
                      style={[styles.studentOptionBtn, { backgroundColor: optionBg, borderColor: optionBorder }]} 
                      onPress={() => handleSelectOption(index)}
                      disabled={showExplanation}
                    >
                      <Text style={{ fontWeight: '800', width: 22 }}>{String.fromCharCode(65 + index)}.</Text>
                      <Text style={{ fontSize: 14, color: colors.textPrimary, flex: 1 }}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}

    {/* STUDENT MODAL Inside Logic */}
{showExplanation && (() => {
  // 1. Calculate isCorrect here
  const isCorrect = userSelectedOption === activeQuizQuestion?.correctAnswerIndex;

  return (
    <View style={[
      styles.explanationBox, 
      { backgroundColor: isCorrect ? '#ECFDF5' : '#FEF2F2', borderColor: isCorrect ? '#A7F3D0' : '#FECACA' }
    ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <HelpCircle size={16} color={isCorrect ? '#059669' : '#DC2626'} />
        <Text style={{ fontWeight: '700', color: isCorrect ? '#065F46' : '#991B1B', fontSize: 13 }}>
          {isCorrect ? '✅ Excellent! Solution:' : '💡 Correct Solution:'}
        </Text>
      </View>
      <Text style={{ fontSize: 13, color: '#334155', lineHeight: 18 }}>
        {activeQuizQuestion?.explanation || `Correct Answer: Option ${String.fromCharCode(65 + activeQuizQuestion?.correctAnswerIndex)}`}
      </Text>
    </View>
  );
})()}

                {!showExplanation ? (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: 16 }, userSelectedOption === null && { opacity: 0.5 }]} 
                    onPress={handleConfirmAnswer} 
                    disabled={userSelectedOption === null}
                  >
                    <Text style={styles.actionBtnText}>Check Answer</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#10B981', marginTop: 16 }]} 
                    onPress={handleNextQuestion} 
                  >
                    <Text style={styles.actionBtnText}>
                      {currentQuestionIndex + 1 === activeQuizTotal ? 'Finish Quiz' : 'Next Question'}
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
};

export default CommunityScreen;

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20 },
  header: { marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '800' },
  subtitleText: { fontSize: 15, marginTop: 2 },
  tabsContainer: { flexDirection: 'row', borderRadius: 30, padding: 4, marginBottom: 16, alignSelf: 'flex-start' },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 24 },
  activeTab: { elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600' },
  activeTabText: { fontWeight: '700' },
  scrollList: { paddingBottom: 100 },
  
  card: { borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarSmallText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  
  userName: { fontWeight: '700', fontSize: 15 },
  timeAgoText: { fontSize: 11, marginTop: 1 },
  postText: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  iconBox: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontWeight: '700', fontSize: 15 },
  cardSubtitle: { fontSize: 12, marginTop: 2 },

  deleteBtn: { padding: 6, borderRadius: 8, backgroundColor: '#FEE2E2' },

  attemptedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  actionBtn: { height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  outlineBtn: { height: 42, borderRadius: 10, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },

  createPostBox: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 8, alignItems: 'center', marginBottom: 16 },
  postInput: { flex: 1, paddingHorizontal: 10, fontSize: 14, maxHeight: 80 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  adminCard: { padding: 12, borderRadius: 16, borderWidth: 1.5, marginBottom: 16 },
  adminTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 40, fontSize: 13, marginBottom: 8 },

  rankText: { fontSize: 16, fontWeight: '800', width: 26 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: SCREEN_HEIGHT * 0.8, padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  modalInput: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 10, height: 50, fontSize: 13, marginBottom: 8 },
  
  optionRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, marginBottom: 8, height: 44 },
  optionChar: { fontWeight: '800', width: 20 },
  optionInput: { flex: 1, fontSize: 13, color: '#0F172A' },

  studentModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  studentModalContent: { backgroundColor: '#FFF', borderRadius: 20, width: '100%', maxHeight: SCREEN_HEIGHT * 0.8, padding: 16 },
  studentOptionBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, padding: 12, marginBottom: 8 },
  
  explanationBox: { backgroundColor: '#EEF2FF', borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#C7D2FE' }
});