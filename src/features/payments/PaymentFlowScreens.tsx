// src/payments/PaymentFlowScreens.tsx
// Steps 4, 5, 6 of the ECC payment mockup (no coupon, no QR).
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PayMethod } from './paymentTypes';
import { useTheme } from '../../hooks/useTheme';

type Palette = {
  blue: string; // accent: follows the app theme (Settings > theme), never hard-coded
  navy: string;
  bg: string;
  card: string;
  border: string;
  text: string;
  sub: string;
  green: string;
  greenBg: string;
};

function usePalette(): Palette {
  const themeContext = useTheme() as any;
  const isDark = themeContext?.isDarkMode ?? false;
  const c = themeContext?.theme?.colors;
  return useMemo(
    () => ({
      blue: c?.primary || '#2563EB',
      navy: '#0B1B3F',
      bg: c?.bgLight || (isDark ? '#090D16' : '#F5F7FB'),
      card: c?.bgCard || (isDark ? '#131B2E' : '#FFFFFF'),
      border: c?.border || (isDark ? '#1E293B' : '#E3E8F2'),
      text: c?.textPrimary || (isDark ? '#F8FAFC' : '#0F172A'),
      sub: c?.textSecondary || (isDark ? '#94A3B8' : '#64748B'),
      green: '#16A34A',
      greenBg: isDark ? '#0E2A1B' : '#F0FBF4',
    }),
    [c, isDark]
  );
}

const METHODS: { id: PayMethod; title: string; sub: string; icon: string; tag?: string }[] = [
  { id: 'upi', title: 'UPI', sub: 'Pay using any UPI app', icon: '⚡', tag: 'Recommended' },
  { id: 'card', title: 'Credit / Debit Card', sub: 'Visa, Mastercard, RuPay', icon: '💳' },
  { id: 'netbanking', title: 'Net Banking', sub: 'All major banks supported', icon: '🏦' },
  { id: 'wallet', title: 'Wallets', sub: 'PhonePe, Paytm, Amazon Pay & more', icon: '👛' },
];

