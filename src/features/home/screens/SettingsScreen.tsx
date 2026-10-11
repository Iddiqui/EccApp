import React, { useState, useEffect, useRef } from 'react';
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
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView
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
  User,
  FileText,
  CheckCircle2,
  Flame,
  Mic,
  ChevronDown,
  ChevronUp,
  Search,
  Building2
} from 'lucide-react-native';

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../../hooks/useTheme';
import { unregisterDeviceToken } from '../../../services/notificationService';

const STATUS_BAR_HEIGHT = StatusBar.currentHeight || (Platform.OS === 'ios' ? 44 : 24);

// 🛟 SUPPORT CONFIG — apne real details yahan daalein
const SUPPORT_EMAIL = 'support@ecc.com';
// WhatsApp number country code ke saath, bina + ya spaces ke (e.g. '919876543210').
// Khaali chhodne par "Live Chat" tap karne par user ko message form par le jayenge.
const SUPPORT_WHATSAPP = '';

type FaqItem = { id: string; cat: 'learning' | 'payments' | 'account'; q: string; a: string };

// ❓ FAQ CONTENT (ECC Help Center)
const FAQS: Record<string, FaqItem[]> = {
  en: [
    { id: 'f1', cat: 'learning', q: 'What is ECC?', a: 'ECC is an English learning and communication platform where you can practice English with real people, teachers, mentors and AI-powered learning tools.' },
    { id: 'f2', cat: 'learning', q: 'How can I improve my English with ECC?', a: 'You can practice through Daily Practice, live voice/video rooms, Read & Record, quizzes, games, AI practice and teacher-led sessions.' },
    { id: 'f3', cat: 'learning', q: 'What is Daily Practice?', a: 'Daily Practice gives you regular English activities designed to help you build consistency and improve your communication skills.' },
    { id: 'f4', cat: 'learning', q: 'What is Join Room?', a: 'Join Room allows you to join live voice or video sessions and practice English with other learners.' },
    { id: 'f5', cat: 'learning', q: 'Can I talk to other English learners?', a: 'Yes. ECC provides community-based speaking opportunities where you can interact and practice English with other users.' },
    { id: 'f6', cat: 'learning', q: 'Can I learn with a teacher?', a: 'Yes. ECC may provide teacher-led live classes, private classes, group classes and other learning programmes.' },
    { id: 'f7', cat: 'learning', q: 'What is Read & Record?', a: 'Read & Record allows you to read English content aloud and submit your recording for pronunciation, fluency and communication practice.' },
    { id: 'f8', cat: 'learning', q: 'Does ECC use AI?', a: 'Yes. ECC uses AI-assisted technology to provide conversational practice, learning assistance, feedback and personalised learning support.' },
    { id: 'f9', cat: 'learning', q: 'Can AI replace a human teacher?', a: "No. ECC's AI is designed to support learning and practice. Human teachers and mentors provide real interaction, guidance and feedback where applicable." },
    { id: 'f10', cat: 'payments', q: 'Is ECC free?', a: 'Some ECC features may be available for free, while certain courses, classes or premium features may require payment.' },
    { id: 'f11', cat: 'payments', q: 'How can I purchase a course?', a: 'You can select the available course or plan, review the applicable price and complete the payment through the available payment method.' },
    { id: 'f12', cat: 'payments', q: 'Can I get a refund?', a: 'Refund eligibility depends on the applicable Refund & Cancellation Policy of the service purchased.' },
    { id: 'f13', cat: 'account', q: 'How do I report a problem or inappropriate behaviour?', a: 'You can contact ECC Support through the Contact Us section and provide relevant details about the issue.' },
    { id: 'f14', cat: 'account', q: 'How do I delete my account?', a: 'Go to your account settings and use the available account deletion option. If the option is unavailable, contact ECC Support.' },
    { id: 'f15', cat: 'account', q: 'How is my personal information protected?', a: 'ECC collects and processes information according to its Privacy Policy.' },
  ],
};

