import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { useCachedState } from '@/hooks/useCachedState';

export interface CommentEntry {
  id: number;
  user_id: number;
  user_name: string;
  title: string;
  comment: string;
  file_ids: number[];
  status: 'pending' | 'responded';
  response?: string | null;
  responded_at?: string | null;
  responded_by_id?: number | null;
  responded_by_name?: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface CommentInput {
  title: string;
  comment: string;
  file_ids?: number[] | string | null;
}

interface CommentsContextValue {
  myComments: CommentEntry[];
  allComments: CommentEntry[];
  loadMyComments: () => Promise<void>;
  loadAllComments: () => Promise<void>;
  submitComment: (payload: CommentInput) => Promise<CommentEntry | null>;
  respondComment: (commentId: number, response: string) => Promise<boolean>;
  loadingMyComments: boolean;
  loadingAllComments: boolean;
  listingAvailable: boolean;
}

const defaultContext: CommentsContextValue = {
  myComments: [],
  allComments: [],
  loadMyComments: async () => {},
  loadAllComments: async () => {},
  submitComment: async () => null,
  respondComment: async () => false,
  loadingMyComments: false,
  loadingAllComments: false,
  listingAvailable: true,
};

export const CommentsContext = createContext<CommentsContextValue>(defaultContext);

const parseFileIds = (value: unknown): number[] => {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === 'number') {
          return Number.isFinite(item) ? item : null;
        }
        const parsed = Number(item);
        return Number.isNaN(parsed) ? null : parsed;
      })
      .filter((item): item is number => item !== null);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'null') {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed);
      return parseFileIds(parsed);
    } catch {
      const numeric = Number(trimmed);
      return Number.isNaN(numeric) ? [] : [numeric];
    }
  }

  if (typeof value === 'object') {
    const nested =
      (value as any)?.file_ids ??
      (value as any)?.attached_files ??
      (value as any)?.files ??
      (value as any)?.attachments ??
      (value as any)?.data ??
      null;
    if (nested !== null && nested !== undefined) {
      return parseFileIds(nested);
    }
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) ? [] : [numeric];
};

const serializeFileIds = (value: CommentInput['file_ids']): number[] | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = parseFileIds(value);
  return parsed.length > 0 ? parsed : null;
};

const normalizeComment = (raw: any): CommentEntry => {
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
  const statusRaw = raw?.status ?? (raw?.response || raw?.response_message ? 'responded' : 'pending');

  return {
    id: Number(raw?.id ?? raw?.comment_id ?? raw?.feedback_id ?? 0),
    user_id: Number(raw?.user_id ?? raw?.author_id ?? raw?.user?.id ?? 0),
    user_name:
      raw?.user_name ??
      raw?.user?.username ??
      raw?.user?.name ??
      raw?.author?.username ??
      raw?.author?.name ??
      '',
    title: raw?.title ?? raw?.subject ?? raw?.name ?? '',
    comment: raw?.comment ?? raw?.message ?? raw?.body ?? '',
    file_ids: parseFileIds(
      raw?.file_ids ?? raw?.attached_files ?? raw?.attachments ?? raw?.files ?? null
    ),
    status: statusRaw === 'responded' || statusRaw === 'resolved' ? 'responded' : 'pending',
    response: raw?.response ?? raw?.response_message ?? raw?.answer ?? null,
    responded_at:
      raw?.responded_at ?? raw?.response_at ?? raw?.answered_at ?? raw?.updated_at ?? null,
    responded_by_id:
      respondedById !== undefined && respondedById !== null ? Number(respondedById) : null,
    responded_by_name: respondedByName,
    created_at: raw?.created_at ?? raw?.inserted_at ?? new Date().toISOString(),
    updated_at: raw?.updated_at ?? null,
  };
};

const extractCommentArray = (payload: any): CommentEntry[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map(normalizeComment);
  }
  if (Array.isArray(payload.comments)) {
    return payload.comments.map(normalizeComment);
  }
  if (Array.isArray(payload.feedbacks)) {
    return payload.feedbacks.map(normalizeComment);
  }
  if (Array.isArray(payload.data)) {
    return payload.data.map(normalizeComment);
  }
  if (payload.comment) {
    return [normalizeComment(payload.comment)];
  }
  if (payload.feedback) {
    return [normalizeComment(payload.feedback)];
  }
  return [];
};

const sortComments = (items: CommentEntry[]): CommentEntry[] => {
  const getTime = (value?: string | null) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  return [...items].sort((a, b) => getTime(b.created_at) - getTime(a.created_at));
};

const mergeComment = (collection: CommentEntry[], updated: CommentEntry): CommentEntry[] => {
  const exists = collection.some(item => item.id === updated.id);
  if (exists) {
    return sortComments(collection.map(item => (item.id === updated.id ? updated : item)));
  }
  return sortComments([...collection, updated]);
};

