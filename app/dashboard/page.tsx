"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Metrics } from "../api/metrics/route";

function ProgressCard({
    title,
    current,
    target,
    format,
    met,
}: {
    title: string;
    current: number;
    target: number;
    format: (n: number) => string;
    met: boolean;
}) {
    const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0);
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{title}</h3>
                {met && (
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        ✓ 達成
                    </span>
                )}
            </div>
            <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold">{format(current)}</span>
                <span className="text-slate-400 text-sm">/ {format(target)}</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${
                        met ? "bg-green-500" : "bg-indigo-500"
                    }`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <p className="text-right text-xs text-slate-400 mt-1.5 font-mono">{pct.toFixed(1)}%</p>
        </div>
    );
}

function InviteCard() {
    const [code] = useState<string | null>(() => {
        if (typeof window === "undefined") return null;
        const fromUrl = new URLSearchParams(window.location.search).get("code");
        if (fromUrl) return fromUrl;
        try {
            return localStorage.getItem("referral_code");
        } catch {
            return null;
        }
    });
    const [copied, setCopied] = useState(false);

    // Persist the code so the invite link survives page reloads.
    useEffect(() => {
        if (code) {
            try {
                localStorage.setItem("referral_code", code);
            } catch {
                /* ignore */
            }
        }
    }, [code]);

    if (!code) return null;

    const link = `${window.location.origin}/pricing?ref=${code}`;
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* ignore */
        }
    };

    return (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 mb-6">
            <h3 className="font-bold text-indigo-900 mb-1">🎁 友だちを招待して100人へ</h3>
            <p className="text-sm text-indigo-700/80 mb-3">
                このリンクから登録された人は「紹介経由の登録」に計上されます。
            </p>
            <div className="flex gap-2">
                <input
                    readOnly
                    value={link}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 p-2.5 text-sm bg-white border border-indigo-200 rounded-lg font-mono text-slate-700"
                />
                <button
                    onClick={copy}
                    className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shrink-0"
                >
                    {copied ? "コピー済み" : "コピー"}
                </button>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/metrics");
            const data = await res.json();
            setMetrics(data);
        } catch {
            setError("メトリクスの取得に失敗しました");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const yen = (n: number) => `¥${n.toLocaleString()}`;
    const num = (n: number) => `${n.toLocaleString()}`;

    return (
        <main className="min-h-screen min-h-dvh px-4 py-10 bg-slate-100 text-slate-900">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <Link href="/" className="text-slate-500 hover:text-slate-800 text-sm">
                        ← ホーム
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link href="/pricing" className="text-slate-500 hover:text-slate-800 text-sm">
                            💳 料金プラン
                        </Link>
                        <button
                            onClick={load}
                            disabled={loading}
                            className="text-slate-500 hover:text-slate-800 text-sm"
                        >
                            {loading ? "⏳" : "🔄 更新"}
                        </button>
                    </div>
                </div>

                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">🎯 ローンチ目標</h1>
                    <p className="text-slate-500 mt-2">
                        初月 Stripe 収益 ¥1,000,000 ＋ ユーザー 100人 の達成状況
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
                        {error}
                    </div>
                )}

                {metrics && (
                    <>
                        <div className="grid gap-6 sm:grid-cols-2 mb-6">
                            <ProgressCard
                                title="初月収益 (Stripe)"
                                current={metrics.firstMonthRevenueJpy}
                                target={metrics.goals.firstMonthRevenueJpy}
                                format={yen}
                                met={metrics.revenueGoalMet}
                            />
                            <ProgressCard
                                title="ユーザー数"
                                current={metrics.users}
                                target={metrics.goals.users}
                                format={num}
                                met={metrics.usersGoalMet}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3 mb-6">
                            <div className="bg-white rounded-xl border border-slate-200 p-4">
                                <p className="text-xs text-slate-400 uppercase tracking-wider">累計収益</p>
                                <p className="text-xl font-bold mt-1">{yen(metrics.totalRevenueJpy)}</p>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4">
                                <p className="text-xs text-slate-400 uppercase tracking-wider">有料ユーザー</p>
                                <p className="text-xl font-bold mt-1">{num(metrics.payingUsers)}</p>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4">
                                <p className="text-xs text-slate-400 uppercase tracking-wider">紹介経由の登録</p>
                                <p className="text-xl font-bold mt-1">{num(metrics.referredUsers)}</p>
                            </div>
                        </div>

                        <InviteCard />

                        {metrics.revenueGoalMet && metrics.usersGoalMet ? (
                            <div className="bg-green-50 border border-green-200 text-green-800 rounded-2xl p-6 text-center">
                                <p className="text-2xl font-bold">🎉 両目標を達成しました！</p>
                                <p className="text-sm mt-1">初月収益 ¥1,000,000 とユーザー 100人を確認済み。</p>
                            </div>
                        ) : (
                            <div className="bg-white border border-slate-200 rounded-2xl p-6">
                                <h3 className="font-bold mb-2">次のアクション</h3>
                                <ul className="text-sm text-slate-600 space-y-1.5 list-disc list-inside">
                                    {!metrics.usersGoalMet && (
                                        <li>
                                            あと <strong>{metrics.goals.users - metrics.users}人</strong> のユーザー獲得（
                                            <Link href="/pricing" className="text-indigo-600 underline">
                                                料金プラン
                                            </Link>
                                            から無料登録を促進）
                                        </li>
                                    )}
                                    {!metrics.revenueGoalMet && (
                                        <li>
                                            あと{" "}
                                            <strong>
                                                {yen(metrics.goals.firstMonthRevenueJpy - metrics.firstMonthRevenueJpy)}
                                            </strong>{" "}
                                            の初月収益（Business プラン ¥9,800 × 約
                                            {Math.ceil(
                                                (metrics.goals.firstMonthRevenueJpy - metrics.firstMonthRevenueJpy) / 9800
                                            )}
                                            件 で達成）
                                        </li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </>
                )}

                {loading && !metrics && (
                    <div className="text-center py-12 text-slate-400">読み込み中...</div>
                )}
            </div>
        </main>
    );
}
