"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Notify } from "./studio";
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setError("");
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);
  useEffect(() => {
    const synced = () => {
      void reload();
    };
    window.addEventListener("blogger-status-synced", synced);
    window.addEventListener("reporting-config-changed", synced);
    if (path.startsWith("/seo/"))
      window.addEventListener("indexing-status-synced", synced);
    if (
      path.startsWith("/traffic/articles") ||
      path.startsWith("/reports/search-console") ||
      path.startsWith("/dashboard")
    )
      window.addEventListener("traffic-records-changed", synced);
    return () => {
      window.removeEventListener("blogger-status-synced", synced);
      window.removeEventListener("reporting-config-changed", synced);
      if (path.startsWith("/seo/"))
        window.removeEventListener("indexing-status-synced", synced);
      if (
        path.startsWith("/traffic/articles") ||
        path.startsWith("/reports/search-console") ||
        path.startsWith("/dashboard")
      )
        window.removeEventListener("traffic-records-changed", synced);
    };
  }, [reload, path]);
  return { data, setData, error, loading, reload };
}
export function useAction(notify: Notify) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    try {
      await fn();
      if (message) notify(message);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}
