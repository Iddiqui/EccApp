import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';

const onboardingData = [
  { id: '01', title: 'Speak English\nWith Confidence', subtitle: 'Practice real conversations, improve pronunciation, and speak without fear.', image: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=500' },
  { id: '02', title: 'Practice Live\nWith Real Learners', subtitle: 'Join live study rooms, talk with real people, and learn together.', image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=500' },
  { id: '03', title: 'Voice Chat Rooms\nSpeak. Listen. Grow', subtitle: 'Jump into voice rooms, practice speaking naturally every day.', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=500' },
  { id: '04', title: 'Build Fluency\nEvery Day', subtitle: 'Stay consistent, track your progress, and unlock achievements.', image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=500' },
];

export default function OnboardingScreen({ navigation, theme }: any) {
  const [currentStep, setCurrentStep] = useState(0);
  const activeData = onboardingData[currentStep];

  const handleNext = () => {
    if (currentStep < onboardingData.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      navigation.replace('Login');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* StatusBar transparency control */}
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      {/* Fixed Safe Header Bar with explicit Top Margin */}
      <View style={styles.headerBar}>
        <View style={styles.headerActionLeft}>
          {currentStep > 0 ? (
            <TouchableOpacity onPress={handleBack} style={styles.navButton}>
              <Text style={[styles.navButtonText, { color: theme.textSecondary }]}>←</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        
        <Text style={[styles.logoText, { color: theme.textPrimary }]}>ECC</Text>
        
        <View style={styles.headerActionRight}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={[styles.skipButtonText, { color: theme.accent }]}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Section */}
      <View style={styles.contentContainer}>
        <View style={[styles.badge, { backgroundColor: theme.cardBg }]}>
          <Text style={{ color: theme.accent, fontWeight: 'bold' }}>{activeData.id}</Text>
        </View>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{activeData.title}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{activeData.subtitle}</Text>
        <Image source={{ uri: activeData.image }} style={styles.illustration} resizeMode="cover" />
      </View>

      {/* Bottom Footer Navigation */}
      <View style={styles.bottomBar}>
        <View style={styles.paginationContainer}>
          {onboardingData.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === currentStep ? theme.accent : theme.border }, i === currentStep && { width: 24 }]} />
          ))}
        </View>
        <TouchableOpacity style={[styles.nextButton, { backgroundColor: theme.accent }]} onPress={handleNext}>
          <Text style={styles.nextButtonText}>{currentStep === onboardingData.length - 1 ? 'Get Started' : 'Next →'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: 45, // Device ke Top status bar notches ko clear karne ke liye constant margin
    paddingBottom: 16,
  },
  headerActionLeft: { width: 50, alignItems: 'flex-start' },
  headerActionRight: { width: 50, alignItems: 'flex-end' },
  navButton: { paddingVertical: 4, paddingHorizontal: 8 },
  navButtonText: { fontSize: 24, fontWeight: '600', lineHeight: 28 },
  logoText: { fontSize: 22, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  skipButton: { paddingVertical: 6, paddingHorizontal: 8 },
  skipButtonText: { fontSize: 16, fontWeight: '600' },
  contentContainer: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  badge: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '800', lineHeight: 40, marginBottom: 12 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 32 },
  illustration: { width: '100%', height: 260, borderRadius: 24 },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 32 },
  paginationContainer: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  nextButton: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 25 },
  nextButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});