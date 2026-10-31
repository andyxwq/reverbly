export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;

    // Normalize trailing slash (except root)
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    // Homepage
    if (path === '/' || path === '') {
      return env.ASSETS.fetch(new URL('/index.html', url.origin));
    }

    // Pretty routes: /reverbly-prototype → reverbly-prototype.html
    // Try HTML first so we don't depend on a 404 from assets.
    if (!path.includes('.')) {
      const htmlUrl = new URL(path + '.html', url.origin);
      htmlUrl.search = url.search;
      const htmlResponse = await env.ASSETS.fetch(new Request(htmlUrl.toString(), request));
      if (htmlResponse.status === 200) {
        return htmlResponse;
      }
    }

    // Direct file (css, js, png, or explicit .html)
    const assetUrl = new URL(path, url.origin);
    assetUrl.search = url.search;
    const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    if (response.status !== 404) return response;

    // Fallback: SPA-style soft landing on homepage for unknown pages
    if (!path.includes('.')) {
      return env.ASSETS.fetch(new URL('/index.html', url.origin));
    }

    return response;
  }
};
