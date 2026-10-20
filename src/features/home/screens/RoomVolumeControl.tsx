// RoomVolumeControl.tsx
// A small floating volume control shown on every call/room screen (public room, class room,
// private 1-to-1 session). It sets the playback volume of every remote speaker in the room,
// from 0% to 300% (so a quiet room can be made louder than the phone's call volume).
// It must be rendered INSIDE <LiveKitRoom>.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useRoomContext } from '@livekit/react-native';
import { RoomEvent } from 'livekit-client';
import { Volume2, VolumeX, Plus, Minus } from 'lucide-react-native';

const STEPS = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3];
const DEFAULT_INDEX = 4; // 100%

export const RoomVolumeControl = () => {
  const room = useRoomContext();
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(DEFAULT_INDEX);
  const volumeRef = useRef(STEPS[DEFAULT_INDEX]);
  const touchedRef = useRef(false);

  const applyVolume = useCallback(() => {
    const v = volumeRef.current;
    // Untouched (100%): leave the audio engine alone, so this control can never disturb normal playback
    if (v === 1 && !touchedRef.current) return;
    try {
      room?.remoteParticipants?.forEach((p: any) => {
        const pubs: any = p.audioTrackPublications || p.audioTracks;
        pubs?.forEach?.((pub: any) => {
          try { pub?.track?.setVolume?.(v); } catch (e) {}
        });
      });
    } catch (e) {}
  }, [room]);

  // Apply the chosen volume again whenever someone new starts speaking / joins
  useEffect(() => {
    if (!room) return;
    room.on(RoomEvent.TrackSubscribed, applyVolume);
    room.on(RoomEvent.ParticipantConnected, applyVolume);
    return () => {
      room.off(RoomEvent.TrackSubscribed, applyVolume);
      room.off(RoomEvent.ParticipantConnected, applyVolume);
    };
  }, [room, applyVolume]);

  useEffect(() => {
    volumeRef.current = STEPS[idx];
    applyVolume();
  }, [idx, applyVolume]);

  const pct = Math.round(STEPS[idx] * 100);
  const Icon = idx === 0 ? VolumeX : Volume2;
  const top = (StatusBar.currentHeight || 24) + 74;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top }]}>
      {open && (
        <View style={styles.panel}>
          <TouchableOpacity
            onPress={() => { touchedRef.current = true; setIdx((i) => Math.min(i + 1, STEPS.length - 1)); }}
            style={styles.stepBtn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            disabled={idx >= STEPS.length - 1}
          >
            <Plus size={18} color={idx >= STEPS.length - 1 ? '#64748B' : '#FFFFFF'} />
          </TouchableOpacity>
          <Text style={styles.pct}>{pct}%</Text>
          <TouchableOpacity
            onPress={() => { touchedRef.current = true; setIdx((i) => Math.max(i - 1, 0)); }}
            style={styles.stepBtn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            disabled={idx <= 0}
          >
            <Minus size={18} color={idx <= 0 ? '#64748B' : '#FFFFFF'} />
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity onPress={() => setOpen((o) => !o)} style={styles.fab} activeOpacity={0.85}>
        <Icon size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 10, alignItems: 'center', zIndex: 50 },
  fab: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.35)',
  },
  panel: {
    alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, marginBottom: 8, borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.92)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.35)',
  },
  stepBtn: { width: 36, height: 34, alignItems: 'center', justifyContent: 'center' },
  pct: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', marginVertical: 2 },
});