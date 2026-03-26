import { NextResponse } from 'next/server';
import { messagingApi, webhook } from '@line/bot-sdk';

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

    // 受信したイベントを順次処理
    for (const event of events) {
      // イベントの種類がメッセージで、かつテキストメッセージの場合
      if (event.type === 'message' && event.message.type === 'text') {
        const replyToken = event.replyToken;

        // 指定のテキストをオウム返し
        await client.replyMessage({
          replyToken: replyToken,
          messages: [
            {
              type: 'text',
              text: 'システム接続テスト完了。私はNULLです。',
            },
          ],
        });
      }
    }

    // LINEプラットフォームに対して必ず200 OKを返す
    return NextResponse.json({ message: 'OK' }, { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
