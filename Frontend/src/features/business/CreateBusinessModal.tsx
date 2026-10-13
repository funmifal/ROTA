import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Effects } from '../../theme/tokens';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { api, Business } from '../../services/api';

interface CreateBusinessModalProps {
  visible: boolean;
  onSuccess: (business: Business) => void;
  onClose: () => void;
}

const INDUSTRIES = [
  'Restaurant & Hospitality',
  'Healthcare & Clinic',
  'Retail Store',
  'Salon & Beauty',
  'Small Service Business',
  'Other',
];

export const CreateBusinessModal: React.FC<CreateBusinessModalProps> = ({
  visible,
  onSuccess,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [timezone, setTimezone] = useState('Africa/Lagos');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setError('Business name must be at least 2 characters.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.createBusiness({
        name: trimmed,
        industry,
        timezone,
      });
      setName('');
      onSuccess(res.business);
    } catch (err: any) {
      setError(err.message || 'Failed to create business.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="business" size={24} color={Colors.primary} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.neutral} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Create Your Business</Text>
          <Text style={styles.subtitle}>
            Set up your organization to start scheduling shifts and building your team.
          </Text>

          {error ? <FeedbackBanner type="error" message={error} /> : null}

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Input
              label="Business Name"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (error) setError('');
              }}
              placeholder="e.g. Ocean Blue Cafe"
            />

            <Text style={styles.sectionLabel}>Industry</Text>
            <View style={styles.chipsContainer}>
              {INDUSTRIES.map((ind) => (
                <TouchableOpacity
                  key={ind}
                  style={[
                    styles.chip,
                    industry === ind && styles.activeChip,
                  ]}
                  onPress={() => setIndustry(ind)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      industry === ind && styles.activeChipText,
                    ]}
                  >
                    {ind}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Timezone (IANA)"
              value={timezone}
              onChangeText={setTimezone}
              placeholder="e.g. Africa/Lagos, Europe/London"
            />
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Create Business"
              onPress={handleCreate}
              loading={loading}
              variant="primary"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.largeSpacing,
    maxHeight: '88%',
    ...Effects.hardShadow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.smallSpacing,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    padding: 6,
  },
  title: {
    fontSize: Typography.headlineSmall.fontSize,
    lineHeight: Typography.headlineSmall.lineHeight,
    fontWeight: '700',
    color: Colors.onSurface,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: Typography.bodyMedium.fontSize,
    lineHeight: Typography.bodyMedium.lineHeight,
    color: Colors.neutral,
    marginBottom: Spacing.baseSpacing,
  },
  scrollContent: {
    maxHeight: 380,
  },
  sectionLabel: {
    fontSize: Typography.labelMedium.fontSize,
    lineHeight: Typography.labelMedium.lineHeight,
    fontWeight: '600',
    color: Colors.onSurface,
    marginBottom: Spacing.smallSpacing,
    marginTop: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.baseSpacing,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.neutralContainer,
  },
  activeChip: {
    backgroundColor: Colors.primaryContainer,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: Typography.labelSmall.fontSize,
    color: Colors.neutral,
    fontWeight: '500',
  },
  activeChipText: {
    color: Colors.onPrimaryContainer,
    fontWeight: '600',
  },
  footer: {
    marginTop: Spacing.baseSpacing,
  },
});
