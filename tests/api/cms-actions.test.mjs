import { onRequestPost } from '../../functions/api/create-post.js'

const env = {
  ADMIN_PASSWORD: 'test-admin-password',
  GITHUB_TOKEN: 'test-github-token',
  GITHUB_OWNER: 'testowner',
  GITHUB_REPO: 'testrepo',
  GITHUB_BRANCH: 'master',
}

const failures = []
function assert(cond, msg) {
  if (!cond) failures.push(msg)
}

async function testListAction() {
  const mockFiles = [
    { name: 'post-1-uz.mdx', path: 'src/content/blog/post-1-uz.mdx', sha: 'sha1', size: 100 },
    { name: 'post-2-uz.mdx', path: 'src/content/blog/post-2-uz.mdx', sha: 'sha2', size: 200 },
    { name: 'other.txt', path: 'src/content/blog/other.txt', sha: 'sha3', size: 50 },
  ]

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    return new Response(JSON.stringify(mockFiles), { status: 200 })
  }

  try {
    const res = await onRequestPost({
      request: new Request('https://snaxlab.blog/api/create-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-admin-password', action: 'list' }),
      }),
      env,
    })
    assert(res.status === 200, 'list action should return 200')
    const body = await res.json()
    assert(body.ok === true, 'list action should return ok: true')
    assert(body.posts.length === 2, 'list action should only return .mdx/.md files')
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function testGetActionPathTraversal() {
  const res = await onRequestPost({
    request: new Request('https://snaxlab.blog/api/create-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test-admin-password', action: 'get', path: 'src/content/blog/../../secrets.env' }),
    }),
    env,
  })
  assert(res.status === 400, 'path traversal must return 400')
}

async function testDeleteActionValidation() {
  const res = await onRequestPost({
    request: new Request('https://snaxlab.blog/api/create-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test-admin-password', action: 'delete', path: 'invalid/path' }),
    }),
    env,
  })
  assert(res.status === 400, 'delete with invalid path must return 400')
}

await testListAction()
await testGetActionPathTraversal()
await testDeleteActionValidation()

if (failures.length > 0) {
  console.error('CMS Actions test failures:\n' + failures.join('\n'))
  process.exit(1)
} else {
  console.log('CMS Actions tests passed successfully!')
}