export const CommentsProvider = ({ children }: { children: ReactNode }) => {
  const { token, userId, isLoading: authIsLoading } = useContext(AuthContext);
  const [myComments, setMyComments, myCommentsHydrated] = useCachedState<CommentEntry[]>(
    'my_comments',
    []
  );
  const [allComments, setAllComments, allCommentsHydrated] = useCachedState<CommentEntry[]>(
    'all_comments',
    []
  );
  const [loadingMyComments, setLoadingMyComments] = useState(false);
  const [loadingAllComments, setLoadingAllComments] = useState(false);
  const [listingAvailable, setListingAvailable] = useState(true);
  const previousUserIdRef = useRef<string | null>(null);
  const listingDisabledRef = useRef(false);

  const clearCachedComments = useCallback(() => {
    setMyComments(prev => (prev.length > 0 ? [] : prev));
    setAllComments(prev => (prev.length > 0 ? [] : prev));
    setListingAvailable(true);
    listingDisabledRef.current = false;
  }, [setAllComments, setListingAvailable, setMyComments]);

  useEffect(() => {
    if (!myCommentsHydrated || !allCommentsHydrated) {
      return;
    }

    if (!authIsLoading && !userId) {
      clearCachedComments();
      previousUserIdRef.current = null;
      return;
    }

    if (userId && previousUserIdRef.current && previousUserIdRef.current !== userId) {
      clearCachedComments();
    }

    if (userId !== previousUserIdRef.current) {
      previousUserIdRef.current = userId ?? null;
    }
  }, [
    allCommentsHydrated,
    authIsLoading,
    clearCachedComments,
    myCommentsHydrated,
    userId,
  ]);

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

  const disableListingIfNeeded = useCallback(
    (reason: unknown) => {
      let disabled = false;
      setListingAvailable(prev => {
        if (!prev) {
          return prev;
        }
        disabled = true;
        if (!listingDisabledRef.current) {
          listingDisabledRef.current = true;
          console.warn(
            'El backend no soporta la lectura del historial de comentarios. Se mantendrá oculta la bandeja.',
            reason
          );
        }
        return false;
      });
      if (disabled || listingDisabledRef.current) {
        setMyComments(prev => (prev.length > 0 ? [] : prev));
        setAllComments(prev => (prev.length > 0 ? [] : prev));
      }
    },
    [setAllComments, setMyComments]
  );

  const loadMyComments = useCallback(async () => {
    if (!token || !listingAvailable) {
      return;
    }
    setLoadingMyComments(true);
    try {
      const response = await authorizedFetch(`${BASE_URL}/comments/mine`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const status = response.status;
        if (status === 404 || status === 405 || status === 400) {
          disableListingIfNeeded({ scope: 'mine', status, data });
        } else {
          console.warn('Error loading personal comments:', data);
        }
        return;
      }
      setListingAvailable(true);
      const parsed = extractCommentArray(data);
      setMyComments(sortComments(parsed));
    } catch (error) {
      console.warn('Error loading personal comments:', error);
    } finally {
      setLoadingMyComments(false);
    }
  }, [authorizedFetch, disableListingIfNeeded, listingAvailable, setMyComments, token]);

  const loadAllComments = useCallback(async () => {
    if (!token || !listingAvailable) {
      return;
    }
    setLoadingAllComments(true);
    try {
      const response = await authorizedFetch(`${BASE_URL}/comments`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const status = response.status;
        if (status === 404 || status === 405 || status === 400) {
          disableListingIfNeeded({ scope: 'all', status, data });
        } else {
          console.warn('Error loading global comments:', data);
        }
        return;
      }
      setListingAvailable(true);
      const parsed = extractCommentArray(data);
      setAllComments(sortComments(parsed));
    } catch (error) {
      console.warn('Error loading global comments:', error);
    } finally {
      setLoadingAllComments(false);
    }
  }, [authorizedFetch, disableListingIfNeeded, listingAvailable, setAllComments, token]);

  const submitComment = useCallback(
    async (payload: CommentInput): Promise<CommentEntry | null> => {
      if (!payload.title.trim() || !payload.comment.trim()) {
        return null;
      }
      try {
        const body: Record<string, unknown> = {
          title: payload.title.trim(),
          comment: payload.comment.trim(),
        };
        const fileIds = serializeFileIds(payload.file_ids ?? null);
        if (fileIds) {
          body.file_ids = fileIds;
        }
        const response = await authorizedFetch(`${BASE_URL}/comments`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.error('Error submitting comment:', data);
          return null;
        }
        const parsed = extractCommentArray(data);
        const created = parsed[0] ?? normalizeComment({ ...payload, id: Date.now() });
        setMyComments(prev => mergeComment(prev, created));
        setAllComments(prev => mergeComment(prev, created));
        return created;
      } catch (error) {
        console.error('Error submitting comment:', error);
        return null;
      }
    },
    [authorizedFetch, setAllComments, setMyComments]
  );

  const respondComment = useCallback(
    async (commentId: number, responseMessage: string): Promise<boolean> => {
      if (!responseMessage.trim()) {
        return false;
      }
      try {
        const response = await authorizedFetch(`${BASE_URL}/comments/${commentId}/respond`, {
          method: 'POST',
          body: JSON.stringify({ response: responseMessage.trim() }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.error('Error responding comment:', data);
          return false;
        }
        const parsed = extractCommentArray(data);
        const updated = parsed[0] ?? null;
        if (updated) {
          setMyComments(prev => mergeComment(prev, updated));
          setAllComments(prev => mergeComment(prev, updated));
        } else {
          await Promise.all([loadMyComments(), loadAllComments()]);
        }
        return true;
      } catch (error) {
        console.error('Error responding comment:', error);
        return false;
      }
    },
    [authorizedFetch, loadAllComments, loadMyComments, setAllComments, setMyComments]
  );

  const contextValue = useMemo(
    () => ({
      myComments,
      allComments,
      loadMyComments,
      loadAllComments,
      submitComment,
      respondComment,
      loadingMyComments,
      loadingAllComments,
      listingAvailable,
    }),
    [
      allComments,
      listingAvailable,
      loadAllComments,
      loadMyComments,
      loadingAllComments,
      loadingMyComments,
      myComments,
      respondComment,
      submitComment,
    ]
  );

  return <CommentsContext.Provider value={contextValue}>{children}</CommentsContext.Provider>;
};

