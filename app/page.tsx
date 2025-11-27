"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { PostResponse } from "../types/api";

type RecentPost = {
  text: string;
  date: string;
  type: "posted" | "scheduled";
};

export default function Home() {
  const [text, setText] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PostResponse | null>(null);
  const [recentPost, setRecentPost] = useState<RecentPost | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_CHARS = 280;
  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isEmpty = charCount === 0;
  const isNearLimit = charCount > MAX_CHARS * 0.9;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [text]);

  // Auto-dismiss success message
  useEffect(() => {
    if (result?.success) {
      const timer = setTimeout(() => {
        setResult(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const handlePost = useCallback(async () => {
    if (isEmpty || isOverLimit || loading) return;

    setLoading(true);
    setResult(null);

    const isScheduling = !!scheduledAt;
    const endpoint = isScheduling ? "/api/schedule" : "/api/post";
    const body = isScheduling ? { text, scheduledAt } : { text };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data: PostResponse = await res.json();

      if (data.success) {
        setResult(data);
        setRecentPost({
          text,
          date: isScheduling
            ? new Date(scheduledAt).toLocaleString("ja-JP")
            : new Date().toLocaleString("ja-JP"),
          type: isScheduling ? "scheduled" : "posted",
        });
        setText("");
        setScheduledAt("");
      } else {
        setResult(data);
      }
    } catch (error) {
      setResult({ success: false, error: "サーバーエラーです" });
    } finally {
      setLoading(false);
    }
  }, [text, scheduledAt, isEmpty, isOverLimit, loading]);

  // Calculate min datetime for input (now)
  const minDateTime = new Date().toISOString().slice(0, 16);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-slate-100 text-slate-900 font-sans">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 p-6 text-center">
          <h1 className="text-xl font-bold text-white tracking-wide">
            X Autoposter <span className="text-slate-400 text-sm font-normal">v0.2</span>
          </h1>
        </div>

        <div className="p-8 space-y-6">
          {/* Input Area */}
          <div className="relative group">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={`w-full p-4 text-lg bg-slate-50 border-2 rounded-xl focus:outline-none focus:ring-0 transition-all duration-200 resize-none min-h-[120px] ${isOverLimit
                ? "border-red-400 focus:border-red-500 bg-red-50"
                : "border-slate-200 focus:border-blue-500 focus:bg-white"
                }`}
              placeholder="いまどうしてる？"
              disabled={loading}
            />

            {/* Character Counter & Progress */}
            <div className="absolute bottom-4 right-4 flex items-center gap-3 pointer-events-none">
              <div className={`text-sm font-bold transition-colors ${isOverLimit ? "text-red-500" : isNearLimit ? "text-yellow-500" : "text-slate-400"
                }`}>
                {charCount} <span className="text-slate-300 font-normal">/ {MAX_CHARS}</span>
              </div>

              {/* Simple Circular Progress (CSS conic-gradient) */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: `conic-gradient(${isOverLimit ? '#ef4444' : isNearLimit ? '#eab308' : '#3b82f6'
                    } ${(Math.min(charCount, MAX_CHARS) / MAX_CHARS) * 360}deg, #e2e8f0 0deg)`
                }}
              >
                <div className="w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
          </div>

          {/* Scheduling Input */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Schedule (Optional)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              min={minDateTime}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-slate-700"
              disabled={loading}
            />
          </div>

          {/* Action Button */}
          <button
            onClick={handlePost}
            disabled={isEmpty || isOverLimit || loading}
            className={`w-full py-4 rounded-xl font-bold text-lg tracking-wide transition-all transform active:scale-[0.98] ${isEmpty || isOverLimit || loading
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : scheduledAt
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30"
              }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              scheduledAt ? "Schedule Post" : "Post Tweet"
            )}
          </button>

          {/* Feedback Messages */}
          {result && (
            <div
              className={`p-4 rounded-lg flex items-start gap-3 animate-fade-in ${result.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
                }`}
            >
              <div className="text-xl">
                {result.success ? "✅" : "⚠️"}
              </div>
              <div>
                <p className="font-bold">{result.success ? "Success" : "Error"}</p>
                <p className="text-sm opacity-90">
                  {result.success
                    ? (recentPost?.type === "scheduled" ? "投稿を予約しました" : "投稿を受け取りました")
                    : result.error}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Recent Post Footer */}
        {recentPost && (
          <div className="bg-slate-50 p-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {recentPost.type === "scheduled" ? "Recently Scheduled" : "Recent Post"}
              </h2>
              {recentPost.type === "scheduled" && (
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full font-bold">
                  Scheduled
                </span>
              )}
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                {recentPost.text}
              </p>
              <p className="text-xs text-slate-400 text-right mt-2 font-mono">
                {recentPost.date}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}