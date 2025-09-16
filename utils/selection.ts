export const CLEAR_SELECTION_VALUE = 'clear';

export interface BuildSelectionPathOptions {
  selectedId?: string | number | null;
  returnTo: string;
  returnParam: string;
  stayOnSelect?: boolean;
  extraParams?: Record<string, string | number | boolean | null | undefined>;
}

export const buildSelectionPath = (
  basePath: string,
  { selectedId, returnTo, returnParam, stayOnSelect, extraParams }: BuildSelectionPathOptions
) => {
  const params = new URLSearchParams();
  params.set('select', '1');

  if (selectedId !== undefined && selectedId !== null && `${selectedId}` !== '') {
    params.set('selectedId', String(selectedId));
  }

  params.set('returnTo', returnTo);
  params.set('returnParam', returnParam);

  if (stayOnSelect) {
    params.set('stay', '1');
  }

  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}` !== '') {
        params.set(key, String(value));
      }
    });
  }

  return `${basePath}?${params.toString()}`;
};

export const decodeReturnPath = (value?: string | null) => {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch (error) {
    console.warn('Failed to decode return path', error);
    return value;
  }
};

export const getSingleParamValue = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;
