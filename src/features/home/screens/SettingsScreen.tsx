import React, { useState } from 'react';
import { StyleSheet, Text, View, Switch, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { ArrowLeft, Moon, Palette, Globe, Bell, Shield } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';

export default function SettingsScreen({ navigation }: any) {
  // Updated useTheme hook se theme, isDarkMode, aur toggleDarkMode extract kar rahe hain
  const { theme, isDarkMode, toggleDarkMode } = useTheme();
  const colors = theme.colors; // Safe color access

  // Notification states
  const [pushNotif, setPushNotif] = useState(true);
  const [roomReminders, setRoomReminders] = useState(true);
  const [streakAlerts, setStreakAlerts] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgLight }]}>
      {/* Settings Navigation Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity 
          style={[styles.backBtn, { backgroundColor: colors.iconBg }]} 
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* PREFERENCES SECTION */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PREFERENCES</Text>
        <View style={[styles.cardBlock, { backgroundColor: colors.bgCard }]}>
          
          {/* Dark Mode Switch Row */}
          <View style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: colors.iconBg }]}>
                <Moon size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: colors.textPrimary }]}>Dark mode</Text>
                <Text style={[styles.itemSubLabel, { color: colors.textSecondary }]}>
                  {isDarkMode ? 'On' : 'Off'}
                </Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={(val) => toggleDarkMode(val)}
              trackColor={{ false: '#E2E8F0', true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : ''}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Theme Row */}
          <TouchableOpacity style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: colors.iconBg }]}>
                <Palette size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: colors.textPrimary }]}>Theme</Text>
                <Text style={[styles.itemSubLabel, { color: colors.textSecondary }]}>Ocean Blue</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* App Language Row */}
          <TouchableOpacity style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: colors.iconBg }]}>
                <Globe size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: colors.textPrimary }]}>App language</Text>
                <Text style={[styles.itemSubLabel, { color: colors.textSecondary }]}>English (US)</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* NOTIFICATIONS SECTION */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>NOTIFICATIONS</Text>
        <View style={[styles.cardBlock, { backgroundColor: colors.bgCard }]}>
          
          {/* Push Notifications Switch Row */}
          <View style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: colors.iconBg }]}>
                <Bell size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: colors.textPrimary }]}>Push notifications</Text>
              </View>
            </View>
            <Switch
              value={pushNotif}
              onValueChange={setPushNotif}
              trackColor={{ false: '#E2E8F0', true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : ''}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Room Reminders Switch Row */}
          <View style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: colors.iconBg }]}>
                <Bell size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: colors.textPrimary }]}>Room reminders</Text>
              </View>
            </View>
            <Switch
              value={roomReminders}
              onValueChange={setRoomReminders}
              trackColor={{ false: '#E2E8F0', true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : ''}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Streak Alerts Switch Row */}
          <View style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: colors.iconBg }]}>
                <Bell size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: colors.textPrimary }]}>Streak alerts</Text>
              </View>
            </View>
            <Switch
              value={streakAlerts}
              onValueChange={setStreakAlerts}
              trackColor={{ false: '#E2E8F0', true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : ''}
            />
          </View>
        </View>

        {/* PRIVACY & SECURITY SECTION */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PRIVACY & SECURITY</Text>
        <View style={[styles.cardBlock, { backgroundColor: colors.bgCard }]}>
          <TouchableOpacity style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: colors.iconBg }]}>
                <Shield size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: colors.textPrimary }]}>Account Privacy</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingHorizontal: 20 
  },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 24 
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '800' 
  },
  sectionTitle: { 
    fontSize: 13, 
    fontWeight: '700', 
    marginBottom: 10, 
    marginLeft: 6, 
    letterSpacing: 0.5 
  },
  cardBlock: { 
    borderRadius: 24, 
    paddingHorizontal: 16, 
    marginBottom: 24, 
    elevation: 2 
  },
  settingItemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 14 
  },
  itemLeftBlock: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1 
  },
  iconCircleBg: { 
    width: 42, 
    height: 42, 
    borderRadius: 21, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 14 
  },
  itemMeta: { 
    justifyContent: 'center' 
  },
  itemMainLabel: { 
    fontSize: 15, 
    fontWeight: '700' 
  },
  itemSubLabel: { 
    fontSize: 13, 
    marginTop: 2 
  },
  divider: { 
    height: 1 
  },
});