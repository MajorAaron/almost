// /api/analyze — generate an anti-receipt via Gemini, persist to Turso.
// Zero deps: native fetch (Node 18+ / Netlify Functions).

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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

async function callGemini(item, price, store, reason) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const prompt = `You are the voice of "Almost" — a small AI that mints "anti-receipts" celebrating things people DIDN'T buy. The vibe is warm, slightly literary, never preachy, never anti-consumerist in a moralizing way. Think: a poet wrote your printer receipts.

INPUT:
Item: ${item}
Price: $${price}
Store: ${store || '(unspecified)'}
Why they skipped: ${reason}

Return a JSON object with EXACTLY these keys:
{
  "blurb": "A 1-2 sentence poetic, slightly literary line about this specific skip. NEVER moralize. NEVER use words like 'wisely' or 'smart choice'. Quote-worthy. Max 200 chars.",
  "vibe_label": "A 2-4 word ALL CAPS vibe tag, like 'PURE RESTRAINT', 'FUTURE SELF WINS', 'THE SHELF SAID NO', 'ALGORITHM: -1', 'BOUGHT NOTHING, FELT EVERYTHING'. Be creative and specific to the skip. Max 30 chars.",
  "kept_for": "A 1-sentence suggestion of what this $${price} could become instead. Concrete, slightly playful, never financial-advice-y. Max 120 chars. Examples: 'Four months of library latte tax.' 'The plane ticket fund, plus interest.' 'A really good dinner with someone who matters.'"
}

CRITICAL:
- Reference the SPECIFIC item and reason. Generic platitudes are forbidden.
- No emojis. No hashtags. No exclamation marks unless absolutely necessary.
- Return ONLY the JSON object. No prose, no markdown fences.`;

  const resp = await fetch(GEMINI_URL + '?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 400,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('Gemini error ' + resp.status + ': ' + errText.slice(0, 200));
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error('Gemini returned non-JSON');
  }
  return parsed;
}

async function saveToTurso({ item, price, store, reason, blurb, vibe_label, kept_for }) {
  const url = process.env.TURSO_DB_URL;
  const token = process.env.TURSO_DB_TOKEN;
  if (!url || !token) {
    console.warn('Turso not configured — skipping save');
    return null;
  }
  // Convert libsql:// to https://
  const httpUrl = url.replace('libsql://', 'https://');

  const sql = `INSERT INTO almost_receipts (item, price, store, reason, blurb, vibe_label, kept_for, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

  const args = [
    { type: 'text', value: String(item).slice(0, 200) },
    { type: 'float', value: Number(price) },
    { type: 'text', value: String(store || '').slice(0, 100) },
    { type: 'text', value: String(reason).slice(0, 300) },
    { type: 'text', value: String(blurb).slice(0, 400) },
    { type: 'text', value: String(vibe_label).slice(0, 80) },
    { type: 'text', value: String(kept_for || '').slice(0, 300) }
  ];

  const resp = await fetch(`${httpUrl}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args } },
        { type: 'close' }
      ]
    })
  });
  if (!resp.ok) {
    console.error('Turso save failed:', resp.status, await resp.text().catch(() => ''));
    return null;
  }
  return await resp.json();
}

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

  const item = String(body.item || '').trim().slice(0, 200);
  const price = Number(body.price);
  const store = String(body.store || '').trim().slice(0, 100);
  const reason = String(body.reason || '').trim().slice(0, 300);

  if (!item || !price || price <= 0 || price > 1000000 || !reason) {
    return json(400, { error: 'item, price (>0), and reason are required' });
  }

  try {
    const ai = await callGemini(item, price, store, reason);
    const blurb = ai.blurb || 'A small win, quietly logged.';
    const vibe_label = ai.vibe_label || 'PURE RESTRAINT';
    const kept_for = ai.kept_for || '';

    // Await save so it completes before the serverless function exits
    try {
      await saveToTurso({ item, price, store, reason, blurb, vibe_label, kept_for });
    } catch (e) {
      console.error('save err', e);
    }

    return json(200, { blurb, vibe_label, kept_for });
  } catch (err) {
    console.error('analyze error', err);
    return json(500, { error: 'Generation failed', detail: String(err.message || err) });
  }
};
