// src/features/home/screens/ProfilePhoto.tsx  (or src/components/ProfilePhoto.tsx — any folder works)
//
// A round profile picture (DP) with a small camera badge. Tap it to add, change or remove the photo.
// Works for every login (student, teacher, admin) because the photo belongs to the logged-in account:
//   • the image is stored in Firebase Storage:  profile_photos/{uid}/photo_<time>.jpg
//   • the link is saved in Firebase Auth (photoURL) and in users/{uid}.photoURL
// The Home screen header already reads this photo, so it updates there automatically.
//
// Usage in your Profile screen, where the avatar / email is shown:
//   <ProfilePhoto size={96} name={displayName} />
import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Camera } from 'lucide-react-native';

let ImagePickerLib: any = null;
let storageLib: any = null;
try { ImagePickerLib = require('react-native-image-picker'); } catch (e) { ImagePickerLib = null; }
try { const m = require('@react-native-firebase/storage'); storageLib = m.default || m; } catch (e) { storageLib = null; }

const MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  size?: number;
  name?: string; // used for the letter shown when there is no photo
  accent?: string;
  onChanged?: (url: string | null) => void;
};

export default function ProfilePhoto({ size = 96, name, accent = '#2563EB', onChanged }: Props) {
  const user = auth().currentUser;
  const [photoUrl, setPhotoUrl] = useState<string | null>(user?.photoURL || null);
  const [busy, setBusy] = useState(false);

  // Live photo from the user's document (so it matches the Home screen and survives re-login)
  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    const unsub = firestore()
      .collection('users')
      .doc(uid)
      .onSnapshot(
        (snap) => {
          const v = snap.data()?.photoURL;
          if (typeof v === 'string') setPhotoUrl(v || null); // '' means the user removed it
        },
        () => {}
      );
    return () => unsub();
  }, []);

  const save = async (url: string | null) => {
    const u = auth().currentUser;
    if (!u) return;
    await u.updateProfile({ photoURL: url });
    await firestore().collection('users').doc(u.uid).set({ photoURL: url || '' }, { merge: true });
    setPhotoUrl(url);
    onChanged?.(url);
  };

  const deleteOldFile = async (oldUrl: string | null) => {
    if (!oldUrl || !storageLib || !oldUrl.includes('profile_photos')) return;
    try { await storageLib().refFromURL(oldUrl).delete(); } catch (e) { /* old file already gone */ }
  };

  const choosePhoto = async () => {
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
      const res = await ImagePickerLib.launchImageLibrary({
        mediaType: 'photo', quality: 0.8, maxWidth: 800, maxHeight: 800, selectionLimit: 1,
      });
      if (res.didCancel || !res.assets?.length) return;
      const asset = res.assets[0];
      if (!asset.uri) return;
      if (asset.fileSize && asset.fileSize > MAX_BYTES) {
        Alert.alert('File Too Large', 'Please choose a photo under 5 MB.');
        return;
      }
      setBusy(true);
      const previous = photoUrl;
      const ref = storageLib().ref(`profile_photos/${uid}/photo_${Date.now()}.jpg`);
      await ref.putFile(asset.uri, { contentType: asset.type || 'image/jpeg' });
      const url: string = await ref.getDownloadURL();
      await save(url);
      deleteOldFile(previous);
    } catch (e: any) {
      console.error('ProfilePhoto: upload error', e);
      Alert.alert('Upload Failed', 'Could not update your photo. Check your internet connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = () => {
    Alert.alert('Remove photo?', 'Your profile picture will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const previous = photoUrl;
            await save(null);
            deleteOldFile(previous);
          } catch (e) {
            console.error('ProfilePhoto: remove error', e);
            Alert.alert('Error', 'Could not remove the photo. Please try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const openMenu = () => {
    if (busy) return;
    const buttons: any[] = [{ text: photoUrl ? 'Change photo' : 'Add photo', onPress: choosePhoto }];
    if (photoUrl) buttons.push({ text: 'Remove photo', style: 'destructive', onPress: removePhoto });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile photo', undefined, buttons);
  };

  const initial = (name || user?.displayName || user?.email || 'U').trim().charAt(0).toUpperCase();

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={openMenu} style={{ width: size, height: size }}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: accent }]}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />
        ) : (
          <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
        )}
        {busy && (
          <View style={[styles.busy, { borderRadius: size / 2 }]}>
            <ActivityIndicator color="#FFF" />
          </View>
        )}
      </View>
      <View style={[styles.badge, { backgroundColor: accent }]}>
        <Camera size={14} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { color: '#FFFFFF', fontWeight: '800' },
  busy: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF',
  },
});