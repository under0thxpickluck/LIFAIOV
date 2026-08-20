import { POST } from '@/app/api/image/jacket/route'
import { NextRequest } from 'next/server'

jest.mock('@/app/lib/image/image_client', () => ({
  generateImage: jest.fn(async () => 'https://cdn.example.com/jacket.png'),
}))

global.fetch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  process.env.GAS_WEBAPP_URL = 'https://example.com/gas'
  process.env.GAS_API_KEY = 'gas-key'
})

afterEach(() => {
  delete process.env.GAS_WEBAPP_URL
  delete process.env.GAS_API_KEY
})

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/image/jacket', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const VALID_BODY = {
  id: 'u001',
  code: 'pass',
  jobId: 'JOB-1',
  theme: '海',
  genre: 'ポップ',
  mood: 'さわやか',
  title: 'テスト曲',
}

// fetch呼び出し順: [0] get_balance → [1] bp_lock → [2] bp_commit → [3] image_log
function mockGasUpToCommit() {
  ;(global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, bp: 100000 }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, lock_id: 'LK-1' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
}

test('image_log が失敗してもジャケット生成は成功として返る', async () => {
  mockGasUpToCommit()
  // image_log だけ落とす（GAS応答遅延・エラー時にレスポンス全体を巻き込まないこと）
  ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('gas timeout'))

  const res = await POST(makeRequest(VALID_BODY))

  expect(res.status).toBe(200)
  const json = await res.json()
  expect(json.ok).toBe(true)
  expect(json.imageUrl).toBe('https://cdn.example.com/jacket.png')
})

test('image_log は BP確定より後に呼ばれる', async () => {
  mockGasUpToCommit()
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

  await POST(makeRequest(VALID_BODY))

  const actions = (global.fetch as jest.Mock).mock.calls.map(
    (c) => JSON.parse(c[1].body).action
  )
  expect(actions).toEqual(['get_balance', 'bp_lock', 'bp_commit', 'image_log'])
})
