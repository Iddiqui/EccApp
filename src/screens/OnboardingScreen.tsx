import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Image, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar,
  FlatList,
  Dimensions,
  Platform
} from 'react-native';
import { useTheme } from '../hooks/useTheme'; 

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const onboardingData = [
  { 
    id: '01', 
    title: 'Speak English\nWith Confidence', 
    subtitle: 'Practice real conversations, improve pronunciation, and speak without fear.', 
    image: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=500' 
  },
  { 
    id: '02', 
    title: 'Practice Live\nWith Real Learners', 
    subtitle: 'Join live study rooms, talk with real people, and learn together.', 
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=500' 
  },
  { 
    id: '03', 
    title: 'Voice Chat Rooms\nSpeak. Listen. Grow', 
    subtitle: 'Jump into voice rooms, practice speaking naturally every day.', 
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=500' 
  },
  { 
    id: '04', 
    title: 'Build Fluency\nEvery Day', 
    subtitle: 'Stay consistent, track your progress, and unlock achievements.', 
    image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=500' 
  },
];

export default function OnboardingScreen({ navigation }: any) {
  const [currentStep, setCurrentStep] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  
  const themeHook = useTheme() as any;
  const isDarkMode = themeHook?.isDarkMode || false;

  const colors = themeHook?.theme?.colors || {
    bgLight: '#FFFFFF',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    primary: '#EC4899',
    bgCard: '#F1F5F9',
    border: '#E2E8F0',
  };

  const handleNext = () => {
    if (currentStep < onboardingData.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentStep + 1, animated: true });
    } else {
      navigation.replace('Login');
    }
  };

  const handleSkip = () => {
    navigation.replace('Login');
  };

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    if (index !== currentStep && index >= 0 && index < onboardingData.length) {
      setCurrentStep(index);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor="transparent" 
        translucent={true} 
      />
      
      {/* Top Header Bar - Fixed Logo */}
      <View style={styles.headerBar}>
        <View style={styles.logoRoundWrapper}>
          <Image 
            source={require('../assets/Ecc-logo.jpeg')} 
            style={styles.logoImage} 
            resizeMode="cover"
          />
        </View>

        <TouchableOpacity onPress={handleSkip} style={styles.skipButton} activeOpacity={0.7}>
          <Text style={[styles.skipButtonText, { color: colors.primary || '#EC4899' }]}>
            Skip →
          </Text>
        </TouchableOpacity>
      </View>

      {/* Carousel Section */}
      <FlatList
        ref={flatListRef}
        data={onboardingData}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            
            {/* Step Badge */}
            <View style={styles.badge}>
              <Text style={{ color: colors.primary || '#EC4899', fontWeight: '800', fontSize: 13 }}>{item.id}</Text>
            </View>
            
            {/* Title */}
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {item.title}
            </Text>

            {/* Subtitle */}
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {item.subtitle}
            </Text>
            
            {/* Illustration Image Wrapper */}
            <View style={styles.imageCardWrapper}>
              <Image source={{ uri: item.image }} style={styles.illustration} resizeMode="cover" />
            </View>

          </View>
        )}
      />

      {/* Bottom Footer Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.paginationContainer}>
          {onboardingData.map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.dot, 
                { backgroundColor: i === currentStep ? (colors.primary || '#EC4899') : colors.border }, 
                i === currentStep && { width: 24, backgroundColor: colors.primary || '#EC4899' }
              ]} 
            />
          ))}
        </View>
        
        {/* Next Button */}
        <TouchableOpacity 
          style={[styles.nextButton, { backgroundColor: colors.primary || '#EC4899' }]} 
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>
            {currentStep === onboardingData.length - 1 ? 'Get Started' : 'Next →'}
          </Text>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 12,
    paddingBottom: 4,
    zIndex: 10,
  },
  logoRoundWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#F59E0B',
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  skipButton: { 
    paddingVertical: 6, 
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(236, 72, 153, 0.1)'
  },
  skipButtonText: { 
    fontSize: 14, 
    fontWeight: '700',
  },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 24,
    justifyContent: 'center',
    marginTop: -50, // Cursor location par content shift karne ke liye negative offset
  },
  badge: { 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    backgroundColor: 'rgba(236, 72, 153, 0.1)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  title: { 
    fontSize: 28, 
    fontWeight: '900', 
    lineHeight: 36, 
    marginBottom: 8 
  },
  subtitle: { 
    fontSize: 14, 
    lineHeight: 22, 
    marginBottom: 16 
  },
  imageCardWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  illustration: { 
    width: '100%', 
    height: 240 
  },
  bottomBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingBottom: 28 
  },
  paginationContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  dot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    marginRight: 6 
  },
  nextButton: { 
    paddingHorizontal: 28, 
    paddingVertical: 14, 
    borderRadius: 25, 
    elevation: 3 
  },
  nextButtonText: { 
    color: '#FFFFFF', 
    fontWeight: '800', 
    fontSize: 15 
  },
});