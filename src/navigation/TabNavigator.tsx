import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View, TouchableOpacity, Dimensions, Text } from 'react-native';
import { Home, GraduationCap, Plus, Users, User } from 'lucide-react-native';

import HomeScreen from '../features/home/screens/HomeScreen';
import PracticeScreen from '../features/home/screens/PracticeScreen'; 
import VoiceRoomScreen from '../features/home/screens/VoiceRoomScreen'; 
import CommunityScreen from '../features/home/screens/CommunityScreen'; 
// ProfileScreen ko import kiya
import ProfileScreen from '../features/home/screens/ProfileScreen'; 

const Tab = createBottomTabNavigator();
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TabNavigator() {
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
        tabBarActiveTintColor: '#2563EB', 
        tabBarInactiveTintColor: '#9CA3AF', 
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Practice" component={PracticeScreen} />
      
      {/* ─── NATIVE TAB RENDER STRATEGY FOR ZERO ERRORS ─── */}
      <Tab.Screen 
        name="Voice" 
        component={VoiceRoomScreen} 
        options={({ navigation }) => ({
          tabBarLabel: '',
          tabBarButton: (props) => (
            <View style={styles.centerButtonWrapper} pointerEvents="box-none">
              <TouchableOpacity 
                style={styles.absoluteCenterButton} 
                activeOpacity={0.9}
                onPress={() => navigation.navigate('Voice')}
              >
                <View style={styles.innerCircle}>
                  <Plus color="#FFFFFF" size={34} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
              <Text style={[styles.tabBarLabel, { marginTop: 48, color: '#9CA3AF' }]}></Text>
            </View>
          ),
        })}
      />

      <Tab.Screen name="Community" component={CommunityScreen} />
      {/* Yahan par ProfileScreen ko render kar diya */}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 70,
    paddingBottom: 12,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  }
});