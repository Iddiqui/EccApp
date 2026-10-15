import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Platform,
  Keyboard,
  Animated,
  Easing,
  ActivityIndicator,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

// src/features/auth/authUi.tsx
// Shared look for Mobile Login, Forgot Password and Complete Profile
// (same lavender orbs + glossy card as Login / Register).

export const BRAND = '#5356FF';

/** Counts down from `from` seconds. `start()` restarts it. */
export function useCountdown(from = 30) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const start = useCallback(() => setLeft(from), [from]);
  return { left, start };
}

type ShellProps = {
  onBack?: () => void; // omit to hide the back button
  bg?: string;
  orbA?: string;
  orbB?: string;
  children: React.ReactNode;
};

/** Screen frame: background orbs, back button, keyboard-aware scroll area. */
export function AuthShell({ onBack, bg = '#EEF2FF', orbA = '#C7D2FE', orbB = '#DDD6FE', children }: ShellProps) {
  const kb = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Android already resizes the window when the keyboard opens, so extra padding there
    // would shrink the card twice. Only iOS needs the manual padding.
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e: any) => {
      Animated.timing(kb, {
        toValue: e.endCoordinates.height,
        duration: e?.duration > 0 ? e.duration : 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', (e: any) => {
      Animated.timing(kb, {
        toValue: 0,
        duration: e?.duration > 0 ? e.duration : 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [kb]);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: bg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={bg} />
      <View style={[s.orbTop, { backgroundColor: orbA }]} />
      <View style={[s.orbBottom, { backgroundColor: orbB }]} />

      <View style={s.header}>
        {onBack ? (
          <TouchableOpacity style={s.backButton} onPress={onBack} activeOpacity={0.75} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
            <ArrowLeft size={22} color="#1E293B" />
          </TouchableOpacity>
        ) : (
          <View style={{ height: 44 }} />
        )}
      </View>

      <Animated.View style={{ flex: 1, paddingBottom: kb }}>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.card}>{children}</View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

export const Title = ({ children }: { children: React.ReactNode }) => <Text style={s.title}>{children}</Text>;
export const Subtitle = ({ children }: { children: React.ReactNode }) => <Text style={s.subtitle}>{children}</Text>;

type FieldProps = TextInputProps & {
  prefix?: string; // e.g. "+91"
  badge?: string; // e.g. "Verified"
  locked?: boolean;
};

export function Field({ prefix, badge, locked, style, ...rest }: FieldProps) {
  return (
    <View style={[s.field, locked && { backgroundColor: '#F1F5F9' }]}>
      {prefix ? (
        <>
          <Text style={s.prefix}>{prefix}</Text>
          <View style={s.divider} />
        </>
      ) : null}
      <TextInput
        placeholderTextColor="#94A3B8"
        style={[s.input, style]}
        editable={!locked && rest.editable !== false}
        {...rest}
      />
      {badge ? <Text style={s.badge}>{badge}</Text> : null}
    </View>
  );
}

/** One box for a 6-digit code. */
export function OtpField({ value, onChangeText, editable = true }: { value: string; onChangeText: (v: string) => void; editable?: boolean }) {
  return (
    <View style={[s.field, { justifyContent: 'center' }]}>
      <TextInput
        style={s.otp}
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/\D/g, '').slice(0, 6))}
        placeholder="------"
        placeholderTextColor="#CBD5E1"
        keyboardType="number-pad"
        maxLength={6}
        editable={editable}
        autoFocus
        textContentType="oneTimeCode"
      />
    </View>
  );
}

export function PrimaryButton({ title, onPress, loading, disabled, style }: { title: string; onPress: () => void; loading?: boolean; disabled?: boolean; style?: any }) {
  const off = loading || disabled;
  return (
    <TouchableOpacity style={[s.button, off && { opacity: 0.6 }, style]} onPress={onPress} disabled={off} activeOpacity={0.85}>
      {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={s.buttonText}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function SmallButton({ title, onPress, loading, disabled }: { title: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  const off = loading || disabled;
  return (
    <TouchableOpacity style={[s.small, off && { opacity: 0.55 }]} onPress={onPress} disabled={off} activeOpacity={0.85}>
      {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={s.smallText}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function LinkText({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={{ alignSelf: 'center', paddingVertical: 8 }}>
      <Text style={[s.link, disabled && { color: '#94A3B8' }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export const Label = ({ children }: { children: React.ReactNode }) => <Text style={s.label}>{children}</Text>;

const s = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  orbTop: { position: 'absolute', top: -80, right: -80, width: 270, height: 270, borderRadius: 135, opacity: 0.6 },
  orbBottom: { position: 'absolute', bottom: -100, left: -80, width: 290, height: 290, borderRadius: 145, opacity: 0.7 },
  header: { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 10, paddingHorizontal: 20, paddingBottom: 4, zIndex: 10 },
  backButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center',
    elevation: 3, shadowColor: BRAND, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
  },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 16, zIndex: 5 },
  card: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 32, paddingVertical: 28, paddingHorizontal: 20,
    shadowColor: BRAND, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 6,
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  title: { fontSize: 28, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18, marginBottom: 22, paddingHorizontal: 8, fontWeight: '500' },
  label: { fontSize: 12, fontWeight: '800', color: '#475569', marginBottom: 6, marginLeft: 8 },
  field: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 28, paddingHorizontal: 20, height: 52,
    marginBottom: 12, borderWidth: 1.2, borderColor: '#E2E8F0',
  },
  prefix: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginRight: 10 },
  divider: { width: 1.5, height: 20, backgroundColor: '#CBD5E1', marginRight: 12 },
  input: { flex: 1, fontSize: 15, color: '#0F172A', fontWeight: '600', paddingVertical: 0 },
  badge: { fontSize: 12, fontWeight: '800', color: '#16A34A', marginLeft: 8 },
  otp: { fontSize: 26, fontWeight: '800', color: '#0F172A', letterSpacing: 10, textAlign: 'center', width: '100%' },
  button: {
    height: 54, backgroundColor: BRAND, borderRadius: 27, justifyContent: 'center', alignItems: 'center', shadowColor: BRAND,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5, marginTop: 6, marginBottom: 8,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  small: { height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  smallText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  link: { color: BRAND, fontSize: 14, fontWeight: '800' },
});