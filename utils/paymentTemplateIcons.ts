import { Ionicons } from '@expo/vector-icons';

import { IconName } from '@/constants/menuSections';

const FALLBACK_ICON: IconName = 'sparkles-outline';

const ICON_ALIASES: Record<string, IconName> = {
  'fuel-pump': 'flame-outline',
  'fuel_pump': 'flame-outline',
  combustible: 'flame-outline',
  gasolina: 'flame-outline',
};

const hasIonicon = (icon?: string | null): icon is IconName => {
  if (!icon) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, icon);
};

export const resolvePaymentTemplateIcon = (iconName?: string | null): IconName => {
  if (hasIonicon(iconName)) {
    return iconName;
  }
  if (!iconName) {
    return FALLBACK_ICON;
  }
  const normalized = iconName.trim().toLowerCase();
  const alias = ICON_ALIASES[normalized];
  if (alias && hasIonicon(alias)) {
    return alias;
  }
  // Algunos iconos pueden venir en formato `name-outline`; se intenta buscar su versión outline/filled.
  const candidate = normalized.replace(/[^a-z0-9-]/gi, '-');
  if (hasIonicon(candidate)) {
    return candidate;
  }
  const outlineCandidate = `${candidate}-outline` as IconName;
  if (hasIonicon(outlineCandidate)) {
    return outlineCandidate;
  }
  return FALLBACK_ICON;
};
