export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;

    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    if (path === '/' || path === '') {
      return env.ASSETS.fetch(new URL('/index.html', url.origin));
    }

    // Files with extension: serve directly
    if (path.includes('.')) {
      return env.ASSETS.fetch(new URL(path + url.search, url.origin));
    }

    // Pretty URL → .html (primary)
    const htmlUrl = new URL(path + '.html' + url.search, url.origin);
    let response = await env.ASSETS.fetch(htmlUrl);

    // Brief retry if asset graph still settling after deploy
    if (response.status === 404) {
      response = await env.ASSETS.fetch(htmlUrl);
    }

    if (response.status === 200) {
      return response;
    }

    // Explicit 404 page (do not silently send people home)
    const notFound = await env.ASSETS.fetch(new URL('/404.html', url.origin));
    if (notFound.status === 200) {
      return new Response(await notFound.arrayBuffer(), {
        status: 404,
        headers: {
          'content-type': notFound.headers.get('content-type') || 'text/html; charset=utf-8',
          'cache-control': 'no-store'
        }
      });
    }

    return new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }
};
