# 自動デプロイ診断結果と解決手順

## 🔍 今回のエラー原因（Firebase Hosting でデプロイできなかった理由）

GitHub Actions のログを確認したところ、以下のエラーが発生していました：

```text
403 PERMISSION_DENIED: Permission denied to get service [firebasehosting.googleapis.com]
service: serviceusage.googleapis.com
permission: serviceusage.services.get
subject: projects/225350217665/services/firebasehosting.googleapis.com
```

### 原因の解説
Google Cloud / Firebase プロジェクト（`waseapp-works-waseworkapp`）において、**Firebase Hosting API が有効化されていない（または Firebase Console で Hosting の初期セットアップ「使ってみる」が完了していない）**ため、GitHub Actions に登録されたサービスアカウントからのアクセスが拒否されました。

---

## 🚀 解決策 1: GitHub Pages で即座に自動デプロイ（推奨・設定不要）

すでにリポジトリ設定を完了し、`.github/workflows/deploy-pages.yml` を追加しました！
**何もしなくても、GitHub に push するだけで以下の URL に全自動でデプロイされます：**

🔗 **公開URL**: **https://waseapp-jp.github.io/Waseapp-works-waseworkapp/**

- サービスアカウントキーや GCP 権限の設定は一切不要
- `main` ブランチへ `git push` するたびに、自動ビルド＆自動公開されます

---

## ⚡ 解決策 2: Firebase Hosting も有効化したい場合の手順（2ステップ）

Firebase Hosting (`https://waseapp-works-waseworkapp.web.app`) にもデプロイしたい場合は、以下の2点を行うだけで解決します：

### ステップ 1: Firebase Console で Hosting を有効化
1. [Firebase Hosting コンソール](https://console.firebase.google.com/project/waseapp-works-waseworkapp/hosting) を開く
2. 「**始める**（Get started）」ボタンをクリックして初期設定を完了する（画面の指示通り次へ進むだけでOKです）
3. これにより、Google Cloud 側で `firebasehosting.googleapis.com` が自動的に有効化されます。
   ※ または直接 [GCP APIライブラリ (Firebase Hosting API)](https://console.cloud.google.com/apis/library/firebasehosting.googleapis.com?project=waseapp-works-waseworkapp) を開いて「有効にする」をクリック

### ステップ 2: サービスアカウントの権限確認
1. [Google Cloud IAM & 管理](https://console.cloud.google.com/iam-admin/iam?project=waseapp-works-waseworkapp) を開く
2. GitHub Secrets に登録したサービスアカウント（`github-action-...` 等）の鉛筆マーク（編集）をクリック
3. 以下の2つのロールが付与されていることを確認（なければ「別のロールを追加」）：
   - **Firebase Hosting 管理者** (`Firebase Hosting Admin`)
   - **Service Usage 閲覧者** または **Service Usage ユーザー** (`Service Usage Consumer`)
4. 保存

これで次回の push から Firebase Hosting への自動デプロイも成功します。
