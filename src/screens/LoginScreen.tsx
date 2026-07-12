 import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, SafeAreaView } from 'react-native';

export default function LoginScreen({ navigation, theme }: any) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.loginContent}>
        <Image source={{ uri: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?q=80&w=500' }} style={styles.loginIllustration} resizeMode="cover" />
        <Text style={[styles.loginTitle, { color: theme.textPrimary }]}>Create Your <Text style={{ color: theme.accent }}>Account</Text></Text>
        <Text style={[styles.loginSubtitle, { color: theme.textSecondary }]}>Join ECC and start your journey towards fluent and confident English.</Text>
        
        <TouchableOpacity style={[styles.socialButton, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.socialButtonText, { color: theme.textPrimary }]}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          <Text style={[styles.dividerText, { color: theme.textSecondary }]}>OR</Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        </View>

        <TouchableOpacity style={[styles.emailButton, { backgroundColor: theme.accent }]}>
          <Text style={styles.emailButtonText}>Sign Up with Email</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Onboarding')} style={styles.backButton}>
          <Text style={{ color: theme.accent, textAlign: 'center', marginTop: 20 }}>← Back to Onboarding</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loginContent: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  loginIllustration: { width: '100%', height: 240, borderRadius: 24, marginBottom: 24 },
  loginTitle: { fontSize: 30, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  loginSubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  socialButton: { borderWidth: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 16 },
  socialButtonText: { fontSize: 16, fontWeight: '600' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { paddingHorizontal: 16, fontSize: 14, fontWeight: '600' },
  emailButton: { paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  emailButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  backButton: { marginTop: 10 },
});