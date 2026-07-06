import { POST } from '@/app/api/note/generate/route'
import { NextRequest } from 'next/server'
import { BP_COSTS } from '@/app/lib/bp-config'

global.fetch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  process.env.GAS_WEBAPP_URL = 'https://example.com/gas'
  process.env.GAS_API_KEY = 'gas-key'
  process.env.GAS_ADMIN_KEY = 'gas-admin-key'
})

afterEach(() => {
  delete process.env.GAS_WEBAPP_URL
  delete process.env.GAS_API_KEY
  delete process.env.GAS_ADMIN_KEY
})

const validBody = {
  plan_id: 'plan_1',
  selected_title: 'タイトル',
  outline: [{ heading: 'h', purpose: 'p', target_length: 100 }],
  tone: 'note売れ筋風',
  length: 8000,
  paywall_mode: 'intro_free_main_paid',
}

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/note/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// 認証・BP課金は OpenAI 呼び出しより前に短絡するため、これらのパスは fetch(GAS) のみで検証可能。

test('必須パラメータ不足なら400', async () => {
  const res = await POST(makeRequest({ plan_id: 'plan_1', loginId: 'u1' }))
  expect(res.status).toBe(400)
  expect(global.fetch).not.toHaveBeenCalled()
})

test('loginId が無ければ401相当(400 loginId_required)・GAS未呼び出し', async () => {
  const res = await POST(makeRequest(validBody))
  expect(res.status).toBe(400)
  const json = await res.json()
  expect(json.error).toBe('loginId_required')
  expect(global.fetch).not.toHaveBeenCalled()
})

test('GAS env 未設定なら500', async () => {
  delete process.env.GAS_ADMIN_KEY
  const res = await POST(makeRequest({ ...validBody, loginId: 'u1' }))
  expect(res.status).toBe(500)
  const json = await res.json()
  expect(json.error).toBe('env_missing')
  expect(global.fetch).not.toHaveBeenCalled()
})

test('BP不足なら402・note_full 額で deduct_bp を要求', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ok: false, error: 'insufficient_bp', bp_balance: 5 }),
  })
  const res = await POST(makeRequest({ ...validBody, loginId: 'u1' }))
  expect(res.status).toBe(402)
  const json = await res.json()
  expect(json.error).toBe('insufficient_bp')
  expect(json.bp_balance).toBe(5)
  // deduct_bp が note_full 額・正しい loginId で呼ばれている
  const gasBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
  expect(gasBody.action).toBe('deduct_bp')
  expect(gasBody.amount).toBe(BP_COSTS.note_full)
  expect(gasBody.loginId).toBe('u1')
})

test('GAS到達不能なら502', async () => {
  ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))
  const res = await POST(makeRequest({ ...validBody, loginId: 'u1' }))
  expect(res.status).toBe(502)
  const json = await res.json()
  expect(json.error).toBe('bp_deduct_failed')
})
