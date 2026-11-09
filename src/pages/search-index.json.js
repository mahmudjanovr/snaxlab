import { getAllPosts } from '@/lib/data-utils'

export async function GET() {
  const posts = await getAllPosts()

  const index = posts.map((post) => {
    // Strip markdown formatting, code blocks, and HTML tags for a clean searchable body
    const rawBody = post.body || ''
    const cleanBody = rawBody
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[#*`_~\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500) // first 1500 chars of body text is plenty for excerpts and fast full-text match

    return {
      id: post.id,
      title: post.data.title,
      description: post.data.description || '',
      date: post.data.date.toISOString().slice(0, 10),
      tags: post.data.tags || [],
      href: `/blog/${post.id}/`,
      body: cleanBody,
    }
  })

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
