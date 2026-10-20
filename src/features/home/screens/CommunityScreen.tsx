import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  StyleSheet,
  PanResponder, 
  AppState,
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  Dimensions, 
  Platform, 
  ActivityIndicator, 
  Alert,
  StatusBar,
  Modal,
  ScrollView,
  SafeAreaView,
  Keyboard,
  PermissionsAndroid,
  Animated,
  Easing,
  Image,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Linking
} from 'react-native';
import { 
  Trash2, Send, Trophy, Plus, X, CheckCircle, Flame, 
  Sparkles, MessageCircle, Users, Mic, Paperclip, 
  Play, Pause, MoreVertical, XCircle, Check, CheckCheck, Clock, ShieldCheck, ChevronRight, AlertTriangle, Smile,
  Radio, Puzzle, RotateCcw, Shuffle, ArrowLeft, BarChart2, Lightbulb,
  Pin, PinOff, Camera, Image as ImageIcon, FileText, Music, MapPin, LogOut, UserPlus, Timer, ShieldAlert, UserX, Delete,
  Edit3, Keyboard as KeyboardIcon, ZoomIn, ZoomOut, AtSign
} from 'lucide-react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import { recordPracticeActivity } from '../../../services/streakService';
import AudioRecord from 'react-native-audio-record';

let SoundPlayer: any = null;
try {
  const SoundModule = require('react-native-sound');
  SoundModule.default ? (SoundPlayer = SoundModule.default) : (SoundPlayer = SoundModule);
  if (SoundPlayer && SoundPlayer.setCategory) {
    SoundPlayer.setCategory('Playback', true); 
  }
} catch (e) {
  console.log("react-native-sound missing");
}

// Optional native packages for sharing files in chat. If one is missing the app still runs,
// and the user gets a clear message when they try to use that feature.
//   npm i @react-native-firebase/storage react-native-image-picker @react-native-documents/picker
let storageLib: any = null;
try { storageLib = require('@react-native-firebase/storage').default; } catch (e) {}
let imagePicker: any = null;
try { imagePicker = require('react-native-image-picker'); } catch (e) {}
let docPicker: any = null;
try { docPicker = require('@react-native-documents/picker'); } catch (e) {
  try { docPicker = require('react-native-document-picker'); } catch (e2) {}
}

const MAX_CHAT_FILE_BYTES = 20 * 1024 * 1024;

const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

//@ts-ignore
import ConfettiCannon from 'react-native-confetti-cannon';
import { useTheme } from '../../../hooks/useTheme';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const KNOWN_ADMIN_EMAILS = [
  'jitendrakumar2k4@gmail.com',
  'codizumtech@gmail.com'
];

const IMG_CHILDREN_DEFAULT = require('../../../assets/child.png');
const IMG_CHILD_CHALLENGES = require('../../../assets/child_2.png');
const IMG_COMMUNITY_CARD = require('../../../assets/community.png');

const AVATAR_COLORS = ['#8B5CF6', '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#F97316', '#3B82F6', '#D946EF'];
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'];

const DELETE_FOR_EVERYONE_WINDOW_MS = 60 * 60 * 1000;

const snapshotExists = (snapshot: any): boolean => {
  if (!snapshot) return false;
  const value = snapshot.exists;
  return typeof value === 'function' ? !!value.call(snapshot) : value === true;
};

const hasToDate = (value: any): boolean =>
  !!value && typeof value.toDate === 'function';

const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
  '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
  '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
  '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈',
  '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
  '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🧠', '🫀', '👀', '👁️',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🔥', '✨'
];

const DEFAULT_QUIZ_CHALLENGES = [
  {
    id: 'quiz_challenge_1',
    title: 'Quiz: Listen & Grammar Focus',
    rewardXP: 20,
    timeLeft: '10h 30m Left',
    questions: [
      {
        questionText: 'Choose the sentence with the correct natural spoken English rhythm:',
        options: [
          'A) She told me that she would arrive on time.',
          'B) She told to me she will arrive on time.',
          'C) She said me she is arriving on time.',
          'D) She tell me that she arrive on time.'
        ],
        correctAnswerIndex: 0,
        explanation: '"Told me that..." is the grammatically correct reporting structure in natural English speech.'
      },
      {
        questionText: 'Which phrasal verb means "to cancel an arranged meeting"?',
        options: [
          'A) Call off',
          'B) Call on',
          'C) Call out',
          'D) Call in'
        ],
        correctAnswerIndex: 0,
        explanation: '"Call off" specifically means to cancel an event or meeting.'
      }
    ]
  },
  {
    id: 'quiz_challenge_2',
    title: 'Quiz: Vocabulary & Pronunciation',
    rewardXP: 20,
    timeLeft: '1d 2h Left',
    questions: [
      {
        questionText: 'Which word has a silent "B" sound when pronounced clearly?',
        options: [
          'A) Subtle',
          'B) Rubber',
          'C) Bubble',
          'D) Timber'
        ],
        correctAnswerIndex: 0,
        explanation: 'In "Subtle" (/ˈsʌt.əl/), the "b" is completely silent.'
      },
      {
        questionText: 'Select the best word: "He gave an ________ presentation that inspired everyone."',
        options: [
          'A) Eloquent',
          'B) Awkward',
          'C) Hesitant',
          'D) Ambiguous'
        ],
        correctAnswerIndex: 0,
        explanation: '"Eloquent" describes fluent, persuasive, and graceful speaking.'
      }
    ]
  }
];

const WORD_ZIP_PUZZLES = [
  {
    id: 'zip_puz_1',
    title: 'English Fluency & Speech',
    theme: 'Communication & Speech',
    grid: [
      ['F', 'L', 'U', 'E'],
      ['S', 'P', 'E', 'N'],
      ['W', 'O', 'R', 'T'],
      ['T', 'A', 'L', 'K']
    ],
    words: [
      { word: 'FLUENT', meaning: 'Able to speak or express thoughts smoothly and easily.' },
      { word: 'SPEAK', meaning: 'Say words to convey information, thoughts, or feelings.' },
      { word: 'WORD', meaning: 'A single distinct meaningful element of speech.' },
      { word: 'TALK', meaning: 'Engage in speech, conversation, or discussion.' },
      { word: 'FLOW', meaning: 'Move along in a steady, effortless, continuous stream.' }
    ]
  },
  {
    id: 'zip_puz_2',
    title: 'Active Learning & Growth',
    theme: 'Progress & Vocabulary',
    grid: [
      ['G', 'R', 'O', 'W'],
      ['B', 'E', 'S', 'T'],
      ['H', 'E', 'A', 'R'],
      ['R', 'E', 'A', 'D']
    ],
    words: [
      { word: 'GROW', meaning: 'Progress and improve your English communication skills.' },
      { word: 'BEST', meaning: 'Of the most excellent, effective, or desirable quality.' },
      { word: 'HEAR', meaning: 'Perceive and understand spoken pronunciation clearly.' },
      { word: 'READ', meaning: 'Look at and comprehend the meaning of written text.' }
    ]
  }
];

