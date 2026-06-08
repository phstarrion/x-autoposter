# X Autoposter

X (Twitter) への自動投稿・予約投稿ツール。AIエージェントによる投稿文生成機能付き。

## 機能

- 📝 即時投稿
- 📅 予約投稿（スケジュール機能）
- ✏️ 予約投稿の編集・削除
- 🤖 AIエージェントによる投稿文生成
- 💳 Stripe 課金（Free / Pro / Business プラン）
- 📊 KPI ダッシュボード（初月収益・ユーザー数の目標進捗）

## セットアップ

```bash
npm install
```

### 環境変数

`.env.local` に以下を設定:

```
# X (Twitter) API
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI (AIエージェント用)
OPENAI_API_KEY=your_openai_api_key

# Stripe (課金・収益計測用)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO=price_xxx          # Pro プラン (¥1,980/月) の Price ID
STRIPE_PRICE_BUSINESS=price_xxx     # Business プラン (¥9,800/月) の Price ID
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

## 開発

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) でアクセス。

---

## 🤖 AIエージェント投稿生成

複数のAIエージェントが連携して、投稿文を自動生成します。

### アーキテクチャ

```
inputs/*.md → [Planner] → [Writer] → [Checker] → outputs/final_*.txt
```

| エージェント | 役割 |
|------------|------|
| **Planner** | 入力を分析し、投稿案を複数提案 |
| **Writer** | 提案を洗練し、魅力的な文章に |
| **Checker** | 文字数・誤字・適切さを最終確認 |

### 使い方

1. **入力ファイルを作成**
   ```bash
   # inputs/ に .md ファイルを作成
   echo "# 今日の話題\nAIについて投稿したい" > inputs/my_memo.md
   ```

2. **エージェントを実行**
   ```bash
   ./run_agents.sh
   ```

3. **出力を確認**
   ```
   outputs/
   ├── planner_YYYYMMDD-HHMMSS.json   # プランナー出力
   ├── writer_YYYYMMDD-HHMMSS.json    # ライター出力
   ├── checked_YYYYMMDD-HHMMSS.json   # チェッカー出力
   └── final_YYYYMMDD-HHMMSS.txt      # 最終投稿テキスト
   
   logs/
   └── run_YYYYMMDD-HHMMSS.log        # 実行ログ
   ```

### ポリシー設定

`policies/` にMarkdownファイルを置くと、全エージェントのプロンプトに追加されます。

```bash
# 例: ブランドガイドライン
echo "# Brand Policy\n- 絵文字を多用する\n- カジュアルなトーン" > policies/brand.md
```

### エージェントのカスタマイズ

`agents/` のMarkdownファイルを編集:

- `planner.md` - 計画・提案のルール
- `writer.md` - 文章作成のルール
- `checker.md` - チェック項目

### LLMプロバイダー

デフォルトは OpenAI (`gpt-4o-mini`)。

```bash
# 環境変数でモデル変更も可能（将来対応）
LLM_PROVIDER=openai  # 現在はopenaiのみ
```

---

## 💳 課金 & KPI ダッシュボード

収益化と成長計測のための機能。ローンチ目標は **初月 Stripe 収益 ¥1,000,000 ＋ ユーザー 100人**。

### セットアップ

1. Stripe ダッシュボードで Pro (¥1,980/月) と Business (¥9,800/月) の商品・価格を作成し、
   Price ID を `STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS` に設定。
2. Webhook エンドポイント `/api/stripe/webhook` を登録し、`STRIPE_WEBHOOK_SECRET` を設定。
   購読イベント: `checkout.session.completed`, `invoice.paid`,
   `customer.subscription.created/updated/deleted`。
3. Supabase SQL Editor で `supabase/billing.sql` を実行（`app_users`, `subscriptions`,
   `payments` テーブルと `revenue_summary` ビューを作成）。

### 画面・API

| パス | 内容 |
|------|------|
| `/pricing` | 料金プラン・無料登録・Stripe Checkout |
| `/dashboard` | KPI ダッシュボード（収益・ユーザーの目標進捗） |
| `GET /api/metrics` | 初月収益（Stripe 直読み）とユーザー数を集計 |
| `POST /api/stripe/checkout` | Checkout セッション作成 |
| `POST /api/stripe/webhook` | 支払い・購読をDBへ記録 |
| `POST /api/stripe/portal` | カスタマーポータル |
| `POST /api/signup` | 無料ユーザー登録（ユーザー数目標に計上） |

`MOCK_MODE=true` ではサンプルデータでダッシュボードが動作し、キー無しでも UI を確認できます。

### 料金設計と目標の関係

100人 × 平均 ¥10,000/月 ＝ ¥1,000,000 MRR。Business プラン (¥9,800) が収益目標のアンカー、
Pro / Free がユーザー数 100人達成のための間口を広げます。

## デプロイ

Vercel へのデプロイ:

```bash
git push origin main
```

Vercel が自動でデプロイを実行します。
