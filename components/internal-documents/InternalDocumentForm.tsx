import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { SearchableSelect, SearchableSelectItem } from '@/components/SearchableSelect';
import { useThemeColor } from '@/hooks/useThemeColor';
import {
  DOCUMENT_TYPES,
  FACTURA_X_VOUCHER_TYPE,
  VOUCHER_DEFINITIONS,
} from '@/constants/invoiceOptions';

export interface InternalDocumentValues {
  documentType: string;
  voucherType: string;
}

interface InternalDocumentFormProps {
  initialDocumentType?: string | null;
  initialVoucherType?: string | null;
  documentTypes?: SearchableSelectItem[];
  voucherTypes?: SearchableSelectItem[];
  allowedVoucherTypes?: string[];
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (values: InternalDocumentValues) => void | Promise<void>;
  onCancel?: () => void;
}

const mapVoucherDefinitionsToOptions = () =>
  VOUCHER_DEFINITIONS.map(definition => ({ label: definition.label, value: definition.value }));

const defaultVoucherOptions = mapVoucherDefinitionsToOptions();

const defaultDocumentOptions: SearchableSelectItem[] = DOCUMENT_TYPES;

export const DEFAULT_INTERNAL_DOCUMENT_VALUES: InternalDocumentValues = {
  documentType: defaultDocumentOptions[0]?.value ?? '',
  voucherType: FACTURA_X_VOUCHER_TYPE,
};

export const InternalDocumentForm: React.FC<InternalDocumentFormProps> = ({
  initialDocumentType,
  initialVoucherType,
  documentTypes,
  voucherTypes,
  allowedVoucherTypes,
  submitting = false,
  submitLabel = 'Guardar',
  onSubmit,
  onCancel,
}) => {
  const [documentType, setDocumentType] = useState<string>(
    initialDocumentType !== undefined && initialDocumentType !== null
      ? String(initialDocumentType)
      : DEFAULT_INTERNAL_DOCUMENT_VALUES.documentType
  );
  const [voucherType, setVoucherType] = useState<string>(
    initialVoucherType !== undefined && initialVoucherType !== null
      ? String(initialVoucherType)
      : DEFAULT_INTERNAL_DOCUMENT_VALUES.voucherType
  );
  const [voucherError, setVoucherError] = useState(false);

  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const buttonColor = useThemeColor({}, 'tint');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const destructiveColor = useThemeColor({}, 'destructive');

  const documentOptions = useMemo<SearchableSelectItem[]>(() => {
    if (documentTypes && documentTypes.length > 0) {
      return documentTypes;
    }
    return defaultDocumentOptions;
  }, [documentTypes]);

  const voucherOptions = useMemo<SearchableSelectItem[]>(() => {
    const base = voucherTypes && voucherTypes.length > 0 ? voucherTypes : defaultVoucherOptions;
    if (!allowedVoucherTypes || allowedVoucherTypes.length === 0) {
      return base;
    }
    const allowed = new Set(allowedVoucherTypes.map(value => String(value)));
    const filtered = base.filter(option => allowed.has(String(option.value)));
    return filtered.length > 0 ? filtered : base;
  }, [allowedVoucherTypes, voucherTypes]);

  useEffect(() => {
    if (initialDocumentType !== undefined && initialDocumentType !== null) {
      setDocumentType(String(initialDocumentType));
    }
  }, [initialDocumentType]);

  useEffect(() => {
    if (initialVoucherType !== undefined && initialVoucherType !== null) {
      setVoucherType(String(initialVoucherType));
    }
  }, [initialVoucherType]);

  useEffect(() => {
    if (!voucherType && voucherOptions.length > 0) {
      setVoucherType(String(voucherOptions[0].value));
    }
  }, [voucherOptions, voucherType]);

  const handleSubmit = useCallback(() => {
    if (!voucherType) {
      setVoucherError(true);
      return;
    }

    setVoucherError(false);
    onSubmit({ documentType, voucherType });
  }, [documentType, onSubmit, voucherType]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
          <ThemedText style={styles.sectionTitle}>Datos del comprobante</ThemedText>

          <ThemedText style={styles.label}>Tipo de documento</ThemedText>
          <SearchableSelect
            items={documentOptions}
            selectedValue={documentType}
            onValueChange={value => setDocumentType(value ? String(value) : '')}
            placeholder="Selecciona tipo de documento"
            showSearch={false}
          />

          <ThemedText style={[styles.label, styles.spacingTop, voucherError ? { color: destructiveColor } : null]}>
            Tipo de comprobante
          </ThemedText>
          <SearchableSelect
            items={voucherOptions}
            selectedValue={voucherType || null}
            onValueChange={value => {
              setVoucherType(value ? String(value) : '');
              setVoucherError(false);
            }}
            placeholder="Selecciona tipo de comprobante"
            hasError={voucherError}
            errorColor={destructiveColor}
          />
          {voucherError ? (
            <ThemedText style={[styles.errorText, { color: destructiveColor }]}>Selecciona un tipo de comprobante.</ThemedText>
          ) : null}
        </View>

        <View style={styles.actions}>
          {onCancel ? (
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.secondaryButton, { borderColor, opacity: submitting ? 0.7 : 1 }]}
              disabled={submitting}
            >
              <ThemedText style={[styles.secondaryButtonText, { color: textColor }]}>Cancelar</ThemedText>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.primaryButton, { backgroundColor: buttonColor, opacity: submitting ? 0.7 : 1 }]}
            disabled={submitting}
          >
            <ThemedText style={[styles.primaryButtonText, { color: buttonTextColor }]}>
              {submitting ? 'Procesando…' : submitLabel}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  spacingTop: {
    marginTop: 12,
  },
  errorText: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default InternalDocumentForm;
