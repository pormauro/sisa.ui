import { StyleSheet } from 'react-native';

export const invoiceSharedStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  metaRowMultiline: {
    alignItems: 'flex-start',
    marginTop: 12,
  },
  metaLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 14,
  },
  metaValueGroup: {
    alignItems: 'flex-end',
  },
  metaSubValue: {
    fontSize: 12,
    marginTop: 2,
  },
});
