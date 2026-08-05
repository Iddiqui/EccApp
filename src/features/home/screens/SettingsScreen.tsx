import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Switch, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  StatusBar,
  Modal,
  SafeAreaView,
  Image,
  TextInput,
  Linking,
  Alert
} from 'react-native';
import { 
  ArrowLeft, 
  Moon, 
  Palette, 
  Globe, 
  Bell, 
  Shield, 
  Check, 
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  HelpCircle,
  MessageSquare,
  LogOut,
  Mail,
  AlertTriangle,
  Send,
  Eye,
  User,
  Phone,
  Users,
  Key,
  Lock,
  UserX,
  FileText,
  CheckCircle2,
  Flame,
  Mic
} from 'lucide-react-native';

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../../hooks/useTheme';

const STATUS_BAR_HEIGHT = StatusBar.currentHeight || (Platform.OS === 'ios' ? 44 : 24);

// 🌐 TRANSLATIONS DICTIONARY FOR SETTINGS
const TRANSLATIONS: Record<string, any> = {
  en: {
    settings: 'Settings',
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
    supportHelp: 'SUPPORT & HELP',
    helpCenter: 'Help Center',
    contactUs: 'Contact Us',
    logOut: 'Log Out',
    viewProfile: 'View Profile',
    selectTheme: 'Select App Theme',
    selectLang: 'Select App Language',
    receiveOnDevice: 'Receive notifications on this device.',
    getRoomAlerts: 'Get alerts before room starts.',
    keepStreakAlive: 'Alerts to keep your streak active.',
    privacyMattersTitle: 'Your privacy matters',
    privacyMattersDesc: 'Manage your privacy settings and secure your account and data',
    personalInfo: 'Personal Info',
    security: 'Security',
    howCanWeHelp: 'How can we help you?',
    getInTouch: 'Get in Touch',
    sendUsMessage: 'Send us a Message',
    sendMessageBtn: 'Send Message',
  },
  hi: {
    settings: 'सेटिंग्स',
    preferences: 'पसंद (PREFERENCES)',
    darkMode: 'डार्क मोड',
    on: 'चालू',
    off: 'बंद',
    theme: 'थीम',
    appLanguage: 'ऐप की भाषा',
    notifications: 'सूचनाएं (NOTIFICATIONS)',
    pushNotif: 'पुश नोटिफिकेशन',
    roomReminders: 'रूम रिमाइंडर',
    streakAlerts: 'स्ट्रिक अलर्ट',
    privacySecurity: 'गोपनीयता और सुरक्षा',
    accountPrivacy: 'खाता गोपनीयता',
    supportHelp: 'सहायता और मदद',
    helpCenter: 'हेल्प सेंटर',
    contactUs: 'संपर्क करें',
    logOut: 'लॉग आउट',
    viewProfile: 'प्रोफ़ाइल देखें',
    selectTheme: 'ऐप थीम चुनें',
    selectLang: 'ऐप की भाषा चुनें',
    receiveOnDevice: 'इस डिवाइस पर नोटिफिकेशन प्राप्त करें।',
    getRoomAlerts: 'रूम शुरू होने से पहले अलर्ट पाएं।',
    keepStreakAlive: 'अपनी स्ट्रिक जारी रखने के लिए अलर्ट।',
    privacyMattersTitle: 'आपकी गोपनीयता हमारे लिए महत्वपूर्ण है',
    privacyMattersDesc: 'अपनी गोपनीयता सेटिंग्स प्रबंधित करें और अपने खाते को सुरक्षित रखें',
    personalInfo: 'व्यक्तिगत जानकारी',
    security: 'सुरक्षा',
    howCanWeHelp: 'हम आपकी क्या मदद कर सकते हैं?',
    getInTouch: 'संपर्क में रहें',
    sendUsMessage: 'हमें संदेश भेजें',
    sendMessageBtn: 'संदेश भेजें',
  },
  es: {
    settings: 'Ajustes',
    preferences: 'PREFERENCIAS',
    darkMode: 'Modo oscuro',
    on: 'Activado',
    off: 'Desactivado',
    theme: 'Tema',
    appLanguage: 'Idioma de la aplicación',
    notifications: 'NOTIFICACIONES',
    pushNotif: 'Notificaciones push',
    roomReminders: 'Recordatorios de sala',
    streakAlerts: 'Alertas de racha',
    privacySecurity: 'PRIVACIDAD Y SEGURIDAD',
    accountPrivacy: 'Privacidad de la cuenta',
    supportHelp: 'SOPORTE Y AYUDA',
    helpCenter: 'Centro de ayuda',
    contactUs: 'Contáctenos',
    logOut: 'Cerrar sesión',
    viewProfile: 'Ver perfil',
    selectTheme: 'Seleccionar tema',
    selectLang: 'Seleccionar idioma',
    receiveOnDevice: 'Recibir notificaciones en este dispositivo.',
    getRoomAlerts: 'Recibe alertas antes de comenzar la sala.',
    keepStreakAlive: 'Alertas para mantener tu racha activa.',
    privacyMattersTitle: 'Tu privacidad importa',
    privacyMattersDesc: 'Administra tu privacidad y asegura tu cuenta',
    personalInfo: 'Información personal',
    security: 'Seguridad',
    howCanWeHelp: '¿Cómo podemos ayudarte?',
    getInTouch: 'Ponerse en contacto',
    sendUsMessage: 'Envíanos un mensaje',
    sendMessageBtn: 'Enviar mensaje',
  },
  ur: {
    settings: 'سیٹنگز',
    preferences: 'ترجیحات',
    darkMode: 'ڈارک موڈ',
    on: 'آن',
    off: 'آف',
    theme: 'تھیم',
    appLanguage: 'ایپ کی زبان',
    notifications: 'نوٹیفیکیشنز',
    pushNotif: 'پش نوٹیفیکیشنز',
    roomReminders: 'روم ریمائنڈرز',
    streakAlerts: 'اسٹریک الرٹس',
    privacySecurity: 'رازداری اور سیکیورٹی',
    accountPrivacy: 'اکاؤنٹ کی رازداری',
    supportHelp: 'سپورٹ اور مدد',
    helpCenter: 'ہیلپ سینٹر',
    contactUs: 'ہم سے رابطہ کریں',
    logOut: 'لاگ آؤٹ',
    viewProfile: 'پروفائل دیکھیں',
    selectTheme: 'ایپ تھیم منتخب کریں',
    selectLang: 'ایپ کی زبان منتخب کریں',
    receiveOnDevice: 'اس ڈیوائس پر نوٹیفیکیشنز حاصل کریں۔',
    getRoomAlerts: 'روم شروع ہونے سے پہلے الرٹس حاصل کریں۔',
    keepStreakAlive: 'اپنی اسٹریک برقرار رکھنے کے لیے الرٹس۔',
    privacyMattersTitle: 'آپ کی رازداری ہمارے لیے اہم ہے',
    privacyMattersDesc: 'اپنی ترتیبات کو کنٹرول کریں اور اکاؤنٹ کو محفوظ بنائیں',
    personalInfo: 'ذاتی معلومات',
    security: 'سیکیورٹی',
    howCanWeHelp: 'ہم آپ کی کیا مدد کر سکتے ہیں؟',
    getInTouch: 'رابطے میں رہیں',
    sendUsMessage: 'ہمیں پیغام بھیجیں',
    sendMessageBtn: 'پیغام بھیجیں',
  }
};

