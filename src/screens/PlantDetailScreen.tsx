// PlantDetailScreen.tsx
// Screen 5a from the design handoff — the photo timeline as the app's
// retention spine. Real camera capture now exists (see api/photos.ts);
// timeline tiles and the hero box render an actual captured Image when a
// `uri` is present, falling back to the mockup's emoji-tile look when
// they're not (the default demo props still show the mock example content).

import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius, space } from '../theme';
import { TabBar, TabKey } from '../components/ui';

export interface PhotoTile {
  day: number;
  icon?: string;
  uri?: string;
}

export interface NoteTile {
  id: string;
  text: string;
  dateISO: string;
}

export interface PlantDetailScreenProps {
  cropName?: string;
  cropIcon?: string;
  dayNumber?: number;
  weekNumber?: number;
  stageLabel?: string;
  /** Overrides the computed "DAY n · WEEK n · STAGE" line — for real crop
   * data, where we only know a coarse planted bucket, not an exact day. */
  metaLine?: string;
  heroDateLabel?: string;
  /** Today's captured photo, if any — shown filling the hero box. */
  heroPhotoUri?: string;
  /** Replaces today's photo with a newly taken/picked one — same picker
   * flow as onAddPhoto, just named separately so the hero can offer both
   * "Retake" and "Delete" once a photo already exists today, rather than
   * a single ambiguous tap-to-replace. */
  onRetakePhoto?: () => void;
  onDeletePhoto?: () => void;
  photoCountLabel?: string;
  timeline?: PhotoTile[];
  instructionTitle?: string;
  instructionDetail?: string;
  stats?: { value: string; label: string }[];
  /** Newest-first — see App.tsx's plantDetailProps. */
  notes?: NoteTile[];
  onAddNote?: (text: string) => void;
  onEditNote?: (id: string, text: string) => void;
  onDeleteNote?: (id: string) => void;
  onBack: () => void;
  onAddPhoto?: () => void;
  onPlayTimeline?: () => void;
  activeTab?: TabKey;
  onTabPress?: (tab: TabKey) => void;
}

const DEFAULT_TIMELINE: PhotoTile[] = [
  { day: 1, icon: '🌱' },
  { day: 24, icon: '🌿' },
  { day: 52, icon: '🪴' },
  { day: 78, icon: '🌼' },
  { day: 111, icon: '🍅' },
];

const DEFAULT_STATS = [
  { value: '27', label: 'lbs picked' },
  { value: '18', label: 'tasks done' },
  { value: '~6', label: 'weeks left' },
];

