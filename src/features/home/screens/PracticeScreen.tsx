import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { ArrowRight, Sparkles, BookOpen, Calendar, Mic, Volume2 } from 'lucide-react-native';

export default function PracticeScreen() {
  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" translucent={true} />
      
      {/* ─── FIXED HEADER SECTION (ScrollView Se Bahar) ─── */}
      <View style={styles.fixedHeader}>
        <Text style={styles.title}>Practice</Text>
        <Text style={styles.subtitle}>Sharpen your speaking, your way</Text>
      </View>

      {/* ─── SCROLLABLE CONTENT SECTION ─── */}
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Button */}
        <TouchableOpacity style={styles.heroButton} activeOpacity={0.9}>
          <Text style={styles.heroButtonText}>YOUR AI COACH</Text>
        </TouchableOpacity>

        {/* Weekly Goal Card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.progressRingOuter}>
              <View style={styles.progressRingInner}>
                <View style={styles.progressDot} />
              </View>
            </View>
            
            <View style={styles.goalTextContainer}>
              <Text style={styles.cardTitle}>Weekly goal</Text>
              <Text style={styles.goalStats}>
                <Text style={styles.boldText}>14 of 20</Text> minutes spoken today
              </Text>
            </View>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>70%</Text>
            </View>
          </View>
        </View>

        {/* AI Speaking Coach Card */}
        <TouchableOpacity style={styles.cardRow} activeOpacity={0.8}>
          <View style={[styles.iconContainer, { backgroundColor: '#E0F7F6' }]}>
            <Sparkles color="#14B8A6" size={24} />
          </View>
          <View style={styles.cardRowTextContainer}>
            <Text style={styles.cardTitle}>AI Speaking Coach</Text>
            <Text style={styles.cardDescription}>Have a real conversation and get instant feedback.</Text>
          </View>
          <ArrowRight color="#9CA3AF" size={20} />
        </TouchableOpacity>

        {/* Read & Record Card */}
        <TouchableOpacity style={styles.cardRow} activeOpacity={0.8}>
          <View style={[styles.iconContainer, { backgroundColor: '#EEF2FF' }]}>
            <BookOpen color="#4F46E5" size={24} />
          </View>
          <View style={styles.cardRowTextContainer}>
            <Text style={styles.cardTitle}>Read & Record</Text>
            <Text style={styles.cardDescription}>Read an article aloud and analyze your pronunciation.</Text>
          </View>
          <ArrowRight color="#9CA3AF" size={20} />
        </TouchableOpacity>

        {/* 1:1 Live Coach Card */}
        <TouchableOpacity style={styles.cardRow} activeOpacity={0.8}>
          <View style={[styles.iconContainer, { backgroundColor: '#FFF7ED' }]}>
            <Calendar color="#EA580C" size={24} />
          </View>
          <View style={styles.cardRowTextContainer}>
            <Text style={styles.cardTitle}>1:1 with a Trainer</Text>
            <Text style={styles.cardDescription}>Book a live session with a certified coach.</Text>
          </View>
          <ArrowRight color="#9CA3AF" size={20} />
        </TouchableOpacity>

        {/* Quick Drills Matrix */}
        <Text style={styles.sectionHeading}>Quick drills</Text>

        <View style={styles.gridContainer}>
          <TouchableOpacity style={styles.gridCard} activeOpacity={0.8}>
            <View style={[styles.iconContainerGrid, { backgroundColor: '#EEF2FF' }]}>
              <Mic color="#2563EB" size={20} />
            </View>
            <Text style={styles.gridCardTitle}>Tongue twisters</Text>
            <Text style={styles.gridCardSub}>3 min drill</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridCard} activeOpacity={0.8}>
            <View style={styles.gridCardInner}>
              <View style={[styles.iconContainerGrid, { backgroundColor: '#E0F7F6' }]}>
                <Volume2 color="#0D9488" size={20} />
              </View>
              <Text style={styles.gridCardTitle}>Minimal pairs</Text>
              <Text style={styles.gridCardSub}>3 min drill</Text>
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
    backgroundColor: '#F8FAFC',
  },
  // Fixed header jo upar chipka rahega aur notch ko safe padding dega
  fixedHeader: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingTop: (STATUSBAR_HEIGHT || 0) + 20,
    paddingBottom: 12,
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100, // Bottom Tab padding constraint
  },
  heroButton: {
    backgroundColor: '#2DD4BF',
    borderRadius: 30,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#2DD4BF',
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    borderColor: '#E2E8F0',
    borderLeftColor: '#2563EB',
    borderTopColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRingInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  goalTextContainer: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  goalStats: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  boldText: {
    fontWeight: '600',
    color: '#0F172A',
  },
  badge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#2563EB',
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
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  gridCard: {
    backgroundColor: '#FFFFFF',
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
    color: '#0F172A',
  },
  gridCardSub: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
});