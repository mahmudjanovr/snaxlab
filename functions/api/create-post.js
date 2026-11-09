const LIMITS = {
  title: 120,
  description: 240,
  body: 200000,
  tags: 12,
  authors: 6,
  slug: 80,
  item: 48,
}

const GITHUB_API_VERSION = '2022-11-28'

export async function onRequestPost(context) {
  const origin = context.request.headers.get('origin')
  if (origin) {
    let requestOrigin
    try {
      requestOrigin = new URL(context.request.url).origin
    } catch {
      return json({ error: 'Invalid request URL.' }, 400)
    }

    const allowedOrigins = new Set([requestOrigin])
    const env = context.env || {}
    const siteUrl = env.SITE_URL || env.URL
    if (siteUrl) {
      try {
        allowedOrigins.add(new URL(siteUrl).origin)
      } catch {}
    }

    if (!allowedOrigins.has(origin)) {
      return json({ error: 'Forbidden origin.' }, 403)
    }
  }

  const contentLengthHeader = context.request.headers.get('content-length')
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10)
    if (Number.isFinite(contentLength) && contentLength > 300000) {
      return json({ error: 'Request body is too large.' }, 413)
    }
  }

  let payload

  try {
    payload = await context.request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ error: 'Invalid request.' }, 400)
  }

  const env = context.env || {}
  const adminPassword = env.ADMIN_PASSWORD
  const githubToken = env.GITHUB_TOKEN
  const owner = String(env.GITHUB_OWNER || '').trim()
  const repo = String(env.GITHUB_REPO || '').trim()
  const branch = String(env.GITHUB_BRANCH || 'master').trim() || 'master'

  if (!adminPassword || !githubToken || !owner || !repo) {
    return json(
      { error: 'Server is missing required environment variables.' },
      500,
    )
  }

  const providedPassword =
    typeof payload.password === 'string' ? payload.password : ''

  if (!providedPassword) {
    return json({ error: 'Admin password is required.' }, 400)
  }

  const passwordOk = await passwordsMatch(providedPassword, adminPassword)
  if (!passwordOk) {
    // Modest delay on failed authentication to slow automated guessing without excessive execution time
    await new Promise((resolve) => setTimeout(resolve, 250))
    return json({ error: 'Wrong admin password.' }, 401)
  }

  const githubHeaders = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': 'snaxlab-admin',
  }

  const action = typeof payload.action === 'string' ? payload.action.trim() : 'create'

  // ACTION: List existing posts
  if (action === 'list') {
    try {
      const listRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/src/content/blog?ref=${encodeURIComponent(branch)}`,
        { method: 'GET', headers: githubHeaders },
      )
      if (!listRes.ok) {
        return json({ error: 'GitHub API could not list posts.' }, listRes.status)
      }
      const files = await listRes.json()
      const posts = Array.isArray(files)
        ? files
            .filter((f) => f.name.endsWith('.mdx') || f.name.endsWith('.md'))
            .map((f) => ({
              name: f.name,
              path: f.path,
              sha: f.sha,
              size: f.size,
            }))
        : []
      return json({ ok: true, posts })
    } catch {
      return json({ error: 'Failed to fetch post list.' }, 500)
    }
  }

  // ACTION: Get single post content and SHA
  if (action === 'get') {
    const filePath = typeof payload.path === 'string' ? payload.path.trim() : ''
    if (!filePath.startsWith('src/content/blog/') || filePath.includes('..')) {
      return json({ error: 'Invalid file path.' }, 400)
    }
    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(filePath)}?ref=${encodeURIComponent(branch)}`,
        { method: 'GET', headers: githubHeaders },
      )
      if (!getRes.ok) {
        return json({ error: 'Post was not found in repository.' }, getRes.status)
      }
      const fileData = await getRes.json()
      const decodedContent = base64ToUtf8(fileData.content || '')
      return json({
        ok: true,
        path: fileData.path,
        sha: fileData.sha,
        content: decodedContent,
      })
    } catch {
      return json({ error: 'Failed to retrieve post content.' }, 500)
    }
  }

  // ACTION: Delete single post
  if (action === 'delete') {
    const filePath = typeof payload.path === 'string' ? payload.path.trim() : ''
    const sha = typeof payload.sha === 'string' ? payload.sha.trim() : ''
    if (!filePath.startsWith('src/content/blog/') || filePath.includes('..') || !sha) {
      return json({ error: 'File path and sha are required to delete.' }, 400)
    }
    try {
      const delRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(filePath)}`,
        {
          method: 'DELETE',
          headers: githubHeaders,
          body: JSON.stringify({
            message: `Delete blog post: ${filePath.replace(/^src\/content\/blog\//, '')}`,
            sha,
            branch,
          }),
        },
      )
      if (!delRes.ok) {
        return json({ error: 'GitHub could not delete the post.' }, delRes.status)
      }
      return json({ ok: true, deleted: filePath })
    } catch {
      return json({ error: 'Failed to delete post.' }, 500)
    }
  }

  // ACTION: Update existing post
  if (action === 'update') {
    const filePath = typeof payload.path === 'string' ? payload.path.trim() : ''
    const sha = typeof payload.sha === 'string' ? payload.sha.trim() : ''
    const content = typeof payload.content === 'string' ? payload.content : ''

    if (!filePath.startsWith('src/content/blog/') || filePath.includes('..') || !sha || !content) {
      return json({ error: 'Path, sha and content are required to update.' }, 400)
    }

    try {
      const updateRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(filePath)}`,
        {
          method: 'PUT',
          headers: githubHeaders,
          body: JSON.stringify({
            message: `Update blog post: ${filePath.replace(/^src\/content\/blog\//, '')}`,
            content: utf8ToBase64(content),
            sha,
            branch,
          }),
        },
      )
      if (!updateRes.ok) {
        return json({ error: 'GitHub could not update the post.' }, updateRes.status)
      }
      return json({ ok: true, updated: filePath })
    } catch {
      return json({ error: 'Failed to update post.' }, 500)
    }
  }

  // ACTION: Create new post
  const title = normalizeText(payload.title)
  const description = normalizeText(payload.description)
  const body = typeof payload.body === 'string' ? payload.body.trim() : ''

  if (!title) return json({ error: 'Title is required.' }, 400)
  if (title.length > LIMITS.title) {
    return json({ error: `Title must be ${LIMITS.title} characters or fewer.` }, 400)
  }

  if (!description) return json({ error: 'Description is required.' }, 400)
  if (description.length > LIMITS.description) {
    return json(
      { error: `Description must be ${LIMITS.description} characters or fewer.` },
      400,
    )
  }

  if (!body) return json({ error: 'Article body is required.' }, 400)
  if (body.length > LIMITS.body) {
    return json({ error: 'Article is too large.' }, 413)
  }

  let tags
  let author

  try {
    tags = parseList(payload.tags, LIMITS.tags, LIMITS.item)
    if (typeof payload.author === 'string' && payload.author.trim()) {
      author = payload.author.trim().slice(0, LIMITS.item)
    } else if (payload.authors) {
      const parsedAuthors = parseList(payload.authors, LIMITS.authors, LIMITS.item)
      author = parsedAuthors[0] || 'snaxcyz'
    } else {
      author = 'snaxcyz'
    }
  } catch (error) {
    return json({ error: error.message }, 400)
  }

  const slugSource =
    typeof payload.slug === 'string' && payload.slug.trim()
      ? payload.slug
      : title
  const slug = slugify(slugSource)
  const draft = Boolean(payload.draft)
  const date = new Date().toISOString().slice(0, 10)
  const filePath = `src/content/blog/${slug}-uz.mdx`
  const mdx = makeMdx({
    title,
    description,
    date,
    tags,
    author,
    draft,
    body,
  })

  const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`

  try {
    const existing = await fetch(`${contentsUrl}?ref=${encodeURIComponent(branch)}`, {
      method: 'GET',
      headers: githubHeaders,
    })

    if (existing.status === 200) {
      return json(
        { error: 'A post with this slug already exists. Choose another slug.' },
        409,
      )
    }

    if (existing.status === 401 || existing.status === 403) {
      return json(
        { error: 'GitHub authentication failed. Check GITHUB_TOKEN permissions.' },
        500,
      )
    }

    if (existing.status !== 404) {
      return json({ error: githubErrorMessage(existing.status) }, 500)
    }

    const commitMessage = `${draft ? 'Add draft blog post' : 'Add blog post'}: ${title.replace(/\s+/g, ' ').trim()}`

    const created = await fetch(contentsUrl, {
      method: 'PUT',
      headers: githubHeaders,
      body: JSON.stringify({
        message: commitMessage,
        content: utf8ToBase64(mdx),
        branch,
      }),
    })

    if (created.status === 401 || created.status === 403) {
      return json(
        { error: 'GitHub authentication failed. Check GITHUB_TOKEN permissions.' },
        500,
      )
    }

    if (created.status === 409 || created.status === 422) {
      return json(
        { error: 'A post with this slug already exists. Choose another slug.' },
        409,
      )
    }

    if (!created.ok) {
      return json({ error: githubErrorMessage(created.status) }, 500)
    }

    const result = await created.json().catch(() => ({}))
    const commitUrl =
      result?.commit?.html_url || result?.content?.html_url || ''

    return json({
      ok: true,
      path: filePath,
      commitUrl,
    })
  } catch {
    return json({ error: 'GitHub could not create the post.' }, 500)
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseList(value, maxItems, maxItemLength) {
  let items = []

  if (value == null || value === '') {
    items = []
  } else if (Array.isArray(value)) {
    items = value.map((item) => String(item).trim()).filter(Boolean)
  } else if (typeof value === 'string') {
    items = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  } else {
    throw new Error('Tags and authors must be a list or comma-separated string.')
  }

  if (items.length > maxItems) {
    throw new Error(`No more than ${maxItems} items are allowed.`)
  }

  if (items.some((item) => item.length > maxItemLength)) {
    throw new Error(`Each tag and author must be ${maxItemLength} characters or fewer.`)
  }

  return items
}

function slugify(value) {
  const slug = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-uz$/, '')
    .slice(0, LIMITS.slug)
    .replace(/-+$/g, '')

  return slug || 'untitled-post'
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ''))
}

function makeMdx({ title, description, date, tags, author, draft, body }) {
  const draftLine = draft ? 'draft: true\n' : ''
  return `---