// 📘 GUIDES & TUTORIALS CONTENT
const GUIDES: { title: string; desc: string }[] = [
  { title: 'Getting Started with ECC', desc: 'Learn how to create your account, complete your profile and start learning.' },
  { title: 'How to Use Daily Practice', desc: 'Learn how to access daily activities and complete your English practice.' },
  { title: 'How to Join a Room', desc: 'Learn how to find and join public or private voice/video rooms.' },
  { title: 'How to Start Speaking Practice', desc: "Learn how to use ECC's speaking features to practice English with other learners." },
  { title: 'How to Use Read & Record', desc: 'Learn how to record your voice, submit your practice and receive feedback.' },
  { title: 'How to Use AI Practice', desc: "Learn how to interact with ECC's AI-powered learning features." },
  { title: 'How to Take Quizzes & Play Games', desc: 'Learn how to participate in quizzes and learning games.' },
  { title: 'How to Join a Live Class', desc: 'Learn how to access teacher-led live classes and private sessions.' },
  { title: 'How to Manage Your Account', desc: 'Learn how to update your profile, account information and preferences.' },
  { title: 'How to Manage Your Subscription', desc: 'Learn how to view your plan, payment details and subscription information.' },
  { title: 'How to Report a User', desc: 'Learn how to report inappropriate behaviour, content or other violations.' },
  { title: 'How to Contact ECC Support', desc: 'Learn how to contact our support team for technical, payment or learning-related issues.' },
];

// ☎️ CONTACT INFORMATION
const SUPPORT_WEBSITE_LABEL = 'www.eccenglish.com';
const SUPPORT_WEBSITE_URL = 'https://www.eccenglish.com';
const COMPANY_NAME = 'ECC English Learning Private Limited';
const SUPPORT_TOPICS = [
  'Account issues',
  'Technical problems',
  'Courses and classes',
  'Payments',
  'Refunds',
  'Voice/video rooms',
  'AI features',
  'Community issues',
  'Other ECC services',
];

// 🌐 TRANSLATIONS DICTIONARY FOR SETTINGS
// ─── PRIVACY POLICY CONTENT ───
// Kind of block: 'p' = paragraph, 'b' = bullet list ({ label?, text }), 'contact' = support email + website
type PolicyBlock =
  | { k: 'p'; text: string }
  | { k: 'b'; items: { label?: string; text: string }[] }
  | { k: 'contact' };

const PRIVACY_POLICY_UPDATED = '10 October 2026';

