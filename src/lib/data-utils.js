import { getCollection, render } from 'astro:content'
import { readingTime, calculateWordCountFromHtml } from '@/lib/utils'

export async function getAllAuthors() {
  return await getCollection('authors')
}

export async function getAllPosts() {
  const posts = await getCollection('blog')
  const now = new Date()
  return posts
    .filter((post) => !post.data.draft && !isSubpost(post.id) && post.data.date <= now)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
}

export async function getAllPostsAndSubposts() {
  const posts = await getCollection('blog')
  const now = new Date()
  return posts
    .filter((post) => !post.data.draft && post.data.date <= now)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
}

export async function getAllProjects() {
  const projects = await getCollection('projects')
  return projects.sort((a, b) => {
    const dateA = a.data.startDate?.getTime() || 0
    const dateB = b.data.startDate?.getTime() || 0
    return dateB - dateA
  })
}

export async function getAllTags() {
  const posts = await getAllPosts()
  return posts.reduce((acc, post) => {
    post.data.tags?.forEach((tag) => {
      acc.set(tag, (acc.get(tag) || 0) + 1)
    })
    return acc
  }, new Map())
}

export async function getAdjacentPosts(currentId) {
  const allPosts = await getAllPosts()
  if (isSubpost(currentId)) {
    const parentId = getParentId(currentId)
    const parent = allPosts.find((post) => post.id === parentId) || null
    const posts = await getCollection('blog')
    const now = new Date()
    const subposts = posts
      .filter(
        (post) =>
          isSubpost(post.id) &&
          getParentId(post.id) === parentId &&
          !post.data.draft &&
          post.data.date <= now,
      )
      .sort((a, b) => {
        const dateDiff = a.data.date.valueOf() - b.data.date.valueOf()
        if (dateDiff !== 0) return dateDiff
        const orderA = a.data.order ?? 0
        const orderB = b.data.order ?? 0
        return orderA - orderB
      })
    const currentIndex = subposts.findIndex((post) => post.id === currentId)
    if (currentIndex === -1) {
      return { newer: null, older: null, parent }
    }
    return {
      newer:
        currentIndex < subposts.length - 1 ? subposts[currentIndex + 1] : null,
      older: currentIndex > 0 ? subposts[currentIndex - 1] : null,
      parent,
    }
  }

  const parentPosts = allPosts.filter((post) => !isSubpost(post.id))
  const currentIndex = parentPosts.findIndex((post) => post.id === currentId)
  if (currentIndex === -1) {
    return { newer: null, older: null, parent: null }
  }

  return {
    newer: currentIndex > 0 ? parentPosts[currentIndex - 1] : null,
    older:
      currentIndex < parentPosts.length - 1
        ? parentPosts[currentIndex + 1]
        : null,
    parent: null,
  }
}

export async function getPostsByAuthor(authorId = 'snaxcyz') {
  const posts = await getAllPosts()
  return posts.filter((post) => post.data.author === authorId)
}

export async function getPostsByTag(tag) {
  const posts = await getAllPosts()
  return posts.filter((post) => post.data.tags?.includes(tag))
}

export async function getRecentPosts(count) {
  const posts = await getAllPosts()
  return posts.slice(0, count)
}

export async function getSortedTags() {
  const tagCounts = await getAllTags()
  return [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      const countDiff = b.count - a.count
      return countDiff !== 0 ? countDiff : a.tag.localeCompare(b.tag)
    })
}

export function getParentId(subpostId) {
  return subpostId.split('/')[0]
}

export async function getSubpostsForParent(parentId) {
  const posts = await getCollection('blog')
  const now = new Date()
  return posts
    .filter(
      (post) =>
        !post.data.draft &&
        post.data.date <= now &&
        isSubpost(post.id) &&
        getParentId(post.id) === parentId,
    )
    .sort((a, b) => {
      const dateDiff = a.data.date.valueOf() - b.data.date.valueOf()
      if (dateDiff !== 0) return dateDiff
      const orderA = a.data.order ?? 0
      const orderB = b.data.order ?? 0
      return orderA - orderB
    })
}

export function groupPostsByYear(posts) {
  return posts.reduce((acc, post) => {
    const year = post.data.date.getFullYear().toString()
    ;(acc[year] ?? (acc[year] = [])).push(post)
    return acc
  }, {})
}

