function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

async function verifyDiscord(request, body, publicKey) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  if (!signature || !timestamp || !publicKey) return false;
  const age = Math.abs(Date.now() - Number(timestamp) * 1000);
  if (!Number.isFinite(age) || age > 5 * 60 * 1000) return false;
  const key = await crypto.subtle.importKey('raw', hexToBytes(publicKey), { name: 'Ed25519' }, false, ['verify']);
  return crypto.subtle.verify('Ed25519', key, hexToBytes(signature), new TextEncoder().encode(timestamp + body));
}

function commandReply(name) {
  if (name === 'editor') return 'Open the editor: https://reverbly.app/reverbly-prototype';
  if (name === 'pricing') return 'Plus is €3.99/month. Pro is €7.99/month and includes a 7-day trial. https://reverbly.app/reverbly-pricing';
  if (name === 'help') return 'Reverbly turns original audio into slowed, sped-up, and looped versions. Free includes 3 exports a day. Editor: https://reverbly.app/reverbly-prototype';
  return 'Try /editor, /pricing, or /help.';
}

async function registerCommands(env) {
  const token = env.DISCORD_BOT_TOKEN;
  const appId = env.DISCORD_APPLICATION_ID;
  if (!token || !appId) return new Response('Add DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID in Cloudflare, then open this page again.', { status: 500 });
  const response = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
    method: 'PUT',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      { name: 'editor', description: 'Open the Reverbly editor', type: 1 },
      { name: 'pricing', description: 'See Plus and Pro prices', type: 1 },
      { name: 'help', description: 'How Reverbly works', type: 1 }
    ])
  });
  if (!response.ok) return new Response('Discord did not save the commands. Check the application ID and bot token.', { status: 502 });
  return new Response('Commands saved: /editor, /pricing, /help. They can take up to an hour to show up.', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

async function discordInteraction(request, env) {
  const body = await request.text();
  const valid = await verifyDiscord(request, body, env.DISCORD_PUBLIC_KEY);
  if (!valid) return new Response('invalid request signature', { status: 401 });
  const interaction = JSON.parse(body);
  if (interaction.type === 1) return Response.json({ type: 1 });
  if (interaction.type === 2) return Response.json({ type: 4, data: { content: commandReply(interaction.data?.name) } });
  return Response.json({ type: 4, data: { content: 'Try /editor, /pricing, or /help.' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;

    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

    if (path === '/discord' && request.method === 'POST') return discordInteraction(request, env);
    if (path === '/discord-setup') return registerCommands(env);

    if (path === '/' || path === '') {
      return env.ASSETS.fetch(new URL('/index.html', url.origin));
    }

    if (path.includes('.')) {
      return env.ASSETS.fetch(new URL(path + url.search, url.origin));
    }

    const htmlUrl = new URL(path + '.html' + url.search, url.origin);
    let response = await env.ASSETS.fetch(htmlUrl);
    if (response.status === 404) response = await env.ASSETS.fetch(htmlUrl);

    if (response.status === 200) {
      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=utf-8');
      return new Response(response.body, { status: 200, headers });
    }

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

    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
};
