const error = (message, status) => Response.json({error:message}, {
  status, headers:{'Cache-Control':'no-store'}
});

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if (incoming.pathname !== '/api' && !incoming.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }
    let backend;
    try {
      backend = new URL(env.BACKEND_URL);
      if (backend.protocol !== 'https:' || backend.username || backend.password ||
          backend.pathname !== '/' || backend.search || backend.hash ||
          backend.host === incoming.host) throw new Error('Invalid backend');
    } catch {
      return error('Falta configurar la URL pública del backend en Cloudflare.', 503);
    }
    // Assign the path instead of resolving it: even /api//... stays on this host.
    backend.pathname = incoming.pathname;
    backend.search = incoming.search;
    const headers = new Headers(request.headers);
    headers.delete('host');
    try {
      const upstream = await fetch(backend, {
        method:request.method, headers,
        body:['GET','HEAD'].includes(request.method) ? undefined : request.body,
        redirect:'manual'
      });
      // Preserve the Cloudflare WebSocket upgrade and its webSocket handle.
      // Reconstructing a plain Response loses the upgraded connection.
      if (upstream.status === 101) return upstream;
      const result = new Response(upstream.body, upstream);
      result.headers.set('Cache-Control','no-store');
      return result;
    } catch {
      return error('No se pudo conectar con el servidor. Inténtalo de nuevo en unos momentos.', 502);
    }
  }
};
