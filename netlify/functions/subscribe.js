// /api/subscribe — capture email for monthly anti-haul digest. Turso HTTP API, zero deps.

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Invalid JSON' }); }

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return json(400, { error: 'Valid email required' });
  }

  const url = (process.env.TURSO_DB_URL || '').replace('libsql://', 'https://');
  const token = process.env.TURSO_DB_TOKEN;
  if (!url || !token) {
    console.error('Turso not configured');
    return json(500, { error: 'Storage not configured' });
  }

  const slug = process.env.IDEA_SLUG || 'almost';

  try {
    const resp = await fetch(`${url}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            type: 'execute',
            stmt: {
              sql: `INSERT INTO subscribers (email, idea_slug, source, subscribed_at)
                    VALUES (?, ?, 'almost_tool', datetime('now'))
                    ON CONFLICT(email, idea_slug) DO UPDATE SET unsubscribed_at = NULL`,
              args: [
                { type: 'text', value: email },
                { type: 'text', value: slug }
              ]
            }
          },
          { type: 'close' }
        ]
      })
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Turso subscribe failed:', resp.status, txt);
      return json(500, { error: 'Could not save subscription' });
    }
    return json(200, { ok: true });
  } catch (err) {
    console.error('subscribe err', err);
    return json(500, { error: 'Subscription failed' });
  }
};
