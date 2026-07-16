 import React, { useState } from 'react';
import { StyleSheet, Text, View, Switch, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { ArrowLeft, Moon, Palette, Globe, Bell, Shield } from 'lucide-react-native';

export default function SettingsScreen({ navigation }: any) {
  const [darkMode, setDarkMode] = useState(false);
  const [pushNotif, setPushNotif] = useState(true);
  const [roomReminders, setRoomReminders] = useState(true);
  const [streakAlerts, setStreakAlerts] = useState(false);

  return (
    <View style={styles.container}>
      {/* Settings Navigation Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* PREFERENCES SECTION */}
        <Text style={styles.sectionTitle}>PREFERENCES</Text>
        <View style={styles.cardBlock}>
          {/* Dark Mode Switch Row */}
          <View style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={styles.iconCircleBg}>
                <Moon size={20} color="#0F172A" />
              </View>
              <View style={styles.itemMeta}>
                <Text style={styles.itemMainLabel}>Dark mode</Text>
                <Text style={styles.itemSubLabel}>{darkMode ? 'On' : 'Off'}</Text>
              </View>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : ''}
            />
          </View>

          <View style={styles.divider} />

          {/* Theme Row */}
          <TouchableOpacity style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={styles.iconCircleBg}>
                <Palette size={20} color="#0F172A" />
              </View>
              <View style={styles.itemMeta}>
                <Text style={styles.itemMainLabel}>Theme</Text>
                <Text style={styles.itemSubLabel}>Ocean Blue</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* App Language Row */}
          <TouchableOpacity style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={styles.iconCircleBg}>
                <Globe size={20} color="#0F172A" />
              </View>
              <View style={styles.itemMeta}>
                <Text style={styles.itemMainLabel}>App language</Text>
                <Text style={styles.itemSubLabel}>English (US)</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* NOTIFICATIONS SECTION */}
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
        <View style={styles.cardBlock}>
          {/* Push Notifications Switch Row */}
          <View style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={styles.iconCircleBg}>
                <Bell size={20} color="#0F172A" />
              </View>
              <View style={styles.itemMeta}>
                <Text style={styles.itemMainLabel}>Push notifications</Text>
              </View>
            </View>
            <Switch
              value={pushNotif}
              onValueChange={setPushNotif}
              trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : ''}
            />
          </View>

          <View style={styles.divider} />

          {/* Room Reminders Switch Row */}
          <View style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={styles.iconCircleBg}>
                <Bell size={20} color="#0F172A" />
              </View>
              <View style={styles.itemMeta}>
                <Text style={styles.itemMainLabel}>Room reminders</Text>
              </View>
            </View>
            <Switch
              value={roomReminders}
              onValueChange={setRoomReminders}
              trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : ''}
            />
          </View>

          <View style={styles.divider} />

          {/* Streak Alerts Switch Row */}
          <View style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={styles.iconCircleBg}>
                <Bell size={20} color="#0F172A" />
              </View>
              <View style={styles.itemMeta}>
                <Text style={styles.itemMainLabel}>Streak alerts</Text>
              </View>
            </View>
            <Switch
              value={streakAlerts}
              onValueChange={setStreakAlerts}
              trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : ''}
            />
          </View>
        </View>

        {/* PRIVACY & SECURITY SECTION */}
        <Text style={styles.sectionTitle}>PRIVACY & SECURITY</Text>
        <View style={styles.cardBlock}>
          <TouchableOpacity style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={styles.iconCircleBg}>
                <Shield size={20} color="#0F172A" />
              </View>
              <View style={styles.itemMeta}>
                <Text style={styles.itemMainLabel}>Account Privacy</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 10, marginLeft: 6, letterSpacing: 0.5 },
  cardBlock: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 16, marginBottom: 24, elevation: 2 },
  settingItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  itemLeftBlock: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircleBg: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  itemMeta: { justifyContent: 'center' },
  itemMainLabel: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  itemSubLabel: { fontSize: 13, color: '#64748B', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F1F5F9' },
});