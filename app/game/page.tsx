"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

const GRID_SIZE = 9; // 3x3
const GAME_DURATION = 30; // 秒
const MOLE_MIN_MS = 600;
const MOLE_MAX_MS = 1200;

type GameState = "idle" | "playing" | "over";

export default function MoleGame() {
  const [state, setState] = useState<GameState>("idle");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [activeMole, setActiveMole] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState(0);
  const [whacked, setWhacked] = useState<number | null>(null);

  const moleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popMoleRef = useRef<() => void>(() => {});
  const scoreRef = useRef(0);

  // ベストスコアの読み込み
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem("moleBestScore")
        : null;
    // マウント後に同期してハイドレーション不一致を回避
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setBestScore(parseInt(saved, 10) || 0);
  }, []);

  const clearTimers = useCallback(() => {
    if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  // モグラをランダムに出現させる
  const popMole = useCallback(() => {
    setActiveMole((prev) => {
      let next = Math.floor(Math.random() * GRID_SIZE);
      // 同じ穴の連続を避ける
      if (next === prev) next = (next + 1) % GRID_SIZE;
      return next;
    });
    const delay =
      MOLE_MIN_MS + Math.random() * (MOLE_MAX_MS - MOLE_MIN_MS);
    // 自己参照を避けるため ref 経由で次の出現を予約
    moleTimerRef.current = setTimeout(() => popMoleRef.current(), delay);
  }, []);

  // 最新の popMole を ref に保持（再帰 setTimeout の自己参照を回避）
  useEffect(() => {
    popMoleRef.current = popMole;
  }, [popMole]);

  const endGame = useCallback(() => {
    clearTimers();
    setActiveMole(null);
    setState("over");
    // ベストスコア更新（ref で最新スコアを参照）
    setBestScore((prev) => {
      if (scoreRef.current > prev) {
        window.localStorage.setItem("moleBestScore", String(scoreRef.current));
        return scoreRef.current;
      }
      return prev;
    });
  }, [clearTimers]);

  const startGame = useCallback(() => {
    clearTimers();
    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setWhacked(null);
    setState("playing");
    popMole();
    countdownRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          endGame();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [clearTimers, popMole, endGame]);

  // アンマウント時にタイマー停止
  useEffect(() => clearTimers, [clearTimers]);

  const whack = useCallback(
    (index: number) => {
      if (state !== "playing") return;
      if (index === activeMole) {
        setScore((s) => {
          const next = s + 1;
          scoreRef.current = next;
          return next;
        });
        setWhacked(index);
        setActiveMole(null);
        setTimeout(() => setWhacked(null), 150);
      }
    },
    [state, activeMole],
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-100 to-emerald-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-emerald-800">
            🔨 もぐらたたき
          </h1>
          <Link
            href="/"
            className="text-sm text-emerald-700 hover:underline"
          >
            ← ホーム
          </Link>
        </div>

        <div className="flex items-center justify-between mb-4 bg-white/70 rounded-xl px-4 py-3 shadow">
          <div className="text-center">
            <div className="text-xs text-gray-500">スコア</div>
            <div className="text-2xl font-bold text-emerald-700">{score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">のこり時間</div>
            <div
              className={`text-2xl font-bold ${
                timeLeft <= 5 ? "text-red-500" : "text-sky-700"
              }`}
            >
              {timeLeft}秒
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">ベスト</div>
            <div className="text-2xl font-bold text-amber-600">
              {bestScore}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 bg-amber-900/20 p-4 rounded-2xl">
          {Array.from({ length: GRID_SIZE }).map((_, i) => {
            const isActive = i === activeMole;
            const isWhacked = i === whacked;
            return (
              <button
                key={i}
                onClick={() => whack(i)}
                disabled={state !== "playing"}
                aria-label={`穴 ${i + 1}`}
                className="relative aspect-square rounded-full bg-amber-800 shadow-inner overflow-hidden flex items-center justify-center select-none active:scale-95 transition-transform disabled:cursor-not-allowed"
              >
                <span className="absolute bottom-0 w-full h-1/3 bg-amber-950/40 rounded-b-full" />
                <span
                  className={`text-4xl transition-all duration-150 ${
                    isActive
                      ? "translate-y-0 opacity-100"
                      : "translate-y-full opacity-0"
                  }`}
                >
                  {isWhacked ? "💥" : "🐹"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 text-center">
          {state === "idle" && (
            <button
              onClick={startGame}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg px-8 py-3 rounded-full shadow-lg transition-colors"
            >
              スタート ▶
            </button>
          )}
          {state === "playing" && (
            <p className="text-emerald-800 font-medium animate-pulse">
              モグラをタップして叩こう！
            </p>
          )}
          {state === "over" && (
            <div className="space-y-3">
              <p className="text-xl font-bold text-emerald-800">
                ゲーム終了！スコア: {score}
                {score > 0 && score >= bestScore && " 🎉 自己ベスト!"}
              </p>
              <button
                onClick={startGame}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg px-8 py-3 rounded-full shadow-lg transition-colors"
              >
                もう一度 ↻
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
