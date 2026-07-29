# Claude Skill Factory — 商品化計画（Draft v1）

作成日: 2026-07-29
ブランチ: `claude/skill-factory-product-plan-ihe1a3`
ステータス: 計画のみ（実装は未着手）

---

## 1. 背景と目的

「スキルを作るスキル（メタスキル）」を作り、販売可能な商品パッケージに仕上げる。

要件は2つ:

- **初心者**: スキルの書き方を一切知らなくても、日本語で業務を説明するだけで完成品一式が手に入る
- **上級者**: 既存スキルの診断・分割設計・トリガー最適化・実測評価まで届く

### 前提として確認した事実（重要）

Anthropic 公式の `skill-creator` はこの環境に既にインストールされている
（`/root/.claude/skills/skill-creator/`）。中身を確認した結果、公式版は既に以下をカバーしている:

| 公式がカバー済み | 実体 |
|---|---|
| 新規作成のヒアリング〜SKILL.md 生成 | `SKILL.md`（485行） |
| progressive disclosure の設計指針 | 同上 |
| テストケース作成・with/without 比較実測 | `scripts/run_eval.py`, `agents/grader.md` |
| ベンチマーク集計・HTMLビューア | `scripts/aggregate_benchmark.py`, `eval-viewer/` |
| description のトリガー精度最適化 | `scripts/improve_description.py` |
| 構文検証・ZIPパッケージ化 | `scripts/quick_validate.py`, `scripts/package_skill.py` |

つまり「SKILL.md を生成する」「点数をつける」だけでは**公式の劣化コピー**になる。
差別化できる領域は次章の4点に絞られる。

---

## 2. 差別化の柱（ここ以外に商品価値はない）

### 柱1: 日本語業務ヒアリングの設計
公式は「Proactively ask questions」としか書いておらず、質問設計は毎回モデル任せ。
本商品は**質問の順番・粒度・デフォルト回答**を固定する。

- 一度に聞くのは **最大3問**（初心者は10項目一括質問で脱落する）
- 各質問に**推奨デフォルト案**を必ず添える → 「これで」の一言で進める
- 「おまかせ」と言われたら、**仮定を明示したうえで最後まで生成**して差分修正に切り替える

### 柱2: スキル5類型 × 型別テンプレート
公式には「型」の概念がない。業務スキルは実際には5つに分類でき、型ごとに SKILL.md の骨格が違う。
これが本商品の技術的な中核。

| 型 | 例 | 骨格の特徴 |
|---|---|---|
| 生成型 (generate) | 物件紹介文、営業メール、SNS投稿 | 出力テンプレ固定＋トーン規定＋禁止表現 |
| 変換型 (transform) | 議事録→タスク、仕様書→テストケース | 入力パース規則＋対応表＋欠損時の扱い |
| 判定型 (review) | 契約書チェック、コードレビュー、見積検算 | チェック項目リスト＋重大度＋指摘フォーマット |
| 手順型 (workflow) | リリース前確認、月次締め | 順序固定＋各ステップの完了条件＋中断時の再開 |
| 調査型 (research) | 競合調査、技術選定 | 情報源の優先順位＋不確実性の明示＋出典 |

### 柱3: 「不明を勝手に埋めない」を標準搭載（法的リスク対応）
業務スキル、特に不動産・中古車・金融・医療系の生成文は**広告規制の対象**（景表法、
宅建業法の広告規制、有利誤認表示など）。生成型テンプレートには最初から以下を組み込む:

- 入力にない事実を推測で補完しない（`[要確認]` を出力に残す）
- 断定・最上級表現（「最安」「絶対」「必ず値上がり」）を禁止語として定義
- 不利な情報（修復歴・事故歴・欠点）を省略しない

これは倫理の話ではなく、**購入者が実務で使ったときに事故らない**という商品品質の話。

### 柱4: 自己採点ではなく機械検査＋実測に接続
「100点満点で自己採点」は演出としては映えるが、**モデルの自己採点は甘くなり品質保証にならない**。
本商品は以下の二段構えにする:

