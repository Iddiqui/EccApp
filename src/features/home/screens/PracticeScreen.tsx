import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  Platform, 
  ActivityIndicator 
} from 'react-native';
import { ArrowRight, Sparkles, BookOpen, Calendar, Mic, Volume2 } from 'lucide-react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../../hooks/useTheme';

export default function PracticeScreen() {
  // 🌐 Global Theme Context & Translations Access
  const { theme, isDarkMode, t } = useTheme() as any;
  const colors = theme.colors;

  // Real-time Firestore States
  const [practiceData, setPracticeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = auth().currentUser;

    if (currentUser) {
      // Real-time database synchronizer
      const unsubscribe = firestore()
        .collection('users')
        .doc(currentUser.uid)
        .onSnapshot(
          (documentSnapshot) => {
            if (documentSnapshot.exists()) {
              setPracticeData(documentSnapshot.data());
            } else {
              // Default structural fallback safely handles new profile documentations
              setPracticeData({
                minutesSpokenToday: 0,
                dailyGoalMinutes: 20,
              });
            }
            setLoading(false);
          },
          (error) => {
            console.error("Firestore real-time sync mapping error:", error);
            setLoading(false);
          }
        );

      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  // UI state management during asynchronous load phases
  if (loading) {
    return (
      <View style={[styles.mainContainer, { backgroundColor: colors.bgLight, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // --- Dynamic Math Computations for Goal Component ---
  const spokenMinutes = practiceData?.minutesSpokenToday ?? 0;
  const targetGoalMinutes = practiceData?.dailyGoalMinutes ?? 20;
  
  // Safe math bounds mapping prevents any potential division by zero constraints
  const structuralPercentage = targetGoalMinutes > 0 
    ? Math.min(Math.round((spokenMinutes / targetGoalMinutes) * 100), 100) 
    : 0;

  return (
    <View style={[styles.mainContainer, { backgroundColor: colors.bgLight }]}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={colors.bgLight} 
        translucent={true} 
      />
      
      {/* ─── FIXED HEADER SECTION ─── */}
      <View style={[styles.fixedHeader, { backgroundColor: colors.bgLight }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t?.practice?.title || 'Practice'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t?.practice?.subtitle || 'Sharpen your speaking, your way'}
        </Text>
      </View>

      {/* ─── SCROLLABLE CONTENT SECTION ─── */}
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Button */}
        <TouchableOpacity style={[styles.heroButton, { backgroundColor: colors.primary }]} activeOpacity={0.9}>
          <Text style={styles.heroButtonText}>
            {t?.practice?.yourCoach || 'YOUR AI COACH'}
          </Text>
        </TouchableOpacity>

        {/* Weekly Goal Card */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: isDarkMode ? 1 : 0 }]}>
          <View style={styles.row}>
            <View style={[styles.progressRingOuter, { borderColor: isDarkMode ? '#334155' : '#E2E8F0', borderLeftColor: colors.primary, borderTopColor: colors.primary }]}>
              <View style={[styles.progressRingInner, { borderColor: colors.primary }]}>
                <View style={[styles.progressDot, { backgroundColor: colors.primary }]} />
              </View>
            </View>
            
            <View style={styles.goalTextContainer}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                {t?.practice?.weeklyGoal || 'Weekly goal'}
              </Text>
              <Text style={[styles.goalStats, { color: colors.textSecondary }]}>
                <Text style={[styles.boldText, { color: colors.textPrimary }]}>
                  {spokenMinutes} / {targetGoalMinutes}
                </Text> {t?.practice?.spokenToday || 'minutes spoken today'}
              </Text>
            </View>

            <View style={[styles.badge, { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>{structuralPercentage}%</Text>
            </View>
          </View>
        </View>

        {/* AI Speaking Coach Card */}
        <TouchableOpacity style={[styles.cardRow, { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: isDarkMode ? 1 : 0 }]} activeOpacity={0.8}>
          <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? '#134E4A' : '#E0F7F6' }]}>
            <Sparkles color="#14B8A6" size={24} />
          </View>
          <View style={styles.cardRowTextContainer}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {t?.practice?.aiCoachTitle || 'AI Speaking Coach'}
            </Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              {t?.practice?.aiCoachDesc || 'Have a real conversation and get instant feedback.'}
            </Text>
          </View>
          <ArrowRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>

        {/* Read & Record Card */}
        <TouchableOpacity style={[styles.cardRow, { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: isDarkMode ? 1 : 0 }]} activeOpacity={0.8}>
          <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF' }]}>
            <BookOpen color="#6366F1" size={24} />
          </View>
          <View style={styles.cardRowTextContainer}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {t?.practice?.readRecordTitle || 'Read & Record'}
            </Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              {t?.practice?.readRecordDesc || 'Read an article aloud and analyze your pronunciation.'}
            </Text>
          </View>
          <ArrowRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>

        {/* 1:1 Live Coach Card */}
        <TouchableOpacity style={[styles.cardRow, { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: isDarkMode ? 1 : 0 }]} activeOpacity={0.8}>
          <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? '#431407' : '#FFF7ED' }]}>
            <Calendar color="#EA580C" size={24} />
          </View>
          <View style={styles.cardRowTextContainer}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {t?.practice?.trainerTitle || '1:1 with a Trainer'}
            </Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              {t?.practice?.trainerDesc || 'Book a live session with a certified coach.'}
            </Text>
          </View>
          <ArrowRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>

        {/* Quick Drills Matrix */}
        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
          {t?.practice?.quickDrills || 'Quick drills'}
        </Text>

        <View style={styles.gridContainer}>
          <TouchableOpacity style={[styles.gridCard, { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: isDarkMode ? 1 : 0 }]} activeOpacity={0.8}>
            <View style={[styles.iconContainerGrid, { backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF' }]}>
              <Mic color="#2563EB" size={20} />
            </View>
            <Text style={[styles.gridCardTitle, { color: colors.textPrimary }]}>
              {t?.practice?.tongueTwisters || 'Tongue twisters'}
            </Text>
            <Text style={[styles.gridCardSub, { color: colors.textSecondary }]}>
              {t?.practice?.drillTime || '3 min drill'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.gridCard, { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: isDarkMode ? 1 : 0 }]} activeOpacity={0.8}>
            <View style={styles.gridCardInner}>
              <View style={[styles.iconContainerGrid, { backgroundColor: isDarkMode ? '#134E4A' : '#E0F7F6' }]}>
                <Volume2 color="#0D9488" size={20} />
              </View>
              <Text style={[styles.gridCardTitle, { color: colors.textPrimary }]}>
                {t?.practice?.minimalPairs || 'Minimal pairs'}
              </Text>
              <Text style={[styles.gridCardSub, { color: colors.textSecondary }]}>
                {t?.practice?.drillTime || '3 min drill'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
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
    paddingTop: (STATUSBAR_HEIGHT || 0) + 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },
  heroButton: {
    borderRadius: 30,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  cardRow: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressRingOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRingInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  goalTextContainer: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  goalStats: {
    fontSize: 14,
    marginTop: 2,
  },
  boldText: {
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontWeight: '600',
    fontSize: 13,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardRowTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  cardDescription: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  gridCard: {
    borderRadius: 24,
    padding: 20,
    width: '47.5%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  gridCardInner: {
    width: '100%',
  },
  iconContainerGrid: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  gridCardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  gridCardSub: {
    fontSize: 13,
    marginTop: 4,
  },
});