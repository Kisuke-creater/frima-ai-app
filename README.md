# frima-ai-app

AIを活用してフリマ出品を効率化するWebアプリです。  
商品画像をアップロードするだけで、タイトル・説明文・価格提案を自動生成します。

---

## 🚀 主な機能

- Googleログイン（Firebase Authentication）
- 画像解析（OpenAI Vision API）
- 出品タイトル・説明文の自動生成
- YahooショッピングAPIを用いた新品相場取得
- 相場連動型の価格3段階提案
- Firestoreによる商品管理
- 売却管理・売上集計

---

## 🛠 技術スタック

- Next.js 16 (App Router)
- Firebase (Auth / Firestore)
- OpenAI API
- YahooショッピングAPI
- Vercel (予定)

---

## 📊 価格算出ロジック

1. YahooショッピングAPIで新品価格を取得
2. 外れ値を除外し中央値を算出
3. 商品状態に応じた係数を適用
4. フリマ向け価格を3段階で提案

---

## 🔐 セキュリティ設計

- OpenAI APIキーはサーバー側のみ使用
- 環境変数は `.env.local` で管理
- APIキーはGitHubに公開しない
- Firebase Admin SDKでトークン検証

---

## 📦 セットアップ

```bash
npm install
npm run dev
```