export default function PlantDetailScreen({
  cropName = 'Tomatoes',
  cropIcon = '🍅',
  dayNumber = 111,
  weekNumber = 11,
  stageLabel = 'FRUITING',
  metaLine,
  heroDateLabel = 'AUG 20 · DAY 111',
  heroPhotoUri,
  onRetakePhoto,
  onDeletePhoto,
  photoCountLabel = '31 photos since May 2',
  timeline = DEFAULT_TIMELINE,
  instructionTitle = 'Feed 5-10-10, and pinch suckers if indeterminate',
  instructionDetail = 'High nitrogen now gives leaves, not fruit. On indeterminate varieties, snap out the shoots in each stem-branch V to push energy into the fruit already set. Leave determinate plants alone: pruning costs you yield.',
  stats = DEFAULT_STATS,
  notes = [],
  onAddNote,
  onEditNote,
  onDeleteNote,
  onBack,
  onAddPhoto,
  onPlayTimeline,
  activeTab = 'garden',
  onTabPress,
}: PlantDetailScreenProps) {
  const currentDay = timeline[timeline.length - 1]?.day;
  const [draftNote, setDraftNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  function startEditNote(note: NoteTile) {
    setEditingNoteId(note.id);
    setDraftNote(note.text);
  }

  function cancelEditNote() {
    setEditingNoteId(null);
    setDraftNote('');
  }

  function saveNote() {
    const text = draftNote.trim();
    if (!text) return;
    if (editingNoteId) {
      onEditNote?.(editingNoteId, text);
    } else {
      onAddNote?.(text);
    }
    setDraftNote('');
    setEditingNoteId(null);
  }

  function confirmDeleteNote(id: string) {
    Alert.alert("Delete this note?", "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (editingNoteId === id) cancelEditNote();
          onDeleteNote?.(id);
        },
      },
    ]);
  }

  function confirmDeletePhoto() {
    Alert.alert("Delete today's photo?", "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDeletePhoto },
    ]);
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onBack} accessibilityRole="button" style={styles.backCircle}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.cropName}>{cropName}</Text>
            <Text style={styles.cropMeta}>
              {metaLine ?? `DAY ${dayNumber} · WEEK ${weekNumber} · ${stageLabel}`}
            </Text>
          </View>
          <Text style={styles.headerIcon}>{cropIcon}</Text>
        </View>

        <View style={styles.hero}>
          {heroPhotoUri ? (
            <>
              <Image source={{ uri: heroPhotoUri }} style={styles.heroImage} />
              <View style={styles.heroActions}>
                <TouchableOpacity style={styles.heroActionBtn} onPress={onRetakePhoto} accessibilityRole="button">
                  <Text style={styles.heroActionText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.heroActionBtn} onPress={confirmDeletePhoto} accessibilityRole="button">
                  <Text style={styles.heroActionText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity style={styles.heroEmpty} onPress={onAddPhoto} accessibilityRole="button">
              <Text style={styles.heroIcon}>🌿</Text>
              <Text style={styles.heroTitle}>Today's photo</Text>
              <Text style={styles.heroSub}>Tap to add</Text>
            </TouchableOpacity>
          )}
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{heroDateLabel}</Text>
          </View>
        </View>

        <View>
          <View style={styles.timelineHeadRow}>
            <Text style={styles.timelineHead}>{photoCountLabel}</Text>
            {timeline.length > 0 && onPlayTimeline ? (
              <TouchableOpacity onPress={onPlayTimeline} accessibilityRole="button">
                <Text style={styles.playLink}>Play ▸</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {timeline.length > 0 ? (
            <View style={styles.timelineRow}>
              {timeline.map((tile) => {
                const isCurrent = tile.day === currentDay;
                return (
                  <View
                    key={tile.day}
                    style={[styles.tile, isCurrent ? styles.tileCurrent : styles.tileOld]}
                  >
                    {tile.uri ? (
                      <Image source={{ uri: tile.uri }} style={styles.tileImage} />
                    ) : (
                      <Text style={[styles.tileIcon, !isCurrent && styles.tileIconDim]}>
                        {tile.icon}
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.tileLabel,
                        isCurrent && styles.tileLabelCurrent,
                        tile.uri && styles.tileLabelOnImage,
                      ]}
                    >
                      D{tile.day}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.instructionCard}>
          <Text style={styles.instructionEyebrow}>Do this now</Text>
          <Text style={styles.instructionTitle}>{instructionTitle}</Text>
          <Text style={styles.instructionDetail}>{instructionDetail}</Text>
        </View>

        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statTile}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={heroPhotoUri ? onRetakePhoto : onAddPhoto}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>
            {heroPhotoUri ? "📷 Retake today's photo" : "📷 Add today's photo"}
          </Text>
        </TouchableOpacity>

        <View style={styles.notesSection}>
          <Text style={styles.notesHeading}>Notes & learnings</Text>
          <Text style={styles.notesSub}>Jot down anything worth remembering next season.</Text>

          {notes.length > 0 ? (
            <View style={styles.notesList}>
              {notes.map((n) => (
                <View key={n.id} style={[styles.noteRow, editingNoteId === n.id && styles.noteRowEditing]}>
                  <Text style={styles.noteText}>{n.text}</Text>
                  <View style={styles.noteActions}>
                    <TouchableOpacity
                      onPress={() => startEditNote(n)}
                      accessibilityRole="button"
                      accessibilityLabel="Edit note"
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.noteActionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirmDeleteNote(n.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Delete note"
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.noteActionTextDelete}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {editingNoteId ? (
            <View style={styles.editingBanner}>
              <Text style={styles.editingBannerText}>Editing note</Text>
              <TouchableOpacity onPress={cancelEditNote} accessibilityRole="button">
                <Text style={styles.editingCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.noteInputRow}>
            <TextInput
              style={styles.noteInput}
              value={draftNote}
              onChangeText={setDraftNote}
              placeholder="Add a note..."
              placeholderTextColor={colors.inkSoft}
              multiline
              accessibilityLabel="New note"
            />
            <TouchableOpacity
              style={[styles.noteSaveButton, !draftNote.trim() && styles.noteSaveButtonDisabled]}
              onPress={saveNote}
              disabled={!draftNote.trim()}
              accessibilityRole="button"
            >
              <Text style={styles.noteSaveButtonText}>{editingNoteId ? 'Update' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <TabBar active={activeTab} onPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    gap: 11,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  backCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft },
  headerText: { flex: 1 },
  cropName: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 22, color: colors.pine },
  cropMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 3,
  },
  headerIcon: { fontSize: 20 },
  hero: {
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 18,
    height: 186,
    position: 'relative',
    overflow: 'hidden',
  },
  heroEmpty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  heroImage: { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  heroIcon: { fontSize: 26, opacity: 0.35 },
  heroTitle: { fontFamily: fonts.bodySemiBold, fontSize: 11.5, color: colors.inkSoft },
  heroSub: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft },
  heroActions: {
    position: 'absolute',
    bottom: 11,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  heroActionBtn: {
    backgroundColor: 'rgba(31,61,43,0.86)',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  heroActionText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.onPine,
  },
  heroBadge: {
    position: 'absolute',
    top: 11,
    left: 12,
    backgroundColor: 'rgba(31,61,43,0.86)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  heroBadgeText: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.onPine,
  },
  timelineHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  timelineHead: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  playLink: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.mossGreen },
  timelineRow: { flexDirection: 'row', gap: 6 },
  tile: {
    flex: 1,
    height: 56,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  tileImage: { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  tileOld: {
    backgroundColor: colors.selectedBg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tileCurrent: {
    backgroundColor: colors.pine,
    borderWidth: 1,
    borderColor: colors.pine,
  },
  tileIcon: { fontSize: 15 },
  tileIconDim: { opacity: 0.4 },
  tileLabel: { fontFamily: fonts.monoSemiBold, fontSize: 10, color: colors.inkSoft },
  tileLabelCurrent: { color: colors.pineTag },
  tileLabelOnImage: {
    position: 'absolute',
    bottom: 3,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  instructionCard: {
    backgroundColor: colors.pine,
    borderRadius: radius.xl,
    padding: 14,
  },
  instructionEyebrow: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mustard,
    marginBottom: 7,
  },
  instructionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: colors.onPine,
    marginBottom: 4,
  },
  instructionDetail: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.pineFoot,
  },
  statsRow: { flexDirection: 'row', gap: 9 },
  statTile: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  statValue: { fontFamily: fonts.monoSemiBold, fontSize: 17, color: colors.pine },
  statLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft, marginTop: 4 },
  cta: {
    backgroundColor: colors.mustard,
    borderRadius: 15,
    padding: 14,
    alignItems: 'center',
    marginBottom: 4,
  },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.pine },
  notesSection: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: 14,
    gap: 10,
  },
  notesHeading: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
  notesSub: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: colors.inkSoft, marginTop: -4 },
  notesList: { gap: 10 },
  noteRow: { gap: 5 },
  noteRowEditing: { opacity: 0.5 },
  noteText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink },
  noteActions: { flexDirection: 'row', gap: 14 },
  noteActionText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.mossGreen },
  noteActionTextDelete: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.clay },
  editingBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editingBannerText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.3,
    color: colors.inkSoft,
  },
  editingCancelText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.mossGreen },
  noteInputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  noteInput: {
    flex: 1,
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    minHeight: 42,
    maxHeight: 100,
  },
  noteSaveButton: {
    backgroundColor: colors.mossGreen,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  noteSaveButtonDisabled: { backgroundColor: colors.disabled },
  noteSaveButtonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.onPine },
});
