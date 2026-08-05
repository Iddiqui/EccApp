import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View, TouchableOpacity, Dimensions, Text } from 'react-native';
import { Home, GraduationCap, Plus, Users, User } from 'lucide-react-native';

import HomeScreen from '../features/home/screens/HomeScreen';
import PracticeScreen from '../features/home/screens/PracticeScreen'; 
import VoiceRoomScreen from '../features/home/screens/VoiceRoomScreen'; 
import CommunityScreen from '../features/home/screens/CommunityScreen'; 
import ProfileScreen from '../features/home/screens/ProfileScreen'; 
import { useTheme } from '../hooks/useTheme';

const Tab = createBottomTabNavigator();
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TabNavigator() {
  const { theme, isDarkMode, t } = useTheme() as any;
  const colors = theme.colors;

  return (
    <Tab.Navigator 
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') return <Home color={color} size={size} strokeWidth={2} />;
          if (route.name === 'Practice') return <GraduationCap color={color} size={size} strokeWidth={2} />;
          if (route.name === 'Community') return <Users color={color} size={size} strokeWidth={2} />;
          if (route.name === 'Profile') return <User color={color} size={size} strokeWidth={2} />;
        },
        tabBarActiveTintColor: colors.primary, 
        tabBarInactiveTintColor: isDarkMode ? '#64748B' : '#9CA3AF', 
        tabBarStyle: [
          styles.tabBar, 
          { 
            backgroundColor: colors.bgCard, 
            borderTopColor: colors.border 
          }
        ],
        tabBarLabelStyle: styles.tabBarLabel,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          tabBarLabel: t?.tabs?.home || 'होम'
        }}
      />
      <Tab.Screen 
        name="Practice" 
        component={PracticeScreen} 
        options={{
          tabBarLabel: t?.tabs?.practice || 'प्रैक्टिस'
        }}
      />
      
      {/* ─── NATIVE TAB RENDER STRATEGY FOR ZERO ERRORS ─── */}
      <Tab.Screen 
        name="Voice" 
        component={VoiceRoomScreen} 
        options={({ navigation }) => ({
          tabBarLabel: '',
          tabBarButton: (props) => (
            <View style={styles.centerButtonWrapper} pointerEvents="box-none">
              <TouchableOpacity 
                style={[styles.absoluteCenterButton, { backgroundColor: colors.bgCard }]} 
                activeOpacity={0.9}
                onPress={() => navigation.navigate('Voice')}
              >
                <View style={[styles.innerCircle, { backgroundColor: colors.primary }]}>
                  <Plus color="#FFFFFF" size={34} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
              <Text style={[styles.tabBarLabel, { marginTop: 48, color: colors.textSecondary }]}></Text>
            </View>
          ),
        })}
      />

      <Tab.Screen 
        name="Community" 
        component={CommunityScreen} 
        options={{
          tabBarLabel: t?.tabs?.community || 'कम्युनिटी'
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
          tabBarLabel: t?.tabs?.profile || 'प्रोफाइल'
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 70,
    paddingBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    elevation: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabBarLabel: { 
    fontSize: 11, 
    fontWeight: '600' 
  },
  centerButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  absoluteCenterButton: {
    position: 'absolute',
    top: -32,
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10, 
  },
  innerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  }
});