const LANGUAGES = [
  { code: 'en', label: 'English (US)' },
  { code: 'hi', label: 'हिंदी (Hindi)' },
  { code: 'es', label: 'Español (Spanish)' },
  { code: 'ur', label: 'اردو (Urdu)' },
];

export default function SettingsScreen({ navigation }: any) {
  const themeContext = useTheme() as any;
  const theme = themeContext?.theme;
  const isDarkMode = themeContext?.isDarkMode || false;
  const toggleDarkMode = themeContext?.toggleDarkMode;
  const currentThemeKey = themeContext?.currentThemeKey || 'oceanBlue';
  const changeTheme = themeContext?.changeTheme;
  const availableThemes = themeContext?.availableThemes || {};
  
  // 🌐 Global Language Context
  const currentLang = themeContext?.currentLang || 'en';
  const changeLanguage = themeContext?.changeLanguage;

  const colors = theme?.colors || {
    bgLight: isDarkMode ? '#121212' : '#F8FAFC',
    bgCard: isDarkMode ? '#1E1E1E' : '#FFFFFF',
    textPrimary: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
    primary: '#8B5CF6',
    iconBg: isDarkMode ? '#2A2A2A' : '#F1F5F9',
    border: isDarkMode ? '#334155' : '#E2E8F0',
  };

  // Logged-in User Data State
  const [userData, setUserData] = useState<{ displayName: string; email: string; photoURL: string }>({
    displayName: 'User',
    email: '',
    photoURL: ''
  });

  // Fetch Current Logged In Firebase User Profile
  useEffect(() => {
    const user = auth().currentUser;
    if (user) {
      setUserData({
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email ? `@${user.email.split('@')[0]}` : '@user',
        photoURL: user.photoURL || ''
      });

      // Firestore Listener for Updated Profile Data
      const unsub = firestore().collection('users').doc(user.uid).onSnapshot((doc) => {
        if (doc && doc.exists()) {
          const data = doc.data();
          setUserData(prev => ({
            ...prev,
            displayName: data?.fullName || data?.displayName || prev.displayName,
            photoURL: data?.photoURL || prev.photoURL || ''
          }));
        }
      });
      return () => unsub();
    }
  }, []);

  // 🛡️ 100% ERROR-PROOF PROFILE NAVIGATION
  const handleNavigateToProfile = () => {
    if (!navigation) return;

    // 1. Try Go Back first if Settings was opened from Profile
    if (navigation.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    // 2. Try Navigating Parent Tab Navigator
    const parent = navigation.getParent ? navigation.getParent() : null;
    if (parent) {
      try {
        parent.navigate('ProfileTab');
        return;
      } catch (e) {}
      try {
        parent.navigate('Profile');
        return;
      } catch (e) {}
    }

    // 3. Direct Route Fallback
    try {
      navigation.navigate('ProfileTab');
    } catch (e) {
      try {
        navigation.navigate('Profile');
      } catch (err) {}
    }
  };

  // Navigation State for Sub-Screens
  const [activeSubScreen, setActiveSubScreen] = useState<'main' | 'notification' | 'privacy' | 'help' | 'contact'>('main');

  // Notification Toggles
  const [pushNotif, setPushNotif] = useState(true);
  const [roomReminders, setRoomReminders] = useState(true);
  const [streakAlerts, setStreakAlerts] = useState(false);

  // Privacy & Security States
  const [lastSeen, setLastSeen] = useState('Everyone');
  const [profileVis, setProfileVis] = useState('Everyone');
  const [twoStepVerif, setTwoStepVerif] = useState(true);

  // Contact Us Form State
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  // Modals State
  const [isThemeModalVisible, setThemeModalVisible] = useState(false);
  const [isLangModalVisible, setLangModalVisible] = useState(false);

  // Dynamic Translations
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  // 1️⃣ NOTIFICATION SETTINGS SUB-SCREEN
  const renderNotificationSubScreen = () => (
    <SafeAreaView style={[styles.subSafeArea, { backgroundColor: colors.bgLight }]}>
      <View style={styles.subHeaderRow}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.iconBg }]} onPress={() => setActiveSubScreen('main')}>
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.subHeaderTitle, { color: colors.textPrimary }]}>{t.notifications}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
        <View style={styles.illustrationWrapper}>
          <Image
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3602/3602145.png' }}
            style={styles.notifBannerImage}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.illustrationSubtitle, { color: colors.textSecondary }]}>
          Manage how and when you receive notification from the app.
        </Text>

        <View style={[styles.subCardContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.toggleRow}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <Bell size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>{t.pushNotif}</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>{t.receiveOnDevice}</Text>
            </View>
            <Switch
              value={pushNotif}
              onValueChange={setPushNotif}
              trackColor={{ false: '#CBD5E1', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.toggleRow}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <Mic size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>{t.roomReminders}</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>{t.getRoomAlerts}</Text>
            </View>
            <Switch
              value={roomReminders}
              onValueChange={setRoomReminders}
              trackColor={{ false: '#CBD5E1', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.toggleRow}>
            <View style={[styles.iconCircleBg, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Flame size={20} color="#F59E0B" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>{t.streakAlerts}</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>{t.keepStreakAlive}</Text>
            </View>
            <Switch
              value={streakAlerts}
              onValueChange={setStreakAlerts}
              trackColor={{ false: '#CBD5E1', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  // 2️⃣ PRIVACY & SECURITY SUB-SCREEN
  const renderPrivacySubScreen = () => (
    <SafeAreaView style={[styles.subSafeArea, { backgroundColor: colors.bgLight }]}>
      <View style={styles.subHeaderRow}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.iconBg }]} onPress={() => setActiveSubScreen('main')}>
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.subHeaderTitle, { color: colors.textPrimary }]}>{t.privacySecurity}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
        <View style={[styles.privacyShieldBanner, { backgroundColor: colors.primary }]}>
          <View style={styles.shieldIconWrap}>
            <Shield size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{t.privacyMattersTitle}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
              {t.privacyMattersDesc}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionHeaderLabel, { color: colors.textPrimary }]}>{t.personalInfo}</Text>

        <View style={[styles.subCardContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.settingItemRowInner}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <Eye size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Last Seen & Online</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>{lastSeen}</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingItemRowInner}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <User size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Profile Visibility</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>{profileVis}</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingItemRowInner}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <Phone size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Phone Number Visibility</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>My Contacts</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingItemRowInner}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <Users size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Who Can Add Me to Groups</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>My Contacts</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeaderLabel, { color: colors.textPrimary, marginTop: 20 }]}>{t.security}</Text>

        <View style={[styles.subCardContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.toggleRow}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <Key size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Two-Step Verification</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>Add extra security to your account</Text>
            </View>
            <Switch
              value={twoStepVerif}
              onValueChange={setTwoStepVerif}
              trackColor={{ false: '#CBD5E1', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingItemRowInner}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <Lock size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Login Activity</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>Manage your active sessions</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingItemRowInner}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <UserX size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Blocked Users</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>Manage users you've blocked</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  // 3️⃣ HELP CENTER SUB-SCREEN
  const renderHelpSubScreen = () => (
    <SafeAreaView style={[styles.subSafeArea, { backgroundColor: colors.bgLight }]}>
      <View style={styles.subHeaderRow}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.iconBg }]} onPress={() => setActiveSubScreen('main')}>
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.subHeaderTitle, { color: colors.textPrimary }]}>{t.helpCenter}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
        <View style={styles.illustrationWrapper}>
          <Image
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/4712/4712109.png' }}
            style={{ width: 120, height: 120 }}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.helpBigHeading, { color: colors.textPrimary }]}>{t.howCanWeHelp}</Text>
        <Text style={[styles.illustrationSubtitle, { color: colors.textSecondary }]}>
          Find answers to common questions and learn how to use the app
        </Text>

        <View style={[styles.subCardContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.settingItemRowInner}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <HelpCircle size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>FAQs</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>Find answers to common questions</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingItemRowInner}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <FileText size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Guides & Tutorials</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>Learn how to use features step by step</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingItemRowInner} onPress={() => setActiveSubScreen('contact')}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <Mail size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>{t.contactUs}</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>Get in touch with our support team</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.purpleHelpBottomPill, { backgroundColor: colors.primary + '1F' }]}>
          <CheckCircle2 size={16} color={colors.primary} />
          <Text style={[styles.purplePillText, { color: colors.primary }]}>We're here to help! Your satisfaction is important to us</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  // 4️⃣ CONTACT US SUB-SCREEN
  const renderContactSubScreen = () => (
    <SafeAreaView style={[styles.subSafeArea, { backgroundColor: colors.bgLight }]}>
      <View style={styles.subHeaderRow}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.iconBg }]} onPress={() => setActiveSubScreen('main')}>
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.subHeaderTitle, { color: colors.textPrimary }]}>{t.contactUs}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
        <Text style={[styles.contactIntroText, { color: colors.textSecondary }]}>
          We're here to help! Reach out to us and we'll get back to you as soon as possible
        </Text>

        <Text style={[styles.sectionHeaderLabel, { color: colors.textPrimary }]}>{t.getInTouch}</Text>

        <View style={[styles.subCardContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.settingItemRowInner} onPress={() => Linking.openURL('mailto:support@ecc.com')}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <Mail size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Email Us</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>support@ecc.com</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingItemRowInner}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <MessageSquare size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Live Chat</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>Chat with our support team</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingItemRowInner} onPress={() => setActiveSubScreen('help')}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <HelpCircle size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>{t.helpCenter}</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>Find answers to common questions</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingItemRowInner}>
            <View style={[styles.iconCircleBg, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <AlertTriangle size={20} color="#EF4444" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Report an issue</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>Let us know what's going wrong</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeaderLabel, { color: colors.textPrimary, marginTop: 20 }]}>{t.sendUsMessage}</Text>
        <View style={[styles.subCardContainer, { backgroundColor: colors.bgCard, borderColor: colors.border, padding: 16 }]}>
          <TextInput
            style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgLight }]}
            placeholder="Subject"
            placeholderTextColor={colors.textSecondary}
            value={contactSubject}
            onChangeText={setContactSubject}
          />
          <TextInput
            style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgLight, height: 100, textAlignVertical: 'top' }]}
            placeholder="How can we help?"
            placeholderTextColor={colors.textSecondary}
            multiline
            value={contactMessage}
            onChangeText={setContactMessage}
          />
          <TouchableOpacity
            style={[styles.purpleSubmitBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              Alert.alert('Message Sent', 'Thank you! We will get back to you shortly.');
              setContactSubject('');
              setContactMessage('');
            }}
          >
            <Send size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>{t.sendMessageBtn}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  // Switch Active Sub-Screen View
  if (activeSubScreen === 'notification') return renderNotificationSubScreen();
  if (activeSubScreen === 'privacy') return renderPrivacySubScreen();
  if (activeSubScreen === 'help') return renderHelpSubScreen();
  if (activeSubScreen === 'contact') return renderContactSubScreen();

  // MAIN SETTINGS SCREEN
  return (
    <View style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent" 
        translucent={true} 
        animated={true}
      />

      <View style={styles.headerRow}>
        <TouchableOpacity 
          style={[styles.backBtn, { backgroundColor: colors.iconBg }]} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t.settings}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Dynamic Profile Theme-Synced Card */}
        <View style={[styles.profilePurpleCard, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
          {userData.photoURL ? (
            <Image
              source={{ uri: userData.photoURL }}
              style={styles.profileAvatar}
            />
          ) : (
            <View style={styles.initialAvatarCircle}>
              <Text style={styles.initialAvatarText}>
                {userData.displayName ? userData.displayName.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          )}

          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.profileNameText} numberOfLines={1}>{userData.displayName}</Text>
            <Text style={styles.profileHandleText} numberOfLines={1}>{userData.email}</Text>
            <TouchableOpacity 
              style={styles.viewProfilePillBtn}
              onPress={handleNavigateToProfile}
              activeOpacity={0.8}
            >
              <Text style={styles.viewProfileBtnText}>{t.viewProfile}</Text>
              <ChevronRight size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* PREFERENCES SECTION */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.preferences}</Text>
        <View style={[styles.cardBlock, { backgroundColor: colors.bgCard }]}>
          
          <View style={styles.settingItemRow}>
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: colors.iconBg }]}>
                <Moon size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: colors.textPrimary }]}>{t.darkMode}</Text>
                <Text style={[styles.itemSubLabel, { color: colors.textSecondary }]}>
                  {isDarkMode ? t.on : t.off}
                </Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={(val) => toggleDarkMode && toggleDarkMode(val)}
              trackColor={{ false: '#E2E8F0', true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : ''}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity 
            style={styles.settingItemRow} 
            activeOpacity={0.7}
            onPress={() => setThemeModalVisible(true)}
          >
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: colors.iconBg }]}>
                <Palette size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: colors.textPrimary }]}>{t.theme}</Text>
                <Text style={[styles.itemSubLabel, { color: colors.primary || colors.textSecondary, fontWeight: '700' }]}>
                  {availableThemes[currentThemeKey]?.name || 'Ocean Blue'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity 
            style={styles.settingItemRow} 
            activeOpacity={0.7}
            onPress={() => setLangModalVisible(true)}
          >
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: colors.iconBg }]}>
                <Globe size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: colors.textPrimary }]}>{t.appLanguage}</Text>
                <Text style={[styles.itemSubLabel, { color: colors.textSecondary }]}>
                  {LANGUAGES.find(l => l.code === currentLang)?.label || 'English (US)'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* NOTIFICATIONS SECTION */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.notifications}</Text>
        <View style={[styles.cardBlock, { backgroundColor: colors.bgCard }]}>
          <TouchableOpacity style={styles.settingItemRow} activeOpacity={0.7} onPress={() => setActiveSubScreen('notification')}>
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: colors.iconBg }]}>
                <Bell size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: colors.textPrimary }]}>{t.pushNotif}</Text>
                <Text style={[styles.itemSubLabel, { color: colors.textSecondary }]}>{t.receiveOnDevice}</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* PRIVACY & SECURITY SECTION */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.privacySecurity}</Text>
        <View style={[styles.cardBlock, { backgroundColor: colors.bgCard }]}>
          <TouchableOpacity style={styles.settingItemRow} activeOpacity={0.7} onPress={() => setActiveSubScreen('privacy')}>
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: colors.iconBg }]}>
                <Shield size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: colors.textPrimary }]}>{t.accountPrivacy}</Text>
                <Text style={[styles.itemSubLabel, { color: colors.textSecondary }]}>{t.privacyMattersTitle}</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* SUPPORT & HELP SECTION */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.supportHelp}</Text>
        <View style={[styles.cardBlock, { backgroundColor: colors.bgCard }]}>
          <TouchableOpacity style={styles.settingItemRow} activeOpacity={0.7} onPress={() => setActiveSubScreen('help')}>
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: colors.iconBg }]}>
                <HelpCircle size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: colors.textPrimary }]}>{t.helpCenter}</Text>
                <Text style={[styles.itemSubLabel, { color: colors.textSecondary }]}>FAQ, Contact support</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingItemRow} activeOpacity={0.7} onPress={() => setActiveSubScreen('contact')}>
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: colors.iconBg }]}>
                <MessageSquare size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: colors.textPrimary }]}>{t.contactUs}</Text>
                <Text style={[styles.itemSubLabel, { color: colors.textSecondary }]}>Contact Information</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingItemRow} activeOpacity={0.7} onPress={() => Alert.alert(t.logOut, 'Are you sure you want to log out?')}>
            <View style={styles.itemLeftBlock}>
              <View style={[styles.iconCircleBg, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <LogOut size={20} color="#EF4444" />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMainLabel, { color: '#EF4444' }]}>{t.logOut}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* THEME MODAL */}
      <Modal visible={isThemeModalVisible} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setThemeModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t.selectTheme}</Text>
              <TouchableOpacity onPress={() => setThemeModalVisible(false)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {Object.keys(availableThemes).map((key) => {
              const themeItem = availableThemes[key];
              const isSelected = currentThemeKey === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.themeOptionRow,
                    { backgroundColor: isSelected ? colors.iconBg : 'transparent' }
                  ]}
                  onPress={() => {
                    if (changeTheme) changeTheme(key);
                    setThemeModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[styles.colorPreviewCircle, { backgroundColor: themeItem.primary || '#2563EB' }]} />
                    <Text style={[styles.themeOptionName, { color: colors.textPrimary }]}>
                      {themeItem.name}
                    </Text>
                  </View>
                  {isSelected && <Check size={20} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* LANGUAGE MODAL */}
      <Modal visible={isLangModalVisible} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setLangModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t.selectLang}</Text>
              <TouchableOpacity onPress={() => setLangModalVisible(false)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {LANGUAGES.map((lang) => {
              const isSelected = currentLang === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.themeOptionRow,
                    { backgroundColor: isSelected ? colors.iconBg : 'transparent' }
                  ]}
                  onPress={() => {
                    if (changeLanguage) changeLanguage(lang.code);
                    setLangModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.themeOptionName, { color: colors.textPrimary }]}>
                    {lang.label}
                  </Text>
                  {isSelected && <Check size={20} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    paddingTop: STATUS_BAR_HEIGHT + 10, 
    paddingHorizontal: 20 
  },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 20 
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
  scrollContent: {
    paddingBottom: 40
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

  /* Profile Theme Synced Card */
  profilePurpleCard: {
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 4,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  profileAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#FFFFFF' },
  initialAvatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)'
  },
  initialAvatarText: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  profileNameText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  profileHandleText: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 13, marginTop: 2 },
  viewProfilePillBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8
  },
  viewProfileBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginRight: 4 },

  /* Sub Screen Styles */
  subSafeArea: { flex: 1 },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: Platform.OS === 'android' ? STATUS_BAR_HEIGHT : 0
  },
  subHeaderTitle: { fontSize: 20, fontWeight: '800' },
  scrollPadding: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 10 },
  illustrationWrapper: { alignItems: 'center', marginVertical: 16 },
  notifBannerImage: { width: 140, height: 140 },
  illustrationSubtitle: { fontSize: 13, textAlign: 'center', paddingHorizontal: 20, lineHeight: 19, marginBottom: 20, fontWeight: '500' },
  subCardContainer: { borderRadius: 22, borderWidth: 1, paddingVertical: 6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  settingItemRowInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  toggleMainTitle: { fontSize: 15, fontWeight: '700' },
  toggleSubTitle: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  sectionHeaderLabel: { fontSize: 16, fontWeight: '800', marginBottom: 10, marginLeft: 4 },

  /* Privacy Shield Banner */
  privacyShieldBanner: {
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  shieldIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },

  /* Help Center Pill Badge */
  helpBigHeading: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  purpleHelpBottomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 20,
    gap: 8
  },
  purplePillText: { fontSize: 12, fontWeight: '700', flex: 1 },

  /* Contact Us Form Inputs */
  contactIntroText: { fontSize: 13, lineHeight: 20, marginBottom: 18, fontWeight: '500' },
  formInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, marginBottom: 12 },
  purpleSubmitBtn: { paddingVertical: 13, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },

  /* Modal Styles */
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    paddingHorizontal: 24 
  },
  modalContent: { 
    borderRadius: 24, 
    padding: 20, 
    elevation: 5 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: '800' 
  },
  themeOptionRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 14, 
    borderRadius: 16, 
    marginBottom: 8 
  },
  colorPreviewCircle: { 
    width: 24, 
    height: 24, 
    borderRadius: 12 
  },
  themeOptionName: { 
    fontSize: 15, 
    fontWeight: '600' 
  },
});