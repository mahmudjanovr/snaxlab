import { SITE } from '@/consts';
import rss from '@astrojs/rss';
import { getAllPosts } from '@/lib/data-utils';

export async function GET(context) {
  try {
    const posts = await getAllPosts();
    return rss({
      title: SITE.title,
      description: SITE.description,
      site: context.site ?? SITE.href,
      customData: `<language>${SITE.locale}</language>`,
      items: posts.map((post) => ({
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.date,
        link: `/blog/${post.id}/`,
        author: SITE.author,
        categories: post.data.tags || [],
      })),
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    return new Response('Error generating RSS feed', { status: 500 });
  }
}