title: ${yamlString(title)}
description: ${yamlString(description)}
date: ${yamlString(date)}
lang: "uz"
tags: ${JSON.stringify(tags)}
author: ${JSON.stringify(author || 'snaxcyz')}
${draftLine}---

${body}
`
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const chunkSize = 0x2000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk)
  }

  return btoa(binary)
}

function base64ToUtf8(b64) {
  const clean = String(b64 || '').replace(/\s+/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

async function passwordsMatch(provided, expected) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign('HMAC', key, encoder.encode(provided)),
    crypto.subtle.sign('HMAC', key, encoder.encode(expected)),
  ])
  const bytesA = new Uint8Array(sigA)
  const bytesB = new Uint8Array(sigB)
  let mismatch = provided.length === expected.length ? 0 : 1

  for (let i = 0; i < bytesA.length; i++) {
    mismatch |= bytesA[i] ^ bytesB[i]
  }

  return mismatch === 0
}

function githubErrorMessage(status) {
  if (status === 401 || status === 403) {
    return 'GitHub authentication failed. Check GITHUB_TOKEN permissions.'
  }
  if (status === 404) {
    return 'GitHub repository was not found. Check GITHUB_OWNER and GITHUB_REPO.'
  }
  if (status === 409 || status === 422) {
    return 'A post with this slug already exists. Choose another slug.'
  }
  return 'GitHub could not create the post.'
}
