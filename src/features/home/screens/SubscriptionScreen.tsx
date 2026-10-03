import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Check, ArrowLeft, Crown } from 'lucide-react-native';
import { payWithRazorpay, getPlans } from '../../payments/paymentService';
import type { SubscriptionPlan } from '../../payments/paymentTypes';

export default function SubscriptionScreen({ navigation, route }: any) {
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);

  // Plans + prices server se aate hain (functions/src/payments/pricing.ts),
  // isliye screen pe dikhne wali price aur asli charge hamesha same rehte hain.
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState(false);

  const loadPlans = async () => {
    setLoadingPlans(true);
    setPlansError(false);
    try {
      setPlans(await getPlans());
    } catch (err) {
      console.error('SubscriptionScreen: getPlans error', err);
      setPlansError(true);
    } finally {
      setLoadingPlans(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  // Agar ClassRoomScreen se "subscription nahi hai" ki wajah se yahan
  // bheja gaya tha, to payment success hone ke baad wahin wapas bhej denge.
  const returnTo = route?.params?.returnTo;

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (processingPlanId) return; // ek time pe ek hi payment process ho

    setProcessingPlanId(plan.id);
    try {
      // Amount app se nahi jaata, server plan.id se price nikalta hai.
      const result = await payWithRazorpay({
        type: 'subscription',
        planId: plan.id,
      });

      if (result.success) {
        const validTill = result.expiresAt
          ? ` Valid till ${new Date(result.expiresAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}.`
          : '';
        Alert.alert('Success 🎉', `Aapka subscription activate ho gaya hai!${validTill}`, [
          {
            text: 'OK',
            onPress: () => {
              if (returnTo) {
                navigation.navigate(returnTo.screen, returnTo.params);
              } else {
                navigation.goBack();
              }
            },
          },
        ]);
      }
    } catch (err: any) {
      // paymentService checkout cancel hone par 'CANCELLED' throw karta hai
      // (jab user khud Razorpay checkout band kar de) — usko error alert se
      // spam nahi karte, chup-chaap ignore kar dete hain.
      if (err?.message !== 'CANCELLED') {
        console.error('Subscription payment error:', err);
        // paymentTaken: paisa kat chuka hai (confirm hone me der ya refund case)
        Alert.alert(
          err?.paymentTaken ? 'Payment Received' : 'Payment Failed',
          err?.message || 'Kuch galat ho gaya. Please try again.'
        );
      }
    } finally {
      setProcessingPlanId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose a Plan</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Choose a plan to unlock classrooms.
        </Text>

        {loadingPlans && (
          <ActivityIndicator style={{ marginVertical: 30 }} color="#2563EB" />
        )}

        {plansError && !loadingPlans && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Plans could not be loaded.</Text>
            <TouchableOpacity onPress={loadPlans} activeOpacity={0.85}>
              <Text style={styles.retryText}>Try again.</Text>
            </TouchableOpacity>
          </View>
        )}

        {plans.map((plan) => {
          const isProcessing = processingPlanId === plan.id;
          const isDisabled = processingPlanId !== null && !isProcessing;

          return (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                plan.isPopular && styles.planCardPopular,
              ]}
            >
              {plan.isPopular && (
                <View style={styles.popularBadge}>
                  <Crown size={12} color="#FFF" />
                  <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                </View>
              )}

              <View style={styles.planHeaderRow}>
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.priceRow}>
                  {!!plan.mrp && plan.mrp > plan.price && (
                    <Text style={styles.planMrp}>₹{plan.mrp}</Text>
                  )}
                  <Text style={styles.planPrice}>₹{plan.price}</Text>
                  <Text style={styles.planDuration}>/ {plan.durationLabel}</Text>
                </View>
              </View>

              <View style={styles.featuresList}>
                {plan.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureRow}>
                    <Check size={16} color="#22C55E" />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.subscribeBtn,
                  plan.isPopular && styles.subscribeBtnPopular,
                  isDisabled && styles.subscribeBtnDisabled,
                ]}
                onPress={() => handleSubscribe(plan)}
                disabled={processingPlanId !== null}
                activeOpacity={0.85}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.subscribeBtnText}>
                    Subscribe — ₹{plan.price}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        <Text style={styles.footerNote}>
         Payment is secure via Razorpay. Subscription.{'\n'}
         You will receive a renewal reminder before it expires.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  planCardPopular: {
    borderColor: '#2563EB',
    backgroundColor: '#F0F6FF',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  planPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2563EB',
  },
  planDuration: {
    fontSize: 12,
    color: '#64748B',
  },
  featuresList: {
    gap: 8,
    marginBottom: 18,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  subscribeBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeBtnPopular: {
    backgroundColor: '#2563EB',
  },
  subscribeBtnDisabled: {
    opacity: 0.5,
  },
  subscribeBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  planMrp: {
    fontSize: 13,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  errorBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#64748B',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 8,
    lineHeight: 16,
  },
});