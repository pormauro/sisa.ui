import { CompanyAddress } from '@/contexts/CompaniesContext';

const joinParts = (parts: (string | null | undefined)[], separator: string) =>
  parts
    .map(part => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(separator);

export const formatCompanyAddress = (address?: Partial<CompanyAddress> | null): string => {
  if (!address) {
    return '';
  }

  const streetLine = joinParts([address.street, address.number], ' ');
  const floorLine = joinParts(
    [
      address.floor ? `Piso ${address.floor}` : null,
      address.apartment ? `Dpto ${address.apartment}` : null,
    ],
    ' '
  );
  const locationLine = joinParts([address.city, address.state, address.country], ', ');
  const postalLine = address.postal_code ? `CP ${address.postal_code}` : '';

  return joinParts([streetLine, floorLine, locationLine, postalLine], ', ');
};
