// Cloudflare Pages Advanced Mode worker.
// The original app remains a static asset; this worker only injects the
// independently testable runtime hotfix bundle into the main HTML document.
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const url = new URL(request.url);
    const isMainDocument = request.method === 'GET' &&
      (url.pathname === '/' || url.pathname === '/index.html');
    const contentType = response.headers.get('content-type') || '';

    if (!isMainDocument || !response.ok || !contentType.includes('text/html')) {
      return response;
    }

    return new HTMLRewriter()
      .on('body', {
        element(element) {
          element.append(
            '<script src="/runtime-fixes.js?v=20261126-1"></script>',
            { html: true }
          );
        }
      })
      .transform(response);
  }
};