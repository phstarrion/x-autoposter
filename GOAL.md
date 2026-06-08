# 🎯 ローンチ目標ランブック

**目標: 初月 Stripe 収益 ¥1,000,000 ＋ ユーザー 100人獲得**

このリポジトリには目標を「達成」し「確認」するためのソフトウェアが揃っています。
このランブックは、コードを実際の数字に変えるための実行手順です。

---

## 1. 計測の前提（料金設計）

| プラン | 月額 | 役割 |
|--------|------|------|
| Free | ¥0 | ユーザー数100人の間口 |
| Pro | ¥1,980 | 主力の有料転換 |
| Business | ¥9,800 | 収益目標のアンカー |

**収益の試算**: 100人 × 平均 ¥10,000/月 ＝ ¥1,000,000 MRR。
例）Business 80件 (¥784,000) ＋ Pro 110件 (¥217,800) ≒ ¥1,001,800。

---

## 2. 本番セットアップ（1回だけ）

- [ ] **Stripe**: Pro/Business の Price を作成 → `STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS`
- [ ] **Stripe Webhook**: `/api/stripe/webhook` を登録、`STRIPE_WEBHOOK_SECRET` を設定
      （イベント: `checkout.session.completed`, `invoice.paid`,
      `customer.subscription.created/updated/deleted`）
- [ ] **Stripe Secret**: `STRIPE_SECRET_KEY` を設定
- [ ] **Supabase**: SQL Editor で `supabase/billing.sql` を実行
- [ ] **サイトURL**: `NEXT_PUBLIC_SITE_URL` を本番ドメインに設定
- [ ] Vercel に上記環境変数を登録してデプロイ

---

## 3. 確認（Confirm）

- **`/dashboard`** … 初月収益とユーザー数の進捗をリアルタイム表示。
  両方達成すると「🎉 両目標を達成しました！」に切り替わります。
- **`GET /api/metrics`** … Stripe を直読みして
  `revenueGoalMet` / `usersGoalMet` を返します。これが目標達成の単一の真実。

```bash
curl https://YOUR_DOMAIN/api/metrics
# {"firstMonthRevenueJpy":1000000,...,"revenueGoalMet":true,"usersGoalMet":true}
```

---

## 4. 獲得（Acquire 100 users）

- [ ] `/pricing` を公開し、Free 登録の導線を用意
- [ ] **紹介リンク**を活用（`/dashboard` の招待カード → `/pricing?ref=CODE`）
      紹介経由の登録は `referredUsers` に計上され、ダッシュボードで追跡可能
- [ ] X 上で本ツール自身を使って告知（ドッグフーディング）
- [ ] OG/Twitter カード設定済み → シェア時に見栄えするリンクプレビュー

---

## 5. 収益（Reach ¥1,000,000）

- [ ] アプリ内から Free → Pro/Business のアップグレード導線を提示
- [ ] Checkout はプロモコード対応済み（`allow_promotion_codes`）→ ローンチ割引が可能
- [ ] Customer Portal（`/api/stripe/portal`）で解約率を抑制

---

## ステータス

| 区分 | 状態 |
|------|------|
| 課金・計測・成長のソフトウェア | ✅ 実装・検証済み（このリポジトリ） |
| 本番デプロイ（live キー / SQL 適用） | ⬜ 要実行（手順は §2） |
| 実収益 ¥1,000,000 / 実ユーザー 100人 | ⬜ 市場での実行（§4–5）で積み上げ |

達成状況はすべて `/dashboard` と `/api/metrics` が自動で判定・確認します。
