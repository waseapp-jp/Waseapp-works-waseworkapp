# GitHub 自動デプロイ設定ガイド (GitHub Actions → Firebase Hosting)

このリポジトリ（`https://github.com/waseapp-jp/Waseapp-works-waseworkapp`）への `push`（`main` / `master` ブランチ）をトリガーとして、**Firebase Hosting** への自動ビルド・自動デプロイを行う GitHub Actions ワークフローが設定されています。

---

## 📁 作成されたワークフロー

1. **本番自動デプロイ** (`.github/workflows/firebase-hosting-merge.yml`)
   - `main` または `master` ブランチへの `push` / `merge` 時に起動
   - `npm ci || npm install` → `npm run build` → Firebase Hosting (liveチャンネル) へ自動公開
2. **PRプレビューデプロイ** (`.github/workflows/firebase-hosting-pull-request.yml`)
   - Pull Request 作成・更新時に専用プレビューURLを自動発行

---

## 🔑 必要なワンタイム設定 (GitHub Secrets の登録)

GitHub Actions から Firebase Hosting へアクセス・デプロイするための認証情報を GitHub に1回だけ設定します。

### 方法 1: Firebase CLI で全自動設定 (おすすめ・一番簡単)

ローカルPC等のターミナルで以下を実行すると、GitHubアカウントとFirebaseが自動リンクされ、Secretも自動でGitHubに登録されます。

```bash
firebase login
firebase init hosting:github
```

1. **For which GitHub repository would you like to set up a GitHub workflow?**
   → `waseapp-jp/Waseapp-works-waseworkapp` を入力
2. **Set up the workflow to run a build script before every deploy?**
   → `Yes` (スクリプト名: `npm run build`)
3. **Set up automatic deployment to your site's live channel when a PR is merged?**
   → `Yes` (ブランチ名: `main`)

---

### 方法 2: 手動でサービスアカウント JSON を登録する場合

1. **GCP Console / Firebase Console でサービスアカウントキーを発行**:
   - [Google Cloud IAM & 管理](https://console.cloud.google.com/iam-admin/serviceaccounts?project=waseapp-works-waseworkapp) を開く
   - プロジェクト: `waseapp-works-waseworkapp`
   - 「サービス アカウントを作成」または既存の `firebase-adminsdk` を選択
   - 役割（ロール）: **Firebase Hosting 管理者** (または `Firebase Hosting Admin`) を付与
   - 作成後、該当アカウントの「キー」タブ → 「鍵を追加」 → 「新しい鍵を作成」 → **JSON** を選択してダウンロード
2. **GitHub リポジトリに Secret を登録**:
   - リポジトリ (`waseapp-jp/Waseapp-works-waseworkapp`) を開く
   - **Settings** → **Secrets and variables** → **Actions** を開く
   - **New repository secret** をクリック
   - Name: `FIREBASE_SERVICE_ACCOUNT_WASEAPP_WORKS_WASEWORKAPP` (または `FIREBASE_SERVICE_ACCOUNT`)
   - Secret: ダウンロードした JSON ファイルの中身をそのまま貼り付けて保存

---

## 🚀 デプロイの実行

上記の設定完了後、ローカルや作業環境からリポジトリへコードを `git push` すると、自動的に GitHub Actions が走り、Firebase Hosting へ即座に反映されます！
