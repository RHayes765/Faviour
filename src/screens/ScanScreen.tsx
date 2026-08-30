import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { VerdictBadge } from '../components/VerdictBadge';
import { useData } from '../context/DataContext';
import { useSync } from '../context/SyncContext';
import type { RootStackParamList } from '../navigation/types';
import { useThemeColors, useThemedStyles } from '../context/ThemeContext';
import type { ThemeColors } from '../theme';
import { barcodesMatch, normalizeBarcode } from '../utils/barcode';
import { rankInfo } from '../utils/ranking';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] as const;

export function ScanScreen({ route, navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const capture = route.params?.mode === 'capture';
  const { items, profiles } = useData();
  const { sharedItems, sharedProfiles, sharedLabelFor } = useSync();
  const allItems = [...items, ...sharedItems];
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');
  // The camera keeps firing onBarcodeScanned every frame; act only once.
  const handledRef = React.useRef(false);

  const handleCode = (raw: string) => {
    if (handledRef.current) {
      return;
    }
    const code = normalizeBarcode(raw);
    if (!code) {
      return;
    }
    handledRef.current = true;
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    }
    if (capture) {
      navigation.popTo('AddItem', { scannedBarcode: code }, { merge: true });
      return;
    }
    setScannedCode(code);
  };

  const matches = scannedCode
    ? allItems.filter((i) => barcodesMatch(i.barcode, scannedCode))
    : [];

  const profileName = (id: string) => {
    const own = profiles.find((p) => p.id === id);
    if (own) {
      return own.name;
    }
    const sharedProfile = sharedProfiles.find((p) => p.id === id);
    if (sharedProfile) {
      const label = sharedLabelFor(id);
      return label ? `${sharedProfile.name} · ${label}` : `${sharedProfile.name} (shared)`;
    }
    return 'Unknown';
  };

  return (
    <View style={styles.container}>
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={
            scannedCode ? undefined : ({ data }) => handleCode(data)
          }
        />
      ) : (
        <View style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={56} color={colors.disabled} />
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionText}>
            Point the camera at a product barcode to look it up instantly.
          </Text>
          {permission?.canAskAgain === false ? (
            <Text style={styles.permissionText}>
              Enable camera access for Faviour in your device settings.
            </Text>
          ) : (
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Allow camera</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {permission?.granted && !scannedCode ? (
        <View style={styles.reticle}>
          <Text style={styles.reticleText}>Line up the barcode</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        {scannedCode ? (
          <View style={styles.resultCard}>
            {matches.length > 0 ? (
              <>
                <Text style={styles.resultTitle}>{matches[0].name}</Text>
                <Text style={styles.resultSub}>
                  {matches[0].brand} · {matches[0].category}
                </Text>
                {matches.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.matchRow}
                    onPress={() => navigation.replace('ItemDetail', { itemId: item.id })}
                  >
                    <VerdictBadge preference={item.preference} size="large" />
                    <View style={styles.matchInfo}>
                      <Text style={styles.matchProfile}>{profileName(item.profileId)}</Text>
                      {(() => {
                        const shared = sharedItems.some((s) => s.id === item.id);
                        const info = rankInfo(shared ? sharedItems : items, item);
                        return info ? (
                          <Text style={styles.matchNotes}>
                            Ranked #{info.position} of {info.total} in {item.category}
                          </Text>
                        ) : null;
                      })()}
                      {item.notes ? (
                        <Text style={styles.matchNotes} numberOfLines={1}>
                          {item.notes}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <>
                <Text style={styles.resultTitle}>Not in your list yet</Text>
                <Text style={styles.resultSub}>Barcode {scannedCode}</Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() =>
                    navigation.replace('AddItem', { prefillBarcode: scannedCode })
                  }
                >
                  <Text style={styles.primaryButtonText}>Add this product</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                handledRef.current = false;
                setScannedCode(null);
              }}
            >
              <Text style={styles.secondaryButtonText}>Scan again</Text>
            </TouchableOpacity>
          </View>
        ) : manualOpen ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultSub}>Type the barcode number</Text>
            <View style={styles.manualRow}>
              <TextInput
                style={styles.manualInput}
                value={manualValue}
                onChangeText={setManualValue}
                placeholder="e.g. 0123456789012"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.primaryButton, styles.manualGo]}
                onPress={() => handleCode(manualValue)}
              >
                <Text style={styles.primaryButtonText}>Go</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.manualLink} onPress={() => setManualOpen(true)}>
            <Text style={styles.manualLinkText}>Type the number instead</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  permissionText: {
    color: '#bbbbbb',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  permissionButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  permissionButtonText: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  reticle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  reticleText: {
    color: 'white',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
  },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  resultSub: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 8,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  matchInfo: {
    flex: 1,
  },
  matchProfile: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  matchNotes: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
  },
  manualRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: colors.text,
  },
  manualGo: {
    marginTop: 0,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  manualLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  manualLinkText: {
    color: 'white',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