const PRIVACY_POLICY: { title: string; blocks: PolicyBlock[] }[] = [
  {
    title: '1. Introduction',
    blocks: [
      { k: 'p', text: 'Welcome to ECC (English Conversation Club). We value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and protect your information when you use our application.' },
    ],
  },
  {
    title: '2. Information We Collect',
    blocks: [
      { k: 'p', text: 'We may collect the following information when you use ECC:' },
      {
        k: 'b',
        items: [
          { label: 'Personal Information:', text: 'Name, email address, profile picture, and other details you choose to provide.' },
          { label: 'Profile Information:', text: 'English proficiency level, native language, country, location, and interests.' },
          { label: 'App Activity:', text: 'Practice history, quiz results, XP points, streaks, achievements, and leaderboard activity.' },
          { label: 'Audio and Voice Data:', text: 'Voice messages, recordings, or voice-room activity when you use these features.' },
          { label: 'Payment Information:', text: 'Subscription plans, transaction details, and payment status. Payments may be processed by third-party payment providers.' },
        ],
      },
    ],
  },
  {
    title: '3. How We Use Your Information',
    blocks: [
      { k: 'p', text: 'We use your information to:' },
      {
        k: 'b',
        items: [
          { text: 'Create and manage your account.' },
          { text: 'Provide English learning, speaking practice, and community features.' },
          { text: 'Track your learning progress, XP, streaks, and achievements.' },
          { text: 'Enable voice rooms, chat, and coaching sessions.' },
          { text: 'Process payments and manage subscriptions.' },
          { text: 'Send important account updates and notifications.' },
          { text: 'Improve app performance, security, and user experience.' },
        ],
      },
    ],
  },
  {
    title: '4. Account Privacy',
    blocks: [
      { k: 'p', text: "You can manage certain profile details through your account settings. Some information, such as your display name, profile picture, learning progress, or leaderboard position, may be visible to other users depending on the app's features and your privacy settings." },
      { k: 'p', text: 'Please avoid sharing sensitive personal information in public community rooms or chats.' },
    ],
  },
  {
    title: '5. Audio, Voice Rooms and Community',
    blocks: [
      { k: 'p', text: 'When you participate in voice rooms, send voice messages, or use speaking-practice features, relevant audio and activity data may be processed to provide these services.' },
      { k: 'p', text: 'Community messages and profile information may be visible to other participants. Please use these features responsibly.' },
    ],
  },
  {
    title: '6. Payments and Subscriptions',
    blocks: [
      { k: 'p', text: 'ECC may offer paid memberships, voice-chat plans, and one-to-one coaching sessions. Payments are handled through the payment provider displayed during checkout.' },
      { k: 'p', text: "ECC does not intend to store your complete card number, CVV, or UPI PIN on its own servers. Payment processing is subject to the payment provider's terms and privacy policy." },
    ],
  },
  {
    title: '7. Data Sharing',
    blocks: [
      { k: 'p', text: 'We do not sell your personal information. We may share relevant information with trusted service providers when necessary to operate the app, process payments, provide communication services, maintain security, or comply with applicable laws.' },
    ],
  },
  {
    title: '8. Data Security',
    blocks: [
      { k: 'p', text: 'We take reasonable measures to protect your information from unauthorized access, misuse, loss, or disclosure. However, no digital platform can guarantee complete security.' },
    ],
  },
  {
    title: '9. Data Retention and Account Deletion',
    blocks: [
      { k: 'p', text: 'We retain your information for as long as necessary to provide our services, maintain records, resolve disputes, and comply with legal obligations.' },
      { k: 'p', text: "You may request account deletion or removal of eligible personal information through the app's support or contact channels. Certain records may need to be retained where required by law." },
    ],
  },
  {
    title: "10. Children's Privacy",
    blocks: [
      { k: 'p', text: "ECC is intended for users who meet the applicable age requirements. If a child is permitted to use the app under applicable law, any required parental or guardian consent must be obtained. Please contact us if you believe a child's personal information has been collected improperly." },
    ],
  },
  {
    title: '11. Third-Party Services',
    blocks: [
      { k: 'p', text: 'ECC may use third-party services for authentication, cloud storage, analytics, live voice communication, and payment processing. These services may process information according to their respective privacy policies.' },
    ],
  },
  {
    title: '12. Changes to This Policy',
    blocks: [
      { k: 'p', text: 'We may update this Privacy Policy from time to time. Any updated version will be made available through the app, along with the revised effective date where appropriate.' },
    ],
  },
  {
    title: '13. Contact Us',
    blocks: [
      { k: 'p', text: 'If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us:' },
      { k: 'contact' },
    ],
  },
];

const TRANSLATIONS: Record<string, any> = {
  en: {
    settings: 'Settings',
    preferences: 'PREFERENCES',
    darkMode: 'Dark mode',
    on: 'On',
    off: 'Off',
    theme: 'Theme',
    notifications: 'NOTIFICATIONS',
    pushNotif: 'Push notifications',
    roomReminders: 'Room reminders',
    streakAlerts: 'Streak alerts',
    privacySecurity: 'PRIVACY & SECURITY',
    accountPrivacy: 'Privacy Policy',
    supportHelp: 'SUPPORT & HELP',
    helpCenter: 'Help Center',
    contactUs: 'Contact Us',
    logOut: 'Log Out',
    viewProfile: 'View Profile',
    selectTheme: 'Select App Theme',
    receiveOnDevice: 'Receive notifications on this device.',
    getRoomAlerts: 'Get alerts before room starts.',
    keepStreakAlive: 'Alerts to keep your streak active.',
    privacyMattersTitle: 'Your privacy matters',
    privacyMattersDesc: 'How we collect, use and protect your information',
    howCanWeHelp: 'How can we help you?',
    getInTouch: 'Get in Touch',
    sendUsMessage: 'Send us a Message',
    sendMessageBtn: 'Send Message',
    faqTitle: 'FAQs',
    searchFaq: 'Search questions',
    faqAll: 'All',
    faqLearning: 'Learning',
    faqPayments: 'Payments',
    faqAccount: 'Account',
    noFaqResults: 'No matching questions',
    noFaqResultsDesc: 'Try different words, or contact our support team.',
    stillNeedHelp: 'Still need help? Contact us',
    subject: 'Subject',
    messagePlaceholder: 'How can we help?',
    fillAllFields: 'Missing details',
    fillAllFieldsDesc: 'Please add a subject and a message.',
    messageSent: 'Message sent',
    messageSentDesc: 'Thanks! Our team will get back to you soon.',
    sendFailed: "Couldn't send message",
    sendFailedDesc: 'Check your internet connection and try again, or send it by email.',
    emailInstead: 'Send by email',
    cancel: 'Cancel',
    reportIssuePrefix: 'Issue: ',
    sending: 'Sending...',
    guidesTitle: 'Guides & Tutorials',
  },
};

