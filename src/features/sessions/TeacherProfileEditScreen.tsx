import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { ChevronLeft, User, Camera, Video as VideoIcon, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { getMyTeacherProfile } from './sessionService';

// A teacher edits ONLY their own public profile. Email, active status, modes and rating
// are controlled by the admin / the system and are shown read-only.
// Photo and intro video are picked from the phone gallery and uploaded to Firebase Storage.
//
// Needs two packages (loaded softly so the app does not crash if they are missing):
//   npm install react-native-image-picker @react-native-firebase/storage
// then rebuild the app (npx react-native run-android).
let ImagePickerLib: any = null;
let storageLib: any = null;
try { ImagePickerLib = require('react-native-image-picker'); } catch (e) { ImagePickerLib = null; }
try { const m = require('@react-native-firebase/storage'); storageLib = m.default || m; } catch (e) { storageLib = null; }

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;


export default function TeacherProfileEditScreen() {
  const navigation = useNavigation<any>();
  const themeContext = useTheme() as any;
  const isDarkMode = themeContext?.isDarkMode ?? false;
  const colors = themeContext?.theme?.colors || {
    primary: '#2563EB',
    bgLight: isDarkMode ? '#090D16' : '#F8FAFC',
    bgCard: isDarkMode ? '#131B2E' : '#FFFFFF',
    border: isDarkMode ? '#1E293B' : '#E2E8F0',
    textPrimary: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
  };
  const accent = colors.primary;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teacher, setTeacher] = useState<any | null>(null);

  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [introVideoUrl, setIntroVideoUrl] = useState('');
  const [uploading, setUploading] = useState<null | 'photo' | 'video'>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    getMyTeacherProfile()
      .then((t: any) => {
        setTeacher(t);
        if (t) {
          setName(t.name || '');
          const sp = String(t.specialization || '');
          setSpecialization(sp.toLowerCase() === 'general' ? '' : sp);
          setBio(t.bio || '');
          setLanguages(Array.isArray(t.languages) ? t.languages.join(', ') : '');
          setPhotoUrl(t.photoUrl || '');
          setIntroVideoUrl(t.introVideoUrl || '');
        }
      })
      .catch((e) => console.error('TeacherProfileEditScreen: load error', e))
      .finally(() => setLoading(false));
  }, []);

  const pickAndUpload = async (kind: 'photo' | 'video') => {
    if (uploading) return;
    if (!ImagePickerLib || !storageLib) {
      Alert.alert(
        'Setup Required',
        'Install first:\nnpm install react-native-image-picker @react-native-firebase/storage\nThen rebuild the app.'
      );
      return;
    }
    const uid = auth().currentUser?.uid;
    if (!uid) {
      Alert.alert('Login Required', 'Please log in again.');
      return;
    }
    try {
      const res = await ImagePickerLib.launchImageLibrary(
        kind === 'photo'
          ? { mediaType: 'photo', quality: 0.8, maxWidth: 1000, maxHeight: 1000, selectionLimit: 1 }
          : { mediaType: 'video', selectionLimit: 1 }
      );
      if (res.didCancel || !res.assets?.length) return;
      const asset = res.assets[0];
      if (!asset.uri) return;

      const limit = kind === 'photo' ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES;
      if (asset.fileSize && asset.fileSize > limit) {
        Alert.alert(
          'File Too Large',
          kind === 'photo' ? 'Please choose a photo under 5 MB.' : 'Please choose a video under 50 MB (about 1 minute).'
        );
        return;
      }

      setUploading(kind);
      setProgress(0);
      const ext = kind === 'photo' ? 'jpg' : 'mp4';
      const ref = storageLib().ref(`teacher_media/${uid}/${kind}_${Date.now()}.${ext}`);
      const task = ref.putFile(asset.uri, {
        contentType: asset.type || (kind === 'photo' ? 'image/jpeg' : 'video/mp4'),
      });
      task.on('state_changed', (snap: any) => {
        if (snap.totalBytes) setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      });
      await task;
      const url: string = await ref.getDownloadURL();
      if (kind === 'photo') setPhotoUrl(url);
      else setIntroVideoUrl(url);
    } catch (e: any) {
      console.error('TeacherProfileEditScreen: upload error', e);
      Alert.alert('Upload Failed', 'Could not upload the file. Check your internet connection and try again.');
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!teacher || saving || uploading) return;
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      await firestore()
        .collection('session_teachers')
        .doc(teacher.id)
        .update({
          name: name.trim(),
          specialization: specialization.trim(),
          bio: bio.trim().slice(0, 500),
          languages: languages
            .split(',')
            .map((l) => l.trim())
            .filter(Boolean),
          photoUrl: photoUrl.trim(),
          introVideoUrl: introVideoUrl.trim(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      Alert.alert('Saved', 'Your profile has been updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      console.error('TeacherProfileEditScreen: save error', e);
      Alert.alert('Error', 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const input = [styles.input, { backgroundColor: colors.bgCard, borderColor: colors.border, color: colors.textPrimary }];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.bgLight} />

      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.bgCard }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft color={colors.textPrimary} size={22} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>My Profile</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
      ) : !teacher ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Your account does not have teacher access. Please contact the admin.
        </Text>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: 'center', marginBottom: 6 }}>
              {photoUrl.trim() ? (
                <Image source={{ uri: photoUrl.trim() }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: accent + '1A', alignItems: 'center', justifyContent: 'center' }]}>
                  <User color={accent} size={40} />
                </View>
              )}
              <TouchableOpacity
                style={[styles.upBtn, { borderColor: accent }]}
                onPress={() => pickAndUpload('photo')}
                disabled={!!uploading}
              >
                {uploading === 'photo' ? (
                  <ActivityIndicator size="small" color={accent} />
                ) : (
                  <Camera color={accent} size={16} />
                )}
                <Text style={{ color: accent, fontWeight: '800', fontSize: 13 }}>
                  {uploading === 'photo' ? `Uploading ${progress}%` : photoUrl ? 'Change photo' : 'Upload photo'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.textPrimary }]}>Name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.textSecondary} style={input} />

            <Text style={[styles.label, { color: colors.textPrimary }]}>Specialization</Text>
            <TextInput
              value={specialization}
              onChangeText={setSpecialization}
              placeholder="e.g. Business English, Interview skills"
              placeholderTextColor={colors.textSecondary}
              style={input}
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>About you</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="A short introduction for students"
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={500}
              style={[...input, { height: 110, textAlignVertical: 'top' }]}
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>Languages (comma separated)</Text>
            <TextInput
              value={languages}
              onChangeText={setLanguages}
              placeholder="English, Hindi"
              placeholderTextColor={colors.textSecondary}
              style={input}
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>Intro video (max 50 MB)</Text>
            <View style={[styles.videoRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <VideoIcon color={introVideoUrl ? '#22C55E' : colors.textSecondary} size={20} />
              <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                {uploading === 'video'
                  ? `Uploading ${progress}%...`
                  : introVideoUrl
                  ? 'Intro video added'
                  : 'No intro video yet'}
              </Text>
              {!!introVideoUrl && !uploading && (
                <TouchableOpacity onPress={() => setIntroVideoUrl('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Trash2 color="#EF4444" size={18} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.upBtn, { borderColor: accent, marginTop: 0 }]}
                onPress={() => pickAndUpload('video')}
                disabled={!!uploading}
              >
                {uploading === 'video' ? (
                  <ActivityIndicator size="small" color={accent} />
                ) : (
                  <Text style={{ color: accent, fontWeight: '800', fontSize: 13 }}>{introVideoUrl ? 'Replace' : 'Upload'}</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={[styles.readOnly, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.roRow, { color: colors.textSecondary }]}>Email: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{teacher.email}</Text></Text>
              <Text style={[styles.roRow, { color: colors.textSecondary }]}>
                Modes:{' '}
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                  {(Array.isArray(teacher.modes) ? teacher.modes : ['video', 'audio']).map((m: string) => (m === 'video' ? 'Video' : 'Audio')).join(' + ')}
                </Text>
              </Text>
              <Text style={[styles.roRow, { color: colors.textSecondary }]}>
                Rating:{' '}
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                  {teacher.rating ? Number(teacher.rating).toFixed(1) : 'No ratings yet'}
                </Text>{' '}
                (from student reviews)
              </Text>
              <Text style={[styles.roRow, { color: colors.textSecondary }]}>Email and modes can only be changed by the admin.</Text>
            </View>
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: colors.bgLight, borderTopColor: colors.border }]}>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: accent }, saving && { opacity: 0.6 }]} disabled={saving} onPress={save}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>Save profile</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  upBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginTop: 10 },
  videoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 40, paddingHorizontal: 30, lineHeight: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  label: { fontSize: 13.5, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  readOnly: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 20, gap: 6 },
  roRow: { fontSize: 12.5, lineHeight: 18 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn: { borderRadius: 26, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});