const getAvatarColor = (str: string = 'User') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const formatTimeAgo = (timestamp: any, nowMs: number = Date.now()) => {
  if (!timestamp) return 'Just now';
  const date = hasToDate(timestamp) ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((nowMs - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const PRESENCE_TTL_MS = 90 * 1000;

const presenceMs = (value: any): number => {
  if (!value) return 0;
  const date = hasToDate(value) ? value.toDate() : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
};

// Online = chat is open right now (isChatActive) OR the member is on the Community screen (appOnlineAt).
// Both are heartbeats, so they count only if they are fresh.
const isPresenceFresh = (member: any, nowMs: number = Date.now()) => {
  const chatFresh = member?.isChatActive === true && nowMs - presenceMs(member?.lastActive) <= PRESENCE_TTL_MS;
  const screenFresh = nowMs - presenceMs(member?.appOnlineAt) <= PRESENCE_TTL_MS;
  return chatFresh || screenFresh;
};

const formatMessageTime = (timestamp: any) => {
  if (!timestamp) return 'Just now';
  const date = hasToDate(timestamp) ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Community chat moderation: only admins may share links. Keep this in sync with the
// Firestore rules (chatHasLink) - the rules are the real enforcement, this gives instant feedback.
const CHAT_LINK_REGEX = /(https?:\/\/|ftp:\/\/|www\.|[a-z0-9-]+\.(com|net|org|in|io|co|me|app|ly|link|xyz|info|biz|us|uk|tv|gl|be|to|cc|ai|dev|site|online|store|shop|live|club|top|page|gle)(?![a-z0-9]))/i;
const chatHasLink = (value: any): boolean => CHAT_LINK_REGEX.test(String(value ?? ''));
const IMAGE_FILE_REGEX = /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg|tiff?)$/i;

const isSingleEmojiText = (value: any): boolean => {
  const text = String(value ?? '').trim();
  if (!text) return false;

  let hasEmojiCodePoint = false;
  for (const char of Array.from(text)) {
    const cp = char.codePointAt(0) || 0;
    const isEmojiRange =
      (cp >= 0x1F1E6 && cp <= 0x1F1FF) ||
      (cp >= 0x1F300 && cp <= 0x1FAFF) ||
      (cp >= 0x2300 && cp <= 0x23FF) ||
      (cp >= 0x2600 && cp <= 0x27BF) ||
      (cp >= 0x2B00 && cp <= 0x2BFF);
    const isEmojiJoiner = cp === 0xFE0F || cp === 0x200D || cp === 0x20E3 || (cp >= 0x1F3FB && cp <= 0x1F3FF);
    if (isEmojiRange) hasEmojiCodePoint = true;
    if (!isEmojiRange && !isEmojiJoiner) return false;
  }
  return hasEmojiCodePoint;
};

const getMessageDateHeader = (timestamp: any) => {
  if (!timestamp) return 'Today';
  const date = hasToDate(timestamp) ? timestamp.toDate() : new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  }
};

const AnimatedReactionBadge = ({ item, onRemove }: { item: any; onRemove: (id: string) => void }) => {
  const reactions = item?.reactions || {};
  const reactionValues: string[] = Object.values(reactions);
  const reactionScale = useRef(new Animated.Value(0.55)).current;
  const reactionOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reactionValues.length > 0) {
      reactionScale.setValue(0.55);
      reactionOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(reactionScale, {
          toValue: 1,
          friction: 7,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.timing(reactionOpacity, {
          toValue: 1,
          duration: 130,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      reactionScale.setValue(0.55);
      reactionOpacity.setValue(0);
    }
  }, [reactionValues.join('|')]);

  if (reactionValues.length === 0) return null;

  const uniqueEmojis = Array.from(new Set(reactionValues));
  const badgeStyle = reactionValues.length === 1
    ? styles.pureTransparentReactionBadge
    : styles.whatsappReactionPillContainer;

  const multiReactionLightStyle = reactionValues.length > 1
    ? {
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderColor: 'rgba(148,163,184,0.28)',
      }
    : null;

  return (
    <Animated.View
      style={[
        badgeStyle,
        multiReactionLightStyle,
        {
          opacity: reactionOpacity,
          transform: [{ scale: reactionScale }],
        },
      ]}
    >
      <TouchableOpacity onPress={() => onRemove(item.id)} activeOpacity={0.8} style={reactionValues.length > 1 ? styles.whatsappReactionInner : undefined}>
        <Text style={{ fontSize: reactionValues.length === 1 ? 16 : 13 }}>
          {uniqueEmojis.slice(0, 2).join('')}
        </Text>
        {reactionValues.length > 1 && (
          <Text style={styles.whatsappReactionCountText}>{reactionValues.length}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ───────────── Full-screen image viewer with pinch / double-tap / button zoom ─────────────
const MAX_ZOOM = 5;
const ZoomableImage = ({ uri, onClose }: { uri: string; onClose: () => void }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const st = useRef({
    scale: 1, x: 0, y: 0,
    startDist: 0, startScale: 1, pinching: false,
    lastX: 0, lastY: 0, lastCount: 0, lastTap: 0, moved: false,
  }).current;
  const [zoomLabel, setZoomLabel] = useState(100);

  const clampPos = () => {
    const maxX = (SCREEN_WIDTH * (st.scale - 1)) / 2;
    const maxY = (SCREEN_HEIGHT * (st.scale - 1)) / 2;
    st.x = Math.max(-maxX, Math.min(maxX, st.x));
    st.y = Math.max(-maxY, Math.min(maxY, st.y));
  };
  const apply = (animated: boolean) => {
    clampPos();
    setZoomLabel(Math.round(st.scale * 100));
    if (animated) {
      Animated.parallel([
        Animated.timing(scale, { toValue: st.scale, duration: 160, useNativeDriver: false }),
        Animated.timing(tx, { toValue: st.x, duration: 160, useNativeDriver: false }),
        Animated.timing(ty, { toValue: st.y, duration: 160, useNativeDriver: false }),
      ]).start();
    } else {
      scale.setValue(st.scale); tx.setValue(st.x); ty.setValue(st.y);
    }
  };
  const zoomTo = (next: number) => {
    st.scale = Math.max(1, Math.min(MAX_ZOOM, next));
    if (st.scale <= 1.02) { st.scale = 1; st.x = 0; st.y = 0; }
    apply(true);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const t = e.nativeEvent.touches;
        st.pinching = false; st.moved = false;
        st.lastCount = t.length;
        st.lastX = t[0]?.pageX || 0; st.lastY = t[0]?.pageY || 0;
      },
      onPanResponderMove: (e) => {
        const t = e.nativeEvent.touches;
        if (t.length >= 2) {
          const dx = t[0].pageX - t[1].pageX;
          const dy = t[0].pageY - t[1].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (!st.pinching || st.lastCount < 2) {
            st.pinching = true; st.startDist = dist || 1; st.startScale = st.scale;
          }
          st.scale = Math.max(0.8, Math.min(MAX_ZOOM, st.startScale * (dist / st.startDist)));
          st.moved = true;
          st.lastCount = t.length;
          clampPos();
          setZoomLabel(Math.round(st.scale * 100));
          scale.setValue(st.scale); tx.setValue(st.x); ty.setValue(st.y);
          return;
        }
        const cx = t[0]?.pageX || 0; const cy = t[0]?.pageY || 0;
        if (st.lastCount !== t.length) {
          // finger count changed (pinch -> one finger): restart from this point
          st.lastCount = t.length; st.lastX = cx; st.lastY = cy;
          return;
        }
        const ddx = cx - st.lastX; const ddy = cy - st.lastY;
        st.lastX = cx; st.lastY = cy;
        if (Math.abs(ddx) + Math.abs(ddy) > 1) st.moved = true;
        if (st.scale > 1) {
          st.x += ddx; st.y += ddy;
          clampPos();
          tx.setValue(st.x); ty.setValue(st.y);
        }
      },
      onPanResponderRelease: () => {
        const wasPinch = st.pinching;
        st.pinching = false; st.lastCount = 0;
        if (st.scale < 1.02) { st.scale = 1; st.x = 0; st.y = 0; apply(true); }
        else { apply(false); }
        // double tap = toggle zoom
        if (!st.moved && !wasPinch) {
          const nowMs = Date.now();
          if (nowMs - st.lastTap < 300) {
            st.lastTap = 0;
            if (st.scale > 1) { st.scale = 1; st.x = 0; st.y = 0; apply(true); }
            else { st.scale = 2.5; apply(true); }
          } else {
            st.lastTap = nowMs;
          }
        }
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  return (
    <View style={styles.imagePreviewBackdrop}>
      <View style={{ flex: 1, width: '100%' }} {...pan.panHandlers}>
        <Animated.Image
          source={{ uri }}
          resizeMode="contain"
          style={{
            width: '100%',
            height: '100%',
            transform: [{ translateX: tx }, { translateY: ty }, { scale }],
          }}
        />
      </View>

      <TouchableOpacity style={styles.imagePreviewClose} onPress={onClose} activeOpacity={0.8}>
        <X size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={{ position: 'absolute', bottom: 36, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 28, paddingHorizontal: 8 }}>
        <TouchableOpacity style={{ padding: 12 }} onPress={() => zoomTo(st.scale - 0.75)} activeOpacity={0.7}>
          <ZoomOut size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13, minWidth: 48, textAlign: 'center' }}>{zoomLabel}%</Text>
        <TouchableOpacity style={{ padding: 12 }} onPress={() => zoomTo(st.scale + 0.75)} activeOpacity={0.7}>
          <ZoomIn size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ───────────── @mention helpers ─────────────
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
const makeUsernameBase = (raw: string): string => {
  let b = (raw || '').toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 14);
  if (b.length < 3) b = (b + 'user').slice(0, 14);
  return b;
};

// Message text with @mentions highlighted
// Links in a message. Only ADMIN messages are shown as tappable links; a member's text stays plain text.
const LINK_SPLIT_REGEX = /((?:https?:\/\/|www\.)[^\s]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|in|io|co|me|app|ly|link|xyz|info|biz|us|uk|tv|gl|be|to|cc|ai|dev|site|online|store|shop|live|club|top|page|gle)\b(?:\/[^\s]*)?)/gi;
const openChatLink = (raw: string) => {
  let url = raw.trim().replace(/[.,;:!?)]+$/, '');
  if (!/^[a-z]+:\/\//i.test(url)) url = 'https://' + url;
  Linking.openURL(url).catch(() => Alert.alert('Cannot open link', 'No app found to open this link.'));
};

const MentionText = ({ text, highlight, baseColor, mineColor, isMe, linkify }: any) => {
  const str = String(text || '');
  if (linkify) {
    const pieces = str.split(LINK_SPLIT_REGEX);
    return (
      <Text style={{ color: baseColor, fontSize: 16, lineHeight: 23 }}>
        {pieces.map((part, i) => {
          if (!part) return null;
          const isLink = i % 2 === 1; // split() with a capture group puts the links at the odd positions
          return isLink ? (
            <Text
              key={i}
              onPress={() => openChatLink(part)}
              style={{ color: isMe ? '#FFFFFF' : '#2563EB', textDecorationLine: 'underline', fontWeight: '700' }}
            >
              {part}
            </Text>
          ) : (
            <Text key={i}>{part}</Text>
          );
        })}
      </Text>
    );
  }
  if (!highlight) return <Text style={{ color: baseColor, fontSize: 16, lineHeight: 23 }}>{str}</Text>;
  const parts = str.split(/(@[a-zA-Z0-9_.]{3,20})/g);
  return (
    <Text style={{ color: baseColor, fontSize: 16, lineHeight: 23 }}>
      {parts.map((part, i) =>
        /^@[a-zA-Z0-9_.]{3,20}$/.test(part) ? (
          <Text key={i} style={{ fontWeight: '800', color: isMe ? '#FFFFFF' : mineColor, textDecorationLine: isMe ? 'underline' : 'none' }}>{part}</Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
};

// ───────────── Members list modal (own component, so the big screen does not re-render with it) ─────────────
const MemberRow = React.memo(function MemberRow({ item, isMe, isAdmin, now, colors, onKick }: any) {
  const online = isPresenceFresh(item, now);
  return (
    <View style={[styles.memberItemRow, { borderColor: colors.border }]}>
      <View style={[styles.memberAvatarCircle, { backgroundColor: getAvatarColor(item.userName) }]}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.memberImg} />
        ) : (
          <Text style={styles.memberAvatarInitial}>{(item.userName || 'U').charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.memberNameText, { color: colors.textPrimary }]}>
          {item.userName} {isMe ? '(You)' : ''}
        </Text>
        {!!item.username && (
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>@{item.username}</Text>
        )}
        <Text style={{ fontSize: 11, color: online ? '#10B981' : colors.textSecondary, marginTop: 1 }}>
          {online ? 'Online' : (item.lastActive ? `Last seen ${formatTimeAgo(item.lastActive, now)}` : 'Last seen unavailable')}
        </Text>
      </View>
      <View style={[styles.memberStatusDot, { backgroundColor: online ? '#10B981' : '#64748B' }]} />
      {isAdmin && !isMe && (
        <TouchableOpacity style={styles.adminKickBtn} onPress={() => onKick(item)} activeOpacity={0.7}>
          <UserX size={15} color="#EF4444" />
        </TouchableOpacity>
      )}
    </View>
  );
});

const MembersModal = React.memo(function MembersModal({ visible, onClose, members, total, myUid, isAdmin, isDarkMode, colors, primaryColor, onKick }: any) {
  const [now, setNow] = useState(Date.now());

  // The "online" clock runs only while the list is open
  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, [visible]);

  const sorted = React.useMemo(() => {
    if (!visible) return [];
    const ms = (m: any) => (hasToDate(m?.lastActive) ? m.lastActive.toDate().getTime() : 0);
    return [...members].sort((a: any, b: any) => {
      const oa = isPresenceFresh(a, now) ? 1 : 0;
      const ob = isPresenceFresh(b, now) ? 1 : 0;
      return ob - oa || ms(b) - ms(a);
    });
  }, [visible, members, now]);

  const renderItem = React.useCallback(
    ({ item }: any) => (
      <MemberRow item={item} isMe={item.uid === myUid} isAdmin={isAdmin} now={now} colors={colors} onKick={onKick} />
    ),
    [myUid, isAdmin, now, colors, onKick]
  );

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose} hardwareAccelerated>
      <View style={styles.membersModalOverlay}>
        {/* Tap outside to close. It is a sibling of the card, so it never steals the list's scroll touches. */}
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={[styles.membersModalCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.membersModalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Users size={20} color={primaryColor} />
              <Text style={[styles.membersModalTitle, { color: colors.textPrimary }]}>Group Members ({total})</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {members.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={primaryColor} />
              <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 13 }}>Loading members...</Text>
            </View>
          ) : (
            <FlatList
              data={sorted}
              keyExtractor={(item: any) => item.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8 }}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews
              nestedScrollEnabled
            />
          )}
        </View>
      </View>
    </Modal>
  );
});

export default function CommunityScreen({ navigation, route }: any) {
  const themeContext = useTheme() as any;
  const isDarkMode = themeContext?.isDarkMode ?? false;
  const t = themeContext?.t;
  const currentUser = auth().currentUser;

  const colors = themeContext?.theme?.colors || {
    primary: '#6366F1', 
    primaryGlow: 'rgba(99, 102, 241, 0.25)',
    bgLight: isDarkMode ? '#0F172A' : '#F8FAFC',
    bgCard: isDarkMode ? '#1E293B' : '#FFFFFF',
    border: isDarkMode ? '#334155' : '#E2E8F0',
    textPrimary: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B'
  };

  const primaryColor = colors.primary || '#6366F1';

  const TABS = [
    { title: t?.community?.feed || 'Feed', icon: 'sparkles' },
    { title: 'Chats', icon: 'chat' },
    { title: t?.community?.challenges || 'Challenges', icon: 'trophy' },
    { title: t?.community?.leaderboard || 'Leaderboard', icon: 'flame' }
  ];
  
  const [activeTab, setActiveTab] = useState(1);
  const pagerRef = useRef<ScrollView>(null);

  const currentEmailClean = (currentUser?.email || '').toLowerCase().trim();
  const initialIsAdmin = KNOWN_ADMIN_EMAILS.includes(currentEmailClean);
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);

  // Feed admin = the same `admins` collection the Admin Panel and Voice Rooms use.
  // (Not the fixed email list above, which only controls group-chat powers.)
  const [isFeedAdmin, setIsFeedAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    const rawEmail = (currentUser?.email || '').trim();
    if (!rawEmail) {
      setIsFeedAdmin(false);
      return;
    }
    const emails = Array.from(new Set([rawEmail.toLowerCase(), rawEmail]));
    firestore()
      .collection('admins')
      .where('email', 'in', emails)
      .limit(1)
      .get()
      .then((snap: any) => { if (alive) { setIsFeedAdmin(!snap.empty); if (!snap.empty) setIsAdmin(true); } })
      .catch(() => { if (alive) setIsFeedAdmin(false); });
    return () => { alive = false; };
  }, [currentUser?.email]);

  const [isMember, setIsMember] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [communityMembersList, setCommunityMembersList] = useState<any[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [onlineMembers, setOnlineMembers] = useState(0);
  const [showThreeDotsMenu, setShowThreeDotsMenu] = useState(false);
  const [showMembersListModal, setShowMembersListModal] = useState(false);
  const closeMembersModal = React.useCallback(() => setShowMembersListModal(false), []);
  const kickFromList = React.useCallback((m: any) => {
    setMemberToKick(m);
    setShowKickConfirmModal(true);
  }, []);
  // Name / photo cache, so a heartbeat update does not re-read every user document
  const memberProfileCache = useRef<Record<string, { userName: string; photoURL: string; username?: string }>>({});
  // Member documents whose account no longer exists (leftover / duplicate documents)
  const orphanMemberRef = useRef<Record<string, boolean>>({});

  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const isSelectionMode = selectedMessageIds.length > 0;

  const [showUndoToast, setShowUndoToast] = useState(false);
  const [pendingDeletedMessages, setPendingDeletedMessages] = useState<any[]>([]);
  const undoTimeoutRef = useRef<any>(null);

  const [editingMessage, setEditingMessage] = useState<any>(null);

  const [showJoinConfirmModal, setShowJoinConfirmModal] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const [memberToKick, setMemberToKick] = useState<any>(null);
  const [showKickConfirmModal, setShowKickConfirmModal] = useState(false);
  const [isKicking, setIsKicking] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState<any>({ id: 'ecc_community_chat', title: 'ECC Community Chat' });
  const [isChatModalVisible, setIsChatModalVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const [msgLimit, setMsgLimit] = useState(80); // only the newest messages are loaded; older ones load while scrolling up
  const pendingJumpRef = useRef<string | null>(null);
  const [chatInputText, setChatInputText] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  const [savedKeyboardHeight, setSavedKeyboardHeight] = useState(Platform.OS === 'ios' ? 290 : 270);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  const mediaTrayAnim = useRef(new Animated.Value(0)).current;
  const emojiTrayAnim = useRef(new Animated.Value(0)).current;
  const reactionAnim = useRef(new Animated.Value(0)).current;
  const shineAnim = useRef(new Animated.Value(0.6)).current;

  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const chatListRef = useRef<FlatList<any>>(null);
  const [myUsername, setMyUsername] = useState('');
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameBusy, setUsernameBusy] = useState(false);
  const pendingOpenMessageId = useRef<string | null>(null);
  const [selectedMessageForAction, setSelectedMessageForAction] = useState<any>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [recordTime, setRecordTime] = useState('00:00');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const timerRef = useRef<any>(null);
  const activeSoundRef = useRef<any>(null);

  const [posts, setPosts] = useState<any[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [challengesData, setChallengesData] = useState<any[]>(DEFAULT_QUIZ_CHALLENGES);
  const [completedQuizIds, setCompletedQuizIds] = useState<string[]>(['quiz_challenge_2']);
  const [leaderboardUsers, setLeaderboardUsers] = useState<any[]>([]);

  // Quiz States
  const [isStudentQuizModalVisible, setIsStudentQuizModalVisible] = useState(false);
  const [currentTakingQuiz, setCurrentTakingQuiz] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userSelectedOption, setUserSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [calculatedScore, setCalculatedScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [quizTimerSeconds, setQuizTimerSeconds] = useState(15);
  const quizTimerRef = useRef<any>(null);

  // Word Zip States
  const [isZipScreenVisible, setIsZipScreenVisible] = useState(false);
  const [activeZipIndex, setActiveZipIndex] = useState(0);
  const [selectedTappedCells, setSelectedTappedCells] = useState<{ r: number; c: number; char: string }[]>([]);
  const [completedZipCells, setCompletedZipCells] = useState<{ r: number; c: number }[]>([]);
  const [completedZipWords, setCompletedZipWords] = useState<{ word: string; meaning: string }[]>([]);
  const [tapValidationStatus, setTapValidationStatus] = useState<'idle' | 'success' | 'wrong'>('idle');
  const [zipConfetti, setZipConfetti] = useState(false);

  const [isResultsModalVisible, setIsResultsModalVisible] = useState(false);
  const [puzzlePlayedUsers, setPuzzlePlayedUsers] = useState<any[]>([]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shineAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shineAnim, {
          toValue: 0.55,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [shineAnim]);

  useEffect(() => {
    if (selectedMessageForAction) {
      Animated.timing(reactionAnim, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      reactionAnim.setValue(0);
    }
  }, [selectedMessageForAction]);

  const openMediaPicker = () => {
    setShowEmojiPicker(false);
    setShowMediaPicker(true);
    Animated.timing(mediaTrayAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const closeMediaPicker = () => {
    Animated.timing(mediaTrayAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setShowMediaPicker(false));
  };

  useEffect(() => {
    const unsubMembers = firestore()
      .collection('community_members')
      .where('membershipStatus', '==', 'approved')
      .onSnapshot((snap: any) => {
        const rawList = snap?.docs?.map((doc: any) => ({ id: doc.id, ...doc.data() })) || [];
        setCommunityMembersList(rawList);
        setTotalMembers(rawList.length);

        // One person = one row: leftover documents of the same account are hidden
        const finalize = (list: any[]) => {
          const orphans = orphanMemberRef.current;
          const nameOf = (m: any) => String(m.userName || '').trim().toLowerCase();
          const emailOf = (m: any) => (typeof m.email === 'string' ? m.email.trim().toLowerCase() : '');
          const realNames = new Set(list.filter((m) => !orphans[m.uid]).map(nameOf));
          const ordered = [...list].sort((a, b) => (orphans[a.uid] ? 1 : 0) - (orphans[b.uid] ? 1 : 0));
          const seen = new Set<string>();
          const out: any[] = [];
          ordered.forEach((m) => {
            if (orphans[m.uid] && realNames.has(nameOf(m))) return; // leftover copy of an account that exists
            const keys = [`u:${m.uid}`, ...(emailOf(m) ? [`e:${emailOf(m)}`] : [])];
            if (keys.some((k) => seen.has(k))) return;
            keys.forEach((k) => seen.add(k));
            out.push(m);
          });
          setCommunityMembersList(out);
          setTotalMembers(out.length);
        };

        if (currentUser?.uid) {
          const me = rawList.find((member: any) => (member.uid || member.id) === currentUser.uid);
          setIsMember(!!me);
        } else {
          setIsMember(false);
        }

        const cache = memberProfileCache.current;
        const withProfile = (member: any) => {
          const uid = member.uid || member.id;
          const c = uid ? cache[uid] : undefined;
          return c ? { ...member, uid, userName: c.userName, photoURL: c.photoURL, username: c.username } : { ...member, uid };
        };
        // Show the list immediately with what we already know
        finalize(rawList.map(withProfile));

        // Read profiles only for members we have not seen yet
        const missing = rawList.map((m: any) => m.uid || m.id).filter((uid: string) => uid && !cache[uid]);
        if (missing.length === 0) return;
        Promise.all(
          missing.map(async (uid: string) => {
            try {
              const userSnap = await firestore().collection('users').doc(uid).get();
              if (snapshotExists(userSnap)) {
                const user = userSnap.data() || {};
                const m = rawList.find((x: any) => (x.uid || x.id) === uid) || {};
                cache[uid] = {
                  userName: user.fullName || user.name || m.userName || 'Learner',
                  photoURL: user.photoURL || m.photoURL || '',
                  username: user.username || '',
                };
              } else {
                const m = rawList.find((x: any) => (x.uid || x.id) === uid) || {};
                orphanMemberRef.current[uid] = true;
                cache[uid] = { userName: m.userName || 'Learner', photoURL: m.photoURL || '', username: '' };
              }
            } catch (_) {}
          })
        )
          .then(() => finalize(rawList.map(withProfile)))
          .catch(() => {});
      }, (err) => console.log('Members load error:', err));

    return () => unsubMembers();
  }, [currentUser?.uid]);

  // The members list holds only approved member documents. An admin usually has none, so the admin's own
  // row ("You") is added here, otherwise the admin never sees their own name in the list.
  const membersForModal = React.useMemo(() => {
    const me = currentUser;
    if (!me || !(isMember || isAdmin)) return communityMembersList;
    if (communityMembersList.some((m: any) => (m.uid || m.id) === me.uid)) return communityMembersList;
    const nowDate = new Date();
    return [
      {
        uid: me.uid,
        id: me.uid,
        userName: me.displayName || me.email?.split('@')[0] || 'Admin',
        photoURL: me.photoURL || '',
        username: myUsername,
        isChatActive: true,
        lastActive: nowDate,
        appOnlineAt: nowDate,
      },
      ...communityMembersList,
    ];
  }, [communityMembersList, currentUser?.uid, isMember, isAdmin, myUsername]);

  // ───────── ONLINE COUNT ─────────
  // Recomputed every 30 seconds, so members who left drop out of the count even when nothing else changes.
  const [presenceNow, setPresenceNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setPresenceNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  // ───────── "ONLINE" WHILE USING THE COMMUNITY SCREEN ─────────
  // Before, a member counted as online only with the group chat open, so the card said "Offline" while
  // people were using the Community tab. Now a member is online while this screen is in front.
  // (isChatActive keeps its own meaning, "chat is open", which the chat push notifications rely on.)
  const [screenFocused, setScreenFocused] = useState(true);
  useEffect(() => {
    if (!navigation?.addListener) return;
    const unsubFocus = navigation.addListener('focus', () => setScreenFocused(true));
    const unsubBlur = navigation.addListener('blur', () => setScreenFocused(false));
    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]);

  // Online count. "Me" is always counted from my own state (not from the list), because the list only holds
  // members with membershipStatus "approved" and an admin may have no member document at all.
  useEffect(() => {
    const myUid = currentUser?.uid;
    let count = 0;
    communityMembersList.forEach((m: any) => {
      if ((m.uid || m.id) === myUid) return;
      if (isPresenceFresh(m, presenceNow)) count += 1;
    });
    const iAmOnline = !!myUid && (isMember || isAdmin) && (screenFocused || isChatModalVisible);
    setOnlineMembers(count + (iAmOnline ? 1 : 0));
  }, [communityMembersList, presenceNow, screenFocused, isChatModalVisible, isMember, isAdmin, currentUser?.uid]);

  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid || !(isMember || isAdmin)) return;
    const ref = firestore().collection('community_members').doc(uid);

    const beat = () => {
      if (AppState.currentState !== 'active') return;
      ref.set({ appOnlineAt: firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
    };

    if (!screenFocused) {
      ref.set({ appOnlineAt: firestore.FieldValue.delete() }, { merge: true }).catch(() => {});
      return;
    }

    beat();
    const timer = setInterval(beat, 30 * 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') beat();
      else ref.set({ appOnlineAt: firestore.FieldValue.delete() }, { merge: true }).catch(() => {});
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [screenFocused, isMember, isAdmin, currentUser?.uid]);

  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) return;

    const presenceRef = firestore()
      .collection('community_members')
      .doc(uid);

    const markOnline = async () => {
      try {
        await presenceRef.set(
          {
            isChatActive: true,
            lastActive: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.log('Presence online update error:', e);
      }
    };

    const chatAllowed = isMember || isAdmin;

    if (isChatModalVisible && chatAllowed) {
      markOnline();

      const heartbeatRef = setInterval(() => {
        if (AppState.currentState === 'active') {
          markOnline();
        }
      }, 30 * 1000);

      return () => {
        clearInterval(heartbeatRef);
      };
    }

    return undefined;
  }, [isChatModalVisible, isMember, isAdmin, currentUser?.uid]);

  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) return;

    const presenceRef = firestore()
      .collection('community_members')
      .doc(uid);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        nextState !== 'active' &&
        isChatModalVisible &&
        (isMember || isAdmin)
      ) {
        presenceRef
          .set(
            {
              isChatActive: false,
              lastSeen: firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
          .catch(() => {});
      } else if (
        nextState === 'active' &&
        isChatModalVisible &&
        (isMember || isAdmin)
      ) {
        presenceRef
          .set(
            {
              isChatActive: true,
              lastActive: firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
          .catch(() => {});
      }
    });

    return () => subscription.remove();
  }, [currentUser?.uid, isChatModalVisible, isMember, isAdmin]);

  const handleExecuteJoinCommunity = async () => {
    if (!currentUser?.uid) {
      setShowJoinConfirmModal(false);
      Alert.alert('Sign In Required', 'Please sign in to join the community.');
      return;
    }

    if (isAdmin) {
      setShowJoinConfirmModal(false);
      setSelectedGroup({ id: 'ecc_community_chat', title: 'ECC Community Chat' });
      setIsChatModalVisible(true);
      return;
    }

    setIsJoining(true);
    try {
      const uid = currentUser.uid;

      // Read the profile and clear any old join request at the same time
      const [userSnap] = await Promise.all([
        firestore().collection('users').doc(uid).get().catch(() => null),
        firestore().collection('community_join_requests').doc(uid).delete().catch(() => {}),
      ]);
      const profile: any = userSnap && snapshotExists(userSnap) ? userSnap.data() || {} : {};

      const userName =
        profile.fullName ||
        profile.name ||
        currentUser.displayName ||
        currentUser.email?.split('@')[0] ||
        'Learner';
      const photoURL = profile.photoURL || currentUser.photoURL || '';

      await firestore().collection('community_members').doc(uid).set({
        uid,
        userName,
        photoURL,
        email: currentUser.email || profile.email || '',
        membershipStatus: 'approved',
        joinedAt: firestore.FieldValue.serverTimestamp(),
        isChatActive: false,
        lastActive: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      setIsMember(true);
      setShowJoinConfirmModal(false);
      setShowThreeDotsMenu(false);
      setSelectedGroup({ id: 'ecc_community_chat', title: 'ECC Community Chat' });
      setIsChatModalVisible(true);
    } catch (err: any) {
      Alert.alert('Join Failed', err?.message || 'Unable to join the community.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleExecuteLeaveCommunity = async () => {
    if (!currentUser?.uid) return;
    setIsLeaving(true);
    try {
      await firestore().collection('community_members').doc(currentUser.uid).delete();
      await firestore().collection('community_join_requests').doc(currentUser.uid).delete().catch(() => {});
      setIsMember(false);
      setShowLeaveConfirmModal(false);
      setShowThreeDotsMenu(false);
      closeChatModal();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to leave group.');
    } finally {
      setIsLeaving(false);
    }
  };

  const handleExecuteAdminKick = async () => {
    if (!isAdmin || !memberToKick) return;
    setIsKicking(true);
    try {
      const kickedUid = memberToKick.uid || memberToKick.id;
      await firestore().collection('community_members').doc(kickedUid).delete();
      await firestore().collection('community_join_requests').doc(kickedUid).delete().catch(() => {});
      setShowKickConfirmModal(false);
      setMemberToKick(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsKicking(false);
    }
  };

  const openChatModal = (groupData: any = { id: 'ecc_community_chat', title: 'ECC Community Chat' }) => {
    if (!isMember && !isAdmin) {
      setShowJoinConfirmModal(true);
      return;
    }
    setSelectedGroup(groupData);
    setIsChatModalVisible(true);
    setShowEmojiPicker(false);
    setShowMediaPicker(false);
    setShowThreeDotsMenu(false);
    setSelectedMessageIds([]);
    setEditingMessage(null);
  };

  // Opened from a notification (e.g. @mention): open the group chat and jump to the message
  const [pendingOpenGroup, setPendingOpenGroup] = useState<string | null>(null);
  useEffect(() => {
    const gid = route?.params?.openGroupId;
    if (!gid) return;
    pendingOpenMessageId.current = route?.params?.messageId || null;
    setPendingOpenGroup(gid);
  }, [route?.params?.openGroupId, route?.params?.messageId, route?.params?.openedAt]);

  useEffect(() => {
    if (!pendingOpenGroup) return;
    if (!isMember && !isAdmin) return; // wait until membership is known
    openChatModal({ id: pendingOpenGroup, title: 'ECC Community Chat' });
    setPendingOpenGroup(null);
  }, [pendingOpenGroup, isMember, isAdmin]);

  useEffect(() => {
    const id = pendingOpenMessageId.current;
    if (!id || !isChatModalVisible) return;
    if (!chatMessages.some((m: any) => m.id === id)) return;
    pendingOpenMessageId.current = null;
    setTimeout(() => scrollToMessage(id), 600);
  }, [chatMessages, isChatModalVisible]);

  const closeChatModal = () => {
    Keyboard.dismiss();

    const uid = currentUser?.uid;

    if (uid && isChatModalVisible && (isMember || isAdmin)) {
      firestore()
        .collection('community_members')
        .doc(uid)
        .set(
          {
            isChatActive: false,
            lastSeen: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
        .catch(() => {});
    }

    setShowEmojiPicker(false);
    setIsChatModalVisible(false);
    setShowMediaPicker(false);
    setShowThreeDotsMenu(false);
    setSelectedMessageForAction(null);
    setSelectedMessageIds([]);
    setEditingMessage(null);
    setChatInputText('');

    if (activeSoundRef.current) {
      try {
        activeSoundRef.current.stop();
        activeSoundRef.current.release();
      } catch (e) {}

      activeSoundRef.current = null;
    }

    setPlayingAudioId(null);
  };

  // Lets the backend (Firestore/Storage rules) recognise admins/sub-admins from the `admins` lists.
  // Safe to call repeatedly; it only registers this user if they really are in those lists.
  useEffect(() => {
    if (!isAdmin || !currentUser?.uid) return;
    functions().httpsCallable('syncChatAdmin')({}).catch(() => {});
  }, [isAdmin, currentUser?.uid]);

  // Members can delete only their own messages. Admins can delete any message.
  const isOwnChatMessage = (item: any) => !!item && !!currentUser?.uid && item.senderId === currentUser.uid;
  const canOpenDeleteForMessage = (item: any) => !!item && (isAdmin || isOwnChatMessage(item));

  const canDeleteForEveryone = (item: any) => {
    if (!item) return false;
    if (isAdmin) return true;
    if (item.senderId !== currentUser?.uid) return false;

    const createdDate = hasToDate(item.createdAt)
      ? item.createdAt.toDate()
      : new Date(item.createdAt);
    if (Number.isNaN(createdDate.getTime())) return false;

    return Date.now() - createdDate.getTime() <= DELETE_FOR_EVERYONE_WINDOW_MS;
  };

  const handleMessagePress = (item: any) => {
    if (isSelectionMode) {
      toggleSelectMessage(item.id);
      return;
    }
    if (item?.uploading || !item?.mediaUrl) return;
    if (item.type === 'image') {
      setPreviewImageUrl(item.mediaUrl);
    } else if (item.type === 'file') {
      Linking.openURL(item.mediaUrl).catch(() =>
        Alert.alert('Cannot open file', 'No app found to open this file.')
      );
    }
  };

  const handleMessageLongPress = (item: any) => {
    toggleSelectMessage(item.id);
  };

  const toggleSelectMessage = (id: string) => {
    setSelectedMessageIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(mId => mId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const clearSelectionMode = () => {
    setSelectedMessageIds([]);
  };

  const handleOpenReactionTray = (item: any) => {
    if (isSelectionMode) return;
    setSelectedMessageForAction(item);
  };

  const getSingleSelectedEditableMessage = () => {
    if (selectedMessageIds.length !== 1) return null;
    const targetMsg = chatMessages.find(m => m.id === selectedMessageIds[0]);
    if (!targetMsg || ['voice', 'image', 'file'].includes(targetMsg.type)) return null;
    if (targetMsg.senderId !== (currentUser?.uid || 'guest_user')) return null;

    const createdDate = hasToDate(targetMsg.createdAt) ? targetMsg.createdAt.toDate() : new Date(targetMsg.createdAt);
    const diffMs = Date.now() - createdDate.getTime();
    if (diffMs > 2 * 60 * 1000) return null;

    return targetMsg;
  };

  const handleTriggerEditSelectedMessage = () => {
    const targetMsg = getSingleSelectedEditableMessage();
    if (!targetMsg) return;

    setEditingMessage(targetMsg);
    setChatInputText(targetMsg.text || '');
    clearSelectionMode();
  };

  const handleCancelInlineEdit = () => {
    setEditingMessage(null);
    setChatInputText('');
  };

  useEffect(() => {
    const onKeyboardShow = (e: any) => {
      setShowEmojiPicker(false);
      const kHeight = e?.endCoordinates?.height || 280;
      if (kHeight > 100) {
        setSavedKeyboardHeight(kHeight);
      }
    };

    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onKeyboardShow);
    return () => {
      showSub.remove();
    };
  }, []);

  // Android (edge-to-edge) does not always resize a Modal when the keyboard opens, which hid the message box.
  // We read the keyboard height ourselves, unless the window already shrank on its own.
  const [kbInset, setKbInset] = useState(0);
  const chatOuterH = useRef(0);
  const chatBaseH = useRef(0);
  const kbShown = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e: any) => {
      kbShown.current = true;
      const h = e?.endCoordinates?.height || 0;
      setTimeout(() => {
        const resizedByWindow = chatBaseH.current - chatOuterH.current > 80;
        setKbInset(kbShown.current && !resizedByWindow ? h : 0);
      }, 120);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      kbShown.current = false;
      setKbInset(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const handleToggleEmojiOrKeyboard = () => {
    setShowMediaPicker(false);

    if (showEmojiPicker) {
      setShowEmojiPicker(false);
      emojiTrayAnim.setValue(0);
      requestAnimationFrame(() => {
        textInputRef.current?.focus();
      });
      return;
    }

    setShowEmojiPicker(true);
    emojiTrayAnim.setValue(0);
    Animated.timing(emojiTrayAnim, {
      toValue: 1,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    Keyboard.dismiss();
  };

  // Smooth Tab Navigation: Handles both click and touch-slider gestures
  const handleTabPress = (idx: number) => {
    setActiveTab(idx);
    pagerRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
  };

  const handleMomentumScrollEnd = (e: any) => {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(contentOffsetX / SCREEN_WIDTH);
    if (pageIndex >= 0 && pageIndex < TABS.length) {
      setActiveTab(pageIndex);
    }
  };

  const playQuizSound = (isCorrect: boolean) => {
    if (!SoundPlayer) return;
    const candidateFiles = isCorrect ? ['correct_sound.wav'] : ['wrong_sound.wav'];
    const playCandidate = (index: number) => {
      if (index >= candidateFiles.length) return;
      try {
        const sound = new SoundPlayer(candidateFiles[index], SoundPlayer.MAIN_BUNDLE, (error: any) => {
          if (error) { playCandidate(index + 1); return; }
          if (typeof sound.setSpeakerphoneOn === 'function') sound.setSpeakerphoneOn(true);
          sound.play(() => { try { sound.release(); } catch (e) {} });
        });
      } catch (e) { playCandidate(index + 1); }
    };
    playCandidate(0);
  };

  const playQuizCompletionSound = () => {
    if (!SoundPlayer) return;
    const candidateFiles = ['party_boom.wav', 'party-boom.wav', 'partyboom.wav', 'celebration.wav', 'quiz_complete.wav', 'correct_sound.wav'];
    const playCandidate = (index: number) => {
      if (index >= candidateFiles.length) return;
      try {
        const sound = new SoundPlayer(candidateFiles[index], SoundPlayer.MAIN_BUNDLE, (error: any) => {
          if (error) { playCandidate(index + 1); return; }
          if (typeof sound.setSpeakerphoneOn === 'function') sound.setSpeakerphoneOn(true);
          sound.play(() => { try { sound.release(); } catch (e) {} });
        });
      } catch (e) { playCandidate(index + 1); }
    };
    playCandidate(0);
  };

  const openWordZipScreen = (index = 0) => {
    setActiveZipIndex(index);
    setSelectedTappedCells([]);
    setCompletedZipCells([]);
    setCompletedZipWords([]);
    setTapValidationStatus('idle');
    setZipConfetti(false);
    setIsZipScreenVisible(true);
  };

  const handleTapCell = (r: number, c: number, char: string) => {
    const existingIndex = selectedTappedCells.findIndex(item => item.r === r && item.c === c);
    if (existingIndex !== -1) {
      if (existingIndex === selectedTappedCells.length - 1) {
        setSelectedTappedCells(prev => prev.slice(0, -1));
      }
      return;
    }

    setSelectedTappedCells(prev => [...prev, { r, c, char }]);
    setTapValidationStatus('idle');
  };

  const handleClearTappedWord = () => {
    setSelectedTappedCells([]);
    setTapValidationStatus('idle');
  };

  const handleCheckTappedWord = () => {
    if (selectedTappedCells.length < 2) return;

    const constructedWord = selectedTappedCells.map(item => item.char).join('');
    const puzzle = WORD_ZIP_PUZZLES[activeZipIndex % WORD_ZIP_PUZZLES.length];
    const matchedItem = puzzle.words.find(w => w.word === constructedWord);
    const alreadyFound = completedZipWords.some(w => w.word === constructedWord);

    if (matchedItem && !alreadyFound) {
      setTapValidationStatus('success');
      const newlyLocked = selectedTappedCells.map(item => ({ r: item.r, c: item.c }));
      setCompletedZipCells(prev => [...prev, ...newlyLocked]);
      setCompletedZipWords(prev => [matchedItem, ...prev]);
      setZipConfetti(true);
      playQuizSound(true);

      // A solved puzzle counts as today's challenge for the streak (the server decides if it goes up)
      if (currentUser?.uid) {
        recordPracticeActivity('puzzle');
        firestore().collection('users').doc(currentUser.uid).set({
          xp: firestore.FieldValue.increment(20),
          lastPuzzlePlayedAt: firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        firestore().collection('puzzle_results').add({
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Learner',
          word: constructedWord,
          meaning: matchedItem.meaning,
          earnedXP: 20,
          playedAt: firestore.FieldValue.serverTimestamp()
        });
      }

      setTimeout(() => {
        setSelectedTappedCells([]);
        setTapValidationStatus('idle');
        setZipConfetti(false);
      }, 900);
    } else {
      setTapValidationStatus('wrong');
      playQuizSound(false);
      setTimeout(() => {
        setTapValidationStatus('idle');
      }, 700);
    }
  };

  const handleShowHint = () => {
    const puzzle = WORD_ZIP_PUZZLES[activeZipIndex % WORD_ZIP_PUZZLES.length];
    const unfound = puzzle.words.find(w => !completedZipWords.some(c => c.word === w.word));
    if (unfound) {
      Alert.alert("💡 Word Hint", `Search for "${unfound.word.charAt(0)}..." (${unfound.word.length} letters)\nMeaning: ${unfound.meaning}`);
    } else {
      Alert.alert("🎉 Mastered!", "You found all target words in this level!");
    }
  };

  useEffect(() => {
    const unsubPosts = firestore().collection('posts').orderBy('createdAt', 'desc').onSnapshot((snap: any) => {
      let list: any[] = [];
      snap?.forEach((doc: any) => list.push({ id: doc.id, ...doc.data() }));
      setPosts(list);
    });

    const unsubQuiz = firestore().collection('challenges').orderBy('createdAt', 'desc').onSnapshot((snap: any) => {
      if (snap && !snap.empty) {
        let list: any[] = [];
        snap.forEach((doc: any) => list.push({ id: doc.id, ...doc.data() }));
        setChallengesData(list);
      } else {
        setChallengesData(DEFAULT_QUIZ_CHALLENGES);
      }
    });

    let unsubResults = () => {};
    if (currentUser?.uid) {
      unsubResults = firestore().collection('quiz_results').where('userId', '==', currentUser.uid).onSnapshot((snap: any) => {
        let done: string[] = ['quiz_challenge_2'];
        snap?.forEach((doc: any) => done.push(doc.data().quizId));
        setCompletedQuizIds(Array.from(new Set(done)));
      });
    }

    const unsubLB = firestore().collection('users').orderBy('xp', 'desc').limit(20).onSnapshot((snap: any) => {
      let list: any[] = [];
      snap?.forEach((doc: any) => {
        if (doc.data().xp && doc.data().xp > 0) list.push({ id: doc.id, ...doc.data() });
      });
      setLeaderboardUsers(list);
    });

    const unsubPuzzlePlayed = firestore().collection('puzzle_results').orderBy('playedAt', 'desc').limit(25).onSnapshot((snap: any) => {
      let list: any[] = [];
      snap?.forEach((doc: any) => list.push({ id: doc.id, ...doc.data() }));
      setPuzzlePlayedUsers(list);
    });

    return () => {
      unsubPosts();
      unsubQuiz();
      unsubResults();
      unsubLB();
      unsubPuzzlePlayed();
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    setMsgLimit(80);
  }, [selectedGroup?.id]);

  useEffect(() => {
    const targetGroupId = selectedGroup?.id || 'ecc_community_chat';
    return firestore()
      .collection('community_groups')
      .doc(targetGroupId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(msgLimit)
      .onSnapshot((snap: any) => {
        let msgs: any[] = [];
        snap?.forEach((doc: any) => {
          const item: any = { id: doc.id, ...doc.data() };
          const deletedFor = Array.isArray(item?.deletedFor) ? item.deletedFor : [];
          if (currentUser?.uid && deletedFor.includes(currentUser.uid)) {
            return;
          }
          msgs.push(item);
        });
        // keep files that are still uploading so they don't vanish when another message arrives
        setChatMessages(prev => [...prev.filter((m: any) => m.uploading), ...msgs]);
      });
  }, [selectedGroup?.id, msgLimit]);

  // Pinned messages have their own query, so an old pinned message still shows even when it is not in the newest messages
  useEffect(() => {
    const targetGroupId = selectedGroup?.id || 'ecc_community_chat';
    return firestore()
      .collection('community_groups')
      .doc(targetGroupId)
      .collection('messages')
      .where('isPinned', '==', true)
      .onSnapshot((snap: any) => {
        const pinned: any[] = [];
        snap?.forEach((doc: any) => pinned.push({ id: doc.id, ...doc.data() }));
        pinned.sort((x: any, y: any) => {
          const ms = (v: any) => (v && typeof v.toMillis === 'function' ? v.toMillis() : 0);
          return ms(y.createdAt) - ms(x.createdAt);
        });
        setPinnedMessages(pinned);
      }, () => {});
  }, [selectedGroup?.id]);

  useEffect(() => {
    setTimeout(() => {
      pagerRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: false });
    }, 100);
  }, []);

  const handleStartRecording = async () => {
    setShowEmojiPicker(false);
    setShowMediaPicker(false);
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Required', 'Microphone permission is required to record voice notes.');
          return;
        }
      } catch (err) {
        return;
      }
    }

    try {
      const uniqueFileName = `voice_${Date.now()}.wav`;

      AudioRecord.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6,
        wavFile: uniqueFileName
      });
      setIsRecording(true);
      setRecordSecs(0);
      setRecordTime('00:00');

      AudioRecord.start();

      let secs = 0;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        secs += 1;
        setRecordSecs(secs);
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        setRecordTime(`${m}:${s}`);
      }, 1000);

    } catch (e: any) {
      setIsRecording(false);
      Alert.alert('Recording Error', e.message || 'Unable to start recording');
    }
  };

  const handleCancelRecording = async () => {
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      await AudioRecord.stop();
    } catch (e) {}
    setIsRecording(false);
    setRecordSecs(0);
  };

  // ─── Chat media: every file is uploaded to Firebase Storage and the message
  //     (with its download link) is saved in Firestore: community_groups/{id}/messages ───
  const sendMediaMessage = async (p: {
    type: 'voice' | 'image' | 'file';
    localUri: string;
    fileName: string;
    mimeType: string;
    fileSize?: number;
    duration?: number;
  }) => {
    if (!isAdmin && (p.type === 'image' || String(p.mimeType || '').toLowerCase().startsWith('image/') || IMAGE_FILE_REGEX.test(p.fileName))) {
      Alert.alert('Admins only', 'Only admins can send images in the group chat.');
      return;
    }
    const uid = currentUser?.uid;
    const groupId = selectedGroup?.id || 'ecc_community_chat';
    const senderName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
    const label = p.type === 'voice' ? 'Voice Note' : p.type === 'image' ? 'Photo' : p.fileName;

    const tempId = `temp_${Date.now()}`;
    setChatMessages(prev => [{
      id: tempId,
      text: label,
      type: p.type,
      mediaUrl: p.localUri,
      fileName: p.fileName,
      fileSize: p.fileSize || null,
      duration: p.duration || null,
      senderId: uid || 'guest_user',
      senderName,
      senderPhoto: currentUser?.photoURL || null,
      status: 'sending',
      uploading: true,
      reactions: {},
      isPinned: false,
      createdAt: new Date(),
    }, ...prev]);

    try {
      if (!uid) throw new Error('Please log in again.');
      if (!storageLib) {
        throw new Error('File upload is not set up yet. Run: npm i @react-native-firebase/storage, then rebuild the app.');
      }
      const dot = p.fileName.lastIndexOf('.');
      const ext = (dot >= 0 ? p.fileName.slice(dot + 1) : 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
      const storagePath = `community_media/${groupId}/${uid}/${p.type}_${Date.now()}.${ext}`;
      const ref = storageLib().ref(storagePath);
      await ref.putFile(p.localUri, { contentType: p.mimeType });
      const mediaUrl = await ref.getDownloadURL();

      await firestore().collection('community_groups').doc(groupId).collection('messages').add({
        text: label,
        type: p.type,
        mediaUrl,
        storagePath,
        fileName: p.fileName,
        mimeType: p.mimeType,
        fileSize: p.fileSize || null,
        duration: p.duration || null,
        senderId: uid,
        senderName,
        senderPhoto: currentUser?.photoURL || null,
        status: 'sent',
        reactions: {},
        isPinned: false,
        createdAt: firestore.FieldValue.serverTimestamp()
      });
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Could not send. Please try again.');
    } finally {
      setChatMessages(prev => prev.filter((m: any) => m.id !== tempId));
    }
  };

  useEffect(() => {
    const id = pendingJumpRef.current;
    if (!id) return;
    if (chatMessages.some((m: any) => m.id === id)) {
      pendingJumpRef.current = null;
      setTimeout(() => scrollToMessage(id), 350);
    }
  }, [chatMessages]);

  // ───────────── Pinned messages: jump to the original message ─────────────
  const scrollToMessage = (messageId: string) => {
    const idx = chatMessages.findIndex((m: any) => m.id === messageId);
    if (idx < 0) {
      if (msgLimit < 1000) {
        // The message is older than what is loaded: load more, then jump to it
        pendingJumpRef.current = messageId;
        setMsgLimit(1000);
        return;
      }
      Alert.alert('Message not found', 'This message is no longer available.');
      return;
    }
    setHighlightedMsgId(messageId);
    setTimeout(() => setHighlightedMsgId(prev => (prev === messageId ? null : prev)), 2200);
    try {
      chatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
    } catch (_) {}
  };

  const safePinnedIndex = pinnedMessages.length > 0 ? Math.min(pinnedIndex, pinnedMessages.length - 1) : 0;
  const handlePinnedBannerPress = () => {
    if (pinnedMessages.length === 0) return;
    const current = pinnedMessages[safePinnedIndex];
    if (current) scrollToMessage(current.id);
    // next tap goes to the next pinned message (after the last one it starts again from the first)
    setPinnedIndex((safePinnedIndex + 1) % pinnedMessages.length);
  };

  // ───────────── Username (unique @id) ─────────────
  const claimUsername = async (candidate: string, previous?: string): Promise<void> => {
    const uid = currentUser?.uid;
    if (!uid) throw new Error('Please log in again.');
    const db = firestore();
    await db.runTransaction(async (tx: any) => {
      const newRef = db.collection('usernames').doc(candidate);
      const snap = await tx.get(newRef);
      const already = snapshotExists(snap);
      if (already && snap.data()?.uid !== uid) throw new Error('taken');
      if (!already) tx.set(newRef, { uid, createdAt: firestore.FieldValue.serverTimestamp() });
      tx.set(db.collection('users').doc(uid), { username: candidate }, { merge: true });
      if (previous && previous !== candidate) tx.delete(db.collection('usernames').doc(previous));
    });
  };

  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await firestore().collection('users').doc(uid).get();
        const data: any = snap.data() || {};
        if (data.username) { if (!cancelled) setMyUsername(data.username); return; }
        const base = makeUsernameBase(
          data.fullName || data.name || currentUser?.displayName || (currentUser?.email || '').split('@')[0] || 'user'
        );
        for (let attempt = 0; attempt < 6; attempt++) {
          const candidate = attempt === 0 ? base : `${base.slice(0, 15)}${Math.floor(100 + Math.random() * 900)}`;
          try {
            await claimUsername(candidate);
            if (!cancelled) setMyUsername(candidate);
            memberProfileCache.current[uid] = { ...(memberProfileCache.current[uid] || { userName: '', photoURL: '' }), username: candidate };
            return;
          } catch (e: any) {
            if (String(e?.message || '').includes('taken')) continue;
            return;
          }
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [currentUser?.uid]);

  const handleSaveUsername = async () => {
    const name = usernameDraft.trim().toLowerCase().replace(/^@/, '');
    if (!USERNAME_RE.test(name)) {
      Alert.alert('Invalid username', 'Use 3-20 characters: lowercase letters, numbers, dot (.) or underscore (_).');
      return;
    }
    if (name === myUsername) { setShowUsernameModal(false); return; }
    setUsernameBusy(true);
    try {
      await claimUsername(name, myUsername);
      setMyUsername(name);
      const uid = currentUser?.uid;
      if (uid) memberProfileCache.current[uid] = { ...(memberProfileCache.current[uid] || { userName: '', photoURL: '' }), username: name };
      setShowUsernameModal(false);
      Alert.alert('Username updated', `You are now @${name}`);
    } catch (e: any) {
      if (String(e?.message || '').includes('taken')) Alert.alert('Username taken', 'This username is already in use. Please try another one.');
      else Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setUsernameBusy(false);
    }
  };

  // ───────────── @mention suggestions while typing ─────────────
  // @handle -> uid for members who have not claimed a username yet (so they can still be tagged)
  const mentionHandleMap = useRef<Record<string, string>>({});

  const mentionQuery = useMemo(() => {
    const m = /(^|\s)@([a-zA-Z0-9_.]*)$/.exec(chatInputText);
    return m ? m[2].toLowerCase() : null;
  }, [chatInputText]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null || editingMessage) return [];
    return communityMembersList
      .filter((m: any) => {
        if (!m.uid || m.uid === currentUser?.uid) return false;
        const handle = m.username || makeUsernameBase(String(m.userName || ''));
        return handle.includes(mentionQuery) || String(m.userName || '').toLowerCase().includes(mentionQuery);
      })
      .map((m: any) => ({ ...m, handle: m.username || makeUsernameBase(String(m.userName || '')) }))
      .slice(0, 6);
  }, [mentionQuery, communityMembersList, currentUser?.uid, editingMessage]);

  const insertMention = (username: string, uid?: string) => {
    if (uid) mentionHandleMap.current[username.toLowerCase()] = uid;
    setChatInputText(prev => prev.replace(/(^|\s)@([a-zA-Z0-9_.]*)$/, (_m, lead) => `${lead}@${username} `));
  };

  // Finds the user ids for all @names in a message
  const resolveMentions = async (text: string): Promise<string[]> => {
    const names = Array.from(new Set((text.match(/@([a-zA-Z0-9_.]{3,20})/g) || []).map(x => x.slice(1).toLowerCase())));
    if (names.length === 0) return [];
    const uids: string[] = [];
    await Promise.all(names.map(async (name) => {
      const known = communityMembersList.find((m: any) => m.username === name);
      if (known?.uid) { uids.push(known.uid); return; }
      if (mentionHandleMap.current[name]) { uids.push(mentionHandleMap.current[name]); return; }
      const byName = communityMembersList.find((m: any) => makeUsernameBase(String(m.userName || '')) === name);
      if (byName?.uid) { uids.push(byName.uid); return; }
      try {
        const snap = await firestore().collection('usernames').doc(name).get();
        const u = snap.data()?.uid;
        if (u) uids.push(u);
      } catch (_) {}
    }));
    return Array.from(new Set(uids.filter(u => u !== currentUser?.uid)));
  };

  const handlePickImage = async (fromCamera: boolean) => {
    if (!isAdmin) {
      Alert.alert('Admins only', 'Only admins can send images in the group chat.');
      return;
    }
    if (!imagePicker) {
      Alert.alert('Not available', 'Image picker is not installed. Run: npm i react-native-image-picker, then rebuild the app.');
      return;
    }
    try {
      const launch = fromCamera ? imagePicker.launchCamera : imagePicker.launchImageLibrary;
      const res = await launch({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1600,
        maxHeight: 1600,
        selectionLimit: 1,
        saveToPhotos: false,
      });
      if (res?.didCancel) return;
      if (res?.errorCode) {
        Alert.alert('Error', res.errorMessage || String(res.errorCode));
        return;
      }
      const asset = res?.assets?.[0];
      if (!asset?.uri) return;
      if (asset.fileSize && asset.fileSize > MAX_CHAT_FILE_BYTES) {
        Alert.alert('File too large', 'Maximum size is 20 MB.');
        return;
      }
      await sendMediaMessage({
        type: 'image',
        localUri: asset.uri,
        fileName: asset.fileName || `photo_${Date.now()}.jpg`,
        mimeType: asset.type || 'image/jpeg',
        fileSize: asset.fileSize,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not open the picker.');
    }
  };

  const handlePickDocument = async (kind: 'document' | 'audio') => {
    if (!docPicker) {
      Alert.alert('Not available', 'Document picker is not installed. Run: npm i @react-native-documents/picker, then rebuild the app.');
      return;
    }
    try {
      const T = docPicker.types || {};
      const type = kind === 'audio'
        ? [T.audio].filter(Boolean)
        : [T.pdf, T.doc, T.docx, T.xls, T.xlsx, T.ppt, T.pptx, T.plainText, T.zip].filter(Boolean);
      const opts: any = type.length ? { type } : {};
      const result = typeof docPicker.pickSingle === 'function'
        ? await docPicker.pickSingle(opts)
        : await docPicker.pick(opts);
      const file: any = Array.isArray(result) ? result[0] : result;
      if (!file?.uri) return;
      if (!isAdmin && (String(file.type || '').toLowerCase().startsWith('image/') || IMAGE_FILE_REGEX.test(String(file.name || '')))) {
        Alert.alert('Admins only', 'Only admins can send images in the group chat.');
        return;
      }
      if (!isAdmin && chatHasLink(file.name)) {
        Alert.alert('Links not allowed', 'Please rename the file. Only admins can share links in the group chat.');
        return;
      }
      if (file.size && file.size > MAX_CHAT_FILE_BYTES) {
        Alert.alert('File too large', 'Maximum size is 20 MB.');
        return;
      }
      await sendMediaMessage({
        type: 'file',
        localUri: file.uri,
        fileName: file.name || `file_${Date.now()}`,
        mimeType: file.type || (kind === 'audio' ? 'audio/mpeg' : 'application/octet-stream'),
        fileSize: file.size || undefined,
      });
    } catch (e: any) {
      const cancelled =
        (typeof docPicker.isCancel === 'function' && docPicker.isCancel(e)) ||
        e?.code === 'DOCUMENT_PICKER_CANCELED' ||
        e?.code === 'OPERATION_CANCELED';
      if (!cancelled) Alert.alert('Error', e?.message || 'Could not open the file picker.');
    }
  };

  const handleStopAndSendRecording = async () => {
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      const audioFilePath = await AudioRecord.stop();
      setIsRecording(false);

      const finalDuration = recordSecs > 0 ? recordSecs : 2;
      setRecordSecs(0);

      await sendMediaMessage({
        type: 'voice',
        localUri: audioFilePath,
        fileName: `voice_${Date.now()}.wav`,
        mimeType: 'audio/wav',
        duration: finalDuration,
      });
    } catch (e: any) {
      setIsRecording(false);
      Alert.alert('Error', e?.message || 'Could not send the voice note.');
    }
  };

  const handleTogglePlayAudio = async (msgId: string, durationInSec: number = 2, mediaUrl?: string) => {
    if (playingAudioId === msgId) {
      if (activeSoundRef.current) {
        try { 
          activeSoundRef.current.stop(); 
          activeSoundRef.current.release(); 
        } catch (e) {}
        activeSoundRef.current = null;
      }
      setPlayingAudioId(null);
      return;
    }

    if (!mediaUrl || !SoundPlayer) {
      Alert.alert("Voice Playback", "Voice audio file missing.");
      return;
    }

    if (activeSoundRef.current) {
      try { 
        activeSoundRef.current.stop(); 
        activeSoundRef.current.release(); 
      } catch (e) {}
      activeSoundRef.current = null;
    }

    setPlayingAudioId(msgId);

    try {
      let targetPath = mediaUrl;
      if (Platform.OS === 'android') {
        if (targetPath.startsWith('file://')) {
          targetPath = targetPath.replace('file://', '');
        }
      }

      if (SoundPlayer.setCategory) {
        SoundPlayer.setCategory('Playback', true);
      }

      const sound = new SoundPlayer(targetPath, Platform.OS === 'android' ? '' : SoundPlayer.MAIN_BUNDLE, (error: any) => {
        if (error) {
          setPlayingAudioId(null);
          activeSoundRef.current = null;
          return;
        }

        activeSoundRef.current = sound;
        if (typeof sound.setSpeakerphoneOn === 'function') sound.setSpeakerphoneOn(true);
        sound.setVolume(1.0);

        sound.play(() => {
          try { sound.release(); } catch(e){}
          activeSoundRef.current = null;
          setPlayingAudioId(null);
        });
      });
    } catch (e) {
      setPlayingAudioId(null);
      activeSoundRef.current = null;
    }
  };

  const handleTogglePinMessage = async (message: any) => {
    if (!isAdmin) {
      setSelectedMessageForAction(null);
      Alert.alert('Admins only', 'Only admins can pin or unpin messages.');
      return;
    }
    const targetGroupId = selectedGroup?.id || 'ecc_community_chat';
    try {
      await firestore()
        .collection('community_groups')
        .doc(targetGroupId)
        .collection('messages')
        .doc(message.id)
        .update({
          isPinned: !message?.isPinned
        });
    } catch (e) {}
    finally {
      setSelectedMessageForAction(null);
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    const targetGroupId = selectedGroup?.id || 'ecc_community_chat';
    if (!currentUser?.uid) return;
    try {
      const msgRef = firestore()
        .collection('community_groups')
        .doc(targetGroupId)
        .collection('messages')
        .doc(messageId);

      const msgDoc = await msgRef.get();
      const existingReactions = msgDoc.data()?.reactions || {};

      if (existingReactions[currentUser.uid] === emoji) {
        delete existingReactions[currentUser.uid];
      } else {
        existingReactions[currentUser.uid] = emoji;
      }

      await msgRef.update({ reactions: existingReactions });
    } catch (e) {
    } finally {
      setSelectedMessageForAction(null);
    }
  };

  const handleRemoveMyReaction = async (messageId: string) => {
    const targetGroupId = selectedGroup?.id || 'ecc_community_chat';
    if (!currentUser?.uid) return;
    try {
      const msgRef = firestore()
        .collection('community_groups')
        .doc(targetGroupId)
        .collection('messages')
        .doc(messageId);

      const msgDoc = await msgRef.get();
      const existingReactions = msgDoc.data()?.reactions || {};

      if (existingReactions[currentUser.uid]) {
        delete existingReactions[currentUser.uid];
        await msgRef.update({ reactions: existingReactions });
      }
    } catch (e) {}
  };

  const confirmDeleteSelectedMessages = async () => {
    const targetGroupId = selectedGroup?.id || 'ecc_community_chat';
    if (selectedMessageIds.length === 0) return;

    const selectedMessages = selectedMessageIds
      .map(id => chatMessages.find(m => m.id === id))
      .filter(Boolean);

    const canDeleteAllForEveryone = selectedMessages.length === selectedMessageIds.length &&
      selectedMessages.every((message: any) => canDeleteForEveryone(message));

    if (!canDeleteAllForEveryone) {
      setDeleteModalVisible(false);
      Alert.alert(
        'Delete for everyone',
        isAdmin
          ? 'Unable to delete one or more selected messages.'
          : 'You can delete your own messages for everyone only within 1 hour of sending them. Other messages can be deleted for you.'
      );
      return;
    }

    const idsToDelete = selectedMessages.map((message: any) => message.id);
    const messagesBackup = chatMessages.filter(m => idsToDelete.includes(m.id));

    setChatMessages(prev => prev.filter(m => !idsToDelete.includes(m.id)));
    setSelectedMessageIds([]);
    setDeleteModalVisible(false);

    setPendingDeletedMessages(messagesBackup);
    setShowUndoToast(true);

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

    undoTimeoutRef.current = setTimeout(async () => {
      setShowUndoToast(false);
      setPendingDeletedMessages([]);
      try {
        const batch = firestore().batch();
        idsToDelete.forEach((id) => {
          const docRef = firestore()
            .collection('community_groups')
            .doc(targetGroupId)
            .collection('messages')
            .doc(id);
          batch.delete(docRef);
        });
        await batch.commit();
        // best effort: also remove the uploaded file from Storage
        if (storageLib) {
          messagesBackup.forEach((m: any) => {
            if (m?.storagePath) storageLib().ref(m.storagePath).delete().catch(() => {});
          });
        }
      } catch (error) {
        setChatMessages(prev => [...messagesBackup, ...prev]);
      }
    }, 5000);
  };

  const deleteSelectedMessagesForMe = async () => {
    const targetGroupId = selectedGroup?.id || 'ecc_community_chat';
    const uid = currentUser?.uid;
    if (!uid || selectedMessageIds.length === 0) return;

    const idsToHide = [...selectedMessageIds];
    setDeleteModalVisible(false);
    setSelectedMessageIds([]);
    setChatMessages(prev => prev.filter(m => !idsToHide.includes(m.id)));

    try {
      const batch = firestore().batch();
      idsToHide.forEach((id) => {
        const docRef = firestore()
          .collection('community_groups')
          .doc(targetGroupId)
          .collection('messages')
          .doc(id);
        batch.update(docRef, {
          deletedFor: firestore.FieldValue.arrayUnion(uid),
        });
      });
      await batch.commit();
    } catch (error: any) {
      const restore = chatMessages.filter(m => idsToHide.includes(m.id));
      setChatMessages(prev => {
        const existingIds = prev.map(m => m.id);
        return [...restore.filter(m => !existingIds.includes(m.id)), ...prev];
      });
      Alert.alert('Delete failed', error?.message || 'Could not delete the selected message(s) for you.');
    }
  };

  const handleUndoDelete = () => {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setShowUndoToast(false);
    if (pendingDeletedMessages.length > 0) {
      setChatMessages(prev => {
        const existingIds = prev.map(m => m.id);
        const restored = pendingDeletedMessages.filter(m => !existingIds.includes(m.id));
        return [...restored, ...prev];
      });
      setPendingDeletedMessages([]);
    }
  };

  // Only an admin can delete any post. Everyone else can delete only their own post.
  // Own post: deleted directly (Firestore rules allow only the author).
  // Someone else's post: only through the adminDeletePost Cloud Function, which re-checks
  // the `admins` collection on the server.
  const isOwnPost = (post: any): boolean =>
    !!currentUser?.uid && !!post?.uid && post.uid === currentUser.uid;

  const canDeletePost = (post: any): boolean => isOwnPost(post) || isFeedAdmin;

  const handleDeletePost = (post: any) => {
    if (!canDeletePost(post)) {
      Alert.alert('Not allowed', 'You can delete only your own posts.');
      return;
    }
    Alert.alert('Delete Post', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (isOwnPost(post)) {
              await firestore().collection('posts').doc(post.id).delete();
            } else {
              await functions().httpsCallable('adminDeletePost')({ postId: post.id });
            }
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'You are not allowed to delete this post.');
          }
        }
      }
    ]);
  };

  const handleSendGroupMessage = async () => {
    if (!chatInputText.trim()) return;
    const targetGroupId = selectedGroup?.id || 'ecc_community_chat';
    const messageContent = chatInputText.trim();
    if (!isAdmin && chatHasLink(messageContent)) {
      Alert.alert('Links not allowed', 'Only admins can share links in the group chat.');
      return;
    }
    setChatInputText('');
    setShowEmojiPicker(false);

    if (editingMessage) {
      const targetId = editingMessage.id;
      setEditingMessage(null);
      try {
        await firestore()
          .collection('community_groups')
          .doc(targetGroupId)
          .collection('messages')
          .doc(targetId)
          .update({
            text: messageContent,
            isEdited: true,
            editedAt: firestore.FieldValue.serverTimestamp()
          });
      } catch (e: any) {
        Alert.alert('Edit Failed', e.message || 'Could not update message.');
      }
      return;
    }

    const tempId = `temp_${Date.now()}`;
    const messageType = isSingleEmojiText(messageContent) ? 'emoji' : 'text';
    const mentionUids = await resolveMentions(messageContent);
    const optimisticMessage = {
      id: tempId,
      text: messageContent,
      type: messageType,
      senderId: currentUser?.uid || 'guest_user',
      senderName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User',
      senderPhoto: currentUser?.photoURL || null,
      senderIsAdmin: !!isAdmin,
      status: 'sending',
      reactions: {},
      isPinned: false,
      createdAt: new Date(),
      ...(mentionUids.length ? { mentions: mentionUids } : {}),
    };

    setChatMessages(prev => [optimisticMessage, ...prev]);

    try {
      await firestore().collection('community_groups').doc(targetGroupId).collection('messages').add({
        text: messageContent,
        type: messageType,
        senderId: currentUser?.uid || 'guest_user',
        senderName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User',
        senderPhoto: currentUser?.photoURL || null,
        senderIsAdmin: !!isAdmin,
        status: 'sent',
        reactions: {},
        isPinned: false,
        ...(mentionUids.length ? { mentions: mentionUids } : {}),
        createdAt: firestore.FieldValue.serverTimestamp()
      });
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const handleCreatePost = async () => {
    if (!newPostText.trim() || !currentUser) return;
    setIsPosting(true);
    try {
      await firestore().collection('posts').add({
        text: newPostText.trim(),
        uid: currentUser.uid,
        userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        createdAt: firestore.FieldValue.serverTimestamp()
      });
      setNewPostText('');
    } catch (e: any) { Alert.alert('Error', e.message); } 
    finally { setIsPosting(false); }
  };

  const handleStartQuiz = (quiz: any) => {
    const sourceQuiz = quiz || DEFAULT_QUIZ_CHALLENGES[0];
    const normalizedQuestions = Array.isArray(sourceQuiz?.questions) && sourceQuiz.questions.length > 0
      ? sourceQuiz.questions
      : DEFAULT_QUIZ_CHALLENGES[0].questions;
    const safeQuiz = { ...sourceQuiz, questions: normalizedQuestions };

    if (completedQuizIds.includes(safeQuiz.id)) {
      Alert.alert('Attempted', 'You already completed this challenge.');
      return;
    }

    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    setCurrentTakingQuiz(safeQuiz);
    setCurrentQuestionIndex(0);
    setUserSelectedOption(null);
    setIsAnswerSubmitted(false);
    setCalculatedScore(0);
    setQuizCompleted(false);
    setShowConfetti(false);
    setQuizTimerSeconds(15);
    setIsStudentQuizModalVisible(true);
  };

  const handleSelectOption = (index: number) => {
    if (isAnswerSubmitted) return;
    setUserSelectedOption(index);
  };

  const handleConfirmAnswer = () => {
    if (userSelectedOption === null || isAnswerSubmitted) return;
    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    const activeQ = currentTakingQuiz?.questions?.[currentQuestionIndex];
    const isCorrect = userSelectedOption === activeQ?.correctAnswerIndex;
    if (isCorrect) {
      setCalculatedScore(s => s + 1);
      setShowConfetti(true);
      playQuizSound(true);
    } else {
      setShowConfetti(false);
      playQuizSound(false);
    }
    setIsAnswerSubmitted(true);
  };

  const handleNextQuestion = () => {
    const totalQ = currentTakingQuiz?.questions?.length || 2;
    const finalScore = calculatedScore;

    setShowConfetti(false);
    if (currentQuestionIndex + 1 < totalQ) {
      setCurrentQuestionIndex(i => i + 1);
      setUserSelectedOption(null);
      setIsAnswerSubmitted(false);
      setQuizTimerSeconds(15);
    } else {
      if (quizTimerRef.current) clearInterval(quizTimerRef.current);
      setCalculatedScore(finalScore);
      setQuizCompleted(true);
      setShowConfetti(true);
      playQuizCompletionSound();
      submitScoreToLeaderboard(finalScore, totalQ);
    }
  };

  useEffect(() => {
    if (!isStudentQuizModalVisible || quizCompleted || isAnswerSubmitted || !currentTakingQuiz) {
      if (quizTimerRef.current) clearInterval(quizTimerRef.current);
      return;
    }

    quizTimerRef.current = setInterval(() => {
      setQuizTimerSeconds(prev => {
        if (prev <= 1) {
          if (quizTimerRef.current) clearInterval(quizTimerRef.current);
          setUserSelectedOption(null);
          setIsAnswerSubmitted(true);
          setShowConfetti(false);
          playQuizSound(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    };
  }, [isStudentQuizModalVisible, quizCompleted, isAnswerSubmitted, currentTakingQuiz, currentQuestionIndex]);

  const closeQuizModal = () => {
    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    setIsStudentQuizModalVisible(false);
    setCurrentTakingQuiz(null);
    setUserSelectedOption(null);
    setIsAnswerSubmitted(false);
    setShowConfetti(false);
    setQuizCompleted(false);
  };

  const submitScoreToLeaderboard = async (finalScore: number, totalQ: number) => {
    if (!currentUser || !currentTakingQuiz) return;
    try {
      const earnedXP = 20;
      await firestore().collection('quiz_results').add({
        quizId: currentTakingQuiz.id,
        quizTitle: currentTakingQuiz.title || 'Challenge',
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        score: finalScore,
        totalQuestions: totalQ,
        earnedXP: earnedXP,
        completedAt: firestore.FieldValue.serverTimestamp()
      });

      recordPracticeActivity('quiz'); // counts as today's challenge for the streak
      await firestore().collection('users').doc(currentUser.uid).set({
        xp: firestore.FieldValue.increment(earnedXP)
      }, { merge: true });
    } catch (error) {}
  };

  const activeQuizTotal = currentTakingQuiz?.questions?.length || 2;
  const activeQuizQuestion = currentTakingQuiz?.questions?.[currentQuestionIndex];

  const renderMessageTicks = (item: any) => {
    if (onlineMembers > 1) {
      return <CheckCheck size={13} color="#38BDF8" style={{ marginLeft: 4 }} />;
    } else if (item.status === 'delivered') {
      return <CheckCheck size={13} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
    } else {
      return <Check size={13} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
    }
  };

  // Only MY own status is shown on the card and in the chat header (no count). Other members' status is in the members list.
  const myOnline = !!currentUser?.uid && (isMember || isAdmin) && (screenFocused || isChatModalVisible);

  // The chat row renderer. Its identity is STABLE (renderChatItem), so typing in the input box or any other
  // screen state change does not re-render every message. The list refreshes through `chatListExtra` below.
  const renderChatItemRef = useRef<any>(null);
  renderChatItemRef.current = ({ item, index }: any) => {
            const isMe = item.senderId === (currentUser?.uid || 'guest_user');
            const isPlaying = playingAudioId === item.id;
            const isSelected = selectedMessageIds.includes(item.id);
            const hasReaction = Object.keys(item?.reactions || {}).length > 0;
            const currentDateHeader = getMessageDateHeader(item.createdAt);
            const nextMessage = chatMessages[index + 1];
            const nextDateHeader = nextMessage ? getMessageDateHeader(nextMessage.createdAt) : null;
            const showDateHeader = currentDateHeader !== nextDateHeader;
            const showSenderHeader = !isMe && (!nextMessage || nextMessage.senderId !== item.senderId);

            return (
              <View style={{ width: '100%' }}>
                {showDateHeader && (
                  <View style={{ alignItems: 'center', marginVertical: 12 }}>
                    <View style={{ backgroundColor: isDarkMode ? '#2A2A2A' : '#E2E8F0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>{currentDateHeader}</Text>
                    </View>
                  </View>
                )}

                <View style={[
                  styles.messageRowWrap,
                  hasReaction && styles.messageRowWithReaction,
                  isSelected && { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.22)' : '#EEF2FF', borderRadius: 16 },
                  highlightedMsgId === item.id && { backgroundColor: isDarkMode ? 'rgba(250, 204, 21, 0.28)' : 'rgba(250, 204, 21, 0.35)', borderRadius: 16 }
                ]}>
                  <View style={[
                    styles.messageInnerRow, 
                    isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }
                  ]}>
                    
                    {isMe && !isSelectionMode && (
                      <TouchableOpacity 
                        style={styles.messageReactionSideBtn} 
                        onPress={() => handleOpenReactionTray(item)}
                        activeOpacity={0.7}
                      >
                        <Smile size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}

                    <View style={{ maxWidth: '85%' }}>
                      {showSenderHeader && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, marginLeft: 2 }}>
                          <View style={[styles.chatAvatarThumb, { backgroundColor: getAvatarColor(item.senderName) }]}>
                            {item.senderPhoto ? (
                              <Image source={{ uri: item.senderPhoto }} style={styles.chatAvatarImg} />
                            ) : (
                              <Text style={styles.chatAvatarThumbText}>{(item.senderName || 'U').charAt(0).toUpperCase()}</Text>
                            )}
                          </View>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '700' }}>{item.senderName}</Text>
                        </View>
                      )}
                      
                      <TouchableOpacity 
                        activeOpacity={0.92} 
                        delayLongPress={180}
                        onPress={() => handleMessagePress(item)}
                        onLongPress={() => handleMessageLongPress(item)}
                        style={{ 
                          backgroundColor: isSingleEmojiText(item.text) ? 'transparent' : (isMe ? primaryColor : colors.bgCard), 
                          padding: isSingleEmojiText(item.text) ? 0 : (item.type === 'image' ? 4 : 14),
                          paddingBottom: isSingleEmojiText(item.text) ? 0 : (hasReaction ? 28 : 14),
                          borderRadius: isSingleEmojiText(item.text) ? 10 : 18,
                          borderWidth: isSingleEmojiText(item.text) ? 0 : (isSelected ? 2 : (isMe ? 0 : 1)), 
                          borderColor: isSelected ? '#4F46E5' : colors.border,
                          position: 'relative'
                        }}
                      >
                        {item?.isPinned && (
                          <View style={styles.messagePinIconAnchor}>
                            <Pin size={10} color={isMe ? '#FFF' : primaryColor} />
                          </View>
                        )}

                        {item.type === 'voice' ? (
                          <TouchableOpacity onPress={() => handleTogglePlayAudio(item.id, item.duration, item.mediaUrl)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 140 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isMe ? '#FFF' : primaryColor, justifyContent: 'center', alignItems: 'center' }}>
                              {isPlaying ? <Pause size={18} color={isMe ? primaryColor : '#FFF'} /> : <Play size={18} color={isMe ? primaryColor : '#FFF'} style={{ marginLeft: 2 }} />}
                            </View>
                            <View>
                              <Text style={{ color: isMe ? '#FFF' : colors.textPrimary, fontWeight: '800', fontSize: 13 }}>Voice Note</Text>
                              <Text style={{ color: isMe ? 'rgba(255,255,255,0.85)' : colors.textSecondary, fontSize: 11 }}>{item.duration || 2}s</Text>
                            </View>
                          </TouchableOpacity>
                        ) : item.type === 'image' ? (
                          <View>
                            <Image source={{ uri: item.mediaUrl }} style={styles.chatImageMessage} resizeMode="cover" />
                            {item.uploading && (
                              <View style={styles.chatImageUploading}>
                                <ActivityIndicator color="#FFF" />
                              </View>
                            )}
                          </View>
                        ) : item.type === 'file' ? (
                          <View style={styles.chatFileRow}>
                            <View style={[styles.chatFileIcon, { backgroundColor: isMe ? 'rgba(255,255,255,0.22)' : primaryColor + '18' }]}>
                              {item.uploading
                                ? <ActivityIndicator size="small" color={isMe ? '#FFF' : primaryColor} />
                                : <FileText size={20} color={isMe ? '#FFF' : primaryColor} />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text numberOfLines={2} style={{ color: isMe ? '#FFF' : colors.textPrimary, fontWeight: '700', fontSize: 13 }}>{item.fileName || item.text}</Text>
                              <Text style={{ color: isMe ? 'rgba(255,255,255,0.8)' : colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                                {item.uploading ? 'Uploading...' : (formatFileSize(item.fileSize) || 'Tap to open')}
                              </Text>
                            </View>
                          </View>
                        ) : isSingleEmojiText(item.text) ? (
                          <Text style={[
                            styles.standaloneEmojiMessage,
                            { textAlign: isMe ? 'right' : 'left' }
                          ]}>{String(item.text).trim()}</Text>
                        ) : (
                          <MentionText
                            text={item.text}
                            highlight={Array.isArray(item.mentions) && item.mentions.length > 0}
                            baseColor={isMe ? '#FFF' : colors.textPrimary}
                            mineColor={primaryColor}
                            isMe={isMe}
                            linkify={item.senderIsAdmin === true || (isMe && isAdmin)}
                          />
                        )}

                        {!isSingleEmojiText(item.text) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 5 }}>
                            {item.isEdited && (
                              <Text style={{ color: isMe ? 'rgba(255,255,255,0.7)' : colors.textSecondary, fontSize: 9, fontStyle: 'italic', marginRight: 4 }}>
                                (edited)
                              </Text>
                            )}
                            <Text style={{ color: isMe ? 'rgba(255,255,255,0.75)' : colors.textSecondary, fontSize: 9.5, fontWeight: '500' }}>
                              {formatMessageTime(item.createdAt)}
                            </Text>
                            {isMe && renderMessageTicks(item)}
                          </View>
                        )}
                        
                        <AnimatedReactionBadge item={item} onRemove={handleRemoveMyReaction} />
                      </TouchableOpacity>
                    </View>

                    {!isMe && !isSelectionMode && (
                      <TouchableOpacity 
                        style={styles.messageReactionSideBtn} 
                        onPress={() => handleOpenReactionTray(item)}
                        activeOpacity={0.7}
                      >
                        <Smile size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}

                  </View>
                </View>
              </View>
            );
  };
  const renderChatItem = useCallback((info: any) => renderChatItemRef.current(info), []);
  const chatListExtra = useMemo(
    () => ({ highlightedMsgId, selectedMessageIds, playingAudioId, isDarkMode, primaryColor, onlineMembers }),
    [highlightedMsgId, selectedMessageIds, playingAudioId, isDarkMode, primaryColor, onlineMembers]
  );

  // Reaction picker: every emoji gets a fixed equal width, so all of them always stay inside the card
  const reactionItemW = Math.floor((Math.min(SCREEN_WIDTH * 0.92, 360) - 20) / QUICK_REACTIONS.length);

  const currentHeaderImage = activeTab === 2 ? IMG_CHILD_CHALLENGES : IMG_CHILDREN_DEFAULT;
  const editableMsg = getSingleSelectedEditableMessage();

  return (
    <View style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={colors.bgLight} translucent />

      {/* ─── 1. TOP HERO HEADER ─── */}
      <View style={styles.responsiveCenterWrapper}>
        <View style={[styles.topHeroHeader, { paddingTop: (StatusBar.currentHeight || 0) + 12 }]}>
          <View style={styles.headerLeftBlock}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.realChatLogoPill}>
                <MessageCircle size={22} color="#3B82F6" strokeWidth={2.4} />
              </View>
              <Text style={[styles.mainScreenTitle, { color: colors.textPrimary }]}>Community</Text>
            </View>
            <Text style={[styles.mainScreenSubtitle, { color: colors.textSecondary }]}>
              Learn • Speak • Grow Together ✨
            </Text>
          </View>

          <View style={styles.headerRightBlock}>
            <Image 
              source={currentHeaderImage} 
              style={styles.childrenArtworkTouching} 
              resizeMode="contain" 
            />
          </View>
        </View>

        {/* ─── 2. 4-TABS NAVIGATION ─── */}
        <View style={[styles.tabsContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
          {TABS.map((tabItem, idx) => (
            <TouchableOpacity 
              key={tabItem.title} 
              style={[styles.tab, activeTab === idx && [styles.activeTab, { backgroundColor: colors.bgCard }]]} 
              onPress={() => handleTabPress(idx)}
              activeOpacity={0.85}
            >
              {idx === 0 ? (
                <Sparkles size={14} color={activeTab === idx ? primaryColor : colors.textSecondary} />
              ) : idx === 1 ? (
                <MessageCircle size={14} color={activeTab === idx ? primaryColor : colors.textSecondary} />
              ) : idx === 2 ? (
                <Trophy size={14} color={activeTab === idx ? '#8B5CF6' : colors.textSecondary} />
              ) : (
                <Flame size={14} color={activeTab === idx ? '#EF4444' : colors.textSecondary} />
              )}
              <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === idx && { color: activeTab === 2 ? '#8B5CF6' : primaryColor, fontWeight: '900' }]}>
                {tabItem.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ─── 3. REAL-TIME SWIPE PAGER (Touch-Slider Responsive) ─── */}
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {/* TAB 0: FEED */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <View style={styles.responsiveCenterWrapper}>
            <View style={[styles.createPostBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <TextInput 
                style={[styles.postInput, { color: colors.textPrimary }]} 
                placeholder="Post an update or query..." 
                placeholderTextColor={colors.textSecondary} 
                value={newPostText} 
                onChangeText={setNewPostText} 
                multiline 
              />
              <TouchableOpacity style={[styles.sendBtn, { backgroundColor: primaryColor }, !newPostText.trim() && { opacity: 0.5 }]} onPress={handleCreatePost} disabled={isPosting || !newPostText.trim()}>
                {isPosting ? <ActivityIndicator size="small" color="#FFF" /> : <Send size={16} color="#FFF" />}
              </TouchableOpacity>
            </View>
            <FlatList 
              data={posts} 
              keyExtractor={item => item.id} 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={styles.scrollList} 
              renderItem={({ item }) => {
                const canDelete = canDeletePost(item);
                return (
                  <View style={[styles.premiumCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <View style={[styles.avatarGlow, { backgroundColor: getAvatarColor(item.userName) }]}>
                          <Text style={styles.avatarText}>{item.userName?.charAt(0).toUpperCase() || 'U'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.userNameText, { color: colors.textPrimary }]}>{item.userName || 'User'}</Text>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>{formatTimeAgo(item.createdAt)}</Text>
                        </View>
                      </View>
                      {canDelete && (
                        <TouchableOpacity onPress={() => handleDeletePost(item)} style={styles.deleteIconButton}>
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={{ color: colors.textPrimary, marginTop: 10, fontSize: 14, lineHeight: 21 }}>{item.text}</Text>
                  </View>
                );
              }}
            />
          </View>
        </View>

        {/* TAB 1: CHATS & VOICE ROOMS */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
            <View style={styles.responsiveCenterWrapper}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionHeadingTitle, { color: colors.textPrimary }]}>Community Groups</Text>
                <TouchableOpacity onPress={() => openChatModal({ id: 'ecc_community_chat', title: 'ECC Community Chat' })}>
                  <Text style={{ color: primaryColor, fontWeight: '900', fontSize: 13 }}>See All ›</Text>
                </TouchableOpacity>
              </View>

              {/* CHATS BANNER CARD */}
              <View style={styles.chatCardOuterWrapper}>
                <Image source={IMG_COMMUNITY_CARD} style={styles.chatBannerImageTight} resizeMode="cover" />
                
                <View style={styles.communityContentLayer}>
                  <View style={styles.communityTopRow}>
                    <View style={styles.eccAvatarPillWrap}>
                      <Text style={styles.eccAvatarText}>ECC</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Text style={styles.chatCardTitle}>
                            ECC Community Chat
                          </Text>
                          <View style={styles.realBlueTickBadge}>
                            <Check size={10} color="#FFFFFF" strokeWidth={3.5} />
                          </View>
                        </View>

                        {communityMembersList.length > 0 && (
                          <TouchableOpacity 
                            style={styles.membersAvatarRow} 
                            onPress={() => setShowMembersListModal(true)} 
                            activeOpacity={0.8}
                          >
                            {communityMembersList.slice(0, 3).map((m, mIdx) => (
                              <View 
                                key={m.id || mIdx} 
                                style={[
                                  styles.memberCircleAvatar, 
                                  { 
                                    marginLeft: mIdx > 0 ? -10 : 0, 
                                    backgroundColor: getAvatarColor(m.userName),
                                    zIndex: 10 - mIdx
                                  }
                                ]}
                              >
                                {m.photoURL ? (
                                  <Image source={{ uri: m.photoURL }} style={styles.memberImg} />
                                ) : (
                                  <Text style={styles.memberInitialsText}>
                                    {(m.userName || 'U').charAt(0).toUpperCase()}
                                  </Text>
                                )}
                              </View>
                            ))}
                            {membersForModal.length > 3 && (
                              <View style={[styles.memberCircleAvatarPlus, { marginLeft: -10, zIndex: 5 }]}>
                                <Text style={styles.memberPlusText}>+{membersForModal.length - 3}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>

                      <Text style={styles.chatCardSub}>
                        Official ECC Learners Group
                      </Text>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <View style={styles.memberTagBadge}>
                          <Users size={11} color="#0F172A" />
                          <Text style={styles.memberTagBadgeText}>{membersForModal.length} Members</Text>
                        </View>
                        <View style={styles.activeTagBadge}>
                          <View style={[styles.greenDot, { backgroundColor: myOnline ? '#10B981' : '#64748B' }]} />
                          <Text style={[styles.activeTagBadgeText, { color: myOnline ? '#059669' : '#64748B' }]}>
                            {myOnline ? 'Online' : 'Offline'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {isAdmin ? (
                    <TouchableOpacity 
                      style={[styles.openChatActionBtn, { backgroundColor: '#8B5CF6' }]}
                      onPress={() => openChatModal({ id: 'ecc_community_chat', title: 'ECC Community Chat' })}
                      activeOpacity={0.88}
                    >
                      <ShieldCheck size={16} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.openChatActionBtnText}>Open Group Chat (Admin Access)</Text>
                      <ChevronRight size={16} color="#FFF" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ) : !isMember ? (
                    <View style={styles.neonGlowWrapper}>
                      <TouchableOpacity 
                        style={styles.premiumShineJoinBtn} 
                        onPress={() => setShowJoinConfirmModal(true)}
                        disabled={isJoining}
                        activeOpacity={0.88}
                      >
                        {isJoining ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <UserPlus size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
                            <Text style={styles.premiumShineJoinBtnText}>Join Community ✨</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.openChatActionBtn, { backgroundColor: primaryColor }]}
                      onPress={() => openChatModal({ id: 'ecc_community_chat', title: 'ECC Community Chat' })}
                      activeOpacity={0.88}
                    >
                      <MessageCircle size={16} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.openChatActionBtnText}>Open Group Chat</Text>
                      <ChevronRight size={16} color="#FFF" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* TAB 2: CHALLENGES */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
            <View style={styles.responsiveCenterWrapper}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionHeadingTitle, { color: colors.textPrimary }]}>Daily Challenges</Text>
                <TouchableOpacity><Text style={{ color: '#8B5CF6', fontWeight: '900', fontSize: 13 }}>View History ›</Text></TouchableOpacity>
              </View>

              {/* Quiz Card 1 */}
              <View style={[styles.challengeCardBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={styles.challengeIconBubble3D}>
                      <Text style={{ fontSize: 22 }}>🏆</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.challengeCardTitle, { color: colors.textPrimary }]}>Quiz: Listen & Grammar Focus</Text>
                      <Text style={[styles.challengeCardSub, { color: colors.textSecondary }]}>Complete 2 questions on natural rhythm & grammar</Text>
                    </View>
                  </View>
                  <View style={styles.timeLeftBadge}>
                    <Clock size={11} color="#3B82F6" />
                    <Text style={styles.timeLeftBadgeText}>10h 30m Left</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textSecondary }}>Reward: <Text style={{ color: '#F59E0B', fontWeight: '900' }}>🪙 20 XP</Text></Text>
                </View>

                {completedQuizIds.includes('quiz_challenge_1') ? (
                  <View style={styles.completedChallengePill}>
                    <CheckCircle size={15} color="#10B981" />
                    <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 13, marginLeft: 6 }}>Completed</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.startChallengeActionBtn} onPress={() => handleStartQuiz(challengesData.find((q: any) => q.id === 'quiz_challenge_1') || DEFAULT_QUIZ_CHALLENGES[0])} activeOpacity={0.85}>
                    <Text style={styles.startChallengeActionBtnText}>Start Challenge</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Quiz Card 2 */}
              <View style={[styles.challengeCardBoxGreen, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.08)' : '#F0FDF4', borderColor: '#BBF7D0' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={[styles.challengeIconBubble3D, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                      <CheckCircle size={22} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.challengeCardTitle, { color: colors.textPrimary }]}>Quiz: Vocabulary & Pronunciation</Text>
                      <Text style={[styles.challengeCardSub, { color: colors.textSecondary }]}>Test subtle sounds and advanced vocabulary</Text>
                    </View>
                  </View>
                  <View style={[styles.timeLeftBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                    <Clock size={11} color="#10B981" />
                    <Text style={[styles.timeLeftBadgeText, { color: '#10B981' }]}>1d 2h Left</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textSecondary }}>Reward: <Text style={{ color: '#F59E0B', fontWeight: '900' }}>🪙 20 XP</Text></Text>
                </View>

                {completedQuizIds.includes('quiz_challenge_2') ? (
                  <View style={styles.completedChallengePill}>
                    <CheckCircle size={15} color="#10B981" />
                    <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 13, marginLeft: 6 }}>Completed</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.startChallengeActionBtn, { backgroundColor: '#10B981', shadowColor: '#10B981' }]} onPress={() => handleStartQuiz(challengesData.find((q: any) => q.id === 'quiz_challenge_2') || DEFAULT_QUIZ_CHALLENGES[1])} activeOpacity={0.85}>
                    <Text style={styles.startChallengeActionBtnText}>Start Challenge</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Play & Learn */}
              <View style={[styles.sectionTitleRow, { marginTop: 18 }]}>
                <View>
                  <Text style={[styles.sectionHeadingTitle, { color: colors.textPrimary }]}>Play & Learn</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Tap letters to form words and learn vocabulary!</Text>
                </View>
                <TouchableOpacity onPress={() => setIsResultsModalVisible(true)} activeOpacity={0.8}>
                  <Text style={{ color: '#8B5CF6', fontWeight: '900', fontSize: 13 }}>See Results ›</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.playLearnSingleContainer}>
                <TouchableOpacity 
                  style={[styles.singleGameCard, { backgroundColor: '#F3E8FF', borderColor: '#D8B4FE' }]} 
                  onPress={() => openWordZipScreen(0)}
                  activeOpacity={0.88}
                >
                  <View style={styles.singleGameLeftRow}>
                    <View style={[styles.gameIconBubbleLarge, { backgroundColor: '#E9D5FF' }]}>
                      <Puzzle size={28} color="#9333EA" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.gameCardTitle, { color: '#581C87', fontSize: 17 }]}>Word Zip Puzzle</Text>
                        <View style={styles.xpBonusBadge}>
                          <Text style={styles.xpBonusBadgeText}>+20 XP</Text>
                        </View>
                      </View>
                      <Text style={[styles.gameCardSub, { marginTop: 4, minHeight: 0 }]}>
                        Tap letters to discover vocabulary & meanings
                      </Text>
                    </View>
                  </View>

                  <View style={styles.singleGamePlayButton}>
                    <Text style={styles.singleGamePlayButtonText}>Play Now ›</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={[styles.fluencyTipBanner, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFBEB', borderColor: isDarkMode ? '#334155' : '#FDE68A', marginTop: 16 }]}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>💡</Text>
                <Text style={[styles.fluencyTipText, { color: isDarkMode ? '#F8FAFC' : '#92400E' }]}>
                  <Text style={{ fontWeight: '900' }}>Tip: </Text>Complete challenges daily to build your vocabulary! 😊
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* TAB 3: LEADERBOARD */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <View style={styles.responsiveCenterWrapper}>
            <FlatList 
              data={leaderboardUsers} 
              keyExtractor={item => item.id} 
              contentContainerStyle={styles.scrollList} 
              renderItem={({ item, index }) => {
                const rawName = item.fullName || item.userName || 'User';
                const isTop1 = index === 0;
                const isTop2 = index === 1;
                const isTop3 = index === 2;

                return (
                  <View style={[styles.premiumCard, { backgroundColor: colors.bgCard, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }]}>
                    <View style={{ width: 32, alignItems: 'center', justifyContent: 'center' }}>
                      {isTop1 ? <Text style={{ fontSize: 22 }}>🥇</Text> : 
                       isTop2 ? <Text style={{ fontSize: 22 }}>🥈</Text> : 
                       isTop3 ? <Text style={{ fontSize: 22 }}>🥉</Text> : 
                       <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textSecondary }}>#{index + 1}</Text>}
                    </View>

                    <View style={[styles.avatarGlow, { backgroundColor: getAvatarColor(rawName), marginLeft: 8 }]}>
                      <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>{rawName.charAt(0).toUpperCase()}</Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.userNameText, { color: colors.textPrimary, fontSize: 15 }]}>{rawName}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                      <Flame size={16} color="#EF4444" />
                      <Text style={{ fontWeight: '800', color: colors.textPrimary, marginLeft: 4, fontSize: 13 }}>{item.xp || 0} XP</Text>
                    </View>
                  </View>
                );
              }} 
            />
          </View>
        </View>
      </ScrollView>

      {/* WORD ZIP MODAL */}
      <Modal visible={isZipScreenVisible} animationType="slide" onRequestClose={() => setIsZipScreenVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgLight }}>
          {zipConfetti && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} pointerEvents="none">
              <ConfettiCannon count={150} origin={{ x: SCREEN_WIDTH / 2, y: -20 }} fadeOut autoStart />
            </View>
          )}

          <View style={[styles.puzzleTopBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => setIsZipScreenVisible(false)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <ArrowLeft size={24} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.zipLogoBadge}><Puzzle size={14} color="#FFF" /></View>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.textPrimary }}>Word Zip</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={() => openWordZipScreen(activeZipIndex)}>
                <RotateCcw size={20} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsResultsModalVisible(true)}>
                <BarChart2 size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
            <View style={{ alignItems: 'center', marginVertical: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.textPrimary, textAlign: 'center' }}>
                {WORD_ZIP_PUZZLES[activeZipIndex % WORD_ZIP_PUZZLES.length].theme}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Tap letters on the grid to build words, then tap Check!
              </Text>
            </View>

            <View style={styles.tapWordActionsRow}>
              <TouchableOpacity 
                style={[styles.wordDisplayStripTap, { 
                  borderColor: tapValidationStatus === 'success' ? '#10B981' : (tapValidationStatus === 'wrong' ? '#EF4444' : primaryColor),
                  backgroundColor: tapValidationStatus === 'success' ? '#DCFCE7' : (tapValidationStatus === 'wrong' ? '#FEE2E2' : (isDarkMode ? '#1E293B' : '#EFF6FF'))
                }]}
                onPress={handleClearTappedWord}
                activeOpacity={0.8}
              >
                <Text style={[styles.wordDisplayText, {
                  color: tapValidationStatus === 'success' ? '#166534' : (tapValidationStatus === 'wrong' ? '#991B1B' : '#4F46E5')
                }]}>
                  {selectedTappedCells.length > 0 ? selectedTappedCells.map(item => item.char).join('') : 'Tap letters...'}
                </Text>
              </TouchableOpacity>

              {selectedTappedCells.length > 0 && (
                <TouchableOpacity style={styles.clearWordBtn} onPress={handleClearTappedWord} activeOpacity={0.8}>
                  <Delete size={18} color="#EF4444" />
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[styles.checkWordBtn, { backgroundColor: selectedTappedCells.length >= 2 ? '#10B981' : '#94A3B8' }]}
                onPress={handleCheckTappedWord}
                disabled={selectedTappedCells.length < 2}
                activeOpacity={0.85}
              >
                <Check size={18} color="#FFFFFF" strokeWidth={3} />
                <Text style={styles.checkWordBtnText}>Check</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.zipBoardFrame, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              {WORD_ZIP_PUZZLES[activeZipIndex % WORD_ZIP_PUZZLES.length].grid.map((rowArr, rIdx) => (
                <View key={`row_${rIdx}`} style={styles.zipBoardRow}>
                  {rowArr.map((char, cIdx) => {
                    const tappedOrderIndex = selectedTappedCells.findIndex(item => item.r === rIdx && item.c === cIdx);
                    const isSelected = tappedOrderIndex !== -1;
                    const isLocked = completedZipCells.some(item => item.r === rIdx && item.c === cIdx);

                    let bg = colors.bgCard;
                    let border = colors.border;
                    let textClr = colors.textPrimary;

                    if (isLocked) {
                      bg = '#10B981';
                      border = '#059669';
                      textClr = '#FFFFFF';
                    } else if (isSelected) {
                      if (tapValidationStatus === 'wrong') {
                        bg = '#EF4444';
                        border = '#DC2626';
                        textClr = '#FFFFFF';
                      } else {
                        bg = primaryColor;
                        border = primaryColor;
                        textClr = '#FFFFFF';
                      }
                    }

                    return (
                      <TouchableOpacity
                        key={`cell_${rIdx}_${cIdx}`}
                        activeOpacity={0.7}
                        onPress={() => handleTapCell(rIdx, cIdx, char)}
                        style={[
                          styles.zipGridCell,
                          { backgroundColor: bg, borderColor: border }
                        ]}
                      >
                        <Text style={[styles.zipGridCellText, { color: textClr }]}>{char}</Text>
                        {isSelected && !isLocked && (
                          <View style={styles.tapOrderBadge}>
                            <Text style={styles.tapOrderBadgeText}>{tappedOrderIndex + 1}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            <View style={{ width: '100%', maxWidth: 350, marginTop: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: colors.textSecondary, marginBottom: 8 }}>
                DISCOVERED WORDS & MEANINGS ({completedZipWords.length}):
              </Text>
              {completedZipWords.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' }}>
                  Tap letters on the grid to create valid words and unlock +20 XP!
                </Text>
              ) : (
                completedZipWords.map((item, idx) => (
                  <View key={idx} style={[styles.discoveredWordCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <View style={styles.discoveredBadge}>
                      <Check size={12} color="#FFFFFF" strokeWidth={3} />
                      <Text style={styles.discoveredBadgeText}>{item.word}</Text>
                    </View>
                    <Text style={[styles.discoveredMeaningText, { color: colors.textPrimary }]}>{item.meaning}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.zipControlsRow}>
              <TouchableOpacity style={[styles.zipControlBtn, { borderColor: colors.border }]} onPress={handleShowHint}>
                <Lightbulb size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                <Text style={[styles.zipControlBtnText, { color: colors.textPrimary }]}>Hint</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.zipControlBtn, { borderColor: primaryColor, backgroundColor: primaryColor + '15' }]} 
                onPress={() => openWordZipScreen((activeZipIndex + 1) % WORD_ZIP_PUZZLES.length)}
              >
                <Shuffle size={16} color={primaryColor} style={{ marginRight: 6 }} />
                <Text style={[styles.zipControlBtnText, { color: primaryColor }]}>Next Level</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Results Modal */}
      <Modal visible={isResultsModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsResultsModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 }}>
          <View style={[styles.resultsModalCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.resultsHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Trophy size={22} color="#F59E0B" />
                <Text style={{ fontSize: 18, fontWeight: '900', color: colors.textPrimary }}>Puzzle Champions</Text>
              </View>
              <TouchableOpacity onPress={() => setIsResultsModalVisible(false)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={puzzlePlayedUsers}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 10 }}
              renderItem={({ item, index }) => (
                <View style={[styles.playerResultRow, { borderColor: colors.border }]}>
                  <Text style={{ fontSize: 14, fontWeight: '900', width: 24, color: colors.textSecondary }}>#{index + 1}</Text>
                  <View style={[styles.avatarGlow, { backgroundColor: getAvatarColor(item.userName), width: 34, height: 34 }]}>
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>{item.userName?.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>{item.userName}</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>Word: <Text style={{ fontWeight: '800', color: '#10B981' }}>{item.word}</Text></Text>
                  </View>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* 💬 GROUP CHAT MODAL */}
      <Modal visible={isChatModalVisible} animationType="slide" onRequestClose={closeChatModal} statusBarTranslucent>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgLight }}>
          {isSelectionMode ? (
            <View style={[styles.selectionTopBar, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <TouchableOpacity onPress={clearSelectionMode} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                  <X size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.selectedCountText, { color: colors.textPrimary }]}>
                  {selectedMessageIds.length} Selected
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {editableMsg && (
                  <TouchableOpacity 
                    style={styles.batchEditTopBtn} 
                    onPress={handleTriggerEditSelectedMessage}
                    activeOpacity={0.8}
                  >
                    <Edit3 size={19} color={primaryColor} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={styles.batchDeleteTopBtn} 
                  onPress={() => {
                    const picked = selectedMessageIds.map(id => chatMessages.find((m: any) => m.id === id)).filter(Boolean);
                    if (!isAdmin && picked.some((m: any) => !isOwnChatMessage(m))) {
                      Alert.alert('Not allowed', 'You can delete only your own messages. Only admins can delete other messages.');
                      return;
                    }
                    setDeleteModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Trash2 size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              paddingHorizontal: 16, 
              paddingBottom: 14, 
              backgroundColor: colors.bgCard, 
              borderBottomWidth: 1, 
              borderColor: colors.border,
              paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 12
            }}>
              <TouchableOpacity onPress={closeChatModal} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>{selectedGroup?.title}</Text>
                  {isAdmin && (
                    <View style={styles.adminTagBadge}>
                      <Text style={styles.adminTagBadgeText}>ADMIN</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>{membersForModal.length} Members</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>•</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={[styles.greenDot, { backgroundColor: myOnline ? '#10B981' : '#64748B' }]} />
                    <Text style={{ fontSize: 11, color: myOnline ? '#10B981' : '#64748B', fontWeight: '700' }}>
                      {myOnline ? 'Online' : 'Offline'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {communityMembersList.length > 0 && (
                  <TouchableOpacity 
                    style={styles.membersAvatarRow}
                    onPress={() => setShowMembersListModal(true)}
                    activeOpacity={0.8}
                  >
                    {communityMembersList.slice(0, 2).map((m, mIdx) => (
                      <View 
                        key={m.id || mIdx} 
                        style={[
                          styles.memberCircleAvatar, 
                          { 
                            marginLeft: mIdx > 0 ? -8 : 0, 
                            backgroundColor: getAvatarColor(m.userName),
                            zIndex: 10 - mIdx
                          }
                        ]}
                      >
                        {m.photoURL ? (
                          <Image source={{ uri: m.photoURL }} style={styles.memberImg} />
                        ) : (
                          <Text style={styles.memberInitialsText}>
                            {(m.userName || 'U').charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                    ))}
                    {membersForModal.length > 2 && (
                      <View style={[styles.memberCircleAvatarPlus, { marginLeft: -8, zIndex: 5 }]}>
                        <Text style={styles.memberPlusText}>+{membersForModal.length - 2}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  onPress={() => setShowThreeDotsMenu(!showThreeDotsMenu)} 
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  style={{ padding: 4 }}
                >
                  <MoreVertical size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {showThreeDotsMenu && (
            <TouchableOpacity 
              style={styles.dropdownOverlayBackdrop} 
              activeOpacity={1} 
              onPress={() => setShowThreeDotsMenu(false)}
            >
              <View style={[styles.threeDotsDropdown, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <TouchableOpacity 
                  style={styles.dropdownOptionRow} 
                  onPress={() => {
                    setShowThreeDotsMenu(false);
                    setShowMembersListModal(true);
                  }} 
                  activeOpacity={0.75}
                >
                  <Users size={16} color={primaryColor} />
                  <Text style={[styles.dropdownOptionText, { color: colors.textPrimary }]}>View Members List</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dropdownOptionRow}
                  onPress={() => {
                    setShowThreeDotsMenu(false);
                    setUsernameDraft(myUsername);
                    setShowUsernameModal(true);
                  }}
                  activeOpacity={0.75}
                >
                  <AtSign size={16} color={primaryColor} />
                  <Text style={[styles.dropdownOptionText, { color: colors.textPrimary }]}>{myUsername ? `My username: @${myUsername}` : 'Set my username'}</Text>
                </TouchableOpacity>

                {isMember && (
                  <TouchableOpacity 
                    style={styles.dropdownOptionRow} 
                    onPress={() => {
                      setShowThreeDotsMenu(false);
                      setShowLeaveConfirmModal(true);
                    }} 
                    activeOpacity={0.75}
                  >
                    <LogOut size={16} color="#EF4444" />
                    <Text style={styles.dropdownLeaveText}>Leave Community Group</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          )}

          {pinnedMessages.length > 0 && !isSelectionMode && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handlePinnedBannerPress}
              style={[styles.pinnedBannerBar, { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF', borderColor: colors.border }]}
            >
              <Pin size={14} color={primaryColor} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: primaryColor }}>
                  {pinnedMessages.length > 1
                    ? `Pinned Message ${safePinnedIndex + 1} of ${pinnedMessages.length}`
                    : 'Pinned Message'}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textPrimary }} numberOfLines={1}>
                  {pinnedMessages[safePinnedIndex]?.type === 'image' ? '📷 Photo' : (pinnedMessages[safePinnedIndex]?.text || pinnedMessages[safePinnedIndex]?.fileName || '')}
                </Text>
              </View>
              {pinnedMessages.length > 1 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
                  {pinnedMessages.slice(0, 6).map((_: any, i: number) => (
                    <View key={i} style={{ width: 5, height: 5, borderRadius: 3, marginHorizontal: 2, backgroundColor: i === safePinnedIndex ? primaryColor : colors.border }} />
                  ))}
                </View>
              )}
              {isAdmin && (
                <TouchableOpacity onPress={() => handleTogglePinMessage(pinnedMessages[safePinnedIndex])} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <PinOff size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}

          <KeyboardAvoidingView 
            style={{ flex: 1, backgroundColor: colors.bgLight, paddingBottom: Platform.OS === 'android' ? kbInset : 0 }}
            enabled={Platform.OS === 'ios'}
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              chatOuterH.current = h;
              if (!kbShown.current) chatBaseH.current = h;
            }}
          >
            <TouchableWithoutFeedback onPress={() => { 
              Keyboard.dismiss(); 
              setShowEmojiPicker(false); 
            }}>
              <View style={{ flex: 1 }}>
                <FlatList
                  ref={chatListRef}
                  data={chatMessages}
                  extraData={chatListExtra}
                  initialNumToRender={14}
                  maxToRenderPerBatch={8}
                  windowSize={9}
                  updateCellsBatchingPeriod={40}
                  onEndReachedThreshold={0.4}
                  onEndReached={() => { if (chatMessages.length >= msgLimit) setMsgLimit((n) => Math.min(n + 60, 1000)); }}
                  keyExtractor={(item) => item.id}
                  inverted
                  onScrollToIndexFailed={(info) => {
                    chatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
                    setTimeout(() => {
                      try { chatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 }); } catch (_) {}
                    }, 150);
                  }}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, flexGrow: 1 }}
                  renderItem={renderChatItem}
                />
              </View>
            </TouchableWithoutFeedback>

            {showUndoToast && (
              <View style={[styles.undoToastContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#0F172A' }]}>
                <Text style={styles.undoToastText}>Message deleted</Text>
                <TouchableOpacity onPress={handleUndoDelete} style={styles.undoBtn} activeOpacity={0.8}>
                  <RotateCcw size={16} color="#38BDF8" style={{ marginRight: 4 }} />
                  <Text style={styles.undoBtnText}>UNDO</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.cleanBottomInputWrapper}>
              {mentionSuggestions.length > 0 && (
                <View style={{ backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border, borderWidth: 1, borderRadius: 14, marginHorizontal: 8, marginBottom: 6, overflow: 'hidden' }}>
                  {mentionSuggestions.map((m: any) => (
                    <TouchableOpacity
                      key={m.uid}
                      activeOpacity={0.7}
                      onPress={() => insertMention(m.handle, m.uid)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
                    >
                      <View style={[styles.chatAvatarThumb, { backgroundColor: getAvatarColor(m.userName), marginRight: 10 }]}>
                        {m.photoURL ? (
                          <Image source={{ uri: m.photoURL }} style={styles.chatAvatarImg} />
                        ) : (
                          <Text style={styles.chatAvatarThumbText}>{(m.userName || 'U').charAt(0).toUpperCase()}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>{m.userName}</Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>@{m.handle}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {editingMessage && (
                <View style={[styles.inlineEditHeader, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Edit3 size={13} color={primaryColor} />
                    <Text style={[styles.inlineEditText, { color: primaryColor }]}>Editing message</Text>
                  </View>
                  <TouchableOpacity onPress={handleCancelInlineEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={15} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.cleanInputInnerRow, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
                <TouchableOpacity 
                  onPress={handleToggleEmojiOrKeyboard} 
                  style={{ padding: 6 }}
                  activeOpacity={0.75}
                >
                  {showEmojiPicker ? (
                    <KeyboardIcon size={22} color={primaryColor} />
                  ) : (
                    <Smile size={22} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={openMediaPicker} 
                  style={{ padding: 6 }}
                >
                  <Paperclip size={20} color={showMediaPicker ? primaryColor : colors.textSecondary} />
                </TouchableOpacity>

                {isRecording ? (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, marginHorizontal: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', marginRight: 8 }} />
                    <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 13, flex: 1 }}>{recordTime}</Text>
                    <TouchableOpacity onPress={handleCancelRecording} style={{ padding: 4 }}>
                      <Trash2 size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TextInput
                    ref={textInputRef}
                    style={{ 
                      flex: 1, 
                      color: colors.textPrimary, 
                      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', 
                      paddingHorizontal: 16, 
                      paddingVertical: Platform.OS === 'ios' ? 10 : 8, 
                      borderRadius: 24, 
                      fontSize: 14, 
                      marginHorizontal: 4,
                      maxHeight: 90,
                      minHeight: 42,
                      textAlignVertical: 'center'
                    }}
                    placeholder={editingMessage ? "Edit message..." : "Type a message..."}
                    placeholderTextColor={colors.textSecondary}
                    value={chatInputText}
                    onChangeText={setChatInputText}
                    onSubmitEditing={() => {
                      if (chatInputText.trim() && !isSendingChat) handleSendGroupMessage();
                    }}
                    blurOnSubmit={false}
                    returnKeyType="send"
                    onFocus={() => { 
                      setShowEmojiPicker(false); 
                      setShowMediaPicker(false); 
                      setShowThreeDotsMenu(false); 
                    }}
                  />
                )}

                {isRecording ? (
                  <TouchableOpacity onPress={handleStopAndSendRecording} style={[styles.roundActionBtn, { backgroundColor: primaryColor }]}>
                    <Send size={16} color="#FFF" />
                  </TouchableOpacity>
                ) : chatInputText.trim().length > 0 ? (
                  <TouchableOpacity onPress={handleSendGroupMessage} disabled={isSendingChat} style={[styles.roundActionBtn, { backgroundColor: primaryColor }]}>
                    {isSendingChat ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : editingMessage ? (
                      <Check size={18} color="#FFF" strokeWidth={3} />
                    ) : (
                      <Send size={18} color="#FFF" />
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={handleStartRecording} style={[styles.roundActionBtn, { backgroundColor: primaryColor }]}>
                    <Mic size={18} color="#FFF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {showEmojiPicker && (
              <Animated.View
                style={[
                  styles.whatsappEmojiKeyboardSwap,
                  {
                    height: savedKeyboardHeight,
                    backgroundColor: colors.bgCard,
                    opacity: emojiTrayAnim.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }),
                    transform: [{ translateY: emojiTrayAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
                  },
                ]}
              >
                <ScrollView 
                  contentContainerStyle={styles.emojiGridContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                >
                  {EMOJI_LIST.map((emoji, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={styles.emojiKeyItem} 
                      onPress={() => setChatInputText(prev => prev + emoji)}
                      activeOpacity={0.65}
                    >
                      <Text style={{ fontSize: 28 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Animated.View>
            )}

          </KeyboardAvoidingView>
        </SafeAreaView>

        {selectedMessageForAction && (
          <Modal transparent visible={true} animationType="none" onRequestClose={() => setSelectedMessageForAction(null)}>
            <TouchableOpacity style={styles.reactionOverlayBg} activeOpacity={1} onPress={() => setSelectedMessageForAction(null)}>
              <View style={[styles.whatsappActionContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
                <View style={styles.reactionPickerBar}>
                  {QUICK_REACTIONS.map((emoji) => (
                    <TouchableOpacity 
                      key={emoji} 
                      style={[styles.reactionEmojiItem, { flex: 0, width: reactionItemW }]} 
                      onPress={() => handleAddReaction(selectedMessageForAction.id, emoji)}
                      activeOpacity={0.7}
                    >
                      <Text allowFontScaling={false} style={{ fontSize: 22 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {(isAdmin || canOpenDeleteForMessage(selectedMessageForAction)) && (
                <View style={[styles.actionOptionsRow, { borderTopColor: colors.border }]}>
                  {isAdmin && (
                  <TouchableOpacity 
                    style={styles.actionOptionBtn}
                    onPress={() => handleTogglePinMessage(selectedMessageForAction)}
                  >
                    {selectedMessageForAction?.isPinned ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <PinOff size={16} color="#F59E0B" />
                        <Text style={[styles.actionOptionText, { color: '#F59E0B' }]}>Unpin</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Pin size={16} color={primaryColor} />
                        <Text style={[styles.actionOptionText, { color: primaryColor }]}>Pin Message</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  )}

                  {canOpenDeleteForMessage(selectedMessageForAction) && (
                    <TouchableOpacity 
                      style={styles.actionOptionBtn}
                      onPress={() => {
                        const targetId = selectedMessageForAction.id;
                        setSelectedMessageForAction(null);
                        setSelectedMessageIds([targetId]);
                        setDeleteModalVisible(true);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Trash2 size={16} color="#EF4444" />
                        <Text style={[styles.actionOptionText, { color: '#EF4444' }]}>Delete</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
                )}
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {!!previewImageUrl && (
          <Modal transparent visible={true} animationType="fade" onRequestClose={() => setPreviewImageUrl(null)}>
            <ZoomableImage uri={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />
          </Modal>
        )}

        {showUsernameModal && (
          <Modal transparent visible={true} animationType="fade" onRequestClose={() => setShowUsernameModal(false)}>
            <TouchableOpacity style={styles.mediaOverlayBackdrop} activeOpacity={1} onPress={() => setShowUsernameModal(false)}>
              <TouchableOpacity activeOpacity={1} style={[styles.premiumMediaSheet, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]} onPress={(e) => e.stopPropagation()}>
                <Text style={[styles.mediaSheetTitle, { color: colors.textPrimary, marginBottom: 6 }]}>Your username</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
                  Others can mention you with @{usernameDraft || 'username'}. 3-20 characters: letters, numbers, . or _
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '800', fontSize: 16 }}>@</Text>
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, paddingVertical: 10, paddingHorizontal: 6, fontSize: 15 }}
                    value={usernameDraft}
                    onChangeText={(v) => setUsernameDraft(v.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20))}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                    placeholder="username"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <TouchableOpacity
                  onPress={handleSaveUsername}
                  disabled={usernameBusy}
                  activeOpacity={0.85}
                  style={{ marginTop: 16, backgroundColor: primaryColor, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: usernameBusy ? 0.6 : 1 }}
                >
                  {usernameBusy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Save</Text>}
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        {showMediaPicker && (
          <Modal transparent visible={true} animationType="fade" onRequestClose={closeMediaPicker}>
            <TouchableOpacity style={styles.mediaOverlayBackdrop} activeOpacity={1} onPress={closeMediaPicker}>
              <TouchableOpacity activeOpacity={1} style={[styles.premiumMediaSheet, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]} onPress={(e) => e.stopPropagation()}>
                <View style={styles.mediaSheetHeader}>
                  <Text style={[styles.mediaSheetTitle, { color: colors.textPrimary }]}>Share Content</Text>
                  <TouchableOpacity style={styles.mediaCloseCircle} onPress={closeMediaPicker} activeOpacity={0.8}>
                    <X size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <View style={styles.mediaGridContainer}>
                  {isAdmin && (
                  <>
                  <TouchableOpacity style={styles.mediaActionItem} onPress={() => { closeMediaPicker(); handlePickImage(true); }}>
                    <View style={[styles.mediaIconCircle, { backgroundColor: '#EC4899' }]}>
                      <Camera size={22} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.mediaActionLabel, { color: colors.textPrimary }]}>Camera</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.mediaActionItem} onPress={() => { closeMediaPicker(); handlePickImage(false); }}>
                    <View style={[styles.mediaIconCircle, { backgroundColor: '#8B5CF6' }]}>
                      <ImageIcon size={22} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.mediaActionLabel, { color: colors.textPrimary }]}>Gallery</Text>
                  </TouchableOpacity>

                  </>
                  )}

                  <TouchableOpacity style={styles.mediaActionItem} onPress={() => { closeMediaPicker(); handlePickDocument('document'); }}>
                    <View style={[styles.mediaIconCircle, { backgroundColor: '#3B82F6' }]}>
                      <FileText size={22} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.mediaActionLabel, { color: colors.textPrimary }]}>Document</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.mediaActionItem} onPress={() => { closeMediaPicker(); handlePickDocument('audio'); }}>
                    <View style={[styles.mediaIconCircle, { backgroundColor: '#F59E0B' }]}>
                      <Music size={22} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.mediaActionLabel, { color: colors.textPrimary }]}>Audio</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.mediaActionItem} onPress={() => { closeMediaPicker(); Alert.alert("Location", "Share Live Location"); }}>
                    <View style={[styles.mediaIconCircle, { backgroundColor: '#10B981' }]}>
                      <MapPin size={22} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.mediaActionLabel, { color: colors.textPrimary }]}>Location</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}
      </Modal>

      {/* JOIN CONFIRMATION MODAL */}
      <Modal
        visible={showJoinConfirmModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowJoinConfirmModal(false)}
      >
        <TouchableOpacity style={styles.premiumModalOverlay} activeOpacity={1} onPress={() => setShowJoinConfirmModal(false)}>
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.premiumDialogCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.joinIconAura}>
              <UserPlus size={30} color="#10B981" />
            </View>
            <Text style={[styles.dialogMainTitle, { color: colors.textPrimary }]}>Join Community?</Text>
            <Text style={[styles.dialogDescriptionText, { color: colors.textSecondary }]}>
              Join the ECC Community Chat with your own profile. You can leave anytime and join again later.
            </Text>

            <View style={styles.dialogButtonsRow}>
              <TouchableOpacity
                style={[styles.dialogCancelBtn, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}
                onPress={() => setShowJoinConfirmModal(false)}
                disabled={isJoining}
              >
                <Text style={[styles.dialogCancelBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogConfirmJoinBtn}
                onPress={handleExecuteJoinCommunity}
                disabled={isJoining}
              >
                {isJoining ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.dialogConfirmJoinBtnText}>Join</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* MEMBERS LIST MODAL */}
      <MembersModal
        visible={showMembersListModal}
        onClose={closeMembersModal}
        members={membersForModal}
        total={membersForModal.length}
        myUid={currentUser?.uid}
        isAdmin={isAdmin}
        isDarkMode={isDarkMode}
        colors={colors}
        primaryColor={primaryColor}
        onKick={kickFromList}
      />

      {/* LEAVE MODAL */}
      <Modal visible={showLeaveConfirmModal} animationType="fade" transparent={true} onRequestClose={() => setShowLeaveConfirmModal(false)}>
        <TouchableOpacity style={styles.premiumModalOverlay} activeOpacity={1} onPress={() => setShowLeaveConfirmModal(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.premiumDialogCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.leaveIconAura}>
              <LogOut size={30} color="#EF4444" />
            </View>
            <Text style={[styles.dialogMainTitle, { color: colors.textPrimary }]}>Leave Community Group?</Text>
            <Text style={[styles.dialogDescriptionText, { color: colors.textSecondary }]}>
              You will no longer receive live messages and access group discussions until you re-join.
            </Text>

            <View style={styles.dialogButtonsRow}>
              <TouchableOpacity 
                style={[styles.dialogCancelBtn, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]} 
                onPress={() => setShowLeaveConfirmModal(false)}
                disabled={isLeaving}
                activeOpacity={0.8}
              >
                <Text style={[styles.dialogCancelBtnText, { color: colors.textPrimary }]}>Stay</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.dialogConfirmLeaveBtn} 
                onPress={handleExecuteLeaveCommunity}
                disabled={isLeaving}
                activeOpacity={0.85}
              >
                {isLeaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.dialogConfirmLeaveBtnText}>Yes, Leave</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ADMIN REMOVE MEMBER MODAL */}
      <Modal visible={showKickConfirmModal} animationType="fade" transparent={true} onRequestClose={() => setShowKickConfirmModal(false)}>
        <TouchableOpacity style={styles.premiumModalOverlay} activeOpacity={1} onPress={() => setShowKickConfirmModal(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.premiumDialogCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.leaveIconAura}>
              <UserX size={30} color="#EF4444" />
            </View>
            <Text style={[styles.dialogMainTitle, { color: colors.textPrimary }]}>Remove Member?</Text>
            <Text style={[styles.dialogDescriptionText, { color: colors.textSecondary }]}>
              {memberToKick?.userName || 'This user'} will lose access to the community chat. Their previous messages will remain unless an admin deletes them.
            </Text>
            <View style={styles.dialogButtonsRow}>
              <TouchableOpacity style={[styles.dialogCancelBtn, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]} onPress={() => setShowKickConfirmModal(false)} disabled={isKicking}>
                <Text style={[styles.dialogCancelBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dialogConfirmLeaveBtn} onPress={handleExecuteAdminKick} disabled={isKicking}>
                {isKicking ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.dialogConfirmLeaveBtnText}>Remove</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} animationType="fade" transparent={true} onRequestClose={() => setDeleteModalVisible(false)}>
        <TouchableOpacity style={styles.deleteModalOverlay} activeOpacity={1} onPress={() => setDeleteModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.deleteModalCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.deleteIconBadge}>
              <AlertTriangle size={28} color="#EF4444" />
            </View>
            <Text style={[styles.deleteTitle, { color: colors.textPrimary }]}>
              {selectedMessageIds.length > 1 ? `Delete ${selectedMessageIds.length} Messages?` : 'Delete Message?'}
            </Text>
            {selectedMessageIds.length === 1 && (() => {
              const selectedMessage = chatMessages.find((m: any) => m.id === selectedMessageIds[0]);
              if (!selectedMessage) return null;
              const senderName =
                selectedMessage.senderName ||
                selectedMessage.userName ||
                (selectedMessage.senderId === currentUser?.uid
                  ? (currentUser?.displayName || currentUser?.email?.split('@')[0])
                  : 'User') || 'User';
              const senderPhoto = selectedMessage.senderPhoto || (selectedMessage.senderId === currentUser?.uid ? currentUser?.photoURL : '');
              return (
                <View style={styles.deleteSenderRow}>
                  <View style={[styles.deleteSenderAvatar, { backgroundColor: getAvatarColor(senderName) }]}>
                    {senderPhoto ? (
                      <Image source={{ uri: senderPhoto }} style={styles.deleteSenderAvatarImg} />
                    ) : (
                      <Text style={styles.deleteSenderAvatarText}>{senderName.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.deleteSenderName, { color: colors.textPrimary }]} numberOfLines={1}>{senderName}</Text>
                    <Text style={[styles.deleteSenderHint, { color: colors.textSecondary }]}>Selected message</Text>
                  </View>
                </View>
              );
            })()}

            <Text style={[styles.deleteSubtitle, { color: colors.textSecondary }]}>
              {isAdmin
                ? 'Delete for me hides the selected message(s) only from your chat. Delete for everyone removes them for all members.'
                : 'Delete for me hides the selected message(s) only from your chat. You can delete your own message for everyone within 1 hour.'}
            </Text>

            <View style={styles.deleteOptionsContainer}>
              <TouchableOpacity
                style={[styles.deleteOptionBtn, styles.deleteForMeBtn]}
                onPress={deleteSelectedMessagesForMe}
                activeOpacity={0.82}
              >
                <Text style={styles.deleteOptionBtnText}>Delete for me</Text>
              </TouchableOpacity>

              {(() => {
                const selected = selectedMessageIds
                  .map(id => chatMessages.find((m: any) => m.id === id))
                  .filter(Boolean);
                const canEveryone = selected.length > 0 &&
                  selected.length === selectedMessageIds.length &&
                  selected.every((m: any) => canDeleteForEveryone(m));

                return canEveryone ? (
                  <TouchableOpacity
                    style={[styles.deleteOptionBtn, styles.deleteForEveryoneBtn]}
                    onPress={confirmDeleteSelectedMessages}
                    activeOpacity={0.82}
                  >
                    <Text style={styles.deleteOptionBtnText}>Delete for everyone</Text>
                  </TouchableOpacity>
                ) : null;
              })()}

              <TouchableOpacity
                style={[styles.deleteOptionBtn, styles.deleteCancelBtn, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]}
                onPress={() => setDeleteModalVisible(false)}
                activeOpacity={0.82}
              >
                <Text style={[styles.deleteOptionCancelText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* CHALLENGE QUIZ MODAL WITH FULL-SCREEN SMOOTH CONFETTI */}
      <Modal
        visible={isStudentQuizModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeQuizModal}
      >
        <View style={styles.quizModalOverlay}>
          {showConfetti && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <ConfettiCannon 
                count={220} 
                origin={{ x: SCREEN_WIDTH / 2, y: 0 }} 
                fadeOut={true} 
                autoStart={true} 
                fallSpeed={2800}
                explosionSpeed={350}
              />
            </View>
          )}

          <View style={[styles.quizModalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.quizModalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.quizModalTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                  {currentTakingQuiz?.title || 'Challenge'}
                </Text>
                <Text style={[styles.quizModalProgress, { color: colors.textSecondary }]}>
                  {quizCompleted ? 'Challenge complete' : `Question ${Math.min(currentQuestionIndex + 1, activeQuizTotal)} of ${activeQuizTotal}`}
                </Text>
              </View>
              <TouchableOpacity onPress={closeQuizModal} style={styles.quizCloseBtn} activeOpacity={0.8}>
                <X size={19} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {quizCompleted ? (
              <View style={styles.quizResultBox}>
                <View style={styles.quizResultIcon}>
                  <Trophy size={30} color="#F59E0B" />
                </View>
                <Text style={[styles.quizResultTitle, { color: colors.textPrimary }]}>Challenge Complete! 🎉</Text>
                <Text style={[styles.quizResultScore, { color: primaryColor }]}>
                  {calculatedScore}/{activeQuizTotal}
                </Text>
                <Text style={[styles.quizResultSub, { color: colors.textSecondary }]}>+20 XP earned</Text>
                <TouchableOpacity style={[styles.quizPrimaryBtn, { backgroundColor: primaryColor }]} onPress={closeQuizModal} activeOpacity={0.85}>
                  <Text style={styles.quizPrimaryBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : activeQuizQuestion ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
                <View style={styles.quizTimerBadgeRow}>
                  <Timer size={15} color={quizTimerSeconds <= 5 ? '#EF4444' : '#3B82F6'} />
                  <Text style={[styles.quizTimerText, { color: quizTimerSeconds <= 5 ? '#EF4444' : colors.textPrimary }]}>
                    {quizTimerSeconds}s
                  </Text>
                  <View style={styles.timerProgressBarTrack}>
                    <View style={[styles.timerProgressBarFill, { backgroundColor: quizTimerSeconds <= 5 ? '#EF4444' : '#3B82F6', width: `${Math.max(0, Math.min(100, (quizTimerSeconds / 15) * 100))}%` }]} />
                  </View>
                </View>

                <Text style={[styles.quizQuestionText, { color: colors.textPrimary }]}>
                  {activeQuizQuestion.questionText}
                </Text>

                <View style={{ gap: 10 }}>
                  {(activeQuizQuestion.options || []).map((option: string, optionIndex: number) => {
                    const isChosen = userSelectedOption === optionIndex;
                    const isCorrect = optionIndex === activeQuizQuestion.correctAnswerIndex;
                    const isWrong = isAnswerSubmitted && isChosen && !isCorrect;
                    const showResult = isAnswerSubmitted;
                    return (
                      <TouchableOpacity
                        key={`${currentQuestionIndex}_${optionIndex}`}
                        onPress={() => handleSelectOption(optionIndex)}
                        disabled={isAnswerSubmitted}
                        activeOpacity={0.82}
                        style={[
                          styles.quizOptionBtn,
                          {
                            backgroundColor: showResult && isCorrect
                              ? 'rgba(16, 185, 129, 0.12)'
                              : (isWrong
                                ? 'rgba(239, 68, 68, 0.12)'
                                : (isChosen ? 'rgba(99, 102, 241, 0.12)' : (isDarkMode ? '#0F172A' : '#F8FAFC'))),
                            borderColor: showResult && isCorrect
                              ? '#10B981'
                              : (isWrong ? '#EF4444' : (isChosen ? primaryColor : colors.border)),
                          }
                        ]}
                      >
                        <Text style={[styles.quizOptionText, { color: colors.textPrimary }]}>{option}</Text>
                        {showResult && isCorrect && <CheckCircle size={18} color="#10B981" />}
                        {isWrong && <XCircle size={18} color="#EF4444" />}
                        {!showResult && isChosen && <CheckCircle size={18} color={primaryColor} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {isAnswerSubmitted && (
                  <View style={[styles.quizExplanationBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}>
                    <Text style={[styles.quizExplanationTitle, { color: primaryColor }]}>Explanation</Text>
                    <Text style={[styles.quizExplanationText, { color: colors.textSecondary }]}>
                      {activeQuizQuestion.explanation || 'Good effort! Review the correct option and continue.'}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.quizPrimaryBtn, { backgroundColor: isAnswerSubmitted ? primaryColor : (userSelectedOption === null ? '#94A3B8' : primaryColor) }]}
                  onPress={isAnswerSubmitted ? handleNextQuestion : handleConfirmAnswer}
                  disabled={!isAnswerSubmitted && userSelectedOption === null}
                  activeOpacity={0.85}
                >
                  <Text style={styles.quizPrimaryBtnText}>{isAnswerSubmitted ? (currentQuestionIndex + 1 < activeQuizTotal ? 'Next Question' : 'Finish Challenge') : 'Submit Answer'}</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <View style={styles.quizResultBox}>
                <ActivityIndicator size="large" color={primaryColor} />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  responsiveCenterWrapper: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingTop: 8,
  },

  topHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 0,
    marginBottom: -4,
    zIndex: 10,
  },
  headerLeftBlock: { flex: 1, paddingRight: 6, paddingBottom: 12 },
  realChatLogoPill: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.2,
    borderColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainScreenTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  mainScreenSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  headerRightBlock: { 
    alignItems: 'flex-end', 
    justifyContent: 'flex-end',
  },
  childrenArtworkTouching: {
    width: 154,
    height: 96,
    marginBottom: -6,
  },

  tabsContainer: { 
    flexDirection: 'row', 
    marginHorizontal: 16, 
    borderRadius: 16, 
    padding: 4, 
    marginBottom: 16,
    zIndex: 11,
  },
  tab: { 
    flex: 1, 
    flexDirection: 'row', 
    gap: 4,
    paddingVertical: 10, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderRadius: 12 
  },
  activeTab: { 
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4
  },
  tabText: { fontSize: 11.5, fontWeight: '700' },

  scrollList: { paddingHorizontal: 16, paddingBottom: 100 },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeadingTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  
  chatCardOuterWrapper: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    backgroundColor: '#3B82F6',
    position: 'relative',
    minHeight: 180,
  },
  chatBannerImageTight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  communityContentLayer: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  communityTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  eccAvatarPillWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  eccAvatarText: { fontSize: 14, fontWeight: '900', color: '#2563EB' },
  chatCardTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3, color: '#0F172A' },
  chatCardSub: { fontSize: 11.5, fontWeight: '800', marginTop: 2, color: '#1E293B' },
  realBlueTickBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  memberTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  memberTagBadgeText: { fontSize: 10.5, fontWeight: '900', color: '#0F172A' },
  activeTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(220, 252, 231, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeTagBadgeText: { fontSize: 10.5, fontWeight: '900' },
  
  membersAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  memberCircleAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  memberImg: {
    width: '100%',
    height: '100%',
  },
  memberInitialsText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  memberCircleAvatarPlus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberPlusText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  neonGlowWrapper: {
    width: '100%',
    borderRadius: 16,
  },
  premiumShineJoinBtn: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 16,
    width: '100%',
  },
  premiumShineJoinBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },

  openChatActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    width: '100%',
  },
  openChatActionBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },

  dropdownOverlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  threeDotsDropdown: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 54 : 56,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    zIndex: 999,
    paddingVertical: 6,
    minWidth: 180,
  },
  dropdownOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dropdownLeaveText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  dropdownOptionText: {
    fontSize: 13,
    fontWeight: '800',
  },

  selectionTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 10,
    elevation: 4,
  },
  selectedCountText: {
    fontSize: 17,
    fontWeight: '900',
  },
  batchEditTopBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  batchDeleteTopBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },

  messageRowWrap: {
    width: '100%',
    paddingHorizontal: 4,
    marginVertical: 2,
  },
  messageInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageRowWithReaction: {
    marginBottom: 16,
  },
  messageReactionSideBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  undoToastContainer: {
    position: 'absolute',
    bottom: 74,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    width: '90%',
    maxWidth: 360,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 999,
  },
  undoToastText: {
    color: '#F8FAFC',
    fontSize: 13.5,
    fontWeight: '700',
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  undoBtnText: {
    color: '#38BDF8',
    fontSize: 13.5,
    fontWeight: '900',
  },

  pinnedBannerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  messagePinIconAnchor: {
    position: 'absolute',
    top: 6,
    right: 8,
  },

  chatAvatarThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  chatAvatarImg: {
    width: '100%',
    height: '100%',
  },
  chatAvatarThumbText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  standaloneEmojiMessage: {
    fontSize: 42,
    lineHeight: 50,
    paddingVertical: 2,
  },
  adminTagBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  adminTagBadgeText: {
    color: '#8B5CF6',
    fontSize: 9,
    fontWeight: '900',
  },

  membersModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  membersModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 18,
    maxHeight: SCREEN_HEIGHT * 0.65,
    elevation: 12,
  },
  membersModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  membersModalTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  memberItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  memberAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  memberAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  memberNameText: {
    fontSize: 14,
    fontWeight: '800',
  },
  memberStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },

  adminKickBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    marginLeft: 10,
  },

  premiumModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  premiumDialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    elevation: 16,
  },
  joinIconAura: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  leaveIconAura: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  dialogMainTitle: {
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  dialogDescriptionText: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  dialogButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  dialogConfirmJoinBtn: {
    flex: 1.2,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogConfirmJoinBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13.5,
  },
  dialogConfirmLeaveBtn: {
    flex: 1.2,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogConfirmLeaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13.5,
  },

  quizTimerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 4,
  },
  quizTimerText: {
    fontSize: 13,
    fontWeight: '900',
  },
  timerProgressBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    overflow: 'hidden',
    marginLeft: 6,
  },
  timerProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  quizModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  quizModalCard: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '88%',
    borderRadius: 26,
    borderWidth: 1.2,
    padding: 20,
    elevation: 18,
  },
  quizModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  quizModalTitle: {
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 24,
  },
  quizModalProgress: {
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 4,
  },
  quizCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(148, 163, 184, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizQuestionText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 14,
  },
  quizOptionBtn: {
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1.4,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quizOptionText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '700',
    paddingRight: 8,
  },
  quizExplanationBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  quizExplanationTitle: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  quizExplanationText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  quizPrimaryBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  quizPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  quizResultBox: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  quizResultIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quizResultTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  quizResultScore: {
    fontSize: 36,
    fontWeight: '900',
    marginTop: 8,
  },
  quizResultSub: {
    fontSize: 12.5,
    fontWeight: '700',
  },

  challengeCardBox: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  challengeCardBoxGreen: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  challengeIconBubble3D: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeCardTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  challengeCardSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  timeLeftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  timeLeftBadgeText: { color: '#3B82F6', fontSize: 11, fontWeight: '800' },
  startChallengeActionBtn: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startChallengeActionBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  completedChallengePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#10B981',
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
  },

  playLearnSingleContainer: {
    width: '100%',
    marginTop: 6,
  },
  singleGameCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 4,
  },
  singleGameLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gameIconBubbleLarge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  xpBonusBadge: {
    backgroundColor: 'rgba(147, 51, 234, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  xpBonusBadgeText: {
    color: '#7E22CE',
    fontSize: 11,
    fontWeight: '900',
  },
  singleGamePlayButton: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleGamePlayButtonText: {
    color: '#581C87',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  gameCardTitle: { fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  gameCardSub: { fontSize: 11.5, fontWeight: '500', color: '#64748B', marginTop: 2 },

  puzzleTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  zipLogoBadge: {
    backgroundColor: '#6366F1',
    borderRadius: 6,
    padding: 4,
  },

  tapWordActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 340,
    marginVertical: 12,
  },
  wordDisplayStripTap: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordDisplayText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  clearWordBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkWordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
  },
  checkWordBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },

  zipBoardFrame: {
    borderWidth: 2.5,
    borderRadius: 18,
    padding: 10,
    gap: 8,
  },
  zipBoardRow: {
    flexDirection: 'row',
    gap: 8,
  },
  zipGridCell: {
    width: (SCREEN_WIDTH > 400 ? 68 : 60),
    height: (SCREEN_WIDTH > 400 ? 68 : 60),
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  zipGridCellText: { fontSize: 22, fontWeight: '900' },
  tapOrderBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapOrderBadgeText: {
    color: '#4F46E5',
    fontSize: 10,
    fontWeight: '900',
  },
  discoveredWordCard: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  discoveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
    marginBottom: 4,
  },
  discoveredBadgeText: { color: '#FFF', fontWeight: '900', fontSize: 11.5 },
  discoveredMeaningText: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  zipControlsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 350,
    marginTop: 18,
    marginBottom: 20,
  },
  zipControlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  zipControlBtnText: { fontSize: 14, fontWeight: '800' },

  resultsModalCard: {
    borderRadius: 24,
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  playerResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },

  liveNowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  liveNowPillText: { color: '#3B82F6', fontSize: 11, fontWeight: '800' },
  voiceRoomsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  voiceRoomGridCard: {
    width: '31.5%',
    minHeight: 185,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomEmojiBubble: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  roomCardTitle: { fontSize: 13, fontWeight: '900', textAlign: 'center', letterSpacing: -0.2 },
  roomCardSub: { fontSize: 10.5, marginTop: 2, textAlign: 'center', fontWeight: '500' },
  roomOnlineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: 6,
  },
  roomOnlineCount: { fontSize: 10.5, fontWeight: '800' },
  greenDot: { width: 6, height: 6, borderRadius: 3 },
  joinRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    paddingVertical: 7,
    borderRadius: 10,
  },
  joinRoomBtnText: { fontSize: 12, fontWeight: '900' },

  fluencyTipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 22,
  },
  fluencyTipText: { fontSize: 12.5, flex: 1, lineHeight: 18 },

  createPostBox: { 
    marginHorizontal: 16, 
    borderRadius: 18, 
    borderWidth: 1.5, 
    padding: 12, 
    marginBottom: 16, 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  postInput: { flex: 1, maxHeight: 80, fontSize: 13.5, paddingRight: 8 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  premiumCard: { borderRadius: 20, padding: 16, borderWidth: 1.5, marginBottom: 14 },
  avatarGlow: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  deleteIconButton: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.12)' },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userNameText: { fontSize: 14.5, fontWeight: '800' },

  whatsappEmojiKeyboardSwap: { 
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  emojiGridContent: {
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    paddingHorizontal: 8,
    paddingVertical: 10,
    justifyContent: 'flex-start'
  },
  emojiKeyItem: {
    width: '12.5%', 
    paddingVertical: 10, 
    alignItems: 'center', 
    justifyContent: 'center'
  },

  reactionOverlayBg: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.35)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  whatsappActionContainer: {
    borderRadius: 24,
    elevation: 8,
    padding: 10,
    width: '92%',
    maxWidth: 360,
  },
  reactionPickerBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: 8, 
  },
  // Each emoji takes an equal share of the card width, so all 8 always stay INSIDE the card
  reactionEmojiItem: { 
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6, 
    paddingHorizontal: 0,
    borderRadius: 12, 
  },
  actionOptionsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    borderTopWidth: 1, 
    marginTop: 6, 
    paddingTop: 8, 
  },
  actionOptionBtn: { 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
  },
  actionOptionText: { 
    fontSize: 13, 
    fontWeight: '800', 
  },

  pureTransparentReactionBadge: { 
    position: 'absolute', 
    bottom: -11, 
    left: 8, 
    backgroundColor: 'transparent', 
    paddingHorizontal: 2, 
    paddingVertical: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    zIndex: 10 
  },

  whatsappReactionPillContainer: {
    position: 'absolute',
    bottom: -11,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  whatsappReactionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  whatsappReactionCountText: {
    color: '#334155',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    marginLeft: 1
  },

  cleanBottomInputWrapper: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 14 : 12,
    backgroundColor: 'transparent',
  },
  inlineEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 6,
  },
  inlineEditText: {
    fontSize: 12,
    fontWeight: '800',
  },
  cleanInputInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 28,
  },
  roundActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  mediaOverlayBackdrop: {
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.45)', 
    justifyContent: 'flex-end', 
  },
  chatImageMessage: {
    width: 220,
    height: 220,
    borderRadius: 14,
    backgroundColor: '#CBD5E1',
  },
  chatImageUploading: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 190,
    maxWidth: 240,
  },
  chatFileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreviewImage: {
    width: '100%',
    height: '85%',
  },
  imagePreviewClose: {
    position: 'absolute',
    top: (StatusBar.currentHeight || 40) + 8,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumMediaSheet: {
    borderTopLeftRadius: 28, 
    borderTopRightRadius: 28, 
    padding: 20, 
    elevation: 16, 
  },
  mediaSheetHeader: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20, 
  },
  mediaSheetTitle: {
    fontSize: 17, 
    fontWeight: '900', 
  },
  mediaCloseCircle: {
    width: 30, 
    height: 30, 
    borderRadius: 15, 
    backgroundColor: '#64748B', 
    justifyContent: 'center', 
    alignItems: 'center', 
  },
  mediaGridContainer: {
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-around', 
    gap: 16, 
    paddingBottom: 10, 
  },
  mediaActionItem: {
    alignItems: 'center', 
    width: '28%', 
  },
  mediaIconCircle: {
    width: 54, 
    height: 54, 
    borderRadius: 27, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 6, 
  },
  mediaActionLabel: {
    fontSize: 12, 
    fontWeight: '700', 
  },

  deleteModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  deleteModalCard: { width: '100%', maxWidth: 340, borderRadius: 24, padding: 22, borderWidth: 1.5, alignItems: 'center', elevation: 10 },
  deleteIconBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(239, 68, 68, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  deleteTitle: { fontSize: 19, fontWeight: '800', marginBottom: 6 },
  deleteSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 14 },
  deleteSenderRow: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, marginBottom: 10, backgroundColor: 'rgba(148, 163, 184, 0.10)' },
  deleteSenderAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  deleteSenderAvatarImg: { width: '100%', height: '100%' },
  deleteSenderAvatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  deleteSenderName: { fontSize: 14, fontWeight: '900' },
  deleteSenderHint: { fontSize: 10.5, marginTop: 2 },
  deleteOptionsContainer: { width: '100%', gap: 10, marginTop: 2 },
  deleteOptionBtn: { width: '100%', paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  deleteForMeBtn: { backgroundColor: '#EF4444' },
  deleteForEveryoneBtn: { backgroundColor: '#DC2626' },
  deleteCancelBtn: { elevation: 0 },
  deleteOptionBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  deleteOptionCancelText: { fontWeight: '800', fontSize: 14 }
});