export default function SettingsScreen({ navigation }: any) {
  const themeContext = useTheme() as any;
  const theme = themeContext?.theme;
  const isDarkMode = themeContext?.isDarkMode || false;
  const toggleDarkMode = themeContext?.toggleDarkMode;
  const currentThemeKey = themeContext?.currentThemeKey || 'oceanBlue';
  const changeTheme = themeContext?.changeTheme;
  const availableThemes = themeContext?.availableThemes || {};
  

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
  // Log out: remove this device's push token first so notifications for this account
  // stop arriving on this phone, then sign out. AppNavigator switches to the login
  // screen automatically when the auth state changes.
  const handleLogout = () => {
    Alert.alert(t.logOut, 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: t.logOut,
        style: 'destructive',
        onPress: async () => {
          try {
            await unregisterDeviceToken();
            await auth().signOut();
          } catch (e) {
            console.error('Logout failed:', e);
            Alert.alert('Error', 'Could not log out. Please try again.');
          }
        },
      },
    ]);
  };

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
  const [activeSubScreen, setActiveSubScreen] = useState<'main' | 'notification' | 'privacy' | 'help' | 'contact' | 'faq' | 'guides'>('main');

  // Notification Toggles
  const [pushNotif, setPushNotif] = useState(true);
  const [roomReminders, setRoomReminders] = useState(true);
  const [streakAlerts, setStreakAlerts] = useState(false);

  // Contact Us Form State
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactType, setContactType] = useState<'general' | 'issue'>('general');
  const [isSending, setIsSending] = useState(false);
  const contactScrollRef = useRef<ScrollView>(null);

  // FAQ State
  const [faqSearch, setFaqSearch] = useState('');
  const [faqCategory, setFaqCategory] = useState<'all' | FaqItem['cat']>('all');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  // Modals State
  const [isThemeModalVisible, setThemeModalVisible] = useState(false);

  // Dynamic Translations
  const t = TRANSLATIONS.en;

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

  // 2️⃣ PRIVACY POLICY SUB-SCREEN
  const renderPrivacySubScreen = () => (
    <SafeAreaView style={[styles.subSafeArea, { backgroundColor: colors.bgLight }]}>
      <View style={styles.subHeaderRow}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.iconBg }]} onPress={() => setActiveSubScreen('main')}>
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.subHeaderTitle, { color: colors.textPrimary }]}>{t.accountPrivacy}</Text>
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

        <View style={[styles.policyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.policyUpdated, { color: colors.textSecondary }]}>
            Last Updated: {PRIVACY_POLICY_UPDATED}
          </Text>

          {PRIVACY_POLICY.map((section) => (
            <View key={section.title} style={{ marginTop: 18 }}>
              <Text style={[styles.policyHeading, { color: colors.textPrimary }]}>{section.title}</Text>

              {section.blocks.map((block, bi) => {
                if (block.k === 'p') {
                  return (
                    <Text key={bi} style={[styles.policyPara, { color: colors.textSecondary }]}>
                      {block.text}
                    </Text>
                  );
                }
                if (block.k === 'b') {
                  return (
                    <View key={bi} style={{ marginTop: 6 }}>
                      {block.items.map((item, ii) => (
                        <View key={ii} style={styles.policyBulletRow}>
                          <Text style={[styles.policyBulletDot, { color: colors.primary }]}>{'\u2022'}</Text>
                          <Text style={[styles.policyPara, { color: colors.textSecondary, flex: 1, marginTop: 0 }]}>
                            {item.label ? (
                              <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{item.label} </Text>
                            ) : null}
                            {item.text}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                }
                // contact block
                return (
                  <View key={bi} style={{ marginTop: 8 }}>
                    <Text style={[styles.policyPara, { color: colors.textSecondary, marginTop: 0 }]}>
                      <Text style={{ fontWeight: '700', color: colors.textPrimary }}>App Name: </Text>
                      ECC – English Conversation Club
                    </Text>
                    <Text
                      style={[styles.policyPara, { color: colors.textSecondary }]}
                      onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => Alert.alert(SUPPORT_EMAIL))}
                    >
                      <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Email: </Text>
                      <Text style={{ color: colors.primary }}>{SUPPORT_EMAIL}</Text>
                    </Text>
                    <Text
                      style={[styles.policyPara, { color: colors.textSecondary }]}
                      onPress={() => Linking.openURL(SUPPORT_WEBSITE_URL).catch(() => Alert.alert(SUPPORT_WEBSITE_LABEL))}
                    >
                      <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Website: </Text>
                      <Text style={{ color: colors.primary }}>{SUPPORT_WEBSITE_LABEL}</Text>
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
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
          Find answers to common questions and learn how to use the ECC app.
        </Text>

        <View style={[styles.subCardContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.settingItemRowInner} activeOpacity={0.7} onPress={() => setActiveSubScreen('faq')}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <HelpCircle size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>{t.faqTitle}</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>Find answers to common questions about ECC.</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingItemRowInner} activeOpacity={0.7} onPress={() => setActiveSubScreen('guides')}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <FileText size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>{t.guidesTitle}</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>Learn how to use ECC features step by step.</Text>
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
          <Text style={[styles.purplePillText, { color: colors.primary }]}>We're here to help! Your satisfaction is important to us.</Text>
        </View>

        <Text style={[styles.illustrationSubtitle, { color: colors.textSecondary, marginTop: 16, marginBottom: 0 }]}>
          If you cannot find an answer in the Help Center, contact our support team and we'll do our best to assist you.
        </Text>
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={contactScrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollPadding}
      >
        <Text style={[styles.contactIntroText, { color: colors.textSecondary }]}>
          Get in touch with our support team.
        </Text>

        <Text style={[styles.toggleMainTitle, { color: colors.textPrimary, marginBottom: 10, marginLeft: 4 }]}>
          For support related to:
        </Text>
        <View style={styles.topicWrap}>
          {SUPPORT_TOPICS.map((topic) => (
            <View key={topic} style={[styles.topicPill, { backgroundColor: colors.primary + '1F' }]}>
              <Text style={[styles.topicPillText, { color: colors.primary }]}>{topic}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionHeaderLabel, { color: colors.textPrimary }]}>{t.getInTouch}</Text>

        <View style={[styles.subCardContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.settingItemRowInner} onPress={() => openEmail()}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <Mail size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Email Us</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>{SUPPORT_EMAIL}</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.settingItemRowInner}
            activeOpacity={0.7}
            onPress={() => Linking.openURL(SUPPORT_WEBSITE_URL).catch(() => Alert.alert(SUPPORT_WEBSITE_LABEL))}
          >
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <Globe size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Website</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>{SUPPORT_WEBSITE_LABEL}</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingItemRowInner}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <Building2 size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Company</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>{COMPANY_NAME}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {SUPPORT_WHATSAPP ? (
            <>
              <TouchableOpacity style={styles.settingItemRowInner} activeOpacity={0.7} onPress={handleLiveChat}>
                <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
                  <MessageSquare size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>Live Chat</Text>
                  <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>Chat with our support team</Text>
                </View>
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          ) : null}

          <TouchableOpacity style={styles.settingItemRowInner} onPress={() => setActiveSubScreen('help')}>
            <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
              <HelpCircle size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>{t.helpCenter}</Text>
              <Text style={[styles.toggleSubTitle, { color: colors.textSecondary }]}>Find answers to common questions about ECC.</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingItemRowInner} activeOpacity={0.7} onPress={handleReportIssue}>
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
            placeholder={t.subject}
            placeholderTextColor={colors.textSecondary}
            value={contactSubject}
            onChangeText={setContactSubject}
          />
          <TextInput
            style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgLight, height: 100, textAlignVertical: 'top' }]}
            placeholder={t.messagePlaceholder}
            placeholderTextColor={colors.textSecondary}
            multiline
            value={contactMessage}
            onChangeText={setContactMessage}
          />
          <TouchableOpacity
            style={[styles.purpleSubmitBtn, { backgroundColor: colors.primary, opacity: isSending ? 0.7 : 1 }]}
            onPress={handleSendMessage}
            disabled={isSending}
            activeOpacity={0.8}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
            ) : (
              <Send size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            )}
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>
              {isSending ? t.sending : t.sendMessageBtn}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  // 5️⃣ FAQ SUB-SCREEN
  const renderFaqSubScreen = () => {
    const faqList = FAQS.en;
    const query = faqSearch.trim().toLowerCase();
    const filteredFaqs = faqList.filter(
      (f) =>
        (faqCategory === 'all' || f.cat === faqCategory) &&
        (!query || `${f.q} ${f.a}`.toLowerCase().includes(query))
    );
    const categories: { key: 'all' | FaqItem['cat']; label: string }[] = [
      { key: 'all', label: t.faqAll },
      { key: 'learning', label: t.faqLearning },
      { key: 'payments', label: t.faqPayments },
      { key: 'account', label: t.faqAccount },
    ];

    return (
      <SafeAreaView style={[styles.subSafeArea, { backgroundColor: colors.bgLight }]}>
        <View style={styles.subHeaderRow}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.iconBg }]} onPress={() => setActiveSubScreen('help')}>
            <ChevronLeft size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.subHeaderTitle, { color: colors.textPrimary }]} numberOfLines={1}>{t.faqTitle}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollPadding}>
          <Text style={[styles.contactIntroText, { color: colors.textSecondary, marginBottom: 14 }]}>
            Find answers to common questions about ECC.
          </Text>

          {/* Search */}
          <View style={[styles.faqSearchBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.faqSearchInput, { color: colors.textPrimary }]}
              placeholder={t.searchFaq}
              placeholderTextColor={colors.textSecondary}
              value={faqSearch}
              onChangeText={setFaqSearch}
              returnKeyType="search"
            />
            {faqSearch.length > 0 && (
              <TouchableOpacity onPress={() => setFaqSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
            {categories.map((c) => {
              const active = faqCategory === c.key;
              return (
                <TouchableOpacity
                  key={c.key}
                  activeOpacity={0.8}
                  onPress={() => { setFaqCategory(c.key); setExpandedFaqId(null); }}
                  style={[
                    styles.faqChip,
                    { backgroundColor: active ? colors.primary : colors.bgCard, borderColor: active ? colors.primary : colors.border }
                  ]}
                >
                  <Text style={[styles.faqChipText, { color: active ? '#FFFFFF' : colors.textPrimary }]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Questions */}
          {filteredFaqs.length > 0 ? (
            <View style={[styles.subCardContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              {filteredFaqs.map((faq, index) => {
                const isOpen = expandedFaqId === faq.id;
                return (
                  <View key={faq.id}>
                    {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                    <TouchableOpacity
                      style={styles.faqQuestionRow}
                      activeOpacity={0.7}
                      onPress={() => setExpandedFaqId(isOpen ? null : faq.id)}
                    >
                      <Text style={[styles.toggleMainTitle, { color: colors.textPrimary, flex: 1, paddingRight: 10 }]}>{faq.q}</Text>
                      {isOpen
                        ? <ChevronUp size={20} color={colors.primary} />
                        : <ChevronDown size={20} color={colors.textSecondary} />}
                    </TouchableOpacity>
                    {isOpen && (
                      <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>{faq.a}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.faqEmptyWrap}>
              <HelpCircle size={36} color={colors.textSecondary} />
              <Text style={[styles.helpBigHeading, { color: colors.textPrimary, fontSize: 17, marginTop: 10 }]}>{t.noFaqResults}</Text>
              <Text style={[styles.illustrationSubtitle, { color: colors.textSecondary, marginBottom: 0 }]}>{t.noFaqResultsDesc}</Text>
            </View>
          )}

          {/* Still need help */}
          <TouchableOpacity
            style={[styles.purpleHelpBottomPill, { backgroundColor: colors.primary + '1F' }]}
            activeOpacity={0.8}
            onPress={() => setActiveSubScreen('contact')}
          >
            <Mail size={16} color={colors.primary} />
            <Text style={[styles.purplePillText, { color: colors.primary }]}>{t.stillNeedHelp}</Text>
            <ChevronRight size={16} color={colors.primary} />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  };

  // 6️⃣ GUIDES & TUTORIALS SUB-SCREEN
  const renderGuidesSubScreen = () => (
    <SafeAreaView style={[styles.subSafeArea, { backgroundColor: colors.bgLight }]}>
      <View style={styles.subHeaderRow}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.iconBg }]} onPress={() => setActiveSubScreen('help')}>
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.subHeaderTitle, { color: colors.textPrimary }]} numberOfLines={1}>{t.guidesTitle}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
        <Text style={[styles.contactIntroText, { color: colors.textSecondary }]}>
          Learn how to use ECC features step by step.
        </Text>

        <View style={[styles.subCardContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {GUIDES.map((guide, index) => (
            <View key={guide.title}>
              {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <View style={styles.settingItemRowInner}>
                <View style={[styles.iconCircleBg, { backgroundColor: colors.primary + '1F' }]}>
                  <FileText size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.toggleMainTitle, { color: colors.textPrimary }]}>{guide.title}</Text>
                  <Text style={[styles.toggleSubTitle, { color: colors.textSecondary, lineHeight: 18 }]}>{guide.desc}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.purpleHelpBottomPill, { backgroundColor: colors.primary + '1F' }]}
          activeOpacity={0.8}
          onPress={() => setActiveSubScreen('contact')}
        >
          <Mail size={16} color={colors.primary} />
          <Text style={[styles.purplePillText, { color: colors.primary }]}>{t.stillNeedHelp}</Text>
          <ChevronRight size={16} color={colors.primary} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  // 📨 SUPPORT ACTIONS
  const scrollToContactForm = () => {
    setTimeout(() => contactScrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const openEmail = (subject = '', body = '') => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(t.sendFailed, SUPPORT_EMAIL);
    });
  };

  const handleLiveChat = () => {
    if (!SUPPORT_WHATSAPP) {
      scrollToContactForm();
      return;
    }
    const text = encodeURIComponent(`Hi, I need help with the app. (${userData.displayName})`);
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}?text=${text}`).catch(() => {
      Alert.alert(t.sendFailed, t.sendFailedDesc);
    });
  };

  const handleReportIssue = () => {
    setContactType('issue');
    if (!contactSubject.trim()) setContactSubject(t.reportIssuePrefix);
    scrollToContactForm();
  };

  const handleSendMessage = async () => {
    const subject = contactSubject.trim();
    const message = contactMessage.trim();

    if (!subject || !message) {
      Alert.alert(t.fillAllFields, t.fillAllFieldsDesc);
      return;
    }

    setIsSending(true);
    try {
      const user = auth().currentUser;
      await firestore().collection('supportTickets').add({
        uid: user?.uid || null,
        name: userData.displayName,
        email: user?.email || null,
        type: contactType,
        subject,
        message,
        status: 'open',
        platform: Platform.OS,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      setContactSubject('');
      setContactMessage('');
      setContactType('general');
      Alert.alert(t.messageSent, t.messageSentDesc);
    } catch (error) {
      Alert.alert(t.sendFailed, t.sendFailedDesc, [
        { text: t.cancel, style: 'cancel' },
        { text: t.emailInstead, onPress: () => openEmail(subject, message) },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // Switch Active Sub-Screen View
  if (activeSubScreen === 'notification') return renderNotificationSubScreen();
  if (activeSubScreen === 'privacy') return renderPrivacySubScreen();
  if (activeSubScreen === 'help') return renderHelpSubScreen();
  if (activeSubScreen === 'contact') return renderContactSubScreen();
  if (activeSubScreen === 'faq') return renderFaqSubScreen();
  if (activeSubScreen === 'guides') return renderGuidesSubScreen();

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

          <TouchableOpacity style={styles.settingItemRow} activeOpacity={0.7} onPress={handleLogout}>
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

  /* Privacy Policy */
  policyCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 4 },
  policyUpdated: { fontSize: 12, fontWeight: '600' },
  policyHeading: { fontSize: 15, fontWeight: '800' },
  policyPara: { fontSize: 13.5, lineHeight: 21, marginTop: 6 },
  policyBulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 5, paddingRight: 4 },
  policyBulletDot: { fontSize: 16, lineHeight: 21, width: 16 },

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

  /* FAQ Screen */
  faqSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 14,
    gap: 10
  },
  faqSearchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  faqChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  faqChipText: { fontSize: 13, fontWeight: '700' },
  faqQuestionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  faqAnswer: { fontSize: 13.5, lineHeight: 21, paddingHorizontal: 16, paddingBottom: 16, fontWeight: '500' },
  faqEmptyWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },

  /* Contact topics */
  topicWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  topicPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  topicPillText: { fontSize: 12.5, fontWeight: '700' },

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