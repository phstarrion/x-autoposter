# X Autoposter

X (Twitter) への自動投稿・予約投稿ツール。AIエージェントによる投稿文生成機能付き。

## 機能

- 📝 即時投稿
- 📅 予約投稿（スケジュール機能）
- ✏️ 予約投稿の編集・削除
- 🤖 AIエージェントによる投稿文生成

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

## デプロイ

Vercel へのデプロイ:

```bash
git push origin main
```

Vercel が自動でデプロイを実行します。