export async function hasSubposts(postId) {
  const subposts = await getSubpostsForParent(postId)
  return subposts.length > 0
}

export function isSubpost(postId) {
  return postId.includes('/')
}

export async function getParentPost(subpostId) {
  if (!isSubpost(subpostId)) {
    return null
  }
  const parentId = getParentId(subpostId)
  const allPosts = await getAllPosts()
  return allPosts.find((post) => post.id === parentId) || null
}

export async function getAuthor(authorId = 'snaxcyz') {
  const allAuthors = await getAllAuthors()
  const author = allAuthors.find((a) => a.id === authorId)
  if (author) {
    return {
      id: author.id,
      name: author.data.name || 'Rahmatillo Mahmudjanov',
      avatar: author.data.avatar || '/static/logo.png',
      data: author.data,
      isRegistered: true,
    }
  }
  return {
    id: authorId,
    name: 'Rahmatillo Mahmudjanov',
    avatar: '/static/logo.png',
    data: { name: 'Rahmatillo Mahmudjanov' },
    isRegistered: false,
  }
}

export async function parseAuthors(authorInput = []) {
  const ids = Array.isArray(authorInput)
    ? authorInput
    : authorInput
      ? [authorInput]
      : ['snaxcyz']
  if (!ids.length) return []
  const allAuthors = await getAllAuthors()
  const authorMap = new Map(allAuthors.map((author) => [author.id, author]))
  return ids.map((id) => {
    const author = authorMap.get(id)
    return {
      id,
      name: author?.data?.name || (id === 'snaxcyz' ? 'Rahmatillo Mahmudjanov' : id),
      avatar: author?.data?.avatar || '/static/logo.png',
      isRegistered: !!author,
    }
  })
}

export async function getPostById(postId) {
  const allPosts = await getAllPostsAndSubposts()
  return allPosts.find((post) => post.id === postId) || null
}

export async function getSubpostCount(parentId) {
  const subposts = await getSubpostsForParent(parentId)
  return subposts.length
}

export async function getCombinedReadingTime(postId) {
  const post = await getPostById(postId)
  if (!post) return readingTime(0)
  let totalWords = calculateWordCountFromHtml(post.body || '')
  if (!isSubpost(postId)) {
    const subposts = await getSubpostsForParent(postId)
    for (const subpost of subposts) {
      totalWords += calculateWordCountFromHtml(subpost.body || '')
    }
  }
  return readingTime(totalWords)
}

export async function getPostReadingTime(postId) {
  const post = await getPostById(postId)
  if (!post) return readingTime(0)
  const wordCount = calculateWordCountFromHtml(post.body || '')
  return readingTime(wordCount)
}

export async function getTOCSections(postId) {
  const post = await getPostById(postId)
  if (!post) return []
  const parentId = isSubpost(postId) ? getParentId(postId) : postId
  const parentPost = isSubpost(postId) ? await getPostById(parentId) : post
  if (!parentPost) return []
  const sections = []
  const { headings: parentHeadings } = await render(parentPost)
  if (parentHeadings.length > 0) {
    sections.push({
      type: 'parent',
      title: 'Overview',
      headings: parentHeadings.map((heading) => ({
        slug: heading.slug,
        text: heading.text,
        depth: heading.depth,
      })),
    })
  }
  const subposts = await getSubpostsForParent(parentId)
  for (const subpost of subposts) {
    const { headings: subpostHeadings } = await render(subpost)
    if (subpostHeadings.length > 0) {
      sections.push({
        type: 'subpost',
        title: subpost.data.title,
        headings: subpostHeadings.map((heading, index) => ({
          slug: heading.slug,
          text: heading.text,
          depth: heading.depth,
          isSubpostTitle: index === 0,
        })),
        subpostId: subpost.id,
      })
    }
  }
  return sections
}

/* ==========================================================================
   Editorial Extensions: Bookshelf, Notes, Series, Quotes, Related, Archive
   ========================================================================== */

export async function getAllBooks() {
  const books = await getCollection('bookshelf')
  return books.sort((a, b) => {
    // Featured first, then read dates, then title
    if (a.data.featured && !b.data.featured) return -1
    if (!a.data.featured && b.data.featured) return 1
    const dateA = a.data.dateRead?.getTime() || 0
    const dateB = b.data.dateRead?.getTime() || 0
    if (dateB !== dateA) return dateB - dateA
    return a.data.title.localeCompare(b.data.title)
  })
}

