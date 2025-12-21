"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Draft = {
    id: string;
    text: string;
    source: string;
    meta: {
        char_count?: number;
        ready_to_post?: boolean;
        checks?: Record<string, { passed: boolean; note: string }>;
    } | null;
    created_at: string;
};

type ApiResponse = {
    draft: Draft | null;
    error?: string;
};

export default function DraftsPage() {
    const [draft, setDraft] = useState<Draft | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLatestDraft = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/drafts/latest", {
                cache: "no-store",
            });
            const data: ApiResponse = await res.json();

            if (res.ok) {
                setDraft(data.draft);
            } else {
                setError(data.error || "下書きの取得に失敗しました");
            }
        } catch {
            setError("通信エラーが発生しました");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLatestDraft();
    }, [fetchLatestDraft]);

    // Format date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString("ja-JP", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <main className="min-h-screen min-h-dvh flex flex-col items-center px-4 py-6 sm:py-8 bg-slate-100 text-slate-900">
            {/* Header */}
            <div className="w-full max-w-lg mb-4">
                <Link
                    href="/"
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                >
                    ← ホームに戻る
                </Link>
            </div>

            {/* Main Card */}
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 animate-slide-up">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 px-4 py-5 sm:p-6 flex items-center justify-between">
                    <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-2xl">📝</span>
                        <span>AIエージェント下書き</span>
                    </h1>
                    <button
                        onClick={fetchLatestDraft}
                        disabled={loading}
                        className="text-emerald-200 hover:text-white transition-colors text-sm flex items-center gap-1"
                    >
                        {loading ? (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            "🔄 更新"
                        )}
                    </button>
                </div>

                <div className="p-4 sm:p-6">
                    {loading && !draft ? (
                        <div className="text-center py-12 text-slate-400">
                            <div className="animate-pulse">読み込み中...</div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-red-500 mb-4">⚠️ {error}</p>
                            <button
                                onClick={fetchLatestDraft}
                                className="text-blue-600 hover:underline text-sm"
                            >
                                再試行
                            </button>
                        </div>
                    ) : !draft ? (
                        <div className="text-center py-12 text-slate-400">
                            <p className="text-4xl mb-4">📭</p>
                            <p>まだ下書きはありません</p>
                            <p className="text-sm mt-2">
                                <code className="bg-slate-100 px-2 py-1 rounded">npm run agents</code> を実行して下書きを生成してください
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Draft Text */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <p className="text-slate-800 whitespace-pre-wrap leading-relaxed text-base sm:text-lg">
                                    {draft.text}
                                </p>
                            </div>

                            {/* Meta Info */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
                                    {draft.source}
                                </span>
                                {draft.meta?.char_count && (
                                    <span className="bg-slate-100 px-2 py-1 rounded-full">
                                        {draft.meta.char_count}文字
                                    </span>
                                )}
                                {draft.meta?.ready_to_post !== undefined && (
                                    <span className={`px-2 py-1 rounded-full ${draft.meta.ready_to_post ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                                        {draft.meta.ready_to_post ? "✅ 投稿可" : "⚠️ 要確認"}
                                    </span>
                                )}
                            </div>

                            {/* Checks */}
                            {draft.meta?.checks && (
                                <div className="border-t border-slate-200 pt-4 mt-4">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        チェック結果
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(draft.meta.checks).map(([key, check]) => (
                                            <div
                                                key={key}
                                                className={`text-xs p-2 rounded-lg ${check.passed ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                                            >
                                                <span className="font-medium">{check.passed ? "✓" : "✗"} {key}</span>
                                                <p className="opacity-75">{check.note}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Created At */}
                            <p className="text-xs text-slate-400 text-right font-mono">
                                生成日時: {formatDate(draft.created_at)}
                            </p>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4 border-t border-slate-200">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(draft.text);
                                        alert("クリップボードにコピーしました");
                                    }}
                                    className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-sm"
                                >
                                    📋 コピー
                                </button>
                                <Link
                                    href="/"
                                    className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg text-center text-sm"
                                >
                                    ✈️ 投稿画面へ
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
