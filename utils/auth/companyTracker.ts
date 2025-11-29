let currentCompanyId: number | null = null;

export const setTrackedCompanyId = (companyId: number | null) => {
  currentCompanyId = companyId;
};

export const getTrackedCompanyId = () => currentCompanyId;
