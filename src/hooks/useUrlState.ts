import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export type UrlParamValue = string | null | undefined;

export type UrlStateController = {
  page: string;
  params: URLSearchParams;
  getParam: (key: string) => string | null;
  mapToPage: (
    page: string,
    applyState: () => void,
    updates?: Record<string, UrlParamValue>,
    options?: { replace?: boolean }
  ) => void;
  setPage: (page: string, updates?: Record<string, UrlParamValue>, options?: { replace?: boolean }) => void;
  updateParams: (updates: Record<string, UrlParamValue>, options?: { replace?: boolean }) => void;
};

type UseUrlSyncOptions = {
  defaultPage?: string;
  currentPage: string;
  stateParams?: Record<string, UrlParamValue>;
  stateSignature?: string;
  onUrlStateChange: (page: string, params: URLSearchParams) => void;
};

function normalizePage(page: string | null | undefined, fallback: string) {
  return (page || fallback).trim().toLowerCase();
}

function serializeState(page: string, params: Record<string, UrlParamValue>) {
  const normalizedEntries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right));

  return JSON.stringify([page, normalizedEntries]);
}

export function useUrlSync({
  defaultPage = 'home',
  currentPage,
  stateParams = {},
  stateSignature,
  onUrlStateChange
}: UseUrlSyncOptions): UrlStateController {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = normalizePage(searchParams.get('page'), defaultPage);
  const paramsSignature = searchParams.toString();

  const skipStateSyncRef = useRef(false);
  const lastSyncedPage = useRef<string | null>(null);
  const processingUrlRef = useRef(false);
  const releaseTimerRef = useRef<number | null>(null);
  const stateParamsRef = useRef(stateParams);
  const stateSignatureRef = useRef(stateSignature || serializeState(normalizePage(currentPage, defaultPage), stateParams));
  const urlChangeHandlerRef = useRef(onUrlStateChange);
  const lastSyncedStateSignatureRef = useRef<string | null>(null);

  stateParamsRef.current = stateParams;
  stateSignatureRef.current = stateSignature || serializeState(normalizePage(currentPage, defaultPage), stateParams);
  urlChangeHandlerRef.current = onUrlStateChange;

  const scheduleUnlock = useCallback(() => {
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
    }

    releaseTimerRef.current = window.setTimeout(() => {
      skipStateSyncRef.current = false;
      processingUrlRef.current = false;
      releaseTimerRef.current = null;
    }, 50);
  }, []);

  const applyUpdates = useCallback((base: URLSearchParams, updates: Record<string, UrlParamValue>) => {
    const nextParams = new URLSearchParams(base);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    });

    return nextParams;
  }, []);

  const commitParams = useCallback((
    nextPage: string,
    updates?: Record<string, UrlParamValue>,
    options?: { replace?: boolean }
  ) => {
    setSearchParams(prev => {
      const nextParams = applyUpdates(prev, {
        ...stateParamsRef.current,
        ...updates,
        page: normalizePage(nextPage, defaultPage)
      });

      return nextParams.toString() === prev.toString() ? prev : nextParams;
    }, { replace: options?.replace ?? false });
  }, [applyUpdates, defaultPage, setSearchParams]);

  const updateParams = useCallback((updates: Record<string, UrlParamValue>, options?: { replace?: boolean }) => {
    setSearchParams(prev => {
      const nextParams = applyUpdates(prev, updates);
      return nextParams.toString() === prev.toString() ? prev : nextParams;
    }, { replace: options?.replace ?? false });
  }, [applyUpdates, setSearchParams]);

  const setPage = useCallback((nextPage: string, updates?: Record<string, UrlParamValue>, options?: { replace?: boolean }) => {
    commitParams(nextPage, updates, options);
    lastSyncedPage.current = normalizePage(nextPage, defaultPage);
    lastSyncedStateSignatureRef.current = serializeState(
      normalizePage(nextPage, defaultPage),
      { ...stateParamsRef.current, ...updates }
    );
  }, [commitParams, defaultPage]);

  const mapToPage = useCallback((
    nextPage: string,
    applyState: () => void,
    updates?: Record<string, UrlParamValue>,
    options?: { replace?: boolean }
  ) => {
    const normalizedNextPage = normalizePage(nextPage, defaultPage);

    skipStateSyncRef.current = true;
    applyState();
    commitParams(normalizedNextPage, updates, options);
    lastSyncedPage.current = normalizedNextPage;
    lastSyncedStateSignatureRef.current = serializeState(
      normalizedNextPage,
      { ...stateParamsRef.current, ...updates }
    );
    scheduleUnlock();
  }, [commitParams, defaultPage, scheduleUnlock]);

  useEffect(() => {
    if (!searchParams.get('page')) {
      setSearchParams(prev => {
        const nextParams = new URLSearchParams(prev);
        nextParams.set('page', defaultPage);
        return nextParams;
      }, { replace: true });
    }
  }, [defaultPage, searchParams, setSearchParams]);

  useEffect(() => {
    if (processingUrlRef.current) return;

    const nextPage = normalizePage(searchParams.get('page'), defaultPage);
    const nextSignature = paramsSignature;

    if (lastSyncedPage.current === nextPage && lastSyncedStateSignatureRef.current === nextSignature) {
      return;
    }

    processingUrlRef.current = true;
    skipStateSyncRef.current = true;
    urlChangeHandlerRef.current(nextPage, searchParams);
    lastSyncedPage.current = nextPage;
    lastSyncedStateSignatureRef.current = nextSignature;
    scheduleUnlock();
  }, [defaultPage, paramsSignature, page, scheduleUnlock, searchParams]);

  useEffect(() => {
    if (skipStateSyncRef.current) return;

    const normalizedCurrentPage = normalizePage(currentPage, defaultPage);
    const currentStateSignature = stateSignatureRef.current;

    if (
      normalizedCurrentPage === lastSyncedPage.current &&
      currentStateSignature === lastSyncedStateSignatureRef.current
    ) {
      return;
    }

    commitParams(normalizedCurrentPage, stateParamsRef.current, {
      replace: normalizedCurrentPage === lastSyncedPage.current
    });
    lastSyncedPage.current = normalizedCurrentPage;
    lastSyncedStateSignatureRef.current = currentStateSignature;
  }, [commitParams, currentPage, defaultPage, stateSignature]);

  useEffect(() => () => {
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
    }
  }, []);

  return {
    page,
    params: searchParams,
    getParam: (key: string) => searchParams.get(key),
    mapToPage,
    setPage,
    updateParams
  };
}

export const useUrlState = useUrlSync;
