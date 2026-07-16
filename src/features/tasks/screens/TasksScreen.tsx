 import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { LIGHT_THEME as THEME } from '../../../hooks/useTheme';

export default function TasksScreen() {
  const horizontalDays = [
    { label: 'Sun', num: '18', active: false },
    { label: 'Mon', num: '19', active: false },
    { label: 'Wed', num: '21', active: true },
    { label: 'Tue', num: '22', active: false },
    { label: 'Mon', num: '26', active: false },
    { label: 'Wen', num: '28', active: false }
  ];

  return (
    <View style={styles.container}>
      <View style={styles.headerLayout}>
        <Text style={styles.screenTitle}>Tasks</Text>
        <Text style={styles.screenSubtitle}>Let's improve your English today</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        {/* CALENDAR WEEK TIMELINE */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarStrip}>
          {horizontalDays.map((day, i) => (
            <View key={i} style={[styles.dayCard, day.active && styles.activeDayCard]}>
              <Text style={[styles.dayLabel, day.active && styles.activeDayText]}>{day.label}</Text>
              <Text style={[styles.dayNum, day.active && styles.activeDayText]}>{day.num}</Text>
            </View>
          ))}
        </ScrollView>

        {/* PROGRESS METRIC GRAPH BLOCK */}
        <View style={styles.progressBanner}>
          <View style={styles.circleGraphPlaceholder}>
            <Text style={styles.circleGraphPercent}>50%</Text>
            <Text style={{fontSize: 9, color: THEME.colors.textSecondary}}>Completed</Text>
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.progressHeading}>Today's Progress</Text>
            <Text style={styles.progressSubtext}>13 Of 20 tasks completed</Text>
            <View style={styles.pillIndicatorRow}>
              <Text style={styles.statusPill}>🟢 Completed: 13</Text>
              <Text style={styles.statusPill}>🟡 Pending: 7</Text>
            </View>
          </View>
        </View>

        {/* TASK FEED LIST */}
        <Text style={styles.sectionTitle}>Task Feed</Text>
        <View style={styles.taskCard}>
          <View style={styles.checkIconFilled}><Text style={{color: '#FFF', fontSize: 10}}>✓</Text></View>
          <View style={{flex: 1}}>
            <Text style={styles.taskCardTitle}>Read a part of a book</Text>
            <Text style={styles.taskCardSubtitle}>Practice reading and improve pronunciation</Text>
            <Text style={styles.timeTagText}>🕒 8:30 pm</Text>
          </View>
        </View>

        <View style={styles.taskCard}>
          <View style={styles.checkIconEmpty} />
          <View style={{flex: 1}}>
            <Text style={styles.taskCardTitle}>Watch a movie</Text>
            <Text style={styles.taskCardSubtitle}>Practice hearing and watching that is improve</Text>
            <Text style={styles.timeTagText}>🕒 8:30 pm</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bgLight, paddingTop: 20 },
  headerLayout: { paddingHorizontal: 20, marginBottom: 20 },
  screenTitle: { fontSize: 28, fontWeight: '800', color: THEME.colors.textPrimary },
  screenSubtitle: { fontSize: 14, color: THEME.colors.textSecondary, marginTop: 2 },
  calendarStrip: { flexDirection: 'row', marginBottom: 24 },
  dayCard: { width: 50, height: 68, backgroundColor: THEME.colors.bgCard, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  activeDayCard: { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primary },
  dayLabel: { fontSize: 11, color: THEME.colors.textSecondary },
  dayNum: { fontSize: 16, fontWeight: '700', color: THEME.colors.textPrimary, marginTop: 4 },
  activeDayText: { color: '#FFFFFF' },
  progressBanner: { backgroundColor: THEME.colors.accentLightPurple, borderRadius: THEME.radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  circleGraphPlaceholder: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: THEME.colors.primary },
  circleGraphPercent: { fontSize: 16, fontWeight: '800', color: THEME.colors.textPrimary },
  progressHeading: { fontSize: 16, fontWeight: '700', color: THEME.colors.textPrimary },
  progressSubtext: { fontSize: 12, color: THEME.colors.textSecondary, marginTop: 2 },
  pillIndicatorRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  statusPill: { fontSize: 11, fontWeight: '600', color: THEME.colors.textPrimary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 12 },
  taskCard: { backgroundColor: THEME.colors.bgCard, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: THEME.radius.lg, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 10 },
  checkIconFilled: { width: 20, height: 20, borderRadius: 10, backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkIconEmpty: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: THEME.colors.border, marginTop: 2 },
  taskCardTitle: { fontSize: 15, fontWeight: '700', color: THEME.colors.textPrimary },
  taskCardSubtitle: { fontSize: 12, color: THEME.colors.textSecondary, marginVertical: 4, lineHeight: 16 },
  timeTagText: { fontSize: 11, color: THEME.colors.textSecondary }
});