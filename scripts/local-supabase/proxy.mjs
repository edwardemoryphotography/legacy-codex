// One origin for supabase-js: /auth/v1 → Supabase Auth, /rest/v1 → PostgREST.
// Local verification only; see scripts/local-supabase/start.sh.
import http from 'node:http'

const routes = [
  ['/auth/v1', Number(process.env.AUTH_PORT || 9999)],
  ['/rest/v1', Number(process.env.REST_PORT || 3001)],
]
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, prefer, accept-profile, content-profile, range, x-supabase-api-version',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'access-control-expose-headers': 'content-range, x-total-count',
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    return res.end()
  }
  const route = routes.find(([prefix]) => req.url.startsWith(prefix))
  if (!route) {
    res.writeHead(404, cors)
    return res.end()
  }
  const upstream = http.request({
    host: '127.0.0.1',
    port: route[1],
    path: req.url.slice(route[0].length) || '/',
    method: req.method,
    headers: { ...req.headers, host: '127.0.0.1' },
  }, up => {
    res.writeHead(up.statusCode, { ...up.headers, ...cors })
    up.pipe(res)
  })
  upstream.on('error', error => {
    res.writeHead(502, cors)
    res.end(String(error))
  })
  req.pipe(upstream)
}).listen(Number(process.env.PROXY_PORT || 54321), '127.0.0.1')
