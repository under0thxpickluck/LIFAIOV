'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Question {
  id: number;
  text: string;
  choices: Record<string, string>;
}

interface StoredDiagnosis {
  finalLabel: string;
  mainId: string;
  mainLabel: string;
  subId: string;
  subLabel: string;
  subPattern: string;
}

interface TodayFortune {
  ymd: string;
  day_theme: string;
  recommended_move: string;
  recommended_action: string;
  caution: string;
  love_fortune: string;
  work_fortune: string;
  money_fortune: string;
  crush_advice: string;
  lucky_color: string;
  lucky_item: string;
  lucky_number: number;
  luck_tip: string;
}

type View = 'loading' | 'home' | 'quiz' | 'result' | 'fortune';

// ─── Constants ────────────────────────────────────────────────────────────────
const DANGO_IMG: Record<string, string> = {
  anko: '/fortune/dango/anko.png',
  goma: '/fortune/dango/goma.png',
  kinako: '/fortune/dango/kinako.png',
  mitarashi: '/fortune/dango/mitarashi.png',
  sakura: '/fortune/dango/sakura.png',
  sanshoku: '/fortune/dango/sanshoku.png',
  yomogi: '/fortune/dango/yomogi.png',
  zunda: '/fortune/dango/zunda.png',
};

const LS_RESULT  = 'dango_result';
const LS_INSTALL = 'dango_install_id';
const LS_FORTUNE = 'dango_fortune_cache';

// ─── Server Sync Helpers ──────────────────────────────────────────────────────
function getLoginIdFromStorage(): string {
  try {
    const raw = localStorage.getItem('addval_auth_v1');
    if (raw) {
      const auth = JSON.parse(raw);
      if (auth?.id) return String(auth.id);
    }
  } catch { /* ignore */ }
  return '';
}

async function saveFortuneResultToServer(loginId: string, result: StoredDiagnosis): Promise<void> {
  try {
    await fetch('/api/fortune/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: loginId, result }),
    });
  } catch { /* サーバー保存失敗はサイレントに無視 */ }
}

async function fetchFortuneResultFromServer(loginId: string): Promise<StoredDiagnosis | null> {
  try {
    const res  = await fetch(`/api/fortune/result?userId=${encodeURIComponent(loginId)}`);
    const data = await res.json();
    if (data.ok && data.result) return data.result as StoredDiagnosis;
  } catch { /* ignore */ }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stableHash(s: string): number {
  // FNV-1a (31-bit) — matches Flutter _stableHash
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < s.length; i++) {
    h = h ^ s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    h = h & 0x7fffffff;
  }
  return h >>> 0;
}

function stableRand01(s: string): number {
  return stableHash(s) / 0x80000000;
}

function pickFromList<T>(list: T[], h: number, salt: number): T {
  return list[(h + salt) % list.length];
}

