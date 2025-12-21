"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PostResponse, ScheduledPost } from "../types/api";
import { getNextSlot } from "../lib/schedule";

type RecentPost = {
  text: string;
  date: string;
  type: "posted" | "scheduled";
};

// Sortable item component for D&D
function SortablePostItem({
  post,
  onEdit,
  onDelete,
  formatDate,
  getStatusBadge,
  getStatusLabel,
}: {
  post: ScheduledPost;
  onEdit: (post: ScheduledPost) => void;
  onDelete: (id: number) => void;
  formatDate: (date: string) => string;
  getStatusBadge: (status: ScheduledPost["status"]) => string;
  getStatusLabel: (status: ScheduledPost["status"]) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: post.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-slate-50 p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        {post.status === "pending" && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 shrink-0 touch-none"
            title="ドラッグで並び替え"
          >
            ⋮⋮
          </button>
        )}
        <p className="text-slate-700 text-sm flex-1 whitespace-pre-wrap">
          {post.text}
        </p>
        {post.status === "pending" && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onEdit(post)}
              className="text-blue-400 hover:text-blue-600 transition-colors text-xs"
              title="編集"
            >
              ✏️
            </button>
            <button
              onClick={() => onDelete(post.id)}
              className="text-red-400 hover:text-red-600 transition-colors text-xs"
              title="削除"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200">
        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getStatusBadge(post.status)}`}>
          {getStatusLabel(post.status)}
        </span>
        <span className="text-xs text-slate-400 font-mono">
          {formatDate(post.scheduled_at)}
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const [text, setText] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => getNextSlot());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PostResponse | null>(null);
  const [recentPost, setRecentPost] = useState<RecentPost | null>(null);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_CHARS = 280;
  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isEmpty = charCount === 0;
  const isNearLimit = charCount > MAX_CHARS * 0.9;

  // Edit modal state
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  const [editText, setEditText] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // D&D sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch scheduled posts
  const fetchScheduledPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const res = await fetch("/api/scheduled-posts");
      const data = await res.json();
      if (data.success) {
        setScheduledPosts(data.posts);
      }
    } catch (error) {
      console.error("Failed to fetch scheduled posts:", error);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  // Load scheduled posts on mount
  useEffect(() => {
    fetchScheduledPosts();
  }, [fetchScheduledPosts]);

  // Handle D&D reorder
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = scheduledPosts.findIndex((p) => p.id === active.id);
    const newIndex = scheduledPosts.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic update
    const newPosts = arrayMove(scheduledPosts, oldIndex, newIndex);
    setScheduledPosts(newPosts);

    // Calculate new sort_order values (1000 increment)
    const items = newPosts.map((post, index) => ({
      id: post.id,
      sort_order: (index + 1) * 1000,
    }));

    // Save to API
    try {
      const res = await fetch("/api/scheduled-posts/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const data = await res.json();
      if (!data.ok) {
        console.error("Reorder failed:", data.error);
        // Revert on failure
        fetchScheduledPosts();
      }
    } catch (error) {
      console.error("Reorder error:", error);
      fetchScheduledPosts();
    }
  }, [scheduledPosts, fetchScheduledPosts]);

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
    // Convert local datetime to ISO string before sending
    const scheduledAtISO = isScheduling ? new Date(scheduledAt).toISOString() : null;
    const body = isScheduling ? { text, scheduledAt: scheduledAtISO } : { text };

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
        // Refresh the scheduled posts list
        if (isScheduling) {
          fetchScheduledPosts();
        }
      } else {
        setResult(data);
      }
    } catch (error) {
      setResult({ success: false, error: "サーバーエラーです" });
    } finally {
      setLoading(false);
    }
  }, [text, scheduledAt, isEmpty, isOverLimit, loading, fetchScheduledPosts]);

  const handleDeleteScheduledPost = useCallback(async (id: number) => {
    if (!confirm("この予約投稿を削除しますか？")) return;

    try {
      const res = await fetch("/api/scheduled-posts", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (data.success) {
        setScheduledPosts((prev) => prev.filter((post) => post.id !== id));
      } else {
        alert("削除に失敗しました");
      }
    } catch (error) {
      alert("削除に失敗しました");
    }
  }, []);

  // Start editing a scheduled post
  const handleStartEditing = useCallback((post: ScheduledPost) => {
    setEditingPost(post);
    setEditText(post.text);
    // Convert ISO string to local datetime format for input
    const date = new Date(post.scheduled_at);
    const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setEditScheduledAt(localDateTime);
  }, []);

  // Cancel editing
  const handleCancelEditing = useCallback(() => {
    setEditingPost(null);
    setEditText("");
    setEditScheduledAt("");
  }, []);

  // Save edited post
  const handleSaveEdit = useCallback(async () => {
    if (!editingPost) return;
    if (!editText.trim()) {
      alert("テキストを入力してください");
      return;
    }
    if (editText.length > MAX_CHARS) {
      alert("テキストは280文字以内にしてください");
      return;
    }
    if (!editScheduledAt) {
      alert("予約日時を選択してください");
      return;
    }

    setEditLoading(true);
    try {
      const scheduledAtISO = new Date(editScheduledAt).toISOString();
      const res = await fetch("/api/scheduled-posts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingPost.id,
          text: editText,
          scheduledAt: scheduledAtISO,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setScheduledPosts((prev) =>
          prev.map((post) =>
            post.id === editingPost.id
              ? { ...post, text: editText, scheduled_at: scheduledAtISO }
              : post
          )
        );
        handleCancelEditing();
      } else {
        alert(data.error || "更新に失敗しました");
      }
    } catch (error) {
      alert("更新に失敗しました");
    } finally {
      setEditLoading(false);
    }
  }, [editingPost, editText, editScheduledAt, handleCancelEditing]);

  // Format date for display
  const formatScheduledDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get status badge color
  const getStatusBadge = (status: ScheduledPost["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "sent":
        return "bg-green-100 text-green-800 border-green-200";
      case "failed":
        return "bg-red-100 text-red-800 border-red-200";
    }
  };

  // Get status label
  const getStatusLabel = (status: ScheduledPost["status"]) => {
    switch (status) {
      case "pending":
        return "予約中";
      case "sent":
        return "投稿済み";
      case "failed":
        return "失敗";
    }
  };

  // Calculate min datetime for input (now)
  const minDateTime = new Date().toISOString().slice(0, 16);

  // Filter pending posts
  const pendingPosts = scheduledPosts.filter((p) => p.status === "pending");

  return (
    <main className="min-h-screen min-h-dvh flex flex-col items-center px-4 py-6 sm:py-8 bg-slate-100 text-slate-900">
      {/* Main Card */}
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span className="text-2xl">𝕏</span>
              <span>Autoposter</span>
              <span className="text-slate-400 text-xs sm:text-sm font-normal ml-1">v0.4</span>
            </h1>
            <Link
              href="/drafts"
              className="text-slate-300 hover:text-white text-sm flex items-center gap-1 transition-colors"
            >
              📝 下書き
            </Link>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          {/* Input Area */}
          <div className="relative group">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={`w-full p-3 sm:p-4 text-base sm:text-lg bg-slate-50 border-2 rounded-xl focus:outline-none focus:ring-0 transition-all duration-200 resize-none min-h-[100px] sm:min-h-[120px] ${isOverLimit
                ? "border-red-400 focus:border-red-500 bg-red-50"
                : "border-slate-200 focus:border-blue-500 focus:bg-white"
                }`}
              placeholder="いまどうしてる？"
              disabled={loading}
            />

            {/* Character Counter & Progress */}
            <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 flex items-center gap-2 sm:gap-3 pointer-events-none">
              <div className={`text-xs sm:text-sm font-bold transition-colors ${isOverLimit ? "text-red-500" : isNearLimit ? "text-yellow-500" : "text-slate-400"
                }`}>
                {charCount}<span className="text-slate-300 font-normal">/{MAX_CHARS}</span>
              </div>

              {/* Simple Circular Progress (CSS conic-gradient) */}
              <div
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: `conic-gradient(${isOverLimit ? '#ef4444' : isNearLimit ? '#eab308' : '#3b82f6'
                    } ${(Math.min(charCount, MAX_CHARS) / MAX_CHARS) * 360}deg, #e2e8f0 0deg)`
                }}
              >
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full" />
              </div>
            </div>
          </div>

          {/* Scheduling Input */}
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <label className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">
              予約投稿（オプション）
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
            className={`w-full py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg tracking-wide transition-all transform active:scale-[0.98] ${isEmpty || isOverLimit || loading
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : scheduledAt
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-indigo-500/30"
                : "bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 shadow-lg hover:shadow-blue-500/30"
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
              scheduledAt ? "📅 予約する" : "✈️ 投稿する"
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
          <div className="bg-slate-50 p-4 sm:p-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {recentPost.type === "scheduled" ? "最後の予約" : "最後の投稿"}
              </h2>
              {recentPost.type === "scheduled" && (
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 sm:py-1 rounded-full font-bold">
                  予約済み
                </span>
              )}
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-lg border border-slate-200 shadow-sm">
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

      {/* Scheduled Posts List */}
      <div className="w-full max-w-lg mt-4 sm:mt-6 bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 animate-slide-up">
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 px-4 py-3 sm:p-4 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5 sm:gap-2">
            <span>📅</span>
            <span>予約投稿一覧</span>
            {pendingPosts.length > 0 && (
              <span className="bg-indigo-700/50 text-indigo-100 text-xs sm:text-sm px-2 py-0.5 rounded-full">
                {pendingPosts.length}
              </span>
            )}
          </h2>
          <button
            onClick={fetchScheduledPosts}
            disabled={loadingPosts}
            className="text-indigo-200 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            {loadingPosts ? (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              "🔄 更新"
            )}
          </button>
        </div>

        <div className="p-4">
          {loadingPosts && scheduledPosts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>読み込み中...</p>
            </div>
          ) : scheduledPosts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>予約投稿はありません</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={scheduledPosts.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {scheduledPosts.map((post) => (
                    <SortablePostItem
                      key={post.id}
                      post={post}
                      onEdit={handleStartEditing}
                      onDelete={handleDeleteScheduledPost}
                      formatDate={formatScheduledDate}
                      getStatusBadge={getStatusBadge}
                      getStatusLabel={getStatusLabel}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-indigo-900 p-4">
              <h3 className="text-lg font-bold text-white">📝 予約投稿を編集</h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Edit Text */}
              <div>
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  テキスト
                </label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className={`w-full p-4 text-lg bg-slate-50 border-2 rounded-xl focus:outline-none focus:ring-0 transition-all duration-200 resize-none min-h-[120px] ${editText.length > MAX_CHARS
                    ? "border-red-400 focus:border-red-500 bg-red-50"
                    : "border-slate-200 focus:border-blue-500 focus:bg-white"
                    }`}
                  placeholder="いまどうしてる？"
                  disabled={editLoading}
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-sm font-bold ${editText.length > MAX_CHARS ? "text-red-500" : "text-slate-400"
                    }`}>
                    {editText.length} / {MAX_CHARS}
                  </span>
                </div>
              </div>

              {/* Edit Scheduled Time */}
              <div>
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  予約日時
                </label>
                <input
                  type="datetime-local"
                  value={editScheduledAt}
                  min={minDateTime}
                  onChange={(e) => setEditScheduledAt(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-slate-700"
                  disabled={editLoading}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCancelEditing}
                  disabled={editLoading}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editLoading || !editText.trim() || editText.length > MAX_CHARS || !editScheduledAt}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${editLoading || !editText.trim() || editText.length > MAX_CHARS || !editScheduledAt
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg"
                    }`}
                >
                  {editLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      保存中...
                    </span>
                  ) : (
                    "保存"
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