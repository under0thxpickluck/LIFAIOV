import { POST } from '@/app/api/bgm/generate/route'
import { NextRequest } from 'next/server'

global.fetch = jest.fn()

const savedOpenaiKey = process.env.OPENAI_API_KEY

beforeEach(() => {
  jest.clearAllMocks()
  process.env.REPLICATE_API_TOKEN = 'test-token'
  process.env.GAS_WEBAPP_URL = 'https://example.com/gas'
  process.env.GAS_API_KEY = 'gas-key'
  process.env.GAS_ADMIN_KEY = 'gas-admin-key'
  // OPENAI_API_KEYがあると雰囲気生成のfetchが挟まり呼び出し順が変わるため無効化
  delete process.env.OPENAI_API_KEY
})

afterEach(() => {
  delete process.env.REPLICATE_API_TOKEN
  delete process.env.GAS_WEBAPP_URL
  delete process.env.GAS_API_KEY
  delete process.env.GAS_ADMIN_KEY
  if (savedOpenaiKey !== undefined) process.env.OPENAI_API_KEY = savedOpenaiKey
})

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/bgm/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// fetch呼び出し順: [0] get_balance → [1] deduct_bp → [2] Replicate
function mockHappyGasCalls(bp = 1000) {
  ;(global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, bp }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
}

test('REPLICATE_API_TOKEN未設定なら500', async () => {
  delete process.env.REPLICATE_API_TOKEN
  const res = await POST(makeRequest({ id: 'demo', code: 'pass', theme: 'test', genre: 'ポップ', mood: 'さわやか', duration: 30 }))
  expect(res.status).toBe(500)
  const json = await res.json()
  expect(json.ok).toBe(false)
})

test('id/codeが無ければ401', async () => {
  const res = await POST(makeRequest({ id: 'demo', theme: 'test', genre: 'ポップ', mood: 'さわやか', duration: 30 }))
  expect(res.status).toBe(401)
  const json = await res.json()
  expect(json.ok).toBe(false)
  expect(global.fetch).not.toHaveBeenCalled()
})

test('BP不足なら400', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ok: true, bp: 10 }),
  })
  const res = await POST(makeRequest({ id: 'demo', code: 'pass', theme: 'test', genre: 'ポップ', mood: 'さわやか', duration: 30 }))
  expect(res.status).toBe(400)
  const json = await res.json()
  expect(json.error).toBe('insufficient_bp')
})

test('正常: predictionId を返す', async () => {
  mockHappyGasCalls()
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: 'pred-abc123', status: 'starting' }),
  })
  const res = await POST(makeRequest({ id: 'demo', code: 'pass', theme: '朝の森', genre: 'クラシック', mood: '落ち着いた', duration: 60 }))
  expect(res.status).toBe(200)
  const json = await res.json()
  expect(json.ok).toBe(true)
  expect(json.predictionId).toBe('pred-abc123')
  expect(json.bpUsed).toBe(288)
})

test('Replicate APIエラーなら502', async () => {
  mockHappyGasCalls()
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status: 422,
    json: async () => ({ detail: 'invalid input' }),
  })
  const res = await POST(makeRequest({ id: 'demo', code: 'pass', theme: 'test', genre: 'ポップ', mood: 'さわやか', duration: 30 }))
  expect(res.status).toBe(502)
  const json = await res.json()
  expect(json.ok).toBe(false)
})

test('プロンプトにinstrumental onlyが含まれる', async () => {
  mockHappyGasCalls()
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: 'pred-xyz', status: 'starting' }),
  })
  await POST(makeRequest({ id: 'demo', code: 'pass', theme: 'カフェ', genre: 'ジャズ', mood: 'クール', duration: 30, bpm: 90 }))
  const replicateCall = (global.fetch as jest.Mock).mock.calls[2]
  expect(replicateCall[0]).toBe('https://api.replicate.com/v1/predictions')
  const callBody = JSON.parse(replicateCall[1].body)
  expect(callBody.input.prompt).toContain('instrumental only')
  expect(callBody.input.prompt).toContain('no vocals')
  expect(callBody.input.prompt).toContain('exactly 90 BPM')
})
