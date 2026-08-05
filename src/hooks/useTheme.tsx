import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── 🌐 GLOBAL APP TRANSLATIONS DICTIONARY ───
export const TRANSLATIONS: Record<string, any> = {
  en: {
    // 📌 Bottom Navigation Tabs
    tabs: { 
      home: 'Home', 
      practice: 'Practice', 
      community: 'Community', 
      profile: 'Profile' 
    },
    
    // 🏠 Home Screen
    home: {
      goodMorning: 'Good morning',
      goodAfternoon: 'Good afternoon',
      goodEvening: 'Good evening',
      streak: 'Streak',
      daysInRow: 'days in a row',
      speaking: 'Speaking',
      thisWeek: '+4 this week',
      fluency: 'Fluency',
      level: 'Level B2',
      liveNow: 'LIVE NOW',
      morningTalk: 'Morning Small Talk',
      casualConv: 'Casual conversation to start your day',
      joinRoom: 'Join room ›',
      todayChallenge: "Today's Challenge",
      describeYour: 'Describe your ...',
      speakingChallenge: '60-second speaking challenge',
      joined: 'joined',
      upcomingSessions: 'Upcoming Sessions',
      seeAll: 'See all',
      
      // Upcoming Sessions Cards
      todayTime1: '📅 Today, 6:00 PM',
      session1Title: '1:1 with Priya',
      session1Desc: 'IELTS Speaking coaching',
      session1Details: '30 min • Video',
      
      todayTime2: '🎙️ Today, 7:30 PM',
      session2Title: 'Debate Club',
      session2Desc: 'Technology & Society',
      session2Details: '45 min • Audio',
      
      // Community Section
      fromCommunity: 'From the Community',
      postAuthor: 'Diego Ramos',
      postTime: '2h ago',
      postContent: 'Scored Band 7.5 in IELTS Speaking! The daily challenges kept me consistent. Happy to answer questions.',
      likes: 'likes',
      comments: 'comments',
      
      // Recent Activity
      recentActivity: 'Recent Activity',
      act1Title: "Joined 'Morning Small Talk'",
      act1Time: '2h ago',
      act2Title: 'Completed AI session',
      act2Time: 'Yesterday',
    },

    // 🎯 Practice Screen
    practice: {
      title: 'Practice',
      subtitle: 'Sharpen your speaking, your way',
      yourCoach: 'YOUR AI COACH',
      weeklyGoal: 'Weekly goal',
      spokenToday: '0 of 20 minutes spoken today',
      aiCoachTitle: 'AI Speaking Coach',
      aiCoachDesc: 'Have a real conversation and get instant feedback.',
      readRecordTitle: 'Read & Record',
      readRecordDesc: 'Read an article aloud and analyze your pronunciation.',
      trainerTitle: '1:1 with a Trainer',
      trainerDesc: 'Book a live session with a certified coach.',
      quickDrills: 'Quick drills',
      tongueTwisters: 'Tongue twisters',
      minimalPairs: 'Minimal pairs',
      drillTime: '3 min drill',
    },

    // 🎙️ Voice Rooms Screen
    rooms: {
      title: 'Voice Rooms',
      subtitle: 'Practice live audio communication instantly',
      publicRooms: 'Public Rooms',
      myRooms: 'My Rooms',
      activeSpeakers: 'Active Speakers',
      liveNow: 'Live Now',
      listening: 'listening',
      askToJoin: 'Ask to join',
      hostedBy: 'Hosted by',
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
      privateTag: 'Private',

      // 🎙️ Room Titles & Hosts
      room1Title: 'English Fluency & Pronunciation Practice',
      room2Title: 'Business Communication Secrets',
      room3Title: 'Daily Vocab & Idiom Mastery',
      myRoomTitle: 'My Custom Speaking Workspace',
      host1Name: 'Aman Sharma',
      host2Name: 'Sneha Patel',
      host3Name: 'Rohit Verma',
      myHostName: 'Anas (You)',
    },

    // 👥 Community Screen
    community: {
      title: 'Community',
      subtitle: 'Connect, Learn & Rank',
      feed: 'Feed',
      challenges: 'Challenges',
      leaderboard: 'Leaderboard',
      writePost: 'Write a post...',
      startQuiz: 'Start Quiz Challenge',
      completed: 'Completed',
      questions: 'Questions',
      upToXP: 'Up to XP',
      justNow: 'Just now',
      ago: 'ago',
      daysAgo: 'd ago',
      hoursAgo: 'h ago',
      minsAgo: 'm ago',
      noPosts: 'No posts yet.',
      noChallenges: 'No challenges available.',
      noLeaderboard: 'No leaderboard data yet.',
    },

    // 👤 Profile Screen
    profile: {
      title: 'My Profile',
      joined: 'Level B2 · Intermediate · Joined 2026',
      xp: 'XP',
      roomsJoined: 'Rooms joined',
      dayStreak: 'Day streak',
      speakingProgress: 'Speaking Progress',
      pronunciation: 'Pronunciation',
      grammar: 'Grammar',
      vocabulary: 'Vocabulary',
      fluency: 'Fluency',
      achievements: 'Achievements & Badges',
      noBadges: 'No badges unlocked yet. Keep practicing!',
      certificates: 'Certificates',
      issuedDate: 'Issued Jan 2026 · Verified',
      signOut: 'Sign Out Account',
    },

    // ⚙️ Settings Screen
    settings: {
      title: 'Settings',
      preferences: 'PREFERENCES',
      darkMode: 'Dark mode',
      on: 'On',
      off: 'Off',
      theme: 'Theme',
      appLanguage: 'App language',
      notifications: 'NOTIFICATIONS',
      pushNotif: 'Push notifications',
      roomReminders: 'Room reminders',
      streakAlerts: 'Streak alerts',
      privacySecurity: 'PRIVACY & SECURITY',
      accountPrivacy: 'Account Privacy',
      selectTheme: 'Select App Theme',
      selectLang: 'Select App Language',
    }
  },

  hi: {
    // 📌 Bottom Navigation Tabs
    tabs: { 
      home: 'होम', 
      practice: 'प्रैक्टिस', 
      community: 'कम्युनिटी', 
      profile: 'प्रोफाइल' 
    },

    // 🏠 Home Screen
    home: {
      goodMorning: 'गुड मॉर्निंग',
      goodAfternoon: 'गुड आफ्टरनून',
      goodEvening: 'गुड इवनिंग',
      streak: 'स्ट्रिक',
      daysInRow: 'दिन लगातार',
      speaking: 'स्पीकिंग',
      thisWeek: '+4 इस हफ्ते',
      fluency: 'फ्लूएंसी',
      level: 'लेवल B2',
      liveNow: 'लाइव नाउ',
      morningTalk: 'मॉर्निंग स्मॉल टॉक',
      casualConv: 'दिन की शुरुआत के लिए आसान बातचीत',
      joinRoom: 'रूम में जॉइन करें ›',
      todayChallenge: 'आज का चैलेंज',
      describeYour: 'अपने बारे में बताएं ...',
      speakingChallenge: '60-सेकंड का स्पीकिंग चैलेंज',
      joined: 'लोग जुड़े',
      upcomingSessions: 'आने वाले सेशंस',
      seeAll: 'सभी देखें',
      
      // Upcoming Sessions Cards
      todayTime1: '📅 आज, शाम 6:00 बजे',
      session1Title: 'प्रिया के साथ 1:1',
      session1Desc: 'आईईएलटीएस स्पीकिंग कोचिंग',
      session1Details: '30 मिनट • वीडियो',
      
      todayTime2: '🎙️ आज, शाम 7:30 बजे',
      session2Title: 'डिबेट क्लब',
      session2Desc: 'टेक्नोलॉजी और सोसाइटी',
      session2Details: '45 मिनट • ऑडियो',
      
      // Community Section
      fromCommunity: 'कम्युनिटी से',
      postAuthor: 'डिएगो रामोस',
      postTime: '2 घंटे पहले',
      postContent: 'आईईएलटीएस स्पीकिंग में 7.5 बैंड स्कोर किया! डेली प्रैक्टिस ने बहुत मदद की।',
      likes: 'लाइक',
      comments: 'कमेंट्स',
      
      // Recent Activity
      recentActivity: 'रीसेंट एक्टिविटी',
      act1Title: "'मॉर्निंग स्मॉल टॉक' में जॉइन किया",
      act1Time: '2 घंटे पहले',
      act2Title: 'एआई सेशन पूरा किया',
      act2Time: 'कल',
    },

    // 🎯 Practice Screen
    practice: {
      title: 'प्रैक्टिस',
      subtitle: 'अपनी स्पीकिंग को बेहतर बनाएं',
      yourCoach: 'आपका एआई कोच',
      weeklyGoal: 'वीकली गोल',
      spokenToday: 'आज 20 में से 0 मिनट बोले गए',
      aiCoachTitle: 'एआई स्पीकिंग कोच',
      aiCoachDesc: 'रियल कन्वर्सेशन करें और तुरंत फीडबैक पाएं।',
      readRecordTitle: 'रीड एंड रिकॉर्ड',
      readRecordDesc: 'ज़ोर से पढ़ें और अपने प्रोनंसिएशन की जांच करें।',
      trainerTitle: 'ट्रेनर के साथ 1:1',
      trainerDesc: 'सर्टिफाइड कोच के साथ लाइव सेशन बुक करें।',
      quickDrills: 'क्विक ड्रिल्स',
      tongueTwisters: 'टंग ट्विस्टर्स',
      minimalPairs: 'मिनिमल पेयर्स',
      drillTime: '3 मिनट की ड्रिल',
    },

    // 🎙️ Voice Rooms Screen
    rooms: {
      title: 'वॉइस रूम्स',
      subtitle: 'तुरंत लाइव ऑडियो बातचीत की प्रैक्टिस करें',
      publicRooms: 'पब्लिक रूम्स',
      myRooms: 'मेरे रूम्स',
      activeSpeakers: 'एक्टिव स्पीकर्स',
      liveNow: 'अभी लाइव',
      listening: 'सुन रहे हैं',
      askToJoin: 'जॉइन करने की रिक्वेस्ट करें',
      hostedBy: 'होस्ट:',
      beginner: 'बिगीनर',
      intermediate: 'इंटरमीडिएट',
      advanced: 'एडवांस',
      privateTag: 'प्राइवेट',

      room1Title: 'इंग्लिश फ्लूएंसी और प्रोनंसिएशन प्रैक्टिस',
      room2Title: 'बिजनेस कम्यूनिकेशन सीक्रेट्स',
      room3Title: 'डेली वोकैब और इडियम्स मास्टरी',
      myRoomTitle: 'मेरा स्पीकिंग वर्कस्पेस',
      host1Name: 'अमन शर्मा',
      host2Name: 'स्नेहा पटेल',
      host3Name: 'रोहित वर्मा',
      myHostName: 'अनस (आप)',
    },

    // 👥 Community Screen
    community: {
      title: 'कम्युनिटी',
      subtitle: 'कनेक्ट करें, सीखें और रैंक पाएं',
      feed: 'फ़ीड',
      challenges: 'चैलेंजेस',
      leaderboard: 'लीडरबोर्ड',
      writePost: 'कुछ पोस्ट करें...',
      startQuiz: 'क्विज़ चैलेंज शुरू करें',
      completed: 'कंपलीट हुआ',
      questions: 'क्वेश्चंस',
      upToXP: 'एक्सपी (XP) तक',
      justNow: 'अभी-अभी',
      ago: 'पहले',
      daysAgo: 'दिन पहले',
      hoursAgo: 'घंटे पहले',
      minsAgo: 'मिनट पहले',
      noPosts: 'अभी कोई पोस्ट नहीं है।',
      noChallenges: 'कोई चैलेंज उपलब्ध नहीं है।',
      noLeaderboard: 'अभी कोई लीडरबोर्ड डेटा नहीं है।',
    },

    // 👤 Profile Screen
    profile: {
      title: 'मेरी प्रोफाइल',
      joined: 'लेवल B2 · इंटरमीडिएट · 2026 में जॉइन किया',
      xp: 'एक्सपी (XP)',
      roomsJoined: 'जॉइन किए गए रूम्स',
      dayStreak: 'डे स्ट्रिक',
      speakingProgress: 'स्पीकिंग प्रोग्रेस',
      pronunciation: 'प्रोनंसिएशन',
      grammar: 'ग्रामर',
      vocabulary: 'वोकैबुलरी',
      fluency: 'फ्लूएंसी',
      achievements: 'अचीवमेंट्स और बैजेस',
      noBadges: 'अभी कोई बैज अनलॉक नहीं हुआ। प्रैक्टिस जारी रखें!',
      certificates: 'सर्टिफिकेट्स',
      issuedDate: 'जनवरी 2026 में जारी · वेरीफाइड',
      signOut: 'साइन आउट करें',
    },

    // ⚙️ Settings Screen
    settings: {
      title: 'सेटिंग्स',
      preferences: 'प्रेफरेंसेस',
      darkMode: 'डार्क मोड',
      on: 'ऑन',
      off: 'ऑफ़',
      theme: 'थीम',
      appLanguage: 'ऐप की भाषा',
      notifications: 'नोटिफिकेशन',
      pushNotif: 'पुश नोटिफिकेशन',
      roomReminders: 'रूम रिमाइंडर',
      streakAlerts: 'स्ट्रिक अलर्ट',
      privacySecurity: 'प्राइवेसी और सिक्योरिटी',
      accountPrivacy: 'अकाउंट प्राइवेसी',
      selectTheme: 'ऐप थीम चुनें',
      selectLang: 'ऐप की भाषा चुनें',
    }
  }
};