/* ---------- Step 4: Payment method ---------- */
export function PaymentMethodScreen({
  amountRupees,
  title,
  onPay,
  onBack,
  busy,
}: {
  amountRupees: number;
  title?: string; // e.g. "1:1 with Jitandra"
  onPay: (method: PayMethod) => void;
  onBack?: () => void;
  busy?: boolean;
}) {
  const C = usePalette();
  const s = useMemo(() => makeStyles(C), [C]);
  const [selected, setSelected] = useState<PayMethod>('upi');

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {onBack && (
          <TouchableOpacity onPress={onBack} hitSlop={12}>
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={s.h1}>Payment Methods</Text>
        <Text style={s.sub}>{title ? `${title} · ` : ''}Choose your preferred payment option</Text>

        <View style={{ marginTop: 20, gap: 12 }}>
          {METHODS.map((m) => {
            const active = selected === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                activeOpacity={0.85}
                onPress={() => setSelected(m.id)}
                style={[s.method, active && s.methodActive]}
              >
                <View style={[s.radio, active && s.radioActive]}>
                  {active && <View style={s.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={s.mTitle}>{m.title}</Text>
                    {m.tag && (
                      <View style={s.tag}>
                        <Text style={s.tagText}>{m.tag}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.mSub}>{m.sub}</Text>
                </View>
                <Text style={{ fontSize: 22 }}>{m.icon}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.trustRow}>
          {['100% Secure', 'Instant Payment', 'Safe & Trusted'].map((t) => (
            <Text key={t} style={s.trust}>✓ {t}</Text>
          ))}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          disabled={busy}
          onPress={() => onPay(selected)}
          style={[s.payBtn, busy && { opacity: 0.6 }]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.payText}>Pay ₹{amountRupees} Securely →</Text>
          )}
        </TouchableOpacity>
        <Text style={s.note}>You will be redirected to the secure payment gateway</Text>
      </View>
    </View>
  );
}

/* ---------- Step 5: Processing ---------- */
export function ProcessingScreen({
  amountRupees,
  orderId,
}: {
  amountRupees: number;
  orderId?: string;
}) {
  const C = usePalette();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={[s.screen, { backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
      <Text style={{ fontSize: 64 }}>🛡️</Text>
      <Text style={s.procTitle}>Processing Your Payment</Text>
      <Text style={s.procSub}>Please do not close or refresh this screen</Text>
      <ActivityIndicator color="#60A5FA" style={{ marginTop: 20 }} />
      <Text style={s.procSecured}>Secured by Razorpay</Text>

      <View style={s.procBox}>
        <View style={s.procRow}>
          <Text style={s.procLabel}>Amount</Text>
          <Text style={s.procVal}>₹{amountRupees}</Text>
        </View>
        {orderId && (
          <View style={s.procRow}>
            <Text style={s.procLabel}>Transaction ID</Text>
            <Text style={s.procVal}>{orderId}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ---------- Step 6: Success ---------- */
export function PaymentSuccessScreen({
  heading = 'Payment Successful!',
  message,
  rows,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  heading?: string;
  message: string; // e.g. "Your 1:1 session is confirmed."
  rows: { label: string; value: string }[]; // Session / Order ID / Amount Paid ...
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const C = usePalette();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={[s.screen, { backgroundColor: C.greenBg, padding: 24, justifyContent: 'center' }]}>
      <View style={s.okCircle}>
        <Text style={{ color: '#fff', fontSize: 44 }}>✓</Text>
      </View>
      <Text style={s.okTitle}>{heading}</Text>
      <Text style={s.okMsg}>{message}</Text>

      <View style={s.okCard}>
        {rows.map((r) => (
          <View key={r.label} style={s.okRow}>
            <Text style={s.okLabel}>{r.label}</Text>
            <Text style={s.okVal}>{r.value}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={[s.payBtn, { marginTop: 24 }]} onPress={onPrimary}>
        <Text style={s.payText}>{primaryLabel}</Text>
      </TouchableOpacity>
      {secondaryLabel && onSecondary && (
        <TouchableOpacity style={s.secBtn} onPress={onSecondary}>
          <Text style={s.secText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ---------- Full flow: method -> processing -> success (Modal) ---------- */
// Kisi bhi screen me use karo:
//   <PaymentFlowModal
//     visible={payOpen}
//     amountRupees={price}
//     title="1:1 with Jitandra"
//     onPay={(method) => bookAndPaySession({ teacherId, slotId }, method)}
//     successRows={[{ label: 'Session', value: '...' }, { label: 'Amount Paid', value: '₹500' }]}
//     onError={(err) => Alert.alert(...)}
//     onClose={() => setPayOpen(false)}
//     onDone={() => { setPayOpen(false); navigation.popToTop(); }}
//   />
export function PaymentFlowModal({
  visible,
  amountRupees,
  title,
  onPay,
  onError,
  onClose,
  onDone,
  successMessage = 'Your session has been booked.',
  successRows,
  primaryLabel = 'Go to Home',
}: {
  visible: boolean;
  amountRupees: number;
  title?: string;
  onPay: (method: PayMethod) => Promise<unknown>;
  onError?: (err: any) => void; // CANCELLED bhi yahin aayega, parent decide kare alert dikhana hai ya nahi
  onClose: () => void;
  onDone: () => void;
  successMessage?: string;
  successRows: { label: string; value: string }[];
  primaryLabel?: string;
}) {
  const C = usePalette();
  const s = useMemo(() => makeStyles(C), [C]);
  const [stage, setStage] = useState<'method' | 'processing' | 'success'>('method');

  useEffect(() => {
    if (visible) setStage('method');
  }, [visible]);

  const handlePay = async (method: PayMethod) => {
    setStage('processing');
    try {
      await onPay(method);
      setStage('success');
    } catch (err: any) {
      // Paisa kat chuka ho (PENDING / REFUND) to modal band, parent message dikhaye.
      // Warna (cancel / fail) user method screen par wapas aa jaye aur dobara try kare.
      if (err?.paymentTaken) onClose();
      else setStage('method');
      onError?.(err);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        // processing ke dauran back button block
        if (stage !== 'processing') onClose();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: stage === 'processing' ? C.navy : C.bg }}>
        {stage === 'method' && (
          <PaymentMethodScreen amountRupees={amountRupees} title={title} onPay={handlePay} onBack={onClose} />
        )}
        {stage === 'processing' && <ProcessingScreen amountRupees={amountRupees} />}
        {stage === 'success' && (
          <PaymentSuccessScreen
            message={successMessage}
            rows={successRows}
            primaryLabel={primaryLabel}
            onPrimary={onDone}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  back: { fontSize: 24, color: C.text, marginBottom: 8 },
  h1: { fontSize: 24, fontWeight: '700', color: C.text },
  sub: { fontSize: 14, color: C.sub, marginTop: 4 },
  method: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: C.border,
  },
  methodActive: { borderColor: C.blue, backgroundColor: C.blue + '14' },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#B6C0D4',
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: C.blue },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.blue },
  mTitle: { fontSize: 16, fontWeight: '600', color: C.text },
  mSub: { fontSize: 12.5, color: C.sub, marginTop: 2 },
  tag: { backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 10.5, color: C.green, fontWeight: '600' },
  trustRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  trust: { fontSize: 12, color: C.green, fontWeight: '500' },
  footer: { padding: 20, backgroundColor: C.bg },
  payBtn: {
    backgroundColor: C.blue, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  payText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  note: { textAlign: 'center', color: C.sub, fontSize: 12, marginTop: 10 },
  secBtn: {
    marginTop: 12, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  secText: { color: C.text, fontSize: 15, fontWeight: '600' },

  procTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 16 },
  procSub: { color: '#9FB0D0', fontSize: 13.5, marginTop: 6, textAlign: 'center' },
  procSecured: { color: '#9FB0D0', fontSize: 13, marginTop: 14 },
  procBox: {
    alignSelf: 'stretch', marginTop: 32, borderRadius: 14, padding: 16,
    backgroundColor: 'rgba(255,255,255,0.08)', gap: 10,
  },
  procRow: { flexDirection: 'row', justifyContent: 'space-between' },
  procLabel: { color: '#9FB0D0', fontSize: 14 },
  procVal: { color: '#fff', fontSize: 14, fontWeight: '600' },

  okCircle: {
    alignSelf: 'center', width: 84, height: 84, borderRadius: 42,
    backgroundColor: C.green, alignItems: 'center', justifyContent: 'center',
  },
  okTitle: { textAlign: 'center', color: C.green, fontSize: 24, fontWeight: '700', marginTop: 16 },
  okMsg: { textAlign: 'center', color: C.text, fontSize: 15, marginTop: 6 },
  okCard: {
    marginTop: 24, backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 12,
    borderWidth: 1, borderColor: '#D6F0DE',
  },
  okRow: { flexDirection: 'row', justifyContent: 'space-between' },
  okLabel: { color: C.sub, fontSize: 14 },
  okVal: { color: C.text, fontSize: 14, fontWeight: '600' },
});