export async function getBookBySlug(slug) {
  const books = await getAllBooks()
  return books.find((b) => b.id === slug) || null
}

export async function getBooksByStatus(status) {
  const books = await getAllBooks()
  return books.filter((b) => b.data.status === status)
}

export async function getAllNotes() {
  const notes = await getCollection('notes')
  return notes.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
}

export async function getAllSeries() {
  const series = await getCollection('series')
  return series.sort((a, b) => (a.data.order || 0) - (b.data.order || 0))
}

export async function getSeriesBySlug(slug) {
  const allSeries = await getAllSeries()
  return allSeries.find((s) => s.id === slug) || null
}

export async function getSeriesForPost(postId) {
  const allSeries = await getAllSeries()
  return allSeries.find((s) => s.data.posts.includes(postId)) || null
}

export async function getAllQuotes() {
  const quotes = await getCollection('quotes')
  return quotes
}

export async function getRelatedPosts(currentPost, limit = 3) {
  const allPosts = await getAllPosts()
  const currentTags = currentPost.data.tags || []
  const currentSeries = await getSeriesForPost(currentPost.id)

  const candidates = allPosts
    .filter((post) => post.id !== currentPost.id)
    .map((post) => {
      let score = 0
      const postTags = post.data.tags || []

      // Shared tags score (each matching tag = +2)
      for (const tag of postTags) {
        if (currentTags.includes(tag)) {
          score += 2
        }
      }

      // Shared series score (+4)
      if (currentSeries && currentSeries.data.posts.includes(post.id)) {
        score += 4
      }

      return { post, score }
    })

  // Filter candidates that have at least some relevance or fall back to most recent
  const sorted = candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.post.data.date.valueOf() - a.post.data.date.valueOf()
  })

  const results = sorted.slice(0, limit).map((c) => c.post)

  // Graceful fallback: if not enough matches, add recent posts
  if (results.length < limit) {
    for (const p of allPosts) {
      if (p.id !== currentPost.id && !results.some((r) => r.id === p.id)) {
        results.push(p)
        if (results.length >= limit) break
      }
    }
  }

  return results
}

export async function getArchiveByYearAndMonth() {
  const posts = await getAllPosts()
  const monthNames = [
    'Yanvar',
    'Fevral',
    'Mart',
    'Aprel',
    'May',
    'Iyun',
    'Iyul',
    'Avgust',
    'Sentabr',
    'Oktabr',
    'Noyabr',
    'Dekabr',
  ]

  const archive = {}

  for (const post of posts) {
    const year = post.data.date.getFullYear().toString()
    const monthIndex = post.data.date.getMonth()
    const monthName = monthNames[monthIndex]

    if (!archive[year]) {
      archive[year] = {
        year,
        total: 0,
        months: {},
      }
    }

    if (!archive[year].months[monthIndex]) {
      archive[year].months[monthIndex] = {
        monthName,
        monthIndex,
        posts: [],
      }
    }

    archive[year].months[monthIndex].posts.push(post)
    archive[year].total++
  }

  return archive
}

export async function getAllEssays() {
  const posts = await getAllPosts()
  const essayTags = ['falsafa', 'adabiyot', 'sanat']
  return posts.filter((post) => {
    const hasTag = post.data.tags?.some((t) => essayTags.includes(t))
    const wordCount = calculateWordCountFromHtml(post.body || '')
    return hasTag || wordCount > 500
  })
}

export async function getSiteStatistics() {
  const posts = await getAllPosts()
  const books = await getAllBooks()
  const notes = await getAllNotes()
  const quotes = await getAllQuotes()
  const tags = await getAllTags()

  let totalWords = 0
  for (const p of posts) {
    totalWords += calculateWordCountFromHtml(p.body || '')
  }

  return {
    totalPosts: posts.length,
    totalBooks: books.length,
    totalBooksRead: books.filter((b) => b.data.status === 'read').length,
    totalNotes: notes.length,
    totalQuotes: quotes.length,
    totalTags: tags.size,
    totalWords,
  }
}