function toYmd(d: Date): string {
  const y = d.getFullYear().toString().padStart(4, '0');
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}${m}${day}`;
}

function formatYmdJa(s: string): string {
  const y = parseInt(s.slice(0, 4));
  const m = parseInt(s.slice(4, 6));
  const d = parseInt(s.slice(6, 8));
  const dt = new Date(y, m - 1, d);
  const w = ['日', '月', '火', '水', '木', '金', '土'];
  return `${y}年${m}月${d}日（${w[dt.getDay()]}）`;
}

function makeInstallId(): string {
  return 'inst_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Sub Pattern Picker (rarity) ─────────────────────────────────────────────
function pickWeighted(items: Array<{ id: string; p: number }>, r01: number): { id: string } {
  let acc = 0;
  for (const it of items) {
    acc += it.p;
    if (r01 <= acc) return it;
  }
  return items[items.length - 1];
}

function pickSubLabel(
  pattern: string,
  mode: 'single' | 'pair',
  userSeed: string,
  config: any,
): { subPattern: string; subId: string; subLabel: string } {
  const rarity = config.rarity;
  const overrides = rarity.rarity_overrides;
  const r = stableRand01(`${userSeed}|sub|${pattern}|${config.version}`);

  if (mode === 'single') {
    const o = overrides?.single?.[pattern];
    const single = config.types.sub.single[pattern];
    const base = single.base;
    const rare: any[] = single.rare;

    if (o) {
      const baseP = o.base as number;
      if (r < baseP) {
        return { subPattern: pattern, subId: base.id, subLabel: base.label };
      }
      const rr = (r - baseP) / (1.0 - baseP);
      const picked = pickWeighted(o.rare, rr);
      const match = rare.find((x: any) => x.id === picked.id);
      return { subPattern: pattern, subId: match.id, subLabel: match.label };
    }

    const baseProb = rarity.sub.single_base_prob as number;
    if (r < baseProb) {
      return { subPattern: pattern, subId: base.id, subLabel: base.label };
    }
    const idx = Math.max(0, Math.min(rare.length - 1, Math.floor(((r - baseProb) / (1.0 - baseProb)) * rare.length)));
    return { subPattern: pattern, subId: rare[idx].id, subLabel: rare[idx].label };
  }

  // pair
  const o = overrides?.pairs?.[pattern];
  const pair = config.types.sub.pairs[pattern];
  const base = pair.base;
  const rare: any[] = pair.rare;

  if (o) {
    const baseP = o.base as number;
    if (r < baseP) {
      return { subPattern: pattern, subId: base.id, subLabel: base.label };
    }
    const rr = (r - baseP) / (1.0 - baseP);
    const picked = pickWeighted(o.rare, rr);
    const match = rare.find((x: any) => x.id === picked.id);
    return { subPattern: pattern, subId: match.id, subLabel: match.label };
  }

  const baseProb = rarity.sub.pair_base_prob as number;
  if (r < baseProb) {
    return { subPattern: pattern, subId: base.id, subLabel: base.label };
  }
  const idx = Math.max(0, Math.min(rare.length - 1, Math.floor(((r - baseProb) / (1.0 - baseProb)) * rare.length)));
  return { subPattern: pattern, subId: rare[idx].id, subLabel: rare[idx].label };
}

// ─── Diagnosis Engine ─────────────────────────────────────────────────────────
function runDiagnosis(
  answers: Record<number, string>,
  installId: string,
  config: any,
): StoredDiagnosis {
  // MAIN: Q11-20 (score-based)
  const mainTypes: Array<{ id: string; label: string }> = config.types.main;
  const scores: Record<string, number> = {};
  mainTypes.forEach(t => { scores[t.id] = 0; });

  const mainCfg = config.scoring.main;
  for (const q of mainCfg.questions) {
    const pick = answers[q.id];
    if (!pick) continue;
    const choice = q.choices[pick];
    if (!choice) continue;
    for (const [k, v] of Object.entries(choice.add as Record<string, number>)) {
      scores[k] = (scores[k] ?? 0) + v;
    }
  }

  const priority: string[] = mainCfg.tie_break_priority;
  const sorted = Object.entries(scores).sort((a, b) => {
    const diff = b[1] - a[1];
    if (diff !== 0) return diff;
    return priority.indexOf(a[0]) - priority.indexOf(b[0]);
  });
  const mainId = sorted[0][0];
  const mainLabel = mainTypes.find(t => t.id === mainId)!.label;

  // SUB: Q1-10 (A/B/C/D count)
  let a = 0, b = 0, c = 0, d = 0;
  for (let qid = 1; qid <= 10; qid++) {
    const pick = answers[qid];
    if (pick === 'A') a++;
    else if (pick === 'B') b++;
    else if (pick === 'C') c++;
    else if (pick === 'D') d++;
  }

  const pairs = [{ k: 'A', s: a }, { k: 'B', s: b }, { k: 'C', s: c }, { k: 'D', s: d }]
    .sort((x, y) => y.s - x.s);
  const key1 = pairs[0].k, s1 = pairs[0].s;
  const key2 = pairs[1].k, s2 = pairs[1].s;
  const key3 = pairs[2].k, s3 = pairs[2].s;

  const subRules = config.scoring.sub.pattern_rules;
  let sub: { subPattern: string; subId: string; subLabel: string } | null = null;

  // 1) tri_ex
  const tri = subRules.tri_ex;
  if (!sub && tri?.enabled) {
    const top3Ok =
      s1 >= tri.top3_min && s1 <= tri.top3_max &&
      s2 >= tri.top3_min && s2 <= tri.top3_max &&
      s3 >= tri.top3_min && s3 <= tri.top3_max;
    const diffOk = (s1 - s3) <= tri.s1_minus_s3_max;
    const sumOk = (s1 + s2 + s3) >= tri.top3_sum_min;
    if (top3Ok && diffOk && sumOk) {
      const triKey = [key1, key2, key3].sort().join('');
      const triMap = config.types.sub.tri_ex?.[triKey];
      if (triMap) {
        sub = { subPattern: triKey, subId: triMap.id, subLabel: triMap.label };
      }
    }
  }

  // 2) single
  if (!sub) {
    const single = subRules.single;
    let isSingle = false;
    if (single?.enabled) {
      for (const r of single.rule_any_of) {
        if (s1 >= r.s1_min && (s1 - s2) >= r.s1_minus_s2_min) {
          isSingle = true;
          break;
        }
      }
    }
    if (isSingle) {
      sub = pickSubLabel(key1, 'single', installId, config);
    }
  }

  // 3) pair (fallback)
  if (!sub) {
    const pairKey = [key1, key2].sort().join('');
    sub = pickSubLabel(pairKey, 'pair', installId, config);
  }

  return {
    finalLabel: `${sub.subLabel}${mainLabel}タイプ`,
    mainId,
    mainLabel,
    subId: sub.subId,
    subLabel: sub.subLabel,
    subPattern: sub.subPattern,
  };
}

// ─── Daily Fortune ────────────────────────────────────────────────────────────
function calcTodayFortune(
  stored: StoredDiagnosis,
  installId: string,
  fortuneJson: any,
  todayYmd: string,
): TodayFortune {
  const seed = `${installId}|${todayYmd}|${stored.mainId}|${stored.subId}|${stored.subPattern}`;
  const h = stableHash(seed);

  const mainBlock = fortuneJson.by_main?.[stored.mainId] ?? fortuneJson.by_main?.['anko'];
  const subBlock  = fortuneJson.by_sub_pattern?.[stored.subPattern] ?? fortuneJson.by_sub_pattern?.['A'];

  const fromMain = (key: string): string[] => (mainBlock[key] as any[]).map(e => String(e));
  const fromSub  = (key: string): string[] => (subBlock[key] as any[]).map(e => String(e));
  const luckyNumbers = (subBlock['lucky_number'] as any[]).map(e => parseInt(String(e)));

  return {
    ymd:               todayYmd,
    recommended_move:  pickFromList(fromMain('recommended_move'),  h, 7),
    day_theme:         pickFromList(fromMain('day_theme'),          h, 11),
    recommended_action:pickFromList(fromMain('recommended_action'), h, 29),
    caution:           pickFromList(fromMain('caution'),            h, 53),
    love_fortune:      pickFromList(fromMain('love_fortune'),       h, 97),
    work_fortune:      pickFromList(fromMain('work_fortune'),       h, 131),
    money_fortune:     pickFromList(fromMain('money_fortune'),      h, 173),
    crush_advice:      pickFromList(fromMain('crush_advice'),       h, 199),
    lucky_color:       pickFromList(fromSub('lucky_color'),         h, 223),
    lucky_item:        pickFromList(fromSub('lucky_item'),          h, 251),
    lucky_number:      pickFromList(luckyNumbers,                   h, 277),
    luck_tip:          pickFromList(fromMain('luck_tip'),           h, 307),
  };
}

// ─── Diagnosis Detail Text ────────────────────────────────────────────────────
function buildDiagnosisDetail(mainId: string, subId: string, mainJson: any, subJson: any): string {
  const main = mainJson?.main_types?.[mainId];
  const sub  = subJson?.sub_types?.[subId];
  if (!main || !sub) return `診断データが見つかりませんでした。mainId=${mainId} / subId=${subId}`;

  const toLines = (v: any): string =>
    Array.isArray(v) ? v.map((e: any) => `・${e}`).join('\n') : '';

  const parts: string[] = [
    '■ あなたはこんな性格',
    main.core ?? '',
    '',
    '■ 恋をしたらこんな風になる',
    toLines(main.love_pattern),
    '',
    '■ あなたの人より強いところ',
    toLines(main.strength),
    '',
    '■ 気をつけなきゃいけないところ',
    toLines(main.weakness),
  ];

  if (main.pitfall) parts.push('', '■ 落とし穴', main.pitfall);
  parts.push('', '■ 恋が始まるときはこんな感じ', sub.nuance ?? '');
  if (sub.tone_tags?.length)  parts.push('', '■ あなたを一言で表すなら',     toLines(sub.tone_tags));
  if (main.best_match?.length) parts.push('', '■ あなたと相性がいいタイプ', toLines(main.best_match));

  return parts.join('\n');
}

// ─── UI Components ────────────────────────────────────────────────────────────
function SectionCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-sm font-bold text-pink-400 mb-1">{title}</p>
      <p className="text-sm text-white/80 leading-relaxed">{body}</p>
    </div>
  );
}

function DangoImage({ mainId, className }: { mainId: string; className?: string }) {
  const src = DANGO_IMG[mainId];
  if (!src) return <span className="text-5xl">🍡</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={mainId}
      className={className}
      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FortunePage() {
  const [view, setView] = useState<View>('loading');

  // JSON data
  const [questions,   setQuestions]   = useState<Question[]>([]);
  const [diagConfig,  setDiagConfig]  = useState<any>(null);
  const [fortuneJson, setFortuneJson] = useState<any>(null);
  const [mainJson,    setMainJson]    = useState<any>(null);
  const [subJson,     setSubJson]     = useState<any>(null);

  // User state
  const [installId, setInstallId] = useState('');
  const [stored,    setStored]    = useState<StoredDiagnosis | null>(null);

  // View state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizIdx,     setQuizIdx]     = useState(0);
  const [displayDiag, setDisplayDiag] = useState<StoredDiagnosis | null>(null);
  const [fortune,     setFortune]     = useState<TodayFortune | null>(null);

  // BP toast
  const [adDiag,      setAdDiag]      = useState<StoredDiagnosis | null>(null);
  const [toast,       setToast]       = useState<string | null>(null);

  // ── Load all data on mount ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [qData, cfgData, fData, mData, sData] = await Promise.all([
        fetch('/fortune/config/questions.json').then(r => r.json()),
        fetch('/fortune/config/diagnosis_config.json').then(r => r.json()),
        fetch('/fortune/config/fortune_daily.json').then(r => r.json()),
        fetch('/fortune/config/personality_main.json').then(r => r.json()),
        fetch('/fortune/config/personality_sub.json').then(r => r.json()),
      ]);

      const qs: Question[] = (Array.isArray(qData) ? qData : qData.questions)
        .map((q: any) => ({ id: q.id, text: q.text, choices: q.choices }))
        .sort((a: Question, b: Question) => a.id - b.id);

      setQuestions(qs);
      setDiagConfig(cfgData);
      setFortuneJson(fData);
      setMainJson(mData);
      setSubJson(sData);

      // Install ID
      let id = localStorage.getItem(LS_INSTALL);
      if (!id) {
        id = makeInstallId();
        localStorage.setItem(LS_INSTALL, id);
      }
      setInstallId(id);

      // Stored diagnosis — localStorage を即時表示してからサーバーマージ
      let localDiag: StoredDiagnosis | null = null;
      try {
        const raw = localStorage.getItem(LS_RESULT);
        if (raw) localDiag = JSON.parse(raw);
      } catch { /* ignore */ }
      if (localDiag) setStored(localDiag);

      setView('home');

      // サーバーから取得してマージ（loginId があれば）
      const loginId = getLoginIdFromStorage();
      if (loginId) {
        fetchFortuneResultFromServer(loginId).then((serverResult) => {
          if (serverResult) {
            localStorage.setItem(LS_RESULT, JSON.stringify(serverResult));
            setStored(serverResult);
          }
        }).catch(() => {});
      }
    })();
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  function startQuiz() {
    setQuizAnswers({});
    setQuizIdx(0);
    setView('quiz');
  }

  function pickAnswer(key: string) {
    const q = questions[quizIdx];
    const newAnswers = { ...quizAnswers, [q.id]: key };
    setQuizAnswers(newAnswers);

    if (quizIdx < questions.length - 1) {
      setQuizIdx(quizIdx + 1);
      return;
    }

    // All answered — run diagnosis
    const r = runDiagnosis(newAnswers, installId, diagConfig);
    localStorage.setItem(LS_RESULT, JSON.stringify(r));
    setStored(r);
    setDisplayDiag(r);
    setView('result');
    const lid = getLoginIdFromStorage();
    if (lid) saveFortuneResultToServer(lid, r).catch(() => {});
  }

  // openFortune: compute fortune data, show fortune view, grant BP
  async function openFortune(s: StoredDiagnosis) {
    const todayYmd = toYmd(new Date());
    let cached: TodayFortune | null = null;
    try {
      const raw = localStorage.getItem(LS_FORTUNE);
      if (raw) {
        const p: TodayFortune = JSON.parse(raw);
        if (p.ymd === todayYmd) cached = p;
      }
    } catch { /* ignore */ }

    const f = cached ?? (() => {
      const newF = calcTodayFortune(s, installId, fortuneJson, todayYmd);
      localStorage.setItem(LS_FORTUNE, JSON.stringify(newF));
      return newF;
    })();

    setFortune(f);
    setAdDiag(s);
    setView('fortune');

    // BP grant — loginId は addval_auth_v1 の id フィールドから取得
    let loginId: string | null = null;
    try {
      const raw = localStorage.getItem('addval_auth_v1');
      if (raw) {
        const auth = JSON.parse(raw);
        if (auth?.id) loginId = String(auth.id);
      }
    } catch { /* ignore */ }

    if (loginId) {
      try {
        const res  = await fetch('/api/missions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginId, mission_type: 'fortune' }),
        });
        const data = await res.json();
        if (data.ok) {
          setToast(`+${data.bp_earned}BP獲得！`);
          setTimeout(() => setToast(null), 3000);
        }
        // already_claimed → silently ignore
      } catch { /* ignore */ }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const header = (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-white/10">
      <Link href="/top" className="text-sm text-white/50 hover:text-white transition-colors">
        ← ダッシュボードに戻る
      </Link>
      <span className="text-white font-bold">団子占い 🍡</span>
    </div>
  );

  const diag = displayDiag ?? stored;

  return (
    <div className="min-h-screen bg-black text-white">

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {view === 'loading' && (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="text-white/60">読み込み中…</p>
        </div>
      )}

      {/* ── Home ────────────────────────────────────────────────────────── */}
      {view === 'home' && (
        <>
          {header}
          <div className="max-w-md mx-auto px-4 py-10 flex flex-col items-center gap-6">
            <h1 className="text-3xl font-bold tracking-tight">あなだん</h1>
            <p className="text-white/40 text-sm text-center">
              20問の性格診断で、あなたの「団子タイプ」を見つけよう
            </p>

            {stored ? (
              <>
                <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-4 items-center">
                  <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center bg-white/5 rounded-xl overflow-hidden">
                    <DangoImage mainId={stored.mainId} className="w-full h-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-lg leading-snug">{stored.finalLabel}</p>
                    <p className="text-sm text-white/40 mt-1 truncate">
                      メイン: {stored.mainLabel} / サブ: {stored.subLabel}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => openFortune(stored)}
                  className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  今日の占いへ 🔮
                </button>

                <p className="text-white/30 text-xs text-center">
                  あなたの性格診断は確定済み。毎日の運勢を見よう。
                </p>

                <button
                  onClick={() => { setDisplayDiag(stored); setView('result'); }}
                  className="text-sm text-white/40 hover:text-white/70 transition-colors border border-white/10 rounded-lg px-4 py-2"
                >
                  診断結果を見る 🍡
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={startQuiz}
                  className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  診断をはじめる 🍡
                </button>
                <p className="text-white/30 text-xs text-center">
                  まずは20問の性格診断でタイプを決めよう。
                </p>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Quiz ────────────────────────────────────────────────────────── */}
      {view === 'quiz' && questions.length > 0 && (
        <>
          {header}
          <div className="max-w-md mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/40">診断中</span>
              <span className="text-sm font-bold text-pink-400">{quizIdx + 1} / {questions.length}</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1 mb-8">
              <div
                className="bg-pink-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${((quizIdx + 1) / questions.length) * 100}%` }}
              />
            </div>

            <p className="text-lg font-bold mb-8 leading-relaxed">{questions[quizIdx].text}</p>

            <div className="flex flex-col gap-3">
              {(['A', 'B', 'C', 'D'] as const).map(key => (
                <button
                  key={key}
                  onClick={() => pickAnswer(key)}
                  className="w-full text-left bg-white/5 hover:bg-pink-600/20 border border-white/10 hover:border-pink-500/50 rounded-xl px-4 py-3 transition-all"
                >
                  <span className="text-pink-400 font-bold mr-2">{key}.</span>
                  <span className="text-white/90">{questions[quizIdx].choices[key]}</span>
                </button>
              ))}
            </div>

            {quizIdx > 0 && (
              <button
                onClick={() => setQuizIdx(quizIdx - 1)}
                className="mt-6 text-sm text-white/30 hover:text-white/60 transition-colors"
              >
                ← ひとつ戻る
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Result ──────────────────────────────────────────────────────── */}
      {view === 'result' && diag && (
        <>
          {header}
          <div className="max-w-md mx-auto px-4 py-8">
            <h2 className="text-2xl font-bold mb-4">{diag.finalLabel}</h2>

            <div className="w-full bg-white/5 rounded-2xl overflow-hidden flex items-center justify-center h-52 mb-4">
              <DangoImage mainId={diag.mainId} className="h-full object-contain" />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
              <p className="text-sm font-bold text-pink-400 mb-3">恋愛分析レポート</p>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">
                {buildDiagnosisDetail(diag.mainId, diag.subId, mainJson, subJson)}
              </p>
            </div>

            <button
              onClick={() => openFortune(diag)}
              className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-3 rounded-xl transition-colors mb-3"
            >
              占いに進む 🔮
            </button>

            <button
              onClick={() => setView('home')}
              className="w-full bg-white/5 hover:bg-white/10 text-white/50 py-3 rounded-xl transition-colors"
            >
              ホームに戻る
            </button>
          </div>
        </>
      )}

      {/* ── Fortune ─────────────────────────────────────────────────────── */}
      {view === 'fortune' && fortune && (
        <>
          {header}
          <div className="max-w-md mx-auto px-4 py-8">
            <h2 className="text-xl font-bold">今日の運勢</h2>
            <p className="text-white/30 text-xs mt-1 mb-1">{formatYmdJa(fortune.ymd)}</p>
            {(adDiag ?? diag) && (
              <p className="text-base font-bold text-pink-400 mb-6">{(adDiag ?? diag)!.finalLabel}</p>
            )}

            <div className="flex flex-col gap-3">
              {([
                { title: 'こんな行動がおすすめ！',      body: fortune.recommended_move   },
                { title: '今日はこんな日になるかも',    body: fortune.day_theme          },
                { title: 'おすすめ行動！',              body: fortune.recommended_action },
                { title: 'これに注意！',                body: fortune.caution            },
                { title: '恋愛運',                      body: fortune.love_fortune       },
                { title: '仕事運',                      body: fortune.work_fortune       },
                { title: '金運',                        body: fortune.money_fortune      },
                { title: '気になるあの人に対して',      body: fortune.crush_advice       },
                { title: 'ラッキーカラー',              body: fortune.lucky_color        },
                { title: 'ラッキーアイテム',            body: fortune.lucky_item         },
                { title: 'ラッキーナンバー',            body: String(fortune.lucky_number) },
                { title: '運気上昇のコツ',              body: fortune.luck_tip           },
              ] as { title: string; body: string }[]).map(({ title, body }) => (
                <SectionCard key={title} title={title} body={body} />
              ))}
            </div>

            <button
              onClick={() => setView('result')}
              className="mt-6 w-full bg-white/5 hover:bg-white/10 text-white/50 py-3 rounded-xl transition-colors"
            >
              診断結果へ戻る
            </button>
          </div>
        </>
      )}

      {/* ── BP Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-black font-bold rounded-full px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