1. **機械チェック（自前スクリプト）**: frontmatter妥当性、SKILL.md行数、description内の
   発火語数、出力テンプレの有無、例外処理の有無 → 客観的にPASS/FAIL
2. **実測（公式 skill-creator へ橋渡し）**: with/without 比較を回して「普通のClaudeとの差」を数値化。
   ここは車輪の再発明をせず、公式の `run_eval.py` / `aggregate_benchmark.py` を呼ぶ導線を書く

---

## 3. 成果物とディレクトリ構成

```
skills/
└── japanese-skill-factory/          ← 配布する商品本体
    ├── SKILL.md                     ← 200行以内。分岐と参照だけ書く
    ├── README.md                    ← 購入者向け導入手順（3環境ぶん）
    ├── references/
    │   ├── interview.md             ← ヒアリング手順（3問ずつ・デフォルト付き）
    │   ├── skill-types.md           ← 5類型の判定フローと骨格
    │   ├── trigger-writing.md       ← 日本語descriptionの書き方・発火設計
    │   ├── quality-rubric.md        ← 診断モードの採点基準（機械チェック項目つき）
    │   ├── safety-rules.md          ← 業種別の禁止表現・法規制の注意点
    │   ├── packaging.md             ← ZIP化とインストール（Claude.ai / Claude Code / プロジェクト）
    │   ├── advanced.md              ← 上級者向け（分割設計・scripts化・eval接続）
    │   └── sales-package.md         ← 販売素材モード
    ├── templates/
    │   ├── skill-generate.md
    │   ├── skill-transform.md
    │   ├── skill-review.md
    │   ├── skill-workflow.md
    │   ├── skill-research.md
    │   ├── readme.md
    │   └── test-cases.md
    ├── examples/
    │   ├── real-estate.md           ← 不動産 物件紹介文
    │   ├── used-car.md              ← 中古車 案内文
    │   └── dev-review.md            ← 開発 コードレビュー
    └── scripts/
        ├── validate_skill.py        ← 機械チェック（単体で動く・依存なし）
        └── package_skill.py         ← ZIP化

docs/skill-factory/                  ← 商品企画側（配布物には含めない）
├── sales-copy.md                    ← 商品名・キャッチ・販売ページ原稿
├── industry-templates/              ← 業種別テンプレ（Phase3で10本）
└── release-checklist.md
```

**ドッグフーディング**: `.claude/skills/japanese-skill-factory` に配置して、この
リポジトリの作業中に自分たちで使う。使い物にならなければ売れない。

### SKILL.md の設計方針
- 本体は **200行以内**に抑え、詳細は `references/` に逃がす（progressive disclosure）
- 冒頭で**4モードの分岐**だけ判定 → 該当 reference を読みに行く
- description には日本語の発火フレーズを5つ以上埋める
  （「スキルを作りたい」「業務を自動化」「Claudeに仕事を覚えさせたい」「SKILL.mdを直して」等）

---

## 4. 4モードの仕様

| モード | 発火例 | 入口 | 出力 |
|---|---|---|---|
| A. 業務自動化 | 「営業メール作成をスキルにしたい」 | `interview.md` → `skill-types.md` | スキル一式フォルダ |
| B. 開発スキル | 「Next.js開発ルールをスキル化」 | `interview.md`（開発向け短縮版） | スキル一式＋scripts |
| C. 販売素材 | 「作ったスキルを売りたい」 | `sales-package.md` | 商品名・LP原稿・購入者README・特典案 |
| D. 診断・改善 | 「このSKILL.mdを見て」 | `quality-rubric.md` | 採点表＋書き直し済みSKILL.md |

### 初心者導線 / 上級者導線の両立（要件の核心）

同じスキルで両方を満たすため、**入口で分岐せず、深さで分岐**する。

- 既定は「かんたんモード」。3問ずつ、デフォルト付き、専門用語は使わない
  （"YAML frontmatter" ではなく「スキルの見出し情報」と言う）