// ─── AVAILABLE PALETTES ───
export const PALETTES = {
  oceanBlue: {
    name: 'Ocean Blue',
    primary: '#2563EB',
    accentPurple: '#8B5CF6',
    accentLightPurple: '#EEF2FF',
  },
  emeraldGreen: {
    name: 'Emerald Green',
    primary: '#10B981',
    accentPurple: '#059669',
    accentLightPurple: '#E6F4EA',
  },
  sunsetPurple: {
    name: 'Sunset Purple',
    primary: '#8B5CF6',
    accentPurple: '#7C3AED',
    accentLightPurple: '#F3E8FF',
  },
  neonPink: {
    name: 'Neon Pink',
    primary: '#EC4899',
    accentPurple: '#DB2777',
    accentLightPurple: '#FCE7F3',
  },
};

// ─── LIGHT THEME BASE ───
export const LIGHT_THEME = {
  isDarkMode: false,
  colors: {
    bgLight: '#F1F5F9',
    bgCard: '#FFFFFF',
    primary: '#2563EB',
    accentPurple: '#8B5CF6',
    accentLightPurple: '#EEF2FF',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    border: 'rgba(0, 0, 0, 0.08)',
    iconBg: '#E2E8F0',
    successGreen: '#10B981',
    alertRed: '#EF4444',
  },
  radius: {
    md: 12,
    lg: 18,
    full: 9999,
  },
};

