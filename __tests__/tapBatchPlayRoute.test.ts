/**
 * タップの入口の検査。
 *
 * ここで見るのは「GAS へ渡す前に弾けているか」。時間帯プールや
 * 残高の計算そのものは GAS 側にあるため、このテストの範囲外。
 * 逆に言うと、ここを抜けた値はすべて GAS が受け取る。
 */
/* ルートは読み込んだ時点で GAS_WEBAPP_URL を取る。import 文は巻き上げ
   られるので、beforeEach で環境変数を入れても間に合わない。
   環境変数を設定してから、動的に読み込む。 */
let POST: (req: Request) => Promise<Response>

global.fetch = jest.fn()

beforeAll(async () => {
  process.env.GAS_WEBAPP_URL = 'https://example.com/gas'
  process.env.GAS_API_KEY = 'gas-key'
  ;({ POST } = await import('@/app/api/minigames/tap/batch-play/route'))
})

beforeEach(() => {
  jest.clearAllMocks()
  ;(global.fetch as jest.Mock).mockResolvedValue({
    json: async () => ({ ok: true, processedTapCount: 1 }),
  })
})

function req(body: unknown) {
  return new Request('http://localhost/api/minigames/tap/batch-play', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const valid = {
  userId: 'u001',
  code: 'secret',
  batchId: 'batch-1',
  tapCount: 10,
}

describe('tap batch-play の入口', () => {
  it('揃っていれば GAS へ渡す', async () => {
    const res = await POST(req(valid))
    expect(res.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  /* 以前は userId をそのまま信じていたので、他人のIDを指定すれば
     その人のBPを減らせた。code を必須にして入口で止める。 */
  it('code が無ければ 401 で、GAS を呼ばない', async () => {
    const { code, ...noCode } = valid
    void code
    const res = await POST(req(noCode))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'authentication_required' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('userId が無ければ 400', async () => {
    const { userId, ...noUser } = valid
    void userId
    expect((await POST(req(noUser))).status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  /* batchId が無いと、再送を見分けられず二重に消費される。 */
  it('batchId が無ければ 400', async () => {
    const { batchId, ...noBatch } = valid
    void batchId
    const res = await POST(req(noBatch))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'batchId_required' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['0回', 0],
    ['負数', -5],
    ['小数', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['文字列', '10'],
    ['1バッチの上限50超', 51],
  ])('tapCount が %s なら 400 で、GAS を呼ばない', async (_label, tapCount) => {
    const res = await POST(req({ ...valid, tapCount }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'invalid_tap_count' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('ちょうど50回は通す', async () => {
    const res = await POST(req({ ...valid, tapCount: 50 }))
    expect(res.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('壊れたJSONは 400', async () => {
    const bad = new Request('http://localhost/api/minigames/tap/batch-play', {
      method: 'POST',
      body: '{',
      headers: { 'Content-Type': 'application/json' },
    })
    expect((await POST(bad)).status).toBe(400)
  })

  it('code と batchId を GAS へそのまま渡す', async () => {
    await POST(req(valid))
    const sent = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(sent).toMatchObject({
      action: 'tap_batch_play',
      userId: 'u001',
      code: 'secret',
      batchId: 'batch-1',
      tapCount: 10,
    })
  })
})
