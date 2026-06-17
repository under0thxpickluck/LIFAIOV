import Link from "next/link";

export const metadata = { title: "アルバムの作り方 | LIFAI" };

const STEPS = [
  {
    number: 1,
    title: "アーティスト名を決める",
    icon: "🎤",
    body: [
      {
        heading: "3つの表記が必要です",
        content:
          "narasuへの申請には日本語・カタカナ・英語（アルファベット）の3表記が必要です。配信先のサービスによって使い分けられます。",
      },
      {
        heading: "表記の例",
        list: [
          "日本語: 山田 太郎",
          "カタカナ: ヤマダ タロウ",
          "英語: Taro Yamada",
        ],
      },
      {
        heading: "重複を確認する",
        content:
          "同名の既存アーティストがいると混同される可能性があります。narasuの検索やGoogle検索で確認しておきましょう。",
      },
    ],
    fields: ["artistName", "artistNameKana", "artistNameAlpha"],
  },
  {
    number: 2,
    title: "アルバム名を決める",
    icon: "💿",
    body: [
      {
        heading: "命名パターン",
        list: [
          "テーマ型: 「夜明けの詩」「DAWN」— 曲のテーマや世界観をそのまま表す",
          "感情型: 「静寂」「Silence」— 聴いた時の感情をタイトルにする",
          "造語型: 「ルミネシア」「Luminecia」— 独自の言葉を作る",
        ],
      },
      {
        heading: "シングルの場合",
        content:
          "1〜2曲のシングルリリースであれば、アルバム名は楽曲タイトルと同じにするのが一般的です。",
      },
      {
        heading: "3表記の注意点",
        content:
          "カタカナ表記は日本語名をカタカナに読み替えたもの、英語表記はアルファベットで書いたものです。造語の場合はローマ字表記でも構いません。",
      },
    ],
    fields: ["albumName", "albumNameKana", "albumNameAlpha"],
  },
  {
    number: 3,
    title: "収録曲を揃える",
    icon: "🎵",
    body: [
      {
        heading: "曲数の目安",
        list: [
          "シングル: 1〜2曲（最初のリリースに最適）",
          "EP（ミニアルバム）: 3〜5曲",
          "アルバム: 6曲以上",
        ],
      },
      {
        heading: "音源URLの取得方法",
        content:
          "LIFAIの音楽生成ページで曲を生成した後、再生プレイヤー下部に表示される「URLをコピー」ボタンを使って音源URLを取得してください。このURLをnarasu代行フォームに貼り付けます。",
      },
      {
        heading: "楽曲タイトルの決め方",
        content:
          "アルバム名と世界観を統一したタイトルをつけると、まとまりのある作品になります。シンプルな1〜4文字のタイトルは覚えてもらいやすいです。",
      },
    ],
    fields: ["audioUrls（URL + タイトル）"],
  },
  {
    number: 4,
    title: "ジャケット画像を作る",
    icon: "🎨",
    body: [
      {
        heading: "必須規格",
        list: [
          "サイズ: 3000 × 3000px 以上（正方形）",
          "形式: JPGまたはPNG",
          "解像度不足だとnarasuの審査で弾かれることがあります",
        ],
      },
      {
        heading: "おすすめ無料ツール",
        list: [
          "Canva（canva.com）— テンプレートが豊富で初心者向け。「アルバムカバー」で検索するとすぐに使えるテンプレートが見つかります",
          "Adobe Express（adobe.com/express）— 高品質な仕上がり。操作もシンプル",
        ],
      },
      {
        heading: "デザインのポイント",
        list: [
          "文字は画面サイズが小さくなっても読めるよう、大きめに配置する",
          "著作権フリー・商業利用可能な素材のみ使用する（Canvaの有料素材は商業利用可）",
          "完成した画像はGoogleドライブやDropboxにアップロードし、共有リンクを取得してフォームに貼り付ける",
        ],
      },
    ],
    fields: ["jacketImageUrl", "jacketNote"],
  },
  {
    number: 5,
    title: "申請前の最終チェック",
    icon: "✅",
    body: [
      {
        heading: "narasu代行フォームに必要な全項目",
        checklist: [
          { label: "narasuアカウントID", note: "事前にnarasu.jpで登録が必要" },
          { label: "narasuパスワード", note: "代行完了後に変更することを推奨" },
          { label: "楽曲URL（1曲以上）", note: "Step 3 で取得したURL" },
          { label: "各楽曲のタイトル", note: "Step 3 で決めたタイトル" },
          { label: "アーティスト名（日本語）", note: "Step 1 で決めたもの" },
          { label: "アーティスト名（カタカナ）", note: "Step 1 で決めたもの" },
          { label: "アーティスト名（英語）", note: "Step 1 で決めたもの" },
          { label: "アルバム名（日本語）", note: "Step 2 で決めたもの" },
          { label: "アルバム名（カタカナ）", note: "Step 2 で決めたもの" },
          { label: "アルバム名（英語）", note: "Step 2 で決めたもの" },
          { label: "ジャケット画像URL", note: "Step 4 で作成・アップロードしたもの" },
          { label: "歌詞テキスト", note: "任意（あれば入力）" },
        ],
      },
      {
        heading: "注意事項",
        list: [
          "申請する楽曲の著作権・原盤権はご自身が保有していることをご確認ください",
          "narasuによる審査結果は保証されません",
          "アカウント情報は代行業務完了後に削除されます",
        ],
      },
    ],
    fields: [],
  },
];

export default function AlbumGuidePage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900">アルバムの作り方</h1>
          <p className="mt-1 text-sm text-slate-400">
            narasu配信申請に必要な準備をステップで確認
          </p>
        </div>

        {/* ステップカード */}
        <div className="space-y-4">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              {/* ステップヘッダー */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-extrabold text-indigo-600">
                  {step.number}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{step.icon}</span>
                  <h2 className="text-base font-extrabold text-slate-900">{step.title}</h2>
                </div>
              </div>

              {/* コンテンツ */}
              <div className="space-y-4">
                {step.body.map((section) => (
                  <div key={section.heading}>
                    <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                      {section.heading}
                    </h3>
                    {"content" in section && section.content && (
                      <p className="text-sm leading-relaxed text-slate-700">{section.content}</p>
                    )}
                    {"list" in section && section.list && (
                      <ul className="space-y-1">
                        {section.list.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                    {"checklist" in section && section.checklist && (
                      <ul className="space-y-2">
                        {section.checklist.map((item) => (
                          <li key={item.label} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <span aria-hidden="true" className="mt-0.5 text-indigo-400">☐</span>
                            <div>
                              <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                              <span className="ml-2 text-xs text-slate-400">{item.note}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              {/* 対応フィールド */}
              {step.fields.length > 0 && (
                <div className="mt-4 rounded-xl bg-indigo-50 px-3 py-2">
                  <p className="text-xs text-indigo-500">
                    <span className="font-bold">フォーム入力項目: </span>
                    {step.fields.join(" / ")}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="mt-8 text-center">
          <Link
            href="/narasu-agency"
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            ← narasu代理申請に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
