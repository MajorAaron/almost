// /api/history — return the 12 most-recent anti-receipts for the public Wall.

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=30'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const url = (process.env.TURSO_DB_URL || '').replace('libsql://', 'https://');
  const token = process.env.TURSO_DB_TOKEN;
  if (!url || !token) return json(200, { items: [] });

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
              sql: `SELECT item, price, blurb, vibe_label
                    FROM almost_receipts
                    ORDER BY id DESC
                    LIMIT 12`
            }
          },
          { type: 'close' }
        ]
      })
    });
    if (!resp.ok) return json(200, { items: [] });
    const data = await resp.json();
    const rows = data?.results?.[0]?.response?.result?.rows || [];
    const items = rows.map(r => ({
      item: r[0]?.value || '',
      price: parseFloat(r[1]?.value || 0),
      blurb: r[2]?.value || '',
      vibe_label: r[3]?.value || ''
    }));
    return json(200, { items });
  } catch (e) {
    console.error('history err', e);
    return json(200, { items: [] });
  }
};
