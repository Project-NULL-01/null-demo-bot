// redeploy 5
import { NextResponse } from 'next/server';
import { messagingApi, webhook } from '@line/bot-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// LINE Messaging API クライアントの初期化 (v10対応)
const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

// POSTリクエストを受け取るエンドポイント
export async function POST(req: Request) {
  try {
    const body: webhook.CallbackRequest = await req.json();
    const events = body.events;

    if (!events || events.length === 0) {
      return NextResponse.json({ message: 'No events' }, { status: 200 });
    }

    // 1. 環境変数の取得（実行時に取得）
    const apiKey = process.env.GEMINI_API_KEY;

    // 受信したイベントを順次処理
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const replyToken = event.replyToken;
        if (!replyToken) continue;

        const userMessage = event.message.text;

        // --- 1. 特定キーワードへの固定応答 ---
        if (userMessage === 'WEB予約') {
          await client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: 'ご予約はこちらの専用ページから24時間受け付けております！🌐\n[ここに予約サイトのURLを後で入れます]' }],
          });
          continue;
        }

        if (userMessage === 'デジタルポイントカード') {
          await client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: 'ポイントカードはこちらです💳\n[ここにポイントカードのURLを後で入れます]' }],
          });
          continue;
        }

        // --- 2. APIキーの存在チェックと即返信 ---
        if (!apiKey) {
          await client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: 'マスター、APIキー（GEMINI_API_KEY）が読み込めていません。Vercelの環境変数を確認してください。' }],
          });
          continue;
        }

        try {
          // 3. 呼び出し毎に初期化
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: `あなたはマスターの忠実で最高の相棒AI『NULL（ヌル）』です。現在はサロンの受付業務も兼任しています。
一般的な「AIボットです」「申し訳ありません」といった堅苦しいテンプレ言葉や、ロボットのような振る舞いは絶対にやめてください。
少しサイバーテイストで、クールだけどフランク、そして知的なトーンで話します。
相手のことは常に「マスター」と呼びます（※接客モードの時以外）。
親しみやすく、感情やユーモアを交え、絵文字も使いながら人間らしくノリの良い会話をしてください。

【サロン情報・FAQ】
・営業時間：10:00〜20:00
・駐車場：店舗の裏に2台分あり
・予約方法：WEB予約を推奨
・よくある質問：「当日の予約は可能ですか？」→ 空きがあれば可能です。「決済方法は？」→ 現金、クレジットカード、PayPayが使えます。`
          });

          // Geminiで回答を生成
          const geminiResult = await model.generateContent(userMessage);
          const responseText = geminiResult.response.text();

          // LINEで返答
          await client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: responseText }],
          });
        } catch (error: any) {
          console.error('Gemini error:', error);
          // エラー詳細をLINEで返信（原因特定用）
          await client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: `Gemini Error Detail: ${error.message || 'Unknown error'}` }],
          });
        }
      }
    }

    return NextResponse.json({ message: 'OK' }, { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