// ─── DARK THEME BASE (STANDARD NATURAL SYSTEM DARK MODE) ───
export const DARK_THEME = {
  isDarkMode: true,
  colors: {
    bgLight: '#121212', // Standard natural dark mode background
    bgCard: '#1E1E1E',  // Standard natural dark mode card background
    primary: '#3B82F6',
    accentPurple: '#A78BFA',
    accentLightPurple: '#1E1B4B',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    border: 'rgba(255, 255, 255, 0.12)',
    iconBg: '#2A2A2A',
    successGreen: '#10B981',
    alertRed: '#EF4444',
  },
  radius: {
    md: 12,
    lg: 18,
    full: 9999,
  },
};

type ThemeContextType = {
  theme: typeof LIGHT_THEME;
  isDarkMode: boolean;
  toggleDarkMode: (value?: boolean) => void;
  currentThemeKey: keyof typeof PALETTES;
  changeTheme: (themeKey: keyof typeof PALETTES) => void;
  availableThemes: typeof PALETTES;
  currentLang: string;
  changeLanguage: (langCode: string) => void;
  t: (typeof TRANSLATIONS)['en'];
};

const ThemeContext = createContext<ThemeContextType>({
  theme: LIGHT_THEME,
  isDarkMode: false,
  toggleDarkMode: () => {},
  currentThemeKey: 'oceanBlue',
  changeTheme: () => {},
  availableThemes: PALETTES,
  currentLang: 'en',
  changeLanguage: () => {},
  t: TRANSLATIONS.en,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [currentThemeKey, setCurrentThemeKey] =
    useState<keyof typeof PALETTES>('oceanBlue');
  const [currentLang, setCurrentLang] = useState<string>('en');

  useEffect(() => {
    AsyncStorage.getItem('user_dark_mode').then(val => {
      if (val !== null) {
        setIsDarkMode(JSON.parse(val));
      }
    });

    AsyncStorage.getItem('user_theme_key').then(val => {
      if (val && PALETTES[val as keyof typeof PALETTES]) {
        setCurrentThemeKey(val as keyof typeof PALETTES);
      }
    });

    AsyncStorage.getItem('user_app_language').then(val => {
      if (val) {
        setCurrentLang(val);
      }
    });
  }, []);

  const toggleDarkMode = (value?: boolean) => {
    const newValue = value !== undefined ? value : !isDarkMode;
    setIsDarkMode(newValue);
    AsyncStorage.setItem('user_dark_mode', JSON.stringify(newValue));
  };

  const changeTheme = (themeKey: keyof typeof PALETTES) => {
    if (PALETTES[themeKey]) {
      setCurrentThemeKey(themeKey);
      AsyncStorage.setItem('user_theme_key', themeKey);
    }
  };

  const changeLanguage = (langCode: string) => {
    setCurrentLang(langCode);
    AsyncStorage.setItem('user_app_language', langCode);
  };

  const baseTheme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const activePalette = PALETTES[currentThemeKey];

  const currentTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: activePalette.primary,
      accentPurple: activePalette.accentPurple,
      accentLightPurple: isDarkMode
        ? baseTheme.colors.accentLightPurple
        : activePalette.accentLightPurple,
    },
  };

  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  return (
    <ThemeContext.Provider
      value={{
        theme: currentTheme,
        isDarkMode,
        toggleDarkMode,
        currentThemeKey,
        changeTheme,
        availableThemes: PALETTES,
        currentLang,
        changeLanguage,
        t,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: LIGHT_THEME,
      isDarkMode: false,
      toggleDarkMode: () => {},
      currentThemeKey: 'oceanBlue' as keyof typeof PALETTES,
      changeTheme: () => {},
      availableThemes: PALETTES,
      currentLang: 'en',
      changeLanguage: () => {},
      t: TRANSLATIONS.en,
    };
  }
  return context;
}