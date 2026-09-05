import React from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
} from 'react-native';

import {
  Home,
  GraduationCap,
  Plus,
  UsersRound,
  UserRound,
} from 'lucide-react-native';

import HomeScreen from '../features/home/screens/HomeScreen';
import PracticeScreen from '../features/home/screens/PracticeScreen';
import VoiceRoomScreen from '../features/home/screens/VoiceRoomScreen';
import CommunityScreen from '../features/home/screens/CommunityScreen';
import ProfileScreen from '../features/home/screens/ProfileScreen';

import { useTheme } from '../hooks/useTheme';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const { theme, isDarkMode, t } = useTheme() as any;

  const colors = theme.colors;

  const inactiveColor = isDarkMode
    ? '#94A3B8'
    : '#9AA3B2';

  const activeColor = colors.primary || '#2563EB';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,

        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: colors.bgCard || '#FFFFFF',
            borderColor: isDarkMode
              ? '#334155'
              : '#E8ECF5',
          },
        ],

        tabBarLabelStyle: styles.tabBarLabel,

        tabBarIcon: ({ color, size, focused }) => {
          let IconComponent: any;

          if (route.name === 'Home') {
            IconComponent = Home;
          } else if (route.name === 'Practice') {
            IconComponent = GraduationCap;
          } else if (route.name === 'Community') {
            IconComponent = UsersRound;
          } else if (route.name === 'Profile') {
            IconComponent = UserRound;
          }

          if (!IconComponent) return null;

          return (
            <View
              style={[
                styles.iconContainer,
                focused && {
                  backgroundColor: isDarkMode
                    ? 'rgba(37,99,235,0.18)'
                    : '#EEF4FF',
                },
              ]}
            >
              <IconComponent
                size={focused ? 23 : 22}
                color={color}
                strokeWidth={focused ? 2.8 : 2.2}
              />
            </View>
          );
        },
      })}
    >

      {/* HOME */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t?.tabs?.home || 'Home',
        }}
      />

      {/* PRACTICE */}
      <Tab.Screen
        name="Practice"
        component={PracticeScreen}
        options={{
          tabBarLabel: t?.tabs?.practice || 'Practice',
        }}
      />

      {/* CENTER PLUS BUTTON */}
      <Tab.Screen
        name="Voice"
        component={VoiceRoomScreen}
        options={({ navigation }) => ({
          tabBarLabel: '',
          tabBarButton: () => (
            <View
              style={styles.centerButtonWrapper}
              pointerEvents="box-none"
            >
              <TouchableOpacity
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Open voice room"
                onPress={() => navigation.navigate('Voice')}
                style={[
                  styles.centerButtonOuter,
                  {
                    backgroundColor:
                      colors.bgCard || '#FFFFFF',
                  },
                ]}
              >
                <View
                  style={[
                    styles.centerButtonInner,
                    {
                      backgroundColor: activeColor,
                    },
                  ]}
                >
                  <Plus
                    color="#FFFFFF"
                    size={32}
                    strokeWidth={2.8}
                  />
                </View>
              </TouchableOpacity>
            </View>
          ),
        })}
      />

      {/* COMMUNITY */}
      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          tabBarLabel: t?.tabs?.community || 'Community',
        }}
      />

      {/* PROFILE */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t?.tabs?.profile || 'Profile',
        }}
      />

    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({

  // ─────────────────────────────
  // MAIN FLOATING NAV BAR
  // ─────────────────────────────

  tabBar: {
    position: 'absolute',

    left: 8,
    right: 8,
    bottom: 8,

    height: 76,

    borderRadius: 25,

    borderWidth: 1,

    paddingTop: 7,
    paddingBottom: 7,

    paddingHorizontal: 4,

    elevation: 18,

    shadowColor: '#64748B',
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.14,
    shadowRadius: 16,
  },

  // ─────────────────────────────
  // ICON
  // ─────────────────────────────

  iconContainer: {
    width: 42,
    height: 32,

    borderRadius: 16,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 1,
  },

  // ─────────────────────────────
  // LABEL
  // ─────────────────────────────

  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',

    marginTop: 1,

    letterSpacing: 0.1,
  },

  // ─────────────────────────────
  // CENTER BUTTON WRAPPER
  // ─────────────────────────────

  centerButtonWrapper: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    position: 'relative',
  },

  // ─────────────────────────────
  // OUTER WHITE CIRCLE
  // ─────────────────────────────

  centerButtonOuter: {
    position: 'absolute',

    top: -31,

    width: 68,
    height: 68,

    borderRadius: 34,

    alignItems: 'center',
    justifyContent: 'center',

    elevation: 18,

    shadowColor: '#2563EB',
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },

  // ─────────────────────────────
  // BLUE INNER CIRCLE
  // ─────────────────────────────

  centerButtonInner: {
    width: 56,
    height: 56,

    borderRadius: 28,

    alignItems: 'center',
    justifyContent: 'center',

    elevation: 8,
  },
});