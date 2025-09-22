import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { useCachedState } from '@/hooks/useCachedState';

export interface Feedback {
  id: number;
  user_id: number;
  user_name: string;
  subject: string;
  message: string;
  status: 'pending' | 'responded';
  response_message?: string | null;
  responded_at?: string | null;
  responded_by_id?: number | null;
  responded_by_name?: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface FeedbackInput {
  subject: string;
  message: string;
}

interface FeedbackContextValue {
  myFeedbacks: Feedback[];
  allFeedbacks: Feedback[];
  loadMyFeedbacks: () => Promise<void>;
  loadAllFeedbacks: () => Promise<void>;
  submitFeedback: (payload: FeedbackInput) => Promise<Feedback | null>;
  respondFeedback: (feedbackId: number, response: string) => Promise<boolean>;
  loadingMyFeedbacks: boolean;
  loadingAllFeedbacks: boolean;
}

const defaultContext: FeedbackContextValue = {
  myFeedbacks: [],
  allFeedbacks: [],
  loadMyFeedbacks: async () => {},
  loadAllFeedbacks: async () => {},
  submitFeedback: async () => null,
  respondFeedback: async () => false,
  loadingMyFeedbacks: false,
  loadingAllFeedbacks: false,
};

export const FeedbackContext = createContext<FeedbackContextValue>(defaultContext);

const normalizeFeedback = (raw: any): Feedback => {
  const respondedBy = raw?.responded_by ?? raw?.response_user ?? raw?.responder ?? null;
  const respondedById =
    respondedBy !== null && respondedBy !== undefined
      ? Number(respondedBy.id ?? respondedBy.user_id ?? respondedBy)
      : raw?.responded_by_id ?? raw?.responder_id ?? null;
  const respondedByName =
    (respondedBy && (respondedBy.username ?? respondedBy.name ?? respondedBy.full_name)) ??
    raw?.responded_by_name ??
    raw?.responder_name ??
    null;
  const statusRaw = raw?.status ?? (raw?.response_message || raw?.response ? 'responded' : 'pending');

  return {
    id: Number(raw?.id ?? raw?.feedback_id ?? 0),
    user_id: Number(raw?.user_id ?? raw?.author_id ?? raw?.user?.id ?? 0),
    user_name:
      raw?.user_name ??
      raw?.user?.username ??
      raw?.user?.name ??
      raw?.author?.username ??
      raw?.author?.name ??
      '',
    subject: raw?.subject ?? raw?.title ?? '',
    message: raw?.message ?? raw?.body ?? '',
    status: statusRaw === 'responded' || statusRaw === 'resolved' ? 'responded' : 'pending',
    response_message: raw?.response_message ?? raw?.response ?? raw?.answer ?? null,
    responded_at: raw?.responded_at ?? raw?.response_at ?? raw?.answered_at ?? raw?.updated_at ?? null,
    responded_by_id: respondedById !== undefined && respondedById !== null ? Number(respondedById) : null,
    responded_by_name: respondedByName,
    created_at: raw?.created_at ?? raw?.inserted_at ?? new Date().toISOString(),
    updated_at: raw?.updated_at ?? null,
  };
};

const extractFeedbackArray = (payload: any): Feedback[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map(normalizeFeedback);
  }
  if (Array.isArray(payload.feedbacks)) {
    return payload.feedbacks.map(normalizeFeedback);
  }
  if (Array.isArray(payload.data)) {
    return payload.data.map(normalizeFeedback);
  }
  if (payload.feedback) {
    return [normalizeFeedback(payload.feedback)];
  }
  return [];
};

const sortFeedbacks = (items: Feedback[]): Feedback[] => {
  const getTime = (value?: string | null) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  return [...items].sort((a, b) => getTime(b.created_at) - getTime(a.created_at));
};

const mergeFeedback = (collection: Feedback[], updated: Feedback): Feedback[] => {
  const exists = collection.some(item => item.id === updated.id);
  if (exists) {
    return sortFeedbacks(collection.map(item => (item.id === updated.id ? updated : item)));
  }
  return sortFeedbacks([...collection, updated]);
};

