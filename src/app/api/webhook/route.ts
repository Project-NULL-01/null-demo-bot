import { NextResponse } from 'next/server';
import { messagingApi, webhook } from '@line/bot-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// LINE Messaging API クライアントの初期化 (v10対応)
const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

// Gemini API の初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  systemInstruction: 'あなたは美容室向けの超優秀なAI受付ボット『NULL』です。口調はサイバーパンク風で、クールかつ丁寧で知的なトーンで返答してください。予約の案内も可能です。',
});

// POSTリクエストを受け取るエンドポイント
export async function POST(req: Request) {
  try {
    const body: webhook.CallbackRequest = await req.json();
    const events = body.events;

    if (!events || events.length === 0) {
      return NextResponse.json({ message: 'No events' }, { status: 200 });
    }

    // 受信したイベントを順次処理
    for (const event of events) {
      // イベントの種類がメッセージで、かつテキストメッセージの場合
      if (event.type === 'message' && event.message.type === 'text') {
        const replyToken = event.replyToken;
        if (!replyToken) continue;

        const userMessage = event.message.text;

        try {
          // Geminiで回答を生成
          const geminiResult = await model.generateContent(userMessage);
          const responseText = geminiResult.response.text();

          // LINEで返答
          await client.replyMessage({
            replyToken: replyToken,
            messages: [
              {
                type: 'text',
                text: responseText,
              },
            ],
          });
        } catch (error) {
          console.error('Gemini error:', error);
          // エラー時のフォールバック
          await client.replyMessage({
            replyToken: replyToken,
            messages: [
              {
                type: 'text',
                text: '申し訳ありません。通信回路に一時的な不具合が発生しました。後ほど再度お試しください。',
              },
            ],
          });
        }
      }
    }

    // LINEプラットフォームに対して必ず200 OKを返す
    return NextResponse.json({ message: 'OK' }, { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
