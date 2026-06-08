"use client";

import { useState } from "react";
import Link from "next/link";
import { PLANS, PlanId } from "../../lib/stripe";

export default function PricingPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState<PlanId | null>(null);
    const [error, setError] = useState<string | null>(null);

    const plans = [PLANS.free, PLANS.pro, PLANS.business];

    const handleSubscribe = async (plan: PlanId) => {
        setError(null);

        if (plan === "free") {
            if (!email) {
                setError("メールアドレスを入力してください");
                return;
            }
            setLoading("free");
            try {
                const res = await fetch("/api/signup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });
                const data = await res.json();
                if (data.success) {
                    window.location.href = "/dashboard?signup=success";
                } else {
                    setError(data.error || "登録に失敗しました");
                }
            } catch {
                setError("登録に失敗しました");
            } finally {
                setLoading(null);
            }
            return;
        }

        setLoading(plan);
        try {
            const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan, email: email || undefined }),
            });
            const data = await res.json();
            if (data.success && data.url) {
                window.location.href = data.url;
            } else {
                setError(data.error || "チェックアウトの開始に失敗しました");
            }
        } catch {
            setError("チェックアウトの開始に失敗しました");
        } finally {
            setLoading(null);
        }
    };

    return (
        <main className="min-h-screen min-h-dvh px-4 py-10 bg-slate-100 text-slate-900">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <Link href="/" className="text-slate-500 hover:text-slate-800 text-sm">
                        ← ホーム
                    </Link>
                    <Link href="/dashboard" className="text-slate-500 hover:text-slate-800 text-sm">
                        📊 ダッシュボード
                    </Link>
                </div>

                <div className="text-center mb-10">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">料金プラン</h1>
                    <p className="text-slate-500 mt-3">
                        X Autoposter で投稿を自動化。いつでもアップグレード・解約できます。
                    </p>
                </div>

                <div className="max-w-md mx-auto mb-8">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="メールアドレス"
                        className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    {plans.map((plan) => (
                        <div
                            key={plan.id}
                            className={`bg-white rounded-2xl border p-6 flex flex-col shadow-sm ${
                                plan.highlighted
                                    ? "border-indigo-500 ring-2 ring-indigo-500/20 relative"
                                    : "border-slate-200"
                            }`}
                        >
                            {plan.highlighted && (
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                                    人気
                                </span>
                            )}
                            <h2 className="text-lg font-bold">{plan.name}</h2>
                            <div className="mt-3 mb-4">
                                <span className="text-3xl font-bold">¥{plan.priceJpy.toLocaleString()}</span>
                                <span className="text-slate-400 text-sm"> / 月</span>
                            </div>
                            <ul className="space-y-2 flex-1 mb-6">
                                {plan.features.map((f) => (
                                    <li key={f} className="text-sm text-slate-600 flex items-start gap-2">
                                        <span className="text-green-500">✓</span>
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={() => handleSubscribe(plan.id)}
                                disabled={loading !== null}
                                className={`w-full py-3 rounded-xl font-bold transition-all disabled:opacity-60 ${
                                    plan.highlighted
                                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                        : plan.id === "free"
                                          ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                          : "bg-blue-600 text-white hover:bg-blue-700"
                                }`}
                            >
                                {loading === plan.id
                                    ? "処理中..."
                                    : plan.id === "free"
                                      ? "無料で始める"
                                      : "登録する"}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
