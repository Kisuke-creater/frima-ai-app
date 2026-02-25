<<<<<<< HEAD

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

````bash
npm install
npm run dev
=======
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
````

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

> > > > > > > da42481 (initial release)