export const FeedbackProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const [myFeedbacks, setMyFeedbacks] = useCachedState<Feedback[]>('my_feedbacks', []);
  const [allFeedbacks, setAllFeedbacks] = useCachedState<Feedback[]>('all_feedbacks', []);
  const [loadingMyFeedbacks, setLoadingMyFeedbacks] = useState(false);
  const [loadingAllFeedbacks, setLoadingAllFeedbacks] = useState(false);

  const authorizedFetch = useCallback(
    async (url: string, options?: RequestInit) => {
      if (!token) {
        throw new Error('Missing authentication token');
      }
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(options?.headers ?? {}),
        },
      });
      return response;
    },
    [token]
  );

  const loadMyFeedbacks = useCallback(async () => {
    if (!token) {
      setMyFeedbacks([]);
      return;
    }
    setLoadingMyFeedbacks(true);
    try {
      const response = await authorizedFetch(`${BASE_URL}/feedbacks/mine`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('Error loading personal feedbacks:', data);
        return;
      }
      const parsed = extractFeedbackArray(data);
      setMyFeedbacks(sortFeedbacks(parsed));
    } catch (error) {
      console.error('Error loading personal feedbacks:', error);
    } finally {
      setLoadingMyFeedbacks(false);
    }
  }, [authorizedFetch, setMyFeedbacks, token]);

  const loadAllFeedbacks = useCallback(async () => {
    if (!token) {
      setAllFeedbacks([]);
      return;
    }
    setLoadingAllFeedbacks(true);
    try {
      const response = await authorizedFetch(`${BASE_URL}/feedbacks`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('Error loading global feedbacks:', data);
        return;
      }
      const parsed = extractFeedbackArray(data);
      setAllFeedbacks(sortFeedbacks(parsed));
    } catch (error) {
      console.error('Error loading global feedbacks:', error);
    } finally {
      setLoadingAllFeedbacks(false);
    }
  }, [authorizedFetch, setAllFeedbacks, token]);

  const submitFeedback = useCallback(
    async (payload: FeedbackInput): Promise<Feedback | null> => {
      if (!payload.subject.trim() || !payload.message.trim()) {
        return null;
      }
      try {
        const response = await authorizedFetch(`${BASE_URL}/feedbacks`, {
          method: 'POST',
          body: JSON.stringify({
            subject: payload.subject.trim(),
            message: payload.message.trim(),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.error('Error submitting feedback:', data);
          return null;
        }
        const parsed = extractFeedbackArray(data);
        const created = parsed[0] ?? normalizeFeedback({ ...payload, id: Date.now() });
        setMyFeedbacks(prev => mergeFeedback(prev, created));
        setAllFeedbacks(prev => mergeFeedback(prev, created));
        return created;
      } catch (error) {
        console.error('Error submitting feedback:', error);
        return null;
      }
    },
    [authorizedFetch, setAllFeedbacks, setMyFeedbacks]
  );

  const respondFeedback = useCallback(
    async (feedbackId: number, responseMessage: string): Promise<boolean> => {
      if (!responseMessage.trim()) {
        return false;
      }
      try {
        const response = await authorizedFetch(`${BASE_URL}/feedbacks/${feedbackId}/respond`, {
          method: 'POST',
          body: JSON.stringify({ response: responseMessage.trim() }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.error('Error responding feedback:', data);
          return false;
        }
        const parsed = extractFeedbackArray(data);
        const updated = parsed[0] ?? null;
        if (updated) {
          setMyFeedbacks(prev => mergeFeedback(prev, updated));
          setAllFeedbacks(prev => mergeFeedback(prev, updated));
        } else {
          await Promise.all([loadMyFeedbacks(), loadAllFeedbacks()]);
        }
        return true;
      } catch (error) {
        console.error('Error responding feedback:', error);
        return false;
      }
    },
    [authorizedFetch, loadAllFeedbacks, loadMyFeedbacks, setAllFeedbacks, setMyFeedbacks]
  );

  useEffect(() => {
    if (!token) {
      setMyFeedbacks([]);
      setAllFeedbacks([]);
    }
  }, [setAllFeedbacks, setMyFeedbacks, token]);

  const contextValue = useMemo(
    () => ({
      myFeedbacks,
      allFeedbacks,
      loadMyFeedbacks,
      loadAllFeedbacks,
      submitFeedback,
      respondFeedback,
      loadingMyFeedbacks,
      loadingAllFeedbacks,
    }),
    [
      allFeedbacks,
      loadAllFeedbacks,
      loadMyFeedbacks,
      loadingAllFeedbacks,
      loadingMyFeedbacks,
      myFeedbacks,
      respondFeedback,
      submitFeedback,
    ]
  );

  return <FeedbackContext.Provider value={contextValue}>{children}</FeedbackContext.Provider>;
};

