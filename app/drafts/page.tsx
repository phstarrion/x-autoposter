"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getNextSlot } from "../../lib/schedule";
import { Draft } from "../../types/api";

type ApiResponse = {
    drafts?: Draft[];
    error?: string;
};

export default function DraftsPage() {
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Schedule modal state
    const [schedulingDraft, setSchedulingDraft] = useState<Draft | null>(null);
    const [schedulingText, setSchedulingText] = useState("");
    const [scheduledAt, setScheduledAt] = useState("");
    const [scheduleLoading, setScheduleLoading] = useState(false);

    const fetchDrafts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/drafts", {
                cache: "no-store",
            });
            const data: ApiResponse = await res.json();

            if (res.ok && data.drafts) {
                setDrafts(data.drafts);
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
        fetchDrafts();
    }, [fetchDrafts]);

    // Delete draft
    const handleDelete = useCallback(async (id: string) => {
        if (!confirm("この下書きを削除しますか？")) return;

        try {
            const res = await fetch("/api/drafts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });

            if (res.ok) {
                setDrafts((prev) => prev.filter((d) => d.id !== id));
            } else {
                alert("削除に失敗しました");
            }
        } catch {
            alert("削除に失敗しました");
        }
    }, []);

    // Open schedule modal
    const handleOpenScheduleModal = useCallback((draft: Draft) => {
        setSchedulingDraft(draft);
        setSchedulingText(draft.text);
        setScheduledAt(getNextSlot());
    }, []);

    // Close schedule modal
    const handleCloseScheduleModal = useCallback(() => {
        setSchedulingDraft(null);
        setSchedulingText("");
        setScheduledAt("");
    }, []);

    // Schedule draft as post
    const handleSchedule = useCallback(async () => {
        if (!schedulingDraft || !scheduledAt || !schedulingText) return;

        setScheduleLoading(true);
        try {
            // 1. Create scheduled post
            const scheduledAtISO = new Date(scheduledAt).toISOString();
            const scheduleRes = await fetch("/api/schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: schedulingText,  // Use edited text
                    scheduledAt: scheduledAtISO,
                    media: schedulingDraft.media
                }),
            });

            const scheduleData = await scheduleRes.json();
            if (!scheduleData.success) {
                throw new Error(scheduleData.error || "予約投稿に失敗しました");
            }

            // 2. Delete the draft
            await fetch("/api/drafts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: schedulingDraft.id }),
            });

            // 3. Update UI
            setDrafts((prev) => prev.filter((d) => d.id !== schedulingDraft.id));
            handleCloseScheduleModal();
            alert("予約投稿を作成しました！ホームで確認できます。");
        } catch (e) {
            const message = e instanceof Error ? e.message : "予約投稿に失敗しました";
            alert(message);
        } finally {
            setScheduleLoading(false);
        }
    }, [schedulingDraft, scheduledAt, schedulingText, handleCloseScheduleModal]);

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

    // Min datetime for input
    const minDateTime = new Date().toISOString().slice(0, 16);

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
                        {drafts.length > 0 && (
                            <span className="bg-emerald-600/50 text-emerald-100 text-xs sm:text-sm px-2 py-0.5 rounded-full">
                                {drafts.length}
                            </span>
                        )}
                    </h1>
                    <button
                        onClick={fetchDrafts}
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
                    {loading && drafts.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <div className="animate-pulse">読み込み中...</div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-red-500 mb-4">⚠️ {error}</p>
                            <button
                                onClick={fetchDrafts}
                                className="text-blue-600 hover:underline text-sm"
                            >
                                再試行
                            </button>
                        </div>
                    ) : drafts.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <p className="text-4xl mb-4">📭</p>
                            <p>まだ下書きはありません</p>
                            <p className="text-sm mt-2">
                                <code className="bg-slate-100 px-2 py-1 rounded">npm run agents</code> を実行して下書きを生成してください
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {drafts.map((draft) => (
                                <div
                                    key={draft.id}
                                    className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
                                >
                                    {/* Draft Text */}
                                    <p className="text-slate-800 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                                        {draft.text}
                                    </p>

                                    {/* Media Info */}
                                    {draft.media && draft.media.length > 0 && (
                                        <div className="flex gap-2 mt-3">
                                            {draft.media.map((m, i) => (
                                                <div key={i} className="w-32 h-32 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                                    {m.type === 'image' ? (
                                                        <img src={m.url} alt="" className="w-full h-full object-cover text-xs text-slate-400" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-slate-200 text-lg">🎥</div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Meta Info */}
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-3">
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
                                        <span className="text-slate-400 font-mono ml-auto">
                                            {formatDate(draft.created_at)}
                                        </span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(draft.text);
                                                alert("クリップボードにコピーしました");
                                            }}
                                            className="flex-1 py-2 rounded-lg font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-xs sm:text-sm"
                                        >
                                            📋 コピー
                                        </button>
                                        <button
                                            onClick={() => handleOpenScheduleModal(draft)}
                                            className="flex-1 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow transition-colors text-xs sm:text-sm"
                                        >
                                            📅 予約投稿
                                        </button>
                                        <button
                                            onClick={() => handleDelete(draft.id)}
                                            className="py-2 px-3 rounded-lg text-red-500 hover:bg-red-50 transition-colors text-xs sm:text-sm"
                                            title="削除"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Schedule Modal */}
            {schedulingDraft && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 p-4">
                            <h3 className="text-lg font-bold text-white">📅 予約投稿にする</h3>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Editable Text */}
                            <div>
                                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                    投稿内容（編集可能）
                                </label>
                                <textarea
                                    value={schedulingText}
                                    onChange={(e) => setSchedulingText(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors text-slate-700 min-h-[120px] resize-none"
                                    disabled={scheduleLoading}
                                />
                                {schedulingDraft.media && schedulingDraft.media.length > 0 && (
                                    <div className="flex gap-2 mt-3">
                                        {schedulingDraft.media.map((m, i) => (
                                            <div key={i} className="w-32 h-32 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                                {m.type === 'image' ? (
                                                    <img src={m.url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-slate-200">🎥</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Datetime Input */}
                            <div>
                                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                    予約日時
                                </label>
                                <input
                                    type="datetime-local"
                                    value={scheduledAt}
                                    min={minDateTime}
                                    onChange={(e) => setScheduledAt(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors text-slate-700"
                                    disabled={scheduleLoading}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleCloseScheduleModal}
                                    disabled={scheduleLoading}
                                    className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleSchedule}
                                    disabled={scheduleLoading || !scheduledAt}
                                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${scheduleLoading || !scheduledAt
                                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                        : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg"
                                        }`}
                                >
                                    {scheduleLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            処理中...
                                        </span>
                                    ) : (
                                        "予約する"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
