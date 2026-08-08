export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Homepage: always serve index.html
    if (path === '/' || path === '') {
      return env.ASSETS.fetch(new URL('/index.html', url.origin));
    }

    // Try the requested asset first
    let response = await env.ASSETS.fetch(request);

    // Optional pretty paths without .html
    if (response.status === 404 && !path.includes('.') && !path.endsWith('/')) {
      const htmlRequest = new Request(new URL(path + '.html', url.origin), request);
      const htmlResponse = await env.ASSETS.fetch(htmlRequest);
      if (htmlResponse.status === 200) return htmlResponse;
    }

    return response;
  }
};
