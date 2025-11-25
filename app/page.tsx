"use client";

import { useState } from "react";

type PostResult = {
  ok: boolean;
  message?: string;
};

type RecentPost = {
  text: string;
  date: string;
};

export default function Home() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PostResult | null>(null);
  const [recentPost, setRecentPost] = useState<RecentPost | null>(null);

  const MAX_CHARS = 280;
  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isEmpty = charCount === 0;

  const handlePost = async () => {
    if (isEmpty || isOverLimit) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        setResult({ ok: true });
        setRecentPost({
          text,
          date: new Date().toLocaleString("ja-JP"),
        });
        setText("");
      } else {
        setResult({ ok: false, message: data.message || "エラーが発生しました" });
      }
    } catch (error) {
      setResult({ ok: false, message: "サーバーエラーです" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 gap-6 bg-gray-50 text-gray-900">
      <h1 className="text-3xl font-bold mt-10">X 自動投稿アプリ（仮）</h1>

      <div className="w-full max-w-xl relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={`w-full p-4 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none transition-colors ${isOverLimit ? "border-red-500 bg-red-50" : "border-gray-300"
            }`}
          placeholder="いまどうしてる？"
          rows={5}
          disabled={loading}
        />
        <div
          className={`absolute bottom-3 right-4 text-sm font-medium ${isOverLimit ? "text-red-600" : "text-gray-500"
            }`}
        >
          {charCount} / {MAX_CHARS}
        </div>
      </div>

      <button
        onClick={handlePost}
        disabled={isEmpty || isOverLimit || loading}
        className={`px-8 py-3 rounded-full font-bold text-white transition-all ${isEmpty || isOverLimit || loading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-500 hover:bg-blue-600 shadow-md hover:shadow-lg"
          }`}
      >
        {loading ? "送信中..." : "投稿する"}
      </button>

      {result && (
        <div
          className={`text-lg font-medium animate-fade-in ${result.ok ? "text-green-600" : "text-red-600"
            }`}
        >
          {result.ok ? "投稿を受け取りました" : result.message}
        </div>
      )}

      {recentPost && (
        <div className="mt-8 p-6 bg-white border border-gray-200 rounded-xl shadow-sm w-full max-w-xl">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">
            直近の投稿
          </h2>
          <p className="text-gray-800 whitespace-pre-wrap mb-2">
            {recentPost.text}
          </p>
          <p className="text-xs text-gray-400 text-right">
            {recentPost.date}
          </p>
        </div>
      )}
    </main>
  );
}