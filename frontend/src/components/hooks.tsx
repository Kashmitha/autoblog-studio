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
    return () => window.removeEventListener("blogger-status-synced", synced);
  }, [reload]);
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
