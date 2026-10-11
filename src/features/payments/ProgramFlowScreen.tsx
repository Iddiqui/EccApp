import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  TextInput,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Mic, Video, ChevronLeft, ArrowRight, Check, Crown, User, Tag } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { getTeachers } from '../sessions/sessionService';
import { getProgramPlans, previewProgram, getMySubscriptions, payWithRazorpay } from './paymentService';
import { PaymentFlowModal } from './PaymentFlowScreens';
import type {
  PayMethod,
  PayResult,
  ProgramAccess,
  ProgramMode,
  ProgramPlan,
  ProgramPreview,
} from './paymentTypes';

// ─────────────────────────────────────────────────────────────────────────
// ONE route ("ProgramFlowScreen") that runs the whole purchase flow with
// internal steps, so only one screen needs to be registered in the navigator:
//
//   mode -> intro -> teacher -> duration -> plan -> review -> payment -> success
//
// Optional route param: { mode: 'audio' | 'video' } to skip the first step.
// All prices, durations, sessions and features come from the server
// (Firestore `subscriptionPlans`). Nothing is hard-coded here.
// ─────────────────────────────────────────────────────────────────────────

type Step = 'mode' | 'intro' | 'teacher' | 'duration' | 'plan' | 'review';

const DURATIONS: Record<ProgramMode, number[]> = {
  video: [1, 2, 3, 6, 12],
  audio: [2, 3, 6, 12],
};

// Artwork (src/assets): plan = background art for the plan screens, Audio / video = the two learning-mode characters
const IMG_PLAN = require('../../assets/plan.png');
const IMG_AUDIO = require('../../assets/audio.png');
const IMG_VIDEO = require('../../assets/video.png');

const INTRO: Record<
  ProgramMode,
  { title: string; subtitle: string; features: string[] }
> = {
  video: {
    title: 'Video Mode',
    subtitle: 'Get personal 1:1 video sessions with an expert trainer and improve your English.',
    features: [
      'One-to-one attention',
      '30-minute sessions',
      'Flexible scheduling',
      'Detailed feedback',
      'Improve speaking, grammar & confidence',
      'Personalised learning plan',
    ],
  },
  audio: {
    title: 'Audio Mode',
    subtitle:
      'Learn English through live trainer-led voice sessions, interactive activities and real-time speaking practice.',
    features: [
      'Live voice sessions',
      'Expert trainers',
      'Speaking practice',
      'Interactive activities',
      'Fluency development',
      'Community learning',
    ],
  },
};

// Coupon box on the review screen is hidden for now. Set to true to show it again.
const SHOW_COUPON = false;

const monthsLabel = (n: number) => (n === 1 ? '1 Month' : `${n} Months`);
const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const dateLabel = (ms?: number) =>
  ms
    ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-';

