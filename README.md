# ジャーナル手帳（デジタル版）

アチーブメント手帳のジャーナリングをデジタル化したアプリです。カレンダーの日付をクリックすると、その日の記入画面が開きます。毎朝、Outlook（Microsoft 365）の当日の予定が時間軸に自動で入った状態でジャーナリングを始められます。PC・スマホ両対応（PWA でホーム画面に追加可能）。

## 主な機能（Phase 1）

- 月カレンダー → 日付クリックで1日ページへ。記入済みの日にはドット表示。
- 1日ページ（手帳の見開きをデジタル化）
  - 今日の最重点目標
  - 記入欄（各行に達成度 △○◎ トグル）
  - MEMO
  - 時間軸 5:00〜24:00（Outlook予定を自動＋手動取り込み／「結果」欄／手動予定追加）
- 入力は自動保存（ノートに書く感覚。保存ボタン不要）
- 前日・翌日へめくる／今日へジャンプ
- PWA（スマホのホーム画面に追加、簡易オフライン）

> 健康管理（食事）・お金の管理・名言ローテーション・検索などは Phase 2 で追加予定。

---

## ローカルで動かす（デモモード）

環境変数が未設定なら自動で「デモモード」で動きます（ログイン不要／データは `./.data/journal.json` に保存／Outlookはサンプル予定）。

```bash
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開く。

---

## 本番構成（Vercel Postgres + Microsoft 365）

デモモードを卒業して本番運用するには、以下の2つを用意し、環境変数を設定します。

### 1. Microsoft Entra ID（Azure AD）アプリ登録

会社（山岸製作所）のテナントで行います。

1. [Microsoft Entra 管理センター](https://entra.microsoft.com) →「アプリの登録」→「新規登録」
2. リダイレクト URI（Web）を登録:
   - 本番: `https://<アプリ名>.vercel.app/api/auth/callback/microsoft-entra-id`
   - 開発: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
3. 「API のアクセス許可」→ Microsoft Graph →「委任」→ **`Calendars.Read`** を追加（必要なら管理者の同意を付与）
4. 「証明書とシークレット」→ クライアントシークレットを作成し、値を控える
5. 以下を控える: アプリケーション(クライアント)ID / ディレクトリ(テナント)ID / クライアントシークレット

### 2. Vercel Postgres（Neon）

Vercel のプロジェクト →「Storage」→ Postgres を作成すると `DATABASE_URL` が発行されます。

初回のみ、テーブルを作成します（`DATABASE_URL` を設定した状態で）:

```bash
npm run db:push
```

### 3. 環境変数

`.env.example` を参考に、Vercel（および必要ならローカルの `.env.local`）へ設定します。

| 変数 | 内容 |
|---|---|
| `DATABASE_URL` | Vercel Postgres の接続文字列 |
| `AZURE_AD_CLIENT_ID` | アプリ(クライアント)ID |
| `AZURE_AD_CLIENT_SECRET` | クライアントシークレット |
| `AZURE_AD_TENANT_ID` | テナントID |
| `AUTH_SECRET` | セッション暗号化キー（`npx auth secret` で生成） |
| `ALLOWED_EMAILS` | ログインを許可するメール（カンマ区切り。自分だけにする） |

> `AZURE_AD_CLIENT_ID` を設定した時点でデモモードは解除され、Microsoft ログインが必要になります。

### 4. デプロイ

GitHub リポジトリを Vercel に連携するか、`vercel` CLI でデプロイします。上記の環境変数を Vercel 側に設定してください。

---

## 技術構成

- Next.js (App Router) / TypeScript / Tailwind CSS
- 認証・Outlook連携: Auth.js (NextAuth v5) + Microsoft Entra ID + Microsoft Graph
- DB: Vercel Postgres (Neon) + Drizzle ORM（本番）／ JSONファイル（デモ）
- PWA: manifest + Service Worker

ストアは `DATABASE_URL` の有無で自動切替します（`src/lib/store/`）。
