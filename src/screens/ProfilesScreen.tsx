import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '../components/EmptyState';
import { useData } from '../context/DataContext';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { colors, profileColor } from '../theme';
import type { Profile } from '../types';
import { confirmDestructive } from '../utils/confirm';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Profiles'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function ProfilesScreen({ navigation }: Props) {
  const { profiles, items, addProfile, removeProfile } = useData();
  const [newProfileName, setNewProfileName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const profileItems = (profileId: string) => items.filter((i) => i.profileId === profileId);

  const handleAddProfile = async () => {
    const trimmed = newProfileName.trim();
    if (!trimmed) {
      return;
    }
    await addProfile(trimmed);
    setNewProfileName('');
    setShowAddModal(false);
  };

  const handleDeleteProfile = (profile: Profile) => {
    const count = profileItems(profile.id).length;
    confirmDestructive({
      title: 'Delete Profile',
      message: `Are you sure you want to delete ${profile.name}?${
        count > 0 ? ` This will also delete ${count} item${count !== 1 ? 's' : ''}.` : ''
      }`,
      onConfirm: () => {
        void removeProfile(profile.id);
      },
    });
  };

  const handleViewItems = (profileId: string) => {
    navigation.navigate('Lookup', { profileFilterId: profileId });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profiles</Text>
      </View>

      {profiles.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No profiles yet"
          subtitle="Add profiles for each person whose preferences you want to track"
          buttonLabel="Add Your First Profile"
          onButtonPress={() => setShowAddModal(true)}
        />
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(profile) => profile.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: profile }) => {
            const own = profileItems(profile.id);
            const likedCount = own.filter((i) => i.preference === 'like').length;
            const dislikedCount = own.filter((i) => i.preference === 'dislike').length;
            const itemCount = own.length;

            return (
              <View style={styles.profileCard}>
                <View style={styles.profileHeader}>
                  <View style={[styles.avatar, { backgroundColor: profileColor(profile.name) }]}>
                    <Text style={styles.avatarText}>
                      {profile.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{profile.name}</Text>
                    <Text style={styles.profileStats}>
                      {itemCount} item{itemCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteProfile(profile)}
                    accessibilityLabel={`Delete profile ${profile.name}`}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.dislike} />
                  </TouchableOpacity>
                </View>

                {itemCount > 0 && (
                  <View style={styles.preferencesBar}>
                    <View style={[styles.likesBar, { flex: likedCount || 0.01 }]} />
                    <View style={[styles.dislikesBar, { flex: dislikedCount || 0.01 }]} />
                  </View>
                )}

                <View style={styles.profileFooter}>
                  <View style={styles.preferenceCounts}>
                    {itemCount > 0 ? (
                      <>
                        <View style={styles.preferenceCount}>
                          <Ionicons name="thumbs-up" size={14} color={colors.like} />
                          <Text style={styles.countText}>{likedCount}</Text>
                        </View>
                        <View style={styles.preferenceCount}>
                          <Ionicons name="thumbs-down" size={14} color={colors.dislike} />
                          <Text style={styles.countText}>{dislikedCount}</Text>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.noItemsText}>No items yet</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.viewItemsButton}
                    onPress={() => handleViewItems(profile.id)}
                  >
                    <Text style={styles.viewItemsText}>
                      {itemCount > 0 ? 'View Items' : 'Add Items'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={showAddModal}
        // react-native-web's animated close waits for an animationend event that
        // never fires under reduced motion, leaving the modal stuck open.
        animationType={Platform.OS === 'web' ? 'none' : 'slide'}
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Profile</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Profile Name</Text>
            <TextInput
              value={newProfileName}
              onChangeText={setNewProfileName}
              placeholder="Enter name (e.g. Ryley, Mom, Kids)"
              placeholderTextColor={colors.textFaint}
              style={styles.textInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAddProfile}
            />

            <Text style={styles.helperText}>
              Create profiles for each person whose preferences you want to track
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addProfileButton,
                  !newProfileName.trim() && styles.disabledButton,
                ]}
                onPress={handleAddProfile}
                disabled={!newProfileName.trim()}
              >
                <Text style={styles.addProfileButtonText}>Add Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        accessibilityLabel="Add profile"
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  listContent: {
    paddingBottom: 96,
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  profileStats: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  preferencesBar: {
    height: 4,
    flexDirection: 'row',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 16,
    backgroundColor: colors.chipBackground,
  },
  likesBar: {
    height: '100%',
    backgroundColor: colors.like,
  },
  dislikesBar: {
    height: '100%',
    backgroundColor: colors.dislike,
  },
  profileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  preferenceCounts: {
    flexDirection: 'row',
  },
  preferenceCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    gap: 4,
  },
  countText: {
    color: colors.textMuted,
  },
  noItemsText: {
    color: colors.textFaint,
    fontStyle: 'italic',
    fontSize: 13,
  },
  viewItemsButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewItemsText: {
    color: colors.primary,
    marginRight: 2,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: colors.text,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  addProfileButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  addProfileButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 3px 6px rgba(0, 0, 0, 0.2)',
  },
});
