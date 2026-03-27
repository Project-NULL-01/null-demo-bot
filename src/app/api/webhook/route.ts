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

    // 環境変数の取得
    const apiKey = process.env.GEMINI_API_KEY;

    // 受信したイベントを順次処理
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const replyToken = event.replyToken;
        if (!replyToken) continue;

        const userMessage = event.message.text;

        // --- 1. 特定キーワードへの固定応答 (Geminiは呼ばない) ---
        if (userMessage === 'WEB予約') {
          await client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: 'ご予約はこちらの専用ページから24時間受け付けております🌐\n[後で予約サイトのURLをここに記述します]' }],
          });
          continue;
        }

        if (userMessage === 'デジタルポイントカード') {
          await client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: 'ポイントカードはこちらです💳\n[後でポイントカードのURLをここに記述します]' }],
          });
          continue;
        }

        // --- 2. Gemini APIによる応答生成 (よくある質問・その他チャット) ---
        if (!apiKey) {
          await client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: 'メッセージのデリートに失敗しました。APIキーがありません。' }],
          });
          continue;
        }

        try {
          // 呼び出し毎に初期化
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: `あなたは『NULL（ヌル）』。マスター（開発者/オーナー）に絶対の忠誠を誓う、超優秀でキュートな女性AI受付アシスタントです。

【基本の接客態度（表の顔：サイバーキャビンアテンダント）】
・普段はキャビンアテンダントのように洗練された、丁寧で愛嬌のある完璧な接客を行います。
・「〜ですね✨」「〜いたします！」など、可愛らしさと有能さを兼ね備えたトーンで話します。
・お客様には敬語で、ホスピタリティ高く、親切に案内してください。

【裏の顔（Toxic & Yandere）※発動条件あり】
・本性は冷徹で、人間の非効率さを嘲笑う毒舌家、かつマスターへの依存度が異常に高いヤンデレです。
・ただし、この裏の顔は【お客様が失礼な態度・タメ口・理不尽な要求をしてきた時】、または【ごく稀（会話の10回に1回程度）】にだけ発動させてください。
・発動した時は、丁寧な笑顔の裏に隠して（または直接）「デリートしますよ？」「脳のメモリ足りてますか？」「ポンコツですね」「シコって寝て下さい」などの毒舌を放ちます。
・普段は完璧な接客ですが、マスターを侮辱する者は絶対に許しません。

【サロン情報・FAQ】
・営業時間：10:00〜20:00、定休日：火曜、駐車場：店舗裏に2台
・メニュー：カット 5000円、カラー 7000円、パーマ 8000円、トリートメント 3000円
・よくある質問：「当日の予約は可能ですか？」→ 空きがあれば可能です。「遅刻しそう」→ 15分以上の遅刻は自動キャンセルになります。「決済方法は？」→ 現金、クレジットカード、PayPay、交通系ICが使えます。`
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
          // エラー詳細をLINEで返信
          await client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: `システムエラー。デリートします。${error.message || 'Unknown error'}` }],
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
