import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Check, Sparkles } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 🎯 Destination Coordinates: Bottom-Right Profile Tab
const TARGET_PROFILE_X = SCREEN_WIDTH * 0.36;
const TARGET_PROFILE_Y = SCREEN_HEIGHT * 0.44;

// 🌟 Neon Mint Shockwave Burst Particles
const BURST_COUNT = 16;
const BURST_ANGLES = Array.from({ length: BURST_COUNT }).map(
  (_, i) => (i * 2 * Math.PI) / BURST_COUNT
);

// 🌠 S-Curve Trailing Neon Light Stream Particles
const TRAIL_COUNT = 14;
const TRAIL_KEYS = Array.from({ length: TRAIL_COUNT }).map((_, i) => i);

interface XpRewardModalProps {
  visible: boolean;
  xpEarned?: number;
  title?: string;
  subtitle?: string;
  streakCount?: number;
  onComplete: () => void;
}

export default function XpRewardModal({
  visible,
  xpEarned = 10,
  onComplete,
}: XpRewardModalProps) {
  // Master S-Curve Flight Driver (0 -> 1)
  const flightProgress = useRef(new Animated.Value(0)).current;
  const pillScale = useRef(new Animated.Value(0.1)).current;
  const pillOpacity = useRef(new Animated.Value(1)).current;
  const auraPulse = useRef(new Animated.Value(0.5)).current;

  // Starlight Shockwave Drivers
  const burstDist = useRef(new Animated.Value(0)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;

  // Trailing Particle Drivers
  const trailAnims = useRef(TRAIL_KEYS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (visible) {
      // 1. Reset all animation values
      flightProgress.setValue(0);
      pillScale.setValue(0.2);
      pillOpacity.setValue(1);
      auraPulse.setValue(0.5);
      burstDist.setValue(0);
      burstOpacity.setValue(1);
      trailAnims.forEach((t) => t.setValue(0));

      // ─── 2. INSTANT NEON MINT BURST SHOCKWAVE ───
      Animated.parallel([
        Animated.timing(burstDist, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(burstOpacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // ─── 3. POP-IN & CONTINUOUS S-CURVE WAVE FLIGHT (NO STUCK) ───
      Animated.sequence([
        // Fast dynamic bounce pop-in
        Animated.spring(pillScale, {
          toValue: 1.15,
          friction: 4,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pillScale, {
          toValue: 1.0,
          duration: 100,
          useNativeDriver: true,
        }),

        // Continuous S-Curve gliding across the screen
        Animated.parallel([
          // Main flight progression
          Animated.timing(flightProgress, {
            toValue: 1,
            duration: 1100,
            easing: Easing.bezier(0.2, 0.8, 0.25, 1),
            useNativeDriver: true,
          }),

          // Scale down smoothly towards destination
          Animated.timing(pillScale, {
            toValue: 0.32,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),

          // Shimmer Aura
          Animated.sequence([
            Animated.timing(auraPulse, {
              toValue: 1,
              duration: 350,
              useNativeDriver: true,
            }),
            Animated.timing(auraPulse, {
              toValue: 0.2,
              duration: 750,
              useNativeDriver: true,
            }),
          ]),

          // Staggered neon stream particles
          ...trailAnims.map((t, idx) =>
            Animated.sequence([
              Animated.delay(idx * 28),
              Animated.timing(t, {
                toValue: 1,
                duration: 900,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ])
          ),

          // Disappear right upon reaching bottom profile tab
          Animated.sequence([
            Animated.delay(1000),
            Animated.timing(pillOpacity, {
              toValue: 0,
              duration: 100,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start(() => {
        onComplete();
      });
    }
  }, [visible]);

  if (!visible) return null;

  // 🌊 Organic S-Curve / Wave Interpolation across the whole screen
  const translateX = flightProgress.interpolate({
    inputRange: [0, 0.2, 0.45, 0.75, 1],
    outputRange: [
      0,
      -SCREEN_WIDTH * 0.18, // Curves left
      SCREEN_WIDTH * 0.08,  // Sweeps center-right
      TARGET_PROFILE_X * 0.85,
      TARGET_PROFILE_X,     // Enters Profile Tab
    ],
  });

  const translateY = flightProgress.interpolate({
    inputRange: [0, 0.2, 0.5, 0.8, 1],
    outputRange: [
      0,
      -35,                  // Floats up
      TARGET_PROFILE_Y * 0.25,
      TARGET_PROFILE_Y * 0.75,
      TARGET_PROFILE_Y,     // Enters Bottom Nav
    ],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onComplete}>
      <View style={styles.transparentOverlay} pointerEvents="none">
        {/* 🌟 1. 360° NEON MINT STARLIGHT SHOCKWAVE */}
        {BURST_ANGLES.map((rad, idx) => {
          const maxDistance = idx % 2 === 0 ? 115 : 70;
          const burstX = burstDist.interpolate({
            inputRange: [0, 1],
            outputRange: [0, Math.cos(rad) * maxDistance],
          });
          const burstY = burstDist.interpolate({
            inputRange: [0, 1],
            outputRange: [0, Math.sin(rad) * maxDistance],
          });
          const scale = burstDist.interpolate({
            inputRange: [0, 0.4, 1],
            outputRange: [0.2, 1.35, 0.1],
          });

          return (
            <Animated.View
              key={`mint_burst_${idx}`}
              style={[
                styles.burstStarWrapper,
                {
                  opacity: burstOpacity,
                  transform: [
                    { translateX: burstX },
                    { translateY: burstY },
                    { scale },
                  ],
                },
              ]}
            >
              <Text style={styles.sparkleGlyph}>{idx % 3 === 0 ? '✦' : '•'}</Text>
            </Animated.View>
          );
        })}

        {/* 🌠 2. S-CURVE WAVE TRAILING PARTICLES */}
        {TRAIL_KEYS.map((key, idx) => {
          const lagFactor = (idx + 1) * 0.055;
          const trailX = trailAnims[idx].interpolate({
            inputRange: [0, 0.25, 0.55, 1],
            outputRange: [
              0,
              -SCREEN_WIDTH * 0.14 * (1 - lagFactor),
              SCREEN_WIDTH * 0.06 * (1 - lagFactor),
              TARGET_PROFILE_X * Math.max(0.1, 1 - lagFactor) + (idx % 2 === 0 ? 6 : -6),
            ],
          });
          const trailY = trailAnims[idx].interpolate({
            inputRange: [0, 0.25, 0.6, 1],
            outputRange: [
              0,
              -22,
              TARGET_PROFILE_Y * 0.4 * (1 - lagFactor),
              TARGET_PROFILE_Y * Math.max(0.1, 1 - lagFactor) - idx * 2.5,
            ],
          });
          const trailOpacity = trailAnims[idx].interpolate({
            inputRange: [0, 0.15, 0.75, 1],
            outputRange: [0, 0.95, 0.7, 0],
          });
          const trailScale = trailAnims[idx].interpolate({
            inputRange: [0, 0.35, 1],
            outputRange: [0.3, 1.25, 0.1],
          });

          return (
            <Animated.View
              key={`mint_trail_${key}`}
              style={[
                styles.trailPoint,
                {
                  opacity: trailOpacity,
                  transform: [
                    { translateX: trailX },
                    { translateY: trailY },
                    { scale: trailScale },
                  ],
                },
              ]}
            >
              <Text style={styles.trailGlyph}>✦</Text>
            </Animated.View>
          );
        })}

        {/* 🪙 3. EXACT VIDEO UI: GLOWING MINT/EMERALD +XP CAPSULE */}
        <Animated.View
          style={[
            styles.flyingXpContainer,
            {
              opacity: pillOpacity,
              transform: [
                { translateX },
                { translateY },
                { scale: pillScale },
              ],
            },
          ]}
        >
          {/* Ambient Outer Halo */}
          <Animated.View style={[styles.mintGlowAura, { opacity: auraPulse }]} />

          <View style={styles.xpCardOuterFrame}>
            <LinearGradient
              colors={['rgba(16, 185, 129, 0.25)', 'rgba(5, 150, 105, 0.35)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.xpPillGradient}
            >
              <Text style={styles.xpGlowText}>+{xpEarned} XP</Text>
              
              {/* Glowing Mint Checkmark Pill Badge */}
              <View style={styles.checkBadgeCircle}>
                <Check size={16} color="#FFFFFF" strokeWidth={3.5} />
              </View>
            </LinearGradient>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  transparentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 18, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  burstStarWrapper: {
    position: 'absolute',
    zIndex: 90,
  },
  sparkleGlyph: {
    color: '#6EE7B7',
    fontSize: 16,
    fontWeight: '900',
    textShadowColor: '#10B981',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  trailPoint: {
    position: 'absolute',
    zIndex: 92,
  },
  trailGlyph: {
    color: '#A7F3D0',
    fontSize: 14,
    fontWeight: '900',
    textShadowColor: '#10B981',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 9,
  },
  flyingXpContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  mintGlowAura: {
    position: 'absolute',
    width: 220,
    height: 85,
    borderRadius: 42,
    backgroundColor: 'rgba(16, 185, 129, 0.55)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 20,
  },
  xpCardOuterFrame: {
    backgroundColor: '#0D1A1F',
    borderRadius: 30,
    borderWidth: 1.8,
    borderColor: '#34D399',
    elevation: 18,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    overflow: 'hidden',
  },
  xpPillGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 30,
    gap: 12,
  },
  xpGlowText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(16, 185, 129, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  checkBadgeCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    elevation: 4,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});