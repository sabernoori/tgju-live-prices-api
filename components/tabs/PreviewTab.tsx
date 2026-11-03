"use client";

import { useState, useEffect, useRef } from "react";
import { PriceTable } from "@/components/PriceTable";
import { Toggle } from "@/components/Toggle";
import { CachedPrice } from "@/lib/cache";

interface PreviewTabProps {
  apiBase: string;
}

interface PricesResponse {
  success: boolean;
  updatedAt: string;
  cachedAt: string;
  ttlSeconds: number;
  staleCount: number;
  errorCount: number;
  demoMode?: boolean;
  data: Record<string, CachedPrice>;
}

interface PreviewTabProps2 extends PreviewTabProps {
  adminKey?: string;
}

export function PreviewTab({ apiBase, adminKey = "" }: PreviewTabProps2) {
  const [prices, setPrices] = useState<PricesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sseError, setSseError] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchPrices = async (force = false) => {
    setLoading(true);
    try {
      // Force JSON — avoid browser redirecting to HTML
      const url = force
        ? `${apiBase}/api/prices?json=1&force=1`
        : `${apiBase}/api/prices?json=1`;
      const res = await fetch(url, { cache: "no-store" });
      const json: PricesResponse = await res.json();
      setPrices(json);
      setLastUpdate(new Date());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE auto-refresh
  useEffect(() => {
    if (!autoRefresh) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSseError(false);
      return;
    }

    const es = new EventSource(`${apiBase}/api/stream`);
    eventSourceRef.current = es;
    setSseError(false);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "prices") {
          setPrices(data);
          setLastUpdate(new Date());
          setLoading(false);
        }
      } catch {
        /* ignore */
      }
    };

    es.onerror = () => {
      setSseError(true);
    };

    return () => {
      es.close();
    };
  }, [autoRefresh, apiBase]);

  const clearCache = async () => {
    setClearingCache(true);
    try {
      await fetch(`${apiBase}/api/cache`, {
        method: "DELETE",
        headers: { "X-Admin-Key": adminKey },
      });
      // Force a fresh fetch bypassing any remaining cache
      await fetchPrices(true);
    } catch { /* ignore */ } finally {
      setClearingCache(false);
    }
  };

  const staleCount = prices?.staleCount ?? 0;
  const errorCount = prices?.errorCount ?? 0;
  const totalCount = Object.keys(prices?.data ?? {}).length;

  return (
    <div className="space-y-4" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            پیش‌نمایش قیمت‌ها
          </h2>
          {lastUpdate ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              آخرین بروزرسانی: {lastUpdate.toLocaleTimeString("fa-IR")}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">در حال دریافت...</p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Stats badges */}
          {prices && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                {totalCount} نماد
              </span>
              {staleCount > 0 && (
                <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                  {staleCount} قدیمی
                </span>
              )}
              {errorCount > 0 && (
                <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                  {errorCount} خطا
                </span>
              )}
            </div>
          )}

          {/* SSE Toggle */}
          <div className="flex items-center gap-2">
            <Toggle
              checked={autoRefresh}
              onChange={setAutoRefresh}
              color="green"
              size="sm"
            />
            <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
              {autoRefresh
                ? sseError
                  ? "⚠️ SSE خطا"
                  : "SSE فعال"
                : "SSE غیرفعال"}
            </span>
          </div>

          {/* Clear cache */}
          <button
            onClick={clearCache}
            disabled={clearingCache || loading}
            title="حذف کش قیمت‌ها و دریافت مجدد"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
          >
            {clearingCache ? (
              <span className="animate-spin inline-block w-3 h-3 border border-red-400 border-t-transparent rounded-full" />
            ) : (
              <span>🗑️</span>
            )}
            پاک کردن Cache
          </button>

          {/* Manual refresh */}
          <button
            onClick={() => fetchPrices()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
            ) : (
              <span>🔄</span>
            )}
            رفرش
          </button>
        </div>
      </div>

      {/* ── Demo mode notice ── */}
      {prices?.demoMode && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400">
          <span>🧪</span>
          <span>
            <strong>حالت Demo فعال است</strong> — داده‌ها ساختگی هستند.
            برای دریافت قیمت واقعی، <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">DEMO_MODE=false</code> کنید و سرور را ری‌استارت کنید.
          </span>
        </div>
      )}

      {/* ── Error hint (when all error) ── */}
      {prices && errorCount > 0 && errorCount === totalCount && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-400">
          <span className="text-base shrink-0">⚠️</span>
          <div>
            <div className="font-medium">دریافت قیمت از tgju.org با مشکل مواجه شد</div>
            <div className="text-xs mt-1 opacity-80">
              لاگ‌های تب «وضعیت» را بررسی کنید.{" "}
              <a
                href={`${apiBase}/api/debug/geram18`}
                target="_blank"
                className="underline"
              >
                پاسخ خام API
              </a>{" "}
              را نیز می‌توانید ببینید.
            </div>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <PriceTable data={prices?.data ?? {}} loading={loading && !prices} />
      </div>
    </div>
  );
}
