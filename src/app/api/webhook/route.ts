// redeploy 4
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

        // 2. APIキーの存在チェックと即返信
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
          // gemini-pro (v1.0) は systemInstruction をサポートしていないため、
          // 設定から削除し、プロンプトの一部として渡す形式にします。
          const model = genAI.getGenerativeModel({
            model: 'gemini-pro',
          });

          const systemPrompt = 'あなたは美容室向けの超優秀なAI受付ボット『NULL』です。口調はサイバーパンク風で、クールかつ丁寧で知的なトーンで返答してください。予約の案内も可能です。\n\nユーザーメッセージ: ';

          // Geminiで回答を生成
          const geminiResult = await model.generateContent(systemPrompt + userMessage);
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
