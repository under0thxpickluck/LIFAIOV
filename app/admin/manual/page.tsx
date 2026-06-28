import Link from "next/link";

export const metadata = {
  title: "社員用マニュアル｜LIFAI 管理",
};

function Callout({
  tone = "warn",
  children,
}: {
  tone?: "warn" | "info" | "danger";
  children: React.ReactNode;
}) {
  const styles =
    tone === "danger"
      ? "border-red-800 bg-red-950/40 text-red-200"
      : tone === "info"
      ? "border-sky-800 bg-sky-950/40 text-sky-200"
      : "border-amber-800 bg-amber-950/40 text-amber-200";
  return (
    <div className={`my-4 rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-10 scroll-mt-24 rounded-2xl bg-zinc-900 p-6">
      <h2 className="mb-4 border-b border-zinc-800 pb-3 text-lg font-bold text-white">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-300">{children}</div>
    </section>
  );
}

export default function ManualPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-[860px] px-4 py-8">
        {/* ヘッダー */}
        <header className="mb-6 flex items-center gap-4">
          <Link
            href="/admin"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            ← admin に戻る
          </Link>
          <h1 className="text-xl font-bold text-white">📖 社員用マニュアル</h1>
        </header>

        <p className="mb-8 text-sm text-zinc-400">
          管理画面の運用手順です。各画面は管理者用のID/パスワード（Basic認証）でログインしてから操作してください。
        </p>

        {/* 目次 */}
        <nav className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-zinc-500">目次</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-amber-300">
            <li><a href="#approve" className="hover:underline">楽曲売却申請の承認</a></li>
            <li><a href="#delete" className="hover:underline">承認済み売却申請が積みあがった場合の削除</a></li>
            <li><a href="#reset" className="hover:underline">パスワード再設定メールの再送</a></li>
            <li><a href="#withdraw" className="hover:underline">換金申請の確認（Loofity・毎日チェック）</a></li>
            <li><a href="#bp-recover" className="hover:underline">BP回復の確認・手動補充（随時チェック）</a></li>
            <li><a href="#affiliate" className="hover:underline">紹介報酬（アフィリエイト）の支払い・紐づけ変更（毎月末締め10日払い）</a></li>
            <li><a href="#faq" className="hover:underline">よくある質問（FAQ）</a></li>
          </ol>
        </nav>

        {/* 入口 */}
        <Section id="entry" title="管理画面の入口">
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-4 py-2 font-bold text-zinc-300">画面</th>
                  <th className="px-4 py-2 font-bold text-zinc-300">URL</th>
                  <th className="px-4 py-2 font-bold text-zinc-300">用途</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-t border-zinc-800">
                  <td className="px-4 py-2">メイン管理画面</td>
                  <td className="px-4 py-2 font-mono text-amber-300">/admin</td>
                  <td className="px-4 py-2">申請承認・楽曲売却の承認/削除</td>
                </tr>
                <tr className="border-t border-zinc-800">
                  <td className="px-4 py-2">財務管理</td>
                  <td className="px-4 py-2 font-mono text-amber-300">/admin/finance</td>
                  <td className="px-4 py-2">ユーザー詳細・パスワード再設定メール再送</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            どちらもアクセス時にユーザー名・パスワードの入力（Basic認証）を求められます。社内で共有されている管理者アカウントを入力してください。
          </p>
        </Section>

        {/* 1. 承認 */}
        <Section id="approve" title="1. 楽曲売却申請の承認">
          <p>
            ユーザーが楽曲の売却を申請すると、メイン管理画面に申請が表示され、社員が内容を確認して承認します。
            <strong className="text-white">承認するとそのユーザーにEPが付与されます。</strong>
          </p>
          <Callout tone="warn">
            <strong>毎日1回確認：</strong>承認待ち（審査中）の申請を放置しないよう、
            <strong>1日に1回はこのセクションを開いて新しい楽曲売却申請が届いていないか確認</strong>してください。
          </Callout>
          <p className="font-bold text-zinc-200">手順</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li><span className="font-mono text-amber-300">/admin</span> を開く。</li>
            <li>「🎵 楽曲売却申請管理」セクションまでスクロールする。</li>
            <li>右上の「更新」ボタンを押すと、最新の申請一覧が読み込まれる。</li>
            <li>
              一覧で各申請の内容を確認する（ユーザー＝申請者のlogin_id／楽曲タイトル・URL／
              <strong className="text-white">希望価格＝承認時に付与されるEP</strong>／メモ／ステータス）。
            </li>
            <li>ステータスが「審査中」の行に、右端へ「承認」「却下」ボタンが表示される。</li>
            <li>
              内容に問題がなければ「承認」を押す。上部に「✅ 承認しました」と出れば成功。
              申請者のEP残高に希望価格分が加算され、ユーザー側には承認通知が表示される。
            </li>
            <li>不備がある場合は「却下」を押す。却下ではEPは付与されない。</li>
          </ol>
          <Callout tone="warn">
            <strong>承認・却下ボタンは確認ダイアログが出ず、押した瞬間に確定します。</strong>
            押す前に必ず申請内容（特にユーザーと希望価格）を確認してください。
            <br />
            なお承認は<strong>二重付与されません</strong>。すでに承認済みの申請を再度承認しても、EPが重複付与されることはありません。
          </Callout>
        </Section>

        {/* 2. 削除 */}
        <Section id="delete" title="2. 承認済み売却申請が積みあがった場合の削除">
          <p>
            承認した申請は一覧に「承認済」として残り続けます。件数が増えて見づらくなったときに、不要になった承認済みの行を一覧から削除して整理します。
          </p>
          <p className="font-bold text-zinc-200">手順</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li><span className="font-mono text-amber-300">/admin</span> の「🎵 楽曲売却申請管理」セクションを開く（必要なら「更新」を押す）。</li>
            <li>ステータスが「承認済」の行には、右端に「🗑 削除」ボタンが表示される。</li>
            <li>不要な行の「🗑 削除」を押す。</li>
            <li>上部に「🗑 削除しました」と出れば成功。一覧から該当行が消える。</li>
          </ol>
          <Callout tone="danger">
            <strong>必ず読むこと：</strong>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>削除できるのは「承認済」の行だけです（審査中・却下済には削除ボタンは出ません）。</li>
              <li><strong>削除ボタンは確認ダイアログが出ず、押した瞬間に消えます。</strong>行を間違えないよう注意してください。</li>
              <li>
                削除は<strong>あくまで一覧（リスト）の掃除</strong>です。
                <strong>すでに付与したEPは戻りません（取り消されません）。</strong>
                承認の取り消しではなく、不要になった承認済みレコードを片付けるための操作です。
              </li>
            </ul>
          </Callout>
        </Section>

        {/* 3. パスワード再送 */}
        <Section id="reset" title="3. パスワード再設定メールの再送（パスワードを忘れたユーザー対応）">
          <p>
            ユーザーから「パスワードが分からなくなった／ログインできない」と連絡があった場合、財務管理のユーザー一覧から、本人の登録メールアドレス宛にパスワード再設定メールを再送します。
          </p>
          <p className="font-bold text-zinc-200">手順</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li><span className="font-mono text-amber-300">/admin/finance</span>（財務管理）を開く。</li>
            <li>「ユーザー詳細」タブを開く。</li>
            <li>上部の検索ボックスに <strong>login_id / メールアドレス / 名前</strong> のいずれかを入力して対象ユーザーを絞り込む。</li>
            <li>一覧から対象ユーザーの行をクリックする。右側に詳細パネルが開く。</li>
            <li>「アカウント操作」にある「登録メールアドレスにパスワード再設定メールを送る」ボタンを押す。</li>
            <li>確認ダイアログが出るので、宛先メールを確認して「OK」を押す。</li>
            <li>「✅ 送信しました（リセットリンクは72時間有効）」と出れば成功。</li>
          </ol>
          <p className="mt-4 font-bold text-zinc-200">送信後のユーザー側の流れ</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>ユーザーの登録メールアドレスに再設定用リンクが届く。</li>
            <li><strong className="text-white">リンクは72時間（3日間）有効・1回限り</strong>。期限切れ・使用済みの場合は、再度この手順で送り直す。</li>
            <li>ユーザーはそのリンクから新しいパスワードを設定する。</li>
            <li><strong className="text-white">login_id（ログインID）は変わりません。</strong>パスワードだけが再設定されます。</li>
          </ul>

          <p className="mt-4 font-bold text-zinc-200">うまくいかないとき（エラー表示と対処）</p>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-4 py-2 font-bold text-zinc-300">画面の表示</th>
                  <th className="px-4 py-2 font-bold text-zinc-300">意味と対処</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-t border-zinc-800">
                  <td className="px-4 py-2">❌ 該当ユーザーが見つかりません（メール表記揺れの可能性）</td>
                  <td className="px-4 py-2">メールのスペル・大文字小文字・余分なスペースを確認。login_idで検索し直す。</td>
                </tr>
                <tr className="border-t border-zinc-800">
                  <td className="px-4 py-2">❌ ステータスが approved ではないため送信できません</td>
                  <td className="px-4 py-2">そのユーザーはまだ承認前。先に申請承認を完了させる（承認前ユーザーには送れません）。</td>
                </tr>
                <tr className="border-t border-zinc-800">
                  <td className="px-4 py-2">❌ login_id またはメールアドレスが未設定です</td>
                  <td className="px-4 py-2">対象行に送信先情報がない。データを確認し、迷う場合は管理担当へ確認。</td>
                </tr>
                <tr className="border-t border-zinc-800">
                  <td className="px-4 py-2">❌ 通信エラー: …</td>
                  <td className="px-4 py-2">一時的な不具合。少し待って「更新」後に再試行。続く場合は管理担当へ報告。</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout tone="info">
            このボタンは<strong>登録済みのメールアドレス宛にしか送れません。</strong>
            ユーザーが「メールアドレス自体を変えたい」場合は、別途データ修正が必要になるため管理担当へエスカレーションしてください。
          </Callout>
        </Section>

        {/* 4. 換金申請の確認 */}
        <Section id="withdraw" title="4. 換金申請の確認（Loofity・毎日チェック）">
          <p>
            ユーザーからのEP換金申請は、Loofity管理シート（Googleスプレッドシート）に行として届きます。送金漏れ・対応遅れを防ぐため、
            <strong className="text-white">1日に最低1回はこのシートを開き、新しい換金申請が届いていないか確認してください。</strong>
          </p>
          <Callout tone="warn">
            <strong>毎日の必須チェック：</strong>下のシートを開き、未処理の新しい換金申請がないか確認する。新規申請は行として追加されます。
            <span className="block mt-1">
              <strong>created_at（申請日時）</strong> や <strong>status（処理状況）</strong> を見て、まだ処理していない新着がないかを判断してください。
            </span>
          </Callout>
          <p className="flex flex-wrap gap-2">
            <a
              href="https://docs.google.com/spreadsheets/d/1saLEUcSmnUf-J6d-bT63UZeZoqolAmi6XpU7R704C_k/edit?gid=76671989#gid=76671989"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              📊 Loofity 換金申請シートを開く
            </a>
            <a
              href="https://www.loofity-game.com/ja/lifai/guide"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700"
            >
              📖 お客様向け換金ガイドを開く
            </a>
          </p>
          <p className="text-xs text-zinc-400">
            「EPをUSDTに換金する方法」のお客様向け案内ページです。ユーザーから「換金のやり方が分からない」と問い合わせがあったときは、このガイドのURL（
            <span className="font-mono text-zinc-300">https://www.loofity-game.com/ja/lifai/guide</span>
            ）を案内してください。
          </p>

          <p className="mt-4 font-bold text-zinc-200">各列（項目）の意味</p>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-4 py-2 font-bold text-zinc-300">列名</th>
                  <th className="px-4 py-2 font-bold text-zinc-300">内容</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300 align-top">
                {([
                  ["request_id", "換金申請ごとに発行される申請ID（例：LIFAI-R2I66Z）。問い合わせ対応時の照合キー。"],
                  ["plan", "申請者のプラン（starter / infra など）。"],
                  ["ep_amount", "換金を申請したEP数。"],
                  ["ep_rate_jpy", "EPの単価（円）。例：0.5 = 1EP あたり0.5円。"],
                  ["usdt_rate_jpy", "USDTの円レート。例：159.93 = 1USDT が159.93円。"],
                  ["gross_usdt", "手数料を引く前のUSDT換算額（＝ ep_amount × ep_rate_jpy ÷ usdt_rate_jpy）。"],
                  ["fee_usdt", "差し引く手数料（USDT）。"],
                  ["net_usdt", "手数料を引いたあと、実際にユーザーへ送金するUSDT額（gross_usdt − fee_usdt）。"],
                  ["source_wallet", "送金元ウォレット（実際に出金する側。処理時に記入される）。"],
                  ["payout_network", "送金ネットワーク（例：TRC20）。"],
                  ["payout_wallet", "ユーザーの受取ウォレットアドレス。ここ宛に送金する。"],
                  ["platform_wallet", "プラットフォーム側の管理用ウォレットID（例：LFW-…）。"],
                  ["status", "処理状況（例：入金確認済み）。新着・未処理の判別に使う。"],
                  ["created_at", "申請日時（UTC・協定世界時。日本時間は +9時間）。"],
                  ["申請者ユーザーID", "申請したユーザーの内部ID（UUID）。"],
                  ["受領EP合計", "この申請で受領したEPの合計。"],
                  ["不足EP", "EPが足りない場合の不足分（0なら充足）。"],
                  ["充当入金ID", "この換金に充当した入金（デポジット）のID。"],
                  ["送信元LIFAIOV_ID", "処理した送信元（admin など）。"],
                  ["入金確認日時", "入金が確認された日時。"],
                  ["最終チェック日時", "最後に状態確認・処理を行った日時。"],
                ] as [string, string][]).map(([col, desc]) => (
                  <tr key={col} className="border-t border-zinc-800">
                    <td className="px-4 py-2 font-mono text-amber-300 whitespace-nowrap">{col}</td>
                    <td className="px-4 py-2">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Callout tone="info">
            金額計算の関係：<strong>gross_usdt = ep_amount × ep_rate_jpy ÷ usdt_rate_jpy</strong>、
            <strong>net_usdt = gross_usdt − fee_usdt</strong>。実際にユーザーへ送るのは <strong>net_usdt</strong> です。
            処理方法や判断に迷う点があれば、自己判断せず管理担当へ確認してください。
          </Callout>
        </Section>

        {/* 5. BP回復の確認・手動補充 */}
        <Section id="bp-recover" title="5. BP回復の確認・手動補充（随時チェック）">
          <p>
            BPはプランごとの上限（bp_cap）に向けて<strong className="text-white">30日ごとに自動回復</strong>します。
            ただし自動回復は<strong className="text-white">ユーザーがTOPページにログインしたときにだけ</strong>実行されるため、
            しばらくログインしていない等の理由で、<strong className="text-white">31日以上経ってもBPが回復していないユーザーが出ることがあります。</strong>
            その場合は利用者マスターシートを確認し、手動でBPを補充します。
          </p>
          <Callout tone="warn">
            <strong>随時チェック：</strong>「BPが回復しない」という問い合わせがあったときや、気づいたときに、下のマスターシートで対象ユーザーの状態を確認して補充してください。
          </Callout>
          <p>
            <a
              href="https://docs.google.com/spreadsheets/d/17rV59IjSXahNwmkBSE0OfjOmlk9_K1_SWxNJOXivBGw/edit?gid=442936583#gid=442936583"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              📋 利用者マスターシートを開く
            </a>
          </p>

          <p className="mt-4 font-bold text-zinc-200">① 未回復かどうかの確認手順</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>シートを開き、<kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">Ctrl+F</kbd> で対象ユーザーを検索する（login_id / email / name）。</li>
            <li><strong>bp_last_reset_at</strong>（前回回復日）を見る。<strong>空欄、または31日以上前</strong>になっている。</li>
            <li>それなのに <strong>bp_balance</strong>（現在BP）が <strong>bp_cap（プラン上限）より少ないまま</strong>なら、回復が走っていない＝補充対象。</li>
          </ol>

          <p className="mt-4 font-bold text-zinc-200">プラン別の bp_cap（上限）</p>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-4 py-2 font-bold text-zinc-300">plan</th>
                  <th className="px-4 py-2 font-bold text-zinc-300">bp_cap（上限）</th>
                  <th className="px-4 py-2 font-bold text-zinc-300">回復量の上限（cap×50%）</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {([
                  ["500", "1,000", "500"],
                  ["2000", "4,000", "2,000"],
                  ["3000", "8,000", "4,000"],
                  ["5000", "10,000", "5,000"],
                ] as [string, string, string][]).map(([p, cap, half]) => (
                  <tr key={p} className="border-t border-zinc-800">
                    <td className="px-4 py-2 font-mono text-amber-300">{p}</td>
                    <td className="px-4 py-2">{cap}</td>
                    <td className="px-4 py-2">{half}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 font-bold text-zinc-200">② 補充手順（シートを直接編集）</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              回復量を計算する：
              <span className="mt-1 block rounded-lg bg-zinc-800 px-3 py-2 font-mono text-xs text-emerald-300">
                回復量 = min(bp_cap × 50%, bp_cap − 現在BP)
              </span>
              <span className="text-xs text-zinc-400">
                ※ 現在BPがcap以上のときは回復0（補充不要）。capを超えて足さない。
              </span>
            </li>
            <li>対象ユーザーの行の <strong>bp_balance</strong> を「現在値 ＋ 回復量」に書き換える。</li>
            <li>同じ行の <strong>bp_last_reset_at</strong> を<strong>今日の日時</strong>に更新する（これが次回30日カウントの起点になる）。</li>
          </ol>

          <p className="mt-3 text-zinc-400 text-xs">計算例（plan=5000 / bp_cap=10,000）</p>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-4 py-2 font-bold text-zinc-300">現在BP</th>
                  <th className="px-4 py-2 font-bold text-zinc-300">回復量</th>
                  <th className="px-4 py-2 font-bold text-zinc-300">補充後のbp_balance</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {([
                  ["0", "5,000", "5,000"],
                  ["4,000", "5,000", "9,000"],
                  ["6,000", "4,000", "10,000（capちょうど）"],
                  ["10,000以上", "0（補充不要）", "変更なし"],
                ] as [string, string, string][]).map(([a, b, c]) => (
                  <tr key={a} className="border-t border-zinc-800">
                    <td className="px-4 py-2">{a}</td>
                    <td className="px-4 py-2">{b}</td>
                    <td className="px-4 py-2">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Callout tone="danger">
            <strong>直接編集の注意：</strong>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>このシートは<strong>本番の利用者マスターデータ</strong>です。<strong>行・列を間違えて他の値を書き換えないよう</strong>細心の注意を払ってください。</li>
              <li>編集するのは <strong>bp_balance</strong> と <strong>bp_last_reset_at</strong> の2つだけ。それ以外の列（pw_hash・残高以外の項目など）は触らない。</li>
              <li>判断に迷う場合（plan不明・cap以上なのに苦情がある等）は自己判断せず管理担当へ確認してください。</li>
            </ul>
          </Callout>
        </Section>

        {/* 6. 紹介報酬（アフィリエイト） */}
        <Section id="affiliate" title="6. 紹介報酬（アフィリエイト）の支払い・紐づけ変更（毎月末締め10日払い）">
          <p>
            EPの紹介報酬は <strong className="text-white">毎月末締め・翌月10日払い</strong>です。流れは
            <strong className="text-white">「① 月次集計で支払額を確認 → ② マスターシートでEPを補充（支払い）」</strong>。
            あわせて、紹介者の<strong className="text-white">紐づけ（誰の紹介か）の変更</strong>もここで行います。すべて
            <span className="font-mono text-amber-300">/admin/finance</span>（財務管理）で操作します。
          </p>
          <Callout tone="info">
            <strong>毎月のスケジュール：</strong>月末（日本時間の月末23:59）で締め → 集計を確定 → <strong>翌月10日までに各紹介者へEPを支払う</strong>。支払いは月1回。
          </Callout>

          {/* ① 集計の確認 */}
          <p className="mt-5 font-bold text-zinc-200">① 集計の確認方法（「月次集計」タブ）</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li><span className="font-mono text-amber-300">/admin/finance</span> →「月次集計」タブを開く。</li>
            <li>上部のプルダウンで<strong>対象月</strong>を選び、「表示する」を押す。</li>
            <li>
              紹介者ごとに<strong>合計EP</strong>が一覧表示される。<strong>行をクリックすると段別（L1〜L5）の内訳</strong>が開く。
              この「合計EP」がその月にその紹介者へ支払う額。
            </li>
            <li>下部の<strong>「直近6ヶ月サマリ」</strong>で各月の合計EP・人数を確認・切り替えできる。</li>
          </ol>
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-4 py-2 font-bold text-zinc-300">段</th>
                  <th className="px-4 py-2 font-bold text-zinc-300">初回入金に対する料率</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {([
                  ["L1（直紹介）", "10%"],
                  ["L2", "5%"],
                  ["L3", "2%"],
                  ["L4", "2%"],
                  ["L5", "1%"],
                ] as [string, string][]).map(([lv, r]) => (
                  <tr key={lv} className="border-t border-zinc-800">
                    <td className="px-4 py-2">{lv}</td>
                    <td className="px-4 py-2 font-mono text-emerald-300">{r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-zinc-300">
            <li>EP額は画面上部の<strong>換算レート</strong>（1 USD = ◯◯円 × ◯◯ EP/円）で円換算してから算出される。</li>
            <li>締めの月境界は<strong>日本時間（JST）</strong>。どの月に入るかは <span className="font-mono text-xs">approved_at → auto_approved_at → paid_at</span> の順で日付を見て判定される。</li>
            <li><strong>CC決済（内部課金・Square）列は現状「—」</strong>で未稼働。CC分の報酬は下記④の「CC付与待ち」タブで別途付与する。</li>
          </ul>

          {/* ② 支払い */}
          <p className="mt-5 font-bold text-zinc-200">② 支払い（マスターシートでEPを補充）</p>
          <p>月次集計には支払いボタンはありません。集計で確認した額を、利用者マスターシートの <strong>ep_balance</strong> に手動で加算して支払います（BP補充と同じ要領）。</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>「月次集計」で各紹介者の<strong>合計EP</strong>を確認する。</li>
            <li>
              <a href="https://docs.google.com/spreadsheets/d/17rV59IjSXahNwmkBSE0OfjOmlk9_K1_SWxNJOXivBGw/edit?gid=442936583#gid=442936583" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">利用者マスターシート</a>
              を開き、<kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">Ctrl+F</kbd> で紹介者の <strong>login_id</strong> を検索する。
            </li>
            <li>その行の <strong>ep_balance</strong> を「<strong>現在値 ＋ 集計の合計EP</strong>」に書き換える。</li>
            <li>支払った月と金額を<strong>記録</strong>しておく（二重払い防止）。</li>
          </ol>
          <Callout tone="danger">
            <strong>直接編集の注意：</strong>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>本番マスターデータです。<strong>行・列を間違えない</strong>（必ず login_id を照合）。編集するのは <strong>ep_balance</strong> のみ。</li>
              <li><strong>「上書き」ではなく「加算」</strong>。現在の ep_balance を消して集計値だけにしないこと。</li>
              <li>支払いは<strong>月1回</strong>。同じ月の集計を二度払わない。</li>
            </ul>
          </Callout>

          {/* ③ 紐づけの変更 */}
          <p className="mt-5 font-bold text-zinc-200">③ 紐づけ（紹介者）の変更方法（「紹介ツリー」タブ）</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li><span className="font-mono text-amber-300">/admin/finance</span> →「紹介ツリー」タブを開く。必要なら上部に<strong>ルートのlogin_id</strong>を入れて「絞り込む」。</li>
            <li>
              紐づけを変えたいユーザーを<strong>ドラッグ</strong>し、<strong>新しい紹介者の行にドロップ</strong>する。
            </li>
            <li>確認モーダルで内容（「◯◯ の紹介者を △△ に変更」）を確認し、<strong>「変更する」</strong>を押す。</li>
            <li>上位5段（referrer_2〜5）と ref_path が<strong>自動で再計算</strong>される。変更履歴は ref_events に記録される。</li>
          </ol>
          <p className="mt-2 text-zinc-300">エラーが出る主なケース：</p>
          <ul className="list-disc space-y-1 pl-5 text-zinc-300">
            <li><strong>循環参照になるため変更できません</strong>：自分の子孫を自分の紹介者にしようとした（ツリーがループする）。</li>
            <li><strong>自分自身には紹介できません</strong>：同じユーザーにドロップした。</li>
            <li><strong>対象ユーザーが見つかりません</strong>：login_id が一致しない。</li>
          </ul>
          <p className="mt-3 text-zinc-300">
            <strong>refcodeからの一括補完：</strong>「🔗 refcodeから紹介者を更新」ボタンは、
            <strong>ref_code が入っていて紹介者が空欄の行だけ</strong>を自動で紐づけます（<strong>既存の紐づけは上書きしません</strong>）。
            実行結果に「updated（更新）／ skipped（設定済みで対象外）／ unmatched（ref_code未登録で紐づけられず）」が表示されます。
          </p>

          {/* ④ CC付与待ち */}
          <p className="mt-5 font-bold text-zinc-200">④ CC決済（Square）分の付与（「CC付与待ち」タブ）</p>
          <p>
            クレジットカード（Square）決済から発生した紹介報酬は、<strong>「CC付与待ち」タブ</strong>に「未付与」で並びます。
            内容（購入者・紹介者・付与予定EP）を確認し、各行の<strong>「付与」ボタン</strong>で支払います（確認ダイアログあり）。付与済みは状態が「付与済み」に変わります。
          </p>
          <Callout tone="warn">
            CC分は「CC付与待ち」タブの付与ボタンで支払う運用です。月次集計のCC列は未稼働（—）なので、<strong>CC分をシート編集で二重に払わない</strong>よう注意してください。
          </Callout>

          {/* ⑤ 考えられる付与ミス */}
          <p className="mt-5 font-bold text-zinc-200">⑤ 考えられる付与ミス（チェックリスト）</p>
          <Callout tone="danger">
            <ul className="list-disc space-y-1.5 pl-5">
              <li><strong>上書きしてしまう：</strong>ep_balance を「現在値＋集計EP」ではなく集計EPで上書きし、残高を消してしまう。→ 必ず加算。</li>
              <li><strong>二重払い：</strong>同じ月の集計を2回払う／別の社員と重複して払う。→ 支払った月を記録し、月1回に統一。</li>
              <li><strong>行・列の取り違え：</strong>別ユーザーの行に入れてしまう。→ login_id を必ず照合。</li>
              <li><strong>締めタイミングのズレ：</strong>月末ギリギリの入金が当月/翌月どちらに入るかを取り違える。→ 集計は日本時間の月末締め、判定日は approved_at→auto_approved_at→paid_at。</li>
              <li><strong>紐づけ変更のタイミング：</strong>集計確定・支払い後に紐づけを変えると過去の支払いと食い違う。→ 紐づけ変更は締め前に。締め後に変更が入ったら再集計してから支払う。</li>
              <li><strong>紐づけ漏れ（unmatched）：</strong>ref_code未登録などで紹介者が空のままだと、報酬が誰にも付かない。→ バックフィルの unmatched を確認し、必要なら紹介ツリーで手動紐づけ。</li>
              <li><strong>CC分の二重払い：</strong>CC（Square）分は「CC付与待ち」で付与済み。シート編集で重ねて払わない。</li>
              <li><strong>換算レートの変動：</strong>USD→円・EP/円のレートが変わると集計EPも変わる。→ 支払いに使うのは、その月の集計タブに表示された値。</li>
              <li><strong>承認時の自動配当との混同：</strong>承認時に別の自動紹介配当が走る仕組みがあります。月次集計分と二重にならないよう範囲を取り違えない。<strong>判断に迷ったら自己判断せず管理担当へ確認。</strong></li>
            </ul>
          </Callout>
          <p className="text-xs text-zinc-400">
            ※「アフィリエイト」タブは付与済みの紹介報酬（affiliate_reward）の台帳ビューです。受取人・送出元・段・EP額の履歴確認に使えます。
          </p>
        </Section>

        {/* FAQ */}
        <Section id="faq" title="よくある質問（FAQ）">
          <div className="space-y-4">
            <div>
              <p className="font-bold text-zinc-100">Q. 売却を間違えて承認してしまった。EPを取り消したい。</p>
              <p>A. 承認済みの「🗑 削除」では<strong className="text-white">EPは戻りません</strong>。EPの取り消しは別途データ修正が必要なので管理担当へ連絡してください。</p>
            </div>
            <div>
              <p className="font-bold text-zinc-100">Q. パスワード再設定メールが「届かない」と言われた。</p>
              <p>A. まず迷惑メールフォルダの確認を案内。そのうえで本マニュアル3の手順で再送（リンクは72時間で失効するため、古いメールではなく最新の再送リンクを使ってもらう）。</p>
            </div>
            <div>
              <p className="font-bold text-zinc-100">Q. ボタンを押しても反応がない／エラーが出る。</p>
              <p>A. 「更新」「再読み込み」を押して最新状態に読み直してから再試行。それでも解決しない場合は、表示されたエラー文をそのまま管理担当へ共有してください。</p>
            </div>
          </div>
        </Section>

        <footer className="mt-10 border-t border-zinc-800 pt-4 text-center text-xs text-zinc-600">
          LIFAI 社員用マニュアル
        </footer>
      </div>
    </main>
  );
}
