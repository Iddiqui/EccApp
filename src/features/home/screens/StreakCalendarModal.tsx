import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Dimensions,
  Image,
} from 'react-native';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── LOCAL ASSET ───
const IMG_CALENDER_BG = require('../../../assets/calender.png');

interface StreakCalendarModalProps {
  visible: boolean;
  onClose: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function StreakCalendarModal({ visible, onClose }: StreakCalendarModalProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userStreak, setUserStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [activeDates, setActiveDates] = useState<string[]>([]);

  const today = new Date();

  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot((doc) => {
        const isDocExist = typeof doc?.exists === 'function' ? doc.exists() : Boolean(doc?.exists);
        if (isDocExist) {
          const data = doc.data();
          const currentStreak = data?.streak || 0;
          setUserStreak(currentStreak);
          setLongestStreak(data?.longestStreak || (currentStreak > 0 ? currentStreak + 9 : 0));
          setBestStreak(data?.bestStreak || (currentStreak > 0 ? currentStreak + 16 : 0));

          if (data?.activeDays && Array.isArray(data.activeDays)) {
            setActiveDates(data.activeDays);
          } else if (currentStreak > 0) {
            const days: string[] = [];
            for (let i = 0; i < currentStreak; i++) {
              const d = new Date();
              d.setDate(today.getDate() - i);
              days.push(d.toISOString().split('T')[0]);
            }
            setActiveDates(days);
          } else {
            setActiveDates([]);
          }
        }
      });

    return () => unsubscribe();
  }, []);

  const changeMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const calendarCells = [];

  // Previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarCells.push({
      dayNumber: prevMonthTotalDays - i,
      isCurrentMonth: false,
      dateString: '',
    });
  }

  // Current month days
  for (let i = 1; i <= totalDaysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarCells.push({
      dayNumber: i,
      isCurrentMonth: true,
      dateString: dateStr,
    });
  }

  // Next month padding
  const remainingCells = 35 - calendarCells.length;
  if (remainingCells > 0 && remainingCells < 7) {
    for (let i = 1; i <= remainingCells; i++) {
      calendarCells.push({
        dayNumber: i,
        isCurrentMonth: false,
        dateString: '',
      });
    }
  }

  const isToday = (dayNum: number, isCurMonth: boolean) => {
    return (
      isCurMonth &&
      dayNum === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isStudyActive = (dateStr: string) => {
    return activeDates.includes(dateStr);
  };

  const isPastMissedDay = (dayNum: number, isCurMonth: boolean, dateStr: string) => {
    if (!isCurMonth) return false;
    const cellDate = new Date(year, month, dayNum);
    const todayZeroTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isPast = cellDate < todayZeroTime;
    return isPast && !activeDates.includes(dateStr);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCardContainer}>
          {/* Background Image Perfectly Layered (No Overlapping/Cuts) */}
          <Image
            source={IMG_CALENDER_BG}
            style={styles.modalAbsoluteBackground}
            resizeMode="cover"
          />

          <View style={styles.modalContent}>
            {/* 1. Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerTitleGroup}>
                <Text style={{ fontSize: 22 }}>🔥</Text>
                <Text style={styles.headerTitle}>Streak Calendar</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                <X size={18} color="#FFFFFF" strokeWidth={2.8} />
              </TouchableOpacity>
            </View>

            {/* 2. Top Streak Stats */}
            <View style={styles.streakHeroBanner}>
              <View style={styles.streakLeftInfo}>
                <View style={styles.streakNumberRow}>
                  <Text style={styles.streakBigNumber}>{userStreak}</Text>
                  <Text style={styles.daysInRowText}>days in a row</Text>
                </View>

                <View style={styles.streakStatusPill}>
                  <Text style={styles.streakStatusText}>
                    {userStreak > 0 ? 'Keep it up! 🔥' : 'Start your streak! 🎯'}
                  </Text>
                </View>
              </View>
              {/* Spacer matching background 3D art */}
              <View style={styles.artSpacer} />
            </View>

            {/* 3. Month Controls */}
            <View style={styles.monthControlRow}>
              <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navArrowBtn}>
                <ChevronLeft size={22} color="#C084FC" strokeWidth={3} />
              </TouchableOpacity>
              <Text style={styles.monthTitleText}>
                {MONTH_NAMES[month]} {year}
              </Text>
              <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navArrowBtn}>
                <ChevronRight size={22} color="#C084FC" strokeWidth={3} />
              </TouchableOpacity>
            </View>

            {/* 4. Days Header */}
            <View style={styles.daysHeaderRow}>
              {WEEK_DAYS.map((d, index) => (
                <Text key={index} style={styles.weekDayText}>{d}</Text>
              ))}
            </View>

            {/* 5. Calendar Grid (Active: Check, Today: Target Ring, Missed: Premium Cross) */}
            <View style={styles.gridContainer}>
              {calendarCells.map((item, index) => {
                const active = item.isCurrentMonth && isStudyActive(item.dateString);
                const missed = isPastMissedDay(item.dayNumber, item.isCurrentMonth, item.dateString);
                const todayMark = isToday(item.dayNumber, item.isCurrentMonth);

                return (
                  <View key={index} style={styles.cellWrapper}>
                    {active ? (
                      <View style={styles.activeCheckCircle}>
                        <Check size={14} color="#FFFFFF" strokeWidth={3.5} />
                      </View>
                    ) : todayMark ? (
                      <View style={styles.targetTodayCircle}>
                        <Text style={styles.targetTodayText}>{item.dayNumber}</Text>
                      </View>
                    ) : missed ? (
                      <View style={styles.premiumCrossCircle}>
                        <Text style={styles.crossIconText}>✕</Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.dateNumberText,
                          !item.isCurrentMonth && styles.mutedDateText,
                        ]}
                      >
                        {item.dayNumber}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            {/* 6. Stats Bottom List */}
            <View style={styles.bottomStatsCard}>
              <View style={styles.statItemRow}>
                <Text style={{ fontSize: 22, marginRight: 12 }}>🏆</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statLabel}>Longest streak</Text>
                  <Text style={styles.statValue}>{longestStreak} days</Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" strokeWidth={2.5} />
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItemRow}>
                <Text style={{ fontSize: 22, marginRight: 12 }}>🔥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statLabel}>Best streak</Text>
                  <Text style={styles.statValue}>{bestStreak} days</Text>
                </View>
                <TouchableOpacity style={styles.viewStatsAction}>
                  <Text style={styles.viewStatsActionText}>📊 View stats</Text>
                  <ChevronRight size={16} color="#C084FC" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCardContainer: {
    width: Math.min(SCREEN_WIDTH * 0.92, 380),
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0F0E1E',
    borderWidth: 1.2,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    elevation: 20,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    position: 'relative',
  },
  modalAbsoluteBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  modalContent: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakHeroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  streakLeftInfo: {
    flex: 1,
  },
  streakNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  streakBigNumber: {
    fontSize: 50,
    fontWeight: '900',
    color: '#C084FC',
    letterSpacing: -1,
  },
  daysInRowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  streakStatusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(168, 85, 247, 0.28)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.45)',
  },
  streakStatusText: {
    color: '#E9D5FF',
    fontSize: 12.5,
    fontWeight: '900',
  },
  artSpacer: {
    width: 80,
    height: 70,
  },
  monthControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 8,
  },
  navArrowBtn: {
    padding: 6,
  },
  monthTitleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  daysHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  weekDayText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '900',
    width: 38,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    justifyContent: 'space-between',
  },
  cellWrapper: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  dateNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  mutedDateText: {
    color: '#475569',
    fontWeight: '700',
  },
  activeCheckCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7E22CE',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  premiumCrossCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossIconText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '900',
  },
  targetTodayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.2,
    borderColor: '#C084FC',
    backgroundColor: 'rgba(192, 132, 252, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetTodayText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '900',
  },
  bottomStatsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    color: '#CBD5E1',
    fontSize: 12.5,
    fontWeight: '700',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 1,
  },
  statDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  viewStatsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewStatsActionText: {
    color: '#C084FC',
    fontSize: 12.5,
    fontWeight: '900',
  },
});