export default function ProgramFlowScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const themeContext = useTheme() as any;
  const isDarkMode = themeContext?.isDarkMode ?? false;
  const colors = themeContext?.theme?.colors || {
    primary: '#6366F1',
    bgLight: isDarkMode ? '#090D16' : '#F8FAFC',
    bgCard: isDarkMode ? '#131B2E' : '#FFFFFF',
    border: isDarkMode ? '#1E293B' : '#E2E8F0',
    textPrimary: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
  };

  const presetMode: ProgramMode | undefined = route?.params?.mode;
  const [mode, setMode] = useState<ProgramMode | null>(presetMode ?? null);
  const [step, setStep] = useState<Step>(presetMode ? 'intro' : 'mode');

  const [plans, setPlans] = useState<ProgramPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [existing, setExisting] = useState<ProgramAccess | null>(null);

  const [teachers, setTeachers] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [teacher, setTeacher] = useState<any | null>(null);

  const [duration, setDuration] = useState<number | null>(null);
  const [plan, setPlan] = useState<ProgramPlan | null>(null);

  const [preview, setPreview] = useState<ProgramPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [paid, setPaid] = useState<PayResult | null>(null);

  // One accent for both modes: it always follows the app theme chosen in Settings.
  const accent = colors.primary;

  // ── Back handling (header arrow + Android hardware back) ──
  const goBack = useCallback(() => {
    switch (step) {
      case 'mode':
        navigation.goBack();
        break;
      case 'intro':
        if (presetMode) navigation.goBack();
        else setStep('mode');
        break;
      case 'teacher':
        setStep('intro');
        break;
      case 'duration':
        setStep('teacher');
        break;
      case 'plan':
        setStep('duration');
        break;
      case 'review':
        setStep('plan');
        break;
    }
  }, [step, presetMode, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (payOpen) return false; // modal handles its own back
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [goBack, payOpen]);

  // ── When a mode is chosen: load plans + check for an already active plan ──
  useEffect(() => {
    if (!mode) return;
    let alive = true;
    setLoadingPlans(true);
    setExisting(null);
    Promise.all([getProgramPlans(mode), getMySubscriptions()])
      .then(([list, subs]) => {
        if (!alive) return;
        setPlans(list);
        const mine = subs[mode];
        if (mine.active || mine.reason === 'no_sessions_left') setExisting(mine);
      })
      .catch((err) => {
        console.error('ProgramFlowScreen: load error', err);
        if (alive) Alert.alert('Error', 'Could not load the plans. Please try again.');
      })
      .finally(() => alive && setLoadingPlans(false));
    return () => {
      alive = false;
    };
  }, [mode]);

  // ── Teachers for this mode (only active ones; `modes` filter if the teacher has it) ──
  useEffect(() => {
    if (!mode) return;
    let alive = true;
    setLoadingTeachers(true);
    getTeachers()
      .then((list: any[]) => {
        if (!alive) return;
        setTeachers(
          list.filter(
            (t) => t.isActive !== false && (!Array.isArray(t.modes) || t.modes.includes(mode))
          )
        );
      })
      .catch((err) => console.error('ProgramFlowScreen: teachers error', err))
      .finally(() => alive && setLoadingTeachers(false));
    return () => {
      alive = false;
    };
  }, [mode]);

  // ── Review: server-side price preview (also re-checks teacher + active plan) ──
  const loadPreview = useCallback(
    async (coupon?: string) => {
      if (!plan || !teacher) return;
      setLoadingPreview(true);
      setCouponError(null);
      try {
        const res = await previewProgram(plan.id, teacher.id, coupon);
        setPreview(res);
        setAppliedCoupon(res.pricing.couponCode);
        return true;
      } catch (err: any) {
        if (coupon) {
          setCouponError(err?.message || 'This coupon could not be applied.');
        } else {
          Alert.alert('Error', err?.message || 'Could not load the plan details. Please try again.');
        }
        return false;
      } finally {
        setLoadingPreview(false);
      }
    },
    [plan, teacher]
  );

  useEffect(() => {
    if (step === 'review') {
      setCouponInput('');
      setAppliedCoupon(null);
      loadPreview();
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ──
  const durationPlans = useMemo(
    () =>
      duration
        ? plans.filter((p) => p.durationMonths === duration).sort((a, b) => (a.sessions || 0) - (b.sessions || 0))
        : [],
    [plans, duration]
  );

  const chooseMode = (m: ProgramMode) => {
    setMode(m);
    setTeacher(null);
    setDuration(null);
    setPlan(null);
    setStep('intro');
  };

  const chooseDuration = (months: number) => {
    setDuration(months);
    const list = plans
      .filter((p) => p.durationMonths === months)
      .sort((a, b) => (a.sessions || 0) - (b.sessions || 0));
    // Audio has one plan per duration; Video: pre-select the popular one (else the first).
    setPlan(list.find((p) => p.isPopular) || list[0] || null);
  };

  const handlePay = async (method: PayMethod) => {
    const res = await payWithRazorpay({
      type: 'program',
      planId: plan!.id,
      teacherId: teacher!.id,
      couponCode: appliedCoupon || undefined,
      method,
    });
    setPaid(res);
    return res;
  };

  const handlePayError = (err: any) => {
    if (err?.message === 'CANCELLED') return;
    if (err?.code === 'PENDING' || err?.code === 'REFUND') {
      Alert.alert(
        err.code === 'REFUND' ? 'Refund Pending' : 'Payment Being Confirmed',
        err.message
      );
      return;
    }
    console.error('ProgramFlowScreen: payment error', err);
    Alert.alert('Payment Failed', err?.message || 'The payment could not be completed. Please try again.');
  };

  // ───────────────────────── UI pieces ─────────────────────────
  const Header = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <View style={styles.header}>
      <TouchableOpacity
        style={[styles.backBtn, { backgroundColor: colors.bgCard }]}
        onPress={goBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <ChevronLeft color={colors.textPrimary} size={22} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
    </View>
  );

  const PrimaryButton = ({
    label,
    onPress,
    disabled,
    loading,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => (
    <View style={[styles.footer, { backgroundColor: colors.bgLight, borderTopColor: colors.border }]}>
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: accent }, (disabled || loading) && { opacity: 0.45 }]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{label} →</Text>}
      </TouchableOpacity>
    </View>
  );

  const FeatureList = ({ items }: { items: string[] }) => (
    <View style={{ gap: 10 }}>
      {items.map((f) => (
        <View key={f} style={styles.featureRow}>
          <View style={[styles.checkDot, { backgroundColor: accent }]}>
            <Check color="#FFF" size={12} />
          </View>
          <Text style={[styles.featureText, { color: colors.textPrimary }]}>{f}</Text>
        </View>
      ))}
    </View>
  );

  const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.textPrimary }, bold && { fontWeight: '800' }]}>{value}</Text>
    </View>
  );

  // ───────────────────────── STEPS ─────────────────────────
  const renderMode = () => (
    <>
      <View style={styles.modeHeaderWrap}>
        <View style={{ alignSelf: 'flex-start' }}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.bgCard }]}
            onPress={goBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft color={colors.textPrimary} size={22} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.modeBigTitle, { color: colors.textPrimary }]}>How Do You Want to Learn?</Text>
        <Text style={[styles.modeBigSub, { color: colors.textSecondary }]}>
          Choose the learning mode that suits your goal.
        </Text>
      </View>
      <View style={styles.modeCardsWrap}>
        {(['audio', 'video'] as ProgramMode[]).map((m) => {
          const isAudio = m === 'audio';
          const tint = isAudio ? (isDarkMode ? '#12264A' : '#E6EEFF') : (isDarkMode ? '#251A4A' : '#EFE9FF');
          const tone = isAudio ? '#2563EB' : '#7C3AED';
          return (
            <TouchableOpacity
              key={m}
              activeOpacity={0.88}
              onPress={() => chooseMode(m)}
              style={[styles.modeBigCard, { backgroundColor: tint, borderColor: tone + '66' }]}
            >
              <Image
                source={isAudio ? IMG_AUDIO : IMG_VIDEO}
                style={styles.modeBigImage}
                resizeMode="cover"
              />
              <LinearGradient
                pointerEvents="none"
                colors={[tint, tint + '00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modeBigFade}
              />
              <View style={styles.modeBigText}>
                <View style={[styles.modeIcon, { backgroundColor: tone, width: 50, height: 50, borderRadius: 25 }]}>
                  {isAudio ? <Mic color="#FFF" size={24} /> : <Video color="#FFF" size={24} />}
                </View>
                <Text style={[styles.modeBigCardTitle, { color: colors.textPrimary }]}>
                  {isAudio ? 'Audio Mode' : 'Video Mode'}
                </Text>
                <Text style={[styles.modeBigCardSub, { color: colors.textSecondary }]}>
                  {isAudio
                    ? 'Learn through live voice sessions, group practice and trainer interaction.'
                    : 'Get personal 1:1 video sessions with experienced trainers.'}
                </Text>
              </View>
              <View style={[styles.modeArrow, { backgroundColor: tone }]}>
                <ArrowRight color="#FFF" size={18} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  const renderIntro = () => {
    if (!mode) return null;
    const info = INTRO[mode];
    return (
      <>
        <Header title={info.title} />
        {loadingPlans ? (
          <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
        ) : existing ? (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: accent }]}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Your plan is already active</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                {existing.planName || info.title}
              </Text>
              <View style={{ height: 10 }} />
              <Row label="Teacher" value={existing.teacherName || '-'} />
              <Row label="Valid until" value={dateLabel(existing.expiresAt)} />
              {mode === 'video' && (
                <Row
                  label="Remaining sessions"
                  value={`${existing.remainingSessions ?? 0} of ${existing.totalSessions ?? 0}`}
                />
              )}
              {existing.reason === 'no_sessions_left' && (
                <Text style={[styles.warnText]}>
                  You have used all sessions included in your current plan. You can buy a new plan after it expires.
                </Text>
              )}
            </View>
            <Text style={[styles.cardSub, { color: colors.textSecondary, marginTop: 14 }]}>
              You can buy a new {info.title} plan after the current one expires.
            </Text>
          </ScrollView>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.scroll}>
              <View
                style={[
                  styles.introHero,
                  { backgroundColor: mode === 'audio' ? (isDarkMode ? '#12264A' : '#E6EEFF') : (isDarkMode ? '#251A4A' : '#EFE9FF') },
                ]}
              >
                <Image
                  source={mode === 'audio' ? IMG_AUDIO : IMG_VIDEO}
                  style={styles.introHeroImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  pointerEvents="none"
                  colors={[mode === 'audio' ? (isDarkMode ? '#12264A' : '#E6EEFF') : (isDarkMode ? '#251A4A' : '#EFE9FF'), (mode === 'audio' ? (isDarkMode ? '#12264A' : '#E6EEFF') : (isDarkMode ? '#251A4A' : '#EFE9FF')) + '00']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.introHeroFade}
                />
                <View style={styles.introHeroText}>
                  <View style={[styles.modeIcon, { backgroundColor: mode === 'audio' ? '#2563EB' : '#7C3AED', width: 48, height: 48, borderRadius: 24 }]}>
                    {mode === 'audio' ? <Mic color="#FFF" size={22} /> : <Video color="#FFF" size={22} />}
                  </View>
                  <Text style={[styles.introHeroTitle, { color: colors.textPrimary }]}>{info.title}</Text>
                  <Text style={[styles.introHeroSub, { color: colors.textSecondary }]}>{info.subtitle}</Text>
                </View>
              </View>
              <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <FeatureList items={info.features} />
              </View>
            </ScrollView>
            <PrimaryButton label="Continue" onPress={() => setStep('teacher')} />
          </>
        )}
      </>
    );
  };

  const renderTeacher = () => (
    <>
      <Header title="Choose Your Teacher" subtitle="Your teacher stays the same for the whole plan." />
      {loadingTeachers ? (
        <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
      ) : teachers.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No teachers are available for this mode right now. Please check back later.
        </Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {teachers.map((t) => {
            const active = teacher?.id === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                activeOpacity={0.85}
                onPress={() => setTeacher(t)}
                style={[
                  styles.teacherCard,
                  { backgroundColor: colors.bgCard, borderColor: active ? accent : colors.border },
                  active && { borderWidth: 2 },
                ]}
              >
                {t.photoUrl ? (
                  <Image source={{ uri: t.photoUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: accent + '22' }]}>
                    <User color={accent} size={24} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.teacherName, { color: colors.textPrimary }]}>{t.name}</Text>
                  {!!t.specialization && String(t.specialization).toLowerCase() !== 'general' && (
                    <Text style={[styles.teacherSub, { color: colors.textSecondary }]}>{t.specialization}</Text>
                  )}
                  {!!t.bio && (
                    <Text style={[styles.teacherSub, { color: colors.textSecondary }]} numberOfLines={2}>
                      {t.bio}
                    </Text>
                  )}
                </View>
                <View style={[styles.radio, active && { borderColor: accent }]}>
                  {active && <View style={[styles.radioDot, { backgroundColor: accent }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      <PrimaryButton label="Continue" onPress={() => setStep('duration')} disabled={!teacher} />
    </>
  );

  const renderDuration = () => {
    if (!mode) return null;
    const showPrice = mode === 'audio'; // Video: no price on this screen
    return (
      <>
        <Header
          title={mode === 'audio' ? 'Choose Your Audio Plan' : 'Choose Your Duration'}
          subtitle={
            mode === 'audio'
              ? 'The 1-month plan is not available for Audio Mode.'
              : 'Select the duration that suits your goal.'
          }
        />
        <ScrollView contentContainerStyle={styles.scroll}>
          {DURATIONS[mode].map((months) => {
            const list = plans.filter((p) => p.durationMonths === months);
            const available = list.length > 0;
            const active = duration === months;
            const first = list.find((p) => p.isPopular) || list[0];
            return (
              <TouchableOpacity
                key={months}
                activeOpacity={0.85}
                disabled={!available}
                onPress={() => chooseDuration(months)}
                style={[
                  styles.durationCard,
                  { backgroundColor: active ? accent + '14' : colors.bgCard, borderColor: active ? accent : colors.border },
                  active && { borderWidth: 2 },
                  !available && { opacity: 0.45 },
                ]}
              >
                {showPrice && first?.isPopular && (
                  <View style={[styles.popularTag, { backgroundColor: '#F59E0B' }]}>
                    <Crown color="#FFF" size={11} />
                    <Text style={styles.popularTagText}> Most Popular</Text>
                  </View>
                )}
                <View style={[styles.radio, active && { borderColor: accent }]}>
                  {active && <View style={[styles.radioDot, { backgroundColor: accent }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.durationTitle, { color: colors.textPrimary }]}>{monthsLabel(months)}</Text>
                  {showPrice && !!first?.tagline && (
                    <Text style={[styles.teacherSub, { color: colors.textSecondary }]}>{first.tagline}</Text>
                  )}
                  {!available && (
                    <Text style={[styles.teacherSub, { color: colors.textSecondary }]}>Coming soon</Text>
                  )}
                </View>
                {showPrice && !!first && (
                  <Text style={[styles.durationPrice, { color: active ? accent : colors.textPrimary }]}>{money(first.price)}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <PrimaryButton label="Continue" onPress={() => setStep('plan')} disabled={!duration || !plan} />
      </>
    );
  };

  const renderPlan = () => {
    if (!mode || !duration) return null;

    // AUDIO: plan details (what you get) before review
    if (mode === 'audio' && plan) {
      return (
        <>
          <Header title="Audio Plan Details" />
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={[styles.planBanner, { backgroundColor: accent + '14', borderColor: accent + '55' }]}>
              <View>
                <Text style={[styles.planBannerTitle, { color: colors.textPrimary }]}>
                  {monthsLabel(plan.durationMonths)} Plan
                </Text>
                {plan.isPopular && <Text style={[styles.popularInline, { color: '#EC4899' }]}>Most Popular</Text>}
              </View>
              <Text style={[styles.planBannerPrice, { color: accent }]}>{money(plan.price)}</Text>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>What you get</Text>
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <FeatureList items={plan.features.length ? plan.features : INTRO.audio.features} />
            </View>

            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, marginTop: 12 }]}>
              <Row label="Plan validity" value={monthsLabel(plan.durationMonths)} />
              <Row label="Teacher" value={teacher?.name || '-'} />
            </View>
          </ScrollView>
          <PrimaryButton label="Continue" onPress={() => setStep('review')} />
        </>
      );
    }

    // VIDEO: choose the number of sessions for the duration
    return (
      <>
        <Header title={`${monthsLabel(duration)} Plan`} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <View style={[styles.infoPill, { backgroundColor: accent }]}>
              <Text style={styles.infoPillText}>{(durationPlans[0]?.sessionMins || 30)}-min live sessions</Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontWeight: '600' }}>◔ Flexible scheduling</Text>
          </View>

          {durationPlans.map((p, idx) => {
            const active = plan?.id === p.id;
            const perSession = p.sessions ? Math.round(p.price / p.sessions) : 0;
            const taglines = ['Perfect to get started', 'Build your consistency', 'Best for real progress'];
            const tagline = p.tagline || taglines[Math.min(idx, taglines.length - 1)];
            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.85}
                onPress={() => setPlan(p)}
                style={[
                  styles.durationCard,
                  styles.sessionCard,
                  { backgroundColor: active ? accent + '14' : colors.bgCard, borderColor: active ? accent : colors.border },
                  active && { borderWidth: 2 },
                ]}
              >
                {p.isPopular && (
                  <View style={[styles.popularTag, { backgroundColor: '#F59E0B' }]}>
                    <Text style={styles.popularTagText}>Most Popular</Text>
                  </View>
                )}
                {p.isPopular && (
                  <View style={[styles.crownBadge, { backgroundColor: accent }]}>
                    <Crown color="#FFF" size={13} />
                  </View>
                )}
                <View style={[styles.radio, active && { borderColor: accent }]}>
                  {active && <View style={[styles.radioDot, { backgroundColor: accent }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sessionCount, { color: colors.textPrimary }]}>{p.sessions} Sessions</Text>
                  <Text style={[styles.teacherSub, { color: colors.textSecondary }]}>{tagline}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.sessionPrice, { color: active ? accent : colors.textPrimary }]}>{money(p.price)}</Text>
                  {perSession > 0 && (
                    <Text style={[styles.perSession, { color: colors.textSecondary }]}>({money(perSession)} per session)</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={[styles.promoCard, { backgroundColor: isDarkMode ? '#1F2937' : '#FEF3E2', borderColor: isDarkMode ? '#374151' : '#FBE3C0' }]}>
            <Text style={{ fontSize: 34 }}>🎁</Text>
            <Text style={[styles.promoText, { color: colors.textPrimary }]}>
              Learn. Save more.{'\n'}Invest in a better you!
            </Text>
          </View>

          {!!plan && (
            <View style={[styles.card, { backgroundColor: accent + '10', borderColor: accent + '40' }]}>
              <Row label="Session duration" value={`${plan.sessionMins} Minutes`} />
              <Row label="Validity" value={monthsLabel(plan.durationMonths)} />
              <Row label="Mode" value="1:1 Video Call" />
            </View>
          )}
        </ScrollView>
        <PrimaryButton label="Continue" onPress={() => setStep('review')} disabled={!plan} />
      </>
    );
  };

  const renderReview = () => {
    if (!mode || !plan || !teacher) return null;
    const pricing = preview?.pricing;
    return (
      <>
        <Header title="Review Your Plan" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.planBanner, { backgroundColor: accent + '14', borderColor: accent + '55' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.planBannerTitle, { color: colors.textPrimary }]}>
                {mode === 'audio' ? 'Audio Mode' : 'Video Mode'}
              </Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                {monthsLabel(plan.durationMonths)}
                {plan.sessions ? ` · ${plan.sessions} Sessions` : ''}
              </Text>
            </View>
            <Text style={[styles.planBannerPrice, { color: accent }]}>{money(plan.price)}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Row label="Mode" value={mode === 'audio' ? 'Audio Mode (Group Classes)' : '1:1 Video Call'} />
            <Row label="Teacher" value={teacher.name} />
            <Row label="Subscription duration" value={monthsLabel(plan.durationMonths)} />
            {mode === 'video' && <Row label="Session duration" value={`${plan.sessionMins} Minutes`} />}
            {mode === 'video' && <Row label="Total sessions" value={`${plan.sessions} Sessions`} />}
            <Row label="Plan validity" value={monthsLabel(plan.durationMonths)} />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>What is included</Text>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <FeatureList items={plan.features.length ? plan.features : INTRO[mode].features} />
          </View>

          {/* Coupon UI is switched off: set SHOW_COUPON to true (top of file) to bring it back. */}
          {SHOW_COUPON && (
          <>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Apply Coupon Code</Text>
          <View style={styles.couponRow}>
            <TextInput
              value={couponInput}
              onChangeText={(t) => {
                setCouponInput(t.toUpperCase());
                setCouponError(null);
              }}
              placeholder="Enter coupon code"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              style={[
                styles.couponInput,
                { backgroundColor: colors.bgCard, borderColor: colors.border, color: colors.textPrimary },
              ]}
            />
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: accent }, !couponInput.trim() && { opacity: 0.45 }]}
              disabled={!couponInput.trim() || loadingPreview}
              onPress={() => loadPreview(couponInput.trim())}
            >
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
          {!!couponError && <Text style={styles.errorText}>{couponError}</Text>}
          {!!appliedCoupon && !couponError && (
            <Text style={styles.successText}>
              <Tag color="#16A34A" size={12} /> Coupon {appliedCoupon} applied
            </Text>
          )}
          </>
          )}

          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, marginTop: 14 }]}>
            {loadingPreview && !pricing ? (
              <ActivityIndicator color={accent} />
            ) : pricing ? (
              <>
                <Row label="Plan price" value={money(plan.price)} />
                {pricing.couponDiscount > 0 && <Row label="Discount" value={`- ${money(pricing.couponDiscount)}`} />}
                {!pricing.gstIncluded && <Row label="GST (18%)" value={money(pricing.gst)} />}
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Row label="Total payable" value={money(pricing.total)} bold />
              </>
            ) : null}
          </View>
        </ScrollView>
        <PrimaryButton
          label="Proceed to Payment"
          onPress={() => setPayOpen(true)}
          disabled={!pricing || loadingPreview}
        />
      </>
    );
  };

  const program = paid?.program;
  const successRows = [
    { label: 'Plan', value: program?.planName || plan?.durationLabel || '-' },
    { label: 'Teacher', value: program?.teacherName || teacher?.name || '-' },
    ...(program?.sessions
      ? [
          { label: 'Sessions', value: `${program.sessions} (${program.sessionMins} min each)` },
          { label: 'Remaining sessions', value: String(program.remainingSessions ?? program.sessions) },
        ]
      : []),
    { label: 'Activated on', value: dateLabel(program?.startAt) },
    { label: 'Expires on', value: dateLabel(program?.expiresAt) },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.bgLight} />

      {step !== 'mode' && step !== 'intro' && (
        <Image source={IMG_PLAN} style={styles.bgArt} resizeMode="cover" pointerEvents="none" />
      )}

      {step === 'mode' && renderMode()}
      {step === 'intro' && renderIntro()}
      {step === 'teacher' && renderTeacher()}
      {step === 'duration' && renderDuration()}
      {step === 'plan' && renderPlan()}
      {step === 'review' && renderReview()}

      {!!plan && !!teacher && !!preview && (
        <PaymentFlowModal
          visible={payOpen}
          amountRupees={preview.pricing.total}
          title={`${mode === 'audio' ? 'Audio' : 'Video'} Mode · ${plan.durationLabel}`}
          onPay={handlePay}
          onError={handlePayError}
          onClose={() => setPayOpen(false)}
          onDone={() => {
            setPayOpen(false);
            navigation.popToTop();
          }}
          successMessage={`Your ${mode === 'audio' ? 'Audio' : 'Video'} Mode plan is now active.`}
          successRows={successRows}
          primaryLabel="Go to My Dashboard"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '800' },
  headerSub: { fontSize: 12.5, marginTop: 2 },
  scroll: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  primaryBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  bgArt: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.07 },

  modeHeaderWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  modeBigTitle: { fontSize: 26, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  modeBigSub: { fontSize: 14, textAlign: 'center', marginTop: 6 },
  modeBigCard: { flex: 1, maxHeight: 300, borderRadius: 26, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'center' },
  modeCardsWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 20, gap: 16 },
  modeBigImage: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '62%', height: '100%' },
  modeBigFade: { position: 'absolute', top: 0, bottom: 0, right: '46%', width: '22%' },
  modeBigText: { width: '54%', paddingLeft: 18, paddingRight: 4, zIndex: 2 },
  modeBigCardTitle: { fontSize: 23, fontWeight: '900', marginTop: 10 },
  modeBigCardSub: { fontSize: 12, lineHeight: 17, marginTop: 5, fontWeight: '500' },
  modeArrow: { position: 'absolute', right: 14, bottom: 14, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  introHero: { height: 300, borderRadius: 26, overflow: 'hidden', justifyContent: 'center' },
  introHeroImage: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '72%', height: '100%' },
  introHeroFade: { position: 'absolute', top: 0, bottom: 0, right: '38%', width: '34%' },
  introHeroText: { width: '56%', paddingLeft: 18 },
  introHeroTitle: { fontSize: 28, fontWeight: '900', marginTop: 12 },
  introHeroSub: { fontSize: 13.5, lineHeight: 20, marginTop: 6, fontWeight: '500' },

  introText: { fontSize: 14, lineHeight: 20 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardSub: { fontSize: 13 },
  warnText: { color: '#D97706', fontSize: 12.5, marginTop: 10, lineHeight: 18 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 40, paddingHorizontal: 30, lineHeight: 20 },

  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 14, flex: 1 },

  modeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderRadius: 18, padding: 16 },
  modeIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontSize: 17, fontWeight: '800' },
  modeSub: { fontSize: 12.5, marginTop: 4, lineHeight: 18 },

  teacherCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  teacherName: { fontSize: 15.5, fontWeight: '700' },
  teacherSub: { fontSize: 12.5, marginTop: 2 },

  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#B6C0D4', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },

  durationCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, paddingVertical: 18, paddingHorizontal: 16 },
  durationTitle: { fontSize: 18, fontWeight: '800' },
  durationPrice: { fontSize: 22, fontWeight: '900' },
  sessionCard: { paddingVertical: 20 },
  sessionCount: { fontSize: 18, fontWeight: '800' },
  sessionPrice: { fontSize: 24, fontWeight: '900' },
  perSession: { fontSize: 11.5, marginTop: 2 },
  infoPill: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  infoPillText: { color: '#FFF', fontSize: 12.5, fontWeight: '800' },
  crownBadge: { position: 'absolute', top: -14, right: -6, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  promoCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 16, padding: 14 },
  promoText: { fontSize: 14, fontWeight: '700', lineHeight: 20, flex: 1 },
  popularTag: { position: 'absolute', top: -12, right: 38, zIndex: 2, flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  popularTagText: { color: '#FFF', fontSize: 10.5, fontWeight: '800' },
  popularInline: { fontSize: 11.5, fontWeight: '800', marginTop: 2 },

  planBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 16, padding: 16 },
  planBannerTitle: { fontSize: 17, fontWeight: '800' },
  planBannerPrice: { fontSize: 22, fontWeight: '800' },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginTop: 6 },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  rowLabel: { fontSize: 13.5 },
  rowValue: { fontSize: 13.5, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },

  couponRow: { flexDirection: 'row', gap: 8 },
  couponInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  applyBtn: { borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  applyBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  errorText: { color: '#DC2626', fontSize: 12.5 },
  successText: { color: '#16A34A', fontSize: 12.5, fontWeight: '600' },
});