"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/apiClient";

export function useApiData<T = any>(path: string, enabled: boolean = true, refetchNonce: number = 0) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    apiFetch(path)
      .then((result) => {
        if (active) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [path, enabled, refetchNonce]);

  return { data, loading, error };
}

/** POST JSON and parse response; re-runs when `body` shallow-serialization changes. */
export function useApiJsonPost<T = unknown>(path: string, body: Record<string, unknown>, enabled: boolean = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const bodyKey = JSON.stringify(body);

  useEffect(() => {
    let active = true;

    if (!enabled) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    apiFetch(path, { method: "POST", body: bodyKey })
      .then((result) => {
        if (active) {
          setData(result as T);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [path, bodyKey, enabled]);

  return { data, loading, error };
}