- ユーザーの発言に技術的手がかり（`SKILL.md`, `references`, `eval`, `トリガー`, ファイルパス等）が
  出た時点で**自動的に上級者モードに切り替える** → 質問を減らし、`advanced.md` を読む
- 明示切替も可能: 「上級モードで」「おまかせで」の2語をトリガーとして定義

上級者向けに `advanced.md` へ入れる内容:
- context予算の考え方（本体 vs references の分割判断基準）
- 決定論的処理を `scripts/` に切り出す判断基準（同じ計算を毎回LLMにやらせない）
- 既存の CLAUDE.md / 手順書 / コードベースからスキルを**逆生成**する手順
- 既存スキルとの description 衝突チェック（過剰発火の原因）
- 公式 skill-creator の eval への接続コマンド

---

## 5. 実装フェーズ

| Phase | 内容 | 完了条件 |
|---|---|---|
| **1. コア** | `SKILL.md` / `interview.md` / `skill-types.md` / 型別テンプレ5本 / `validate_skill.py` | このスキルを使って実在業務のスキルを1本作れる |
| **2. 品質** | `quality-rubric.md` / `trigger-writing.md` / `safety-rules.md` / `advanced.md` / examples 3本 | 既存 SKILL.md を診断→改善できる。validate が PASS/FAIL を出す |
| **3. 商品化** | `README.md` / `packaging.md` / `sales-package.md` / 業種テンプレ10本 / ZIP生成 | 未経験者がREADMEだけで導入・使用できる |
| **4. 実測と改善** | 公式 eval で with/without 比較 → 弱点修正 | 「普通のClaudeとの差」を数値で提示できる |

**業種テンプレは50本ではなく、まず10本**にする。50本を先に書くと、1本あたりの精度が落ちて
全部が薄くなる。10本を実務水準で仕上げ、購入者の要望で増やすほうが商品として強い。

---

## 6. 検証方法

1. `python skills/japanese-skill-factory/scripts/validate_skill.py <生成されたスキル>` が PASS
2. 生成したスキルを `.claude/skills/` に置き、**別セッション**で発火するか確認
   （同一セッションだと文脈で動いてしまい、トリガー検証にならない）
3. 過剰発火テスト: 無関係な依頼（「今日の天気」等）で発火しないこと
4. 公式 eval: `python -m scripts.run_eval`（skill-creator ディレクトリから）で with/without 比較
5. 初心者テスト: 事前知識ゼロの想定で README のみ渡し、導入〜生成まで到達できるか

---

## 7. リスクと正直な評価

- **公式との重複**: 公式 `skill-creator` は無料で、日本語入力でも動作する。本商品の価値は
  「日本語ヒアリングの型」「5類型テンプレ」「業種別の安全規則」「販売導線」に全面的に依存する。
  ここが薄いと「公式のコピー」と評価されて終わる。
- **自己採点の限界**: 100点満点採点はUIとしては良いが、それ単体を品質保証として売ると誇大になる。
  機械チェック（客観）と実測（比較）を必ずセットにする。
- **商標表記**: 商品名に "Claude" を含める場合、Anthropic 公式製品と誤認させない表記が必要
  （「Claude用」「Claude対応」等の記載に留める）。販売前に要確認事項として残す。
- **仕様変更リスク**: Skills の仕様（frontmatter、配置場所、アップロード方法）は変わりうる。
  README に「◯年◯月時点の仕様」と明記し、更新前提の商品にする。
- **配布形態**: 生成物はテキストのみで実行コードを含まない設計にする（購入者環境で実行される
  スクリプトを同梱すると、サポート負荷と事故リスクが跳ね上がる）。`scripts/` は作成側の
  検証用に限定する。

---

## 8. 未決事項（着手前に確定したい）

1. 商品名の確定（"Claude Skill Factory" は商標配慮が必要）
2. 想定顧客の主軸 — 一般業務層 / 開発者層のどちらを主にするか（テンプレの重心が変わる）
3. 業種テンプレ10本の業種選定
4. 価格帯と特典構成（販売素材モードの出力内容に影響）
