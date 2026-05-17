// Almost — anti-receipt generator client
(function () {
  const form = document.getElementById('receipt-form');
  const submitBtn = document.getElementById('submit-btn');
  const resultPane = document.getElementById('result-pane');
  const keptTotalEl = document.getElementById('kept-total');
  const keptCountEl = document.getElementById('kept-count');
  const subscribeForm = document.getElementById('subscribe-form');
  const subscribeStatus = document.getElementById('subscribe-status');
  const wallGrid = document.getElementById('wall-grid');

  const SESSION_KEY = 'almost.session';

  // Session state — running total of skips
  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return { total: 0, count: 0, cards: [] };
      return JSON.parse(raw);
    } catch (e) { return { total: 0, count: 0, cards: [] }; }
  }
  function saveSession(s) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function fmtMoney(n) {
    return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  function renderTotals() {
    const s = loadSession();
    keptTotalEl.textContent = fmtMoney(s.total);
    keptCountEl.textContent = s.count + (s.count === 1 ? ' anti-receipt printed' : ' anti-receipts printed');
  }

  // Render receipt card
  function renderReceipt(data) {
    const { item, price, store, reason, blurb, vibe_label, kept_for } = data;
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const refNum = 'ALM-' + Math.random().toString(36).slice(2, 8).toUpperCase();

    resultPane.innerHTML = `
      <div class="receipt-card" id="receipt-card">
        <div class="receipt-header">
          <div class="receipt-title">Anti-Receipt</div>
          <div class="receipt-brand">Almost</div>
          <div class="receipt-tag">Proof of Restraint</div>
        </div>

        <div class="receipt-line"><span class="label">Item</span><span class="val">${escapeHtml(item)}</span></div>
        ${store ? `<div class="receipt-line"><span class="label">Vendor</span><span class="val">${escapeHtml(store)}</span></div>` : ''}
        <div class="receipt-line"><span class="label">Listed</span><span class="val strike">${fmtMoney(price)}</span></div>
        <div class="receipt-line"><span class="label">Charged</span><span class="val">$0.00</span></div>

        <div class="receipt-vibe">— ${escapeHtml(vibe_label)} —</div>

        <div class="receipt-blurb">"${escapeHtml(blurb)}"</div>

        ${kept_for ? `<div class="receipt-kept-for"><strong>Instead:</strong> ${escapeHtml(kept_for)}</div>` : ''}

        <div class="receipt-total">
          <span class="label">Kept in your pocket</span>
          <span class="amount">${fmtMoney(price)}</span>
          <span class="note">Reason · ${escapeHtml(reason)}</span>
        </div>

        <div class="receipt-footer">
          ${date} · ${time} · Ref ${refNum} · almost.majorsolutions.studio
        </div>

        <div class="receipt-actions">
          <button type="button" id="download-btn">Download PNG</button>
          <button type="button" id="copy-btn">Copy text</button>
        </div>
      </div>
    `;

    document.getElementById('download-btn').addEventListener('click', downloadReceipt);
    document.getElementById('copy-btn').addEventListener('click', () => copyReceiptText(data, refNum));
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  // Download receipt as PNG via html2canvas-free approach — render to canvas
  async function downloadReceipt() {
    const card = document.getElementById('receipt-card');
    if (!card) return;
    // Use html-to-image-free approach: serialize to SVG foreignObject, then to canvas
    try {
      const rect = card.getBoundingClientRect();
      const scale = 2;
      const w = Math.ceil(rect.width);
      const h = Math.ceil(rect.height);
      const cloned = card.cloneNode(true);
      // Remove action buttons from the clone
      const actions = cloned.querySelector('.receipt-actions');
      if (actions) actions.remove();
      // Inline the cloned styles by wrapping in styled container
      const styleSheets = Array.from(document.styleSheets).map(ss => {
        try {
          return Array.from(ss.cssRules).map(r => r.cssText).join('\n');
        } catch (e) { return ''; }
      }).join('\n');
      const cloneHeight = h - 80; // remove action button area
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${cloneHeight}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="background:#F4EFE6;padding:0;width:${w}px;">
            <style>${styleSheets}</style>
            ${cloned.outerHTML}
          </div>
        </foreignObject>
      </svg>`;
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w * scale;
        canvas.height = cloneHeight * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#F4EFE6';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, w * scale, cloneHeight * scale);
        canvas.toBlob(b => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = 'anti-receipt.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
      };
      img.onerror = () => {
        // Fallback: just copy text
        copyReceiptText({}, '');
        alert('PNG export blocked by browser. Receipt text copied instead.');
      };
      img.src = url;
    } catch (e) {
      console.error('download failed', e);
      alert('Could not export PNG. Try the "Copy text" button.');
    }
  }

  function copyReceiptText(data, refNum) {
    const card = document.getElementById('receipt-card');
    if (!card) return;
    const lines = [];
    const item = card.querySelectorAll('.receipt-line');
    lines.push('★ ANTI-RECEIPT — ALMOST ★');
    lines.push('');
    item.forEach(line => {
      const label = line.querySelector('.label').textContent;
      const val = line.querySelector('.val').textContent;
      lines.push(`${label}: ${val}`);
    });
    const blurb = card.querySelector('.receipt-blurb');
    if (blurb) { lines.push(''); lines.push(blurb.textContent); }
    const kept = card.querySelector('.receipt-kept-for');
    if (kept) { lines.push(''); lines.push(kept.textContent); }
    const total = card.querySelector('.receipt-total .amount');
    if (total) { lines.push(''); lines.push('KEPT: ' + total.textContent); }
    lines.push('');
    lines.push('— almost.majorsolutions.studio');
    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copy-btn');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = orig; }, 1400);
      }
    }).catch(() => alert('Copy failed — please select manually.'));
  }

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = document.getElementById('item').value.trim();
    const price = parseFloat(document.getElementById('price').value);
    const store = document.getElementById('store').value.trim();
    const reason = document.getElementById('reason').value.trim();

    if (!item || !price || !reason) return;

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, price, store, reason })
      });
      if (!resp.ok) throw new Error('Server returned ' + resp.status);
      const data = await resp.json();
      const enriched = { item, price, store, reason, ...data };
      renderReceipt(enriched);
      // Update session totals
      const s = loadSession();
      s.total += price;
      s.count += 1;
      s.cards = (s.cards || []).concat({ item, price, blurb: data.blurb, vibe_label: data.vibe_label, ts: Date.now() }).slice(-50);
      saveSession(s);
      renderTotals();
      // Refresh the wall (non-blocking)
      loadWall();
    } catch (err) {
      console.error(err);
      resultPane.innerHTML = `<div class="placeholder">
        <p class="placeholder-text" style="color: var(--terracotta-deep);">
          The receipt printer jammed. Try again in a moment.
        </p>
      </div>`;
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });

  // Email capture
  subscribeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    if (!email) return;
    subscribeStatus.classList.remove('error');
    subscribeStatus.textContent = 'Saving…';
    try {
      const resp = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Sign-up failed');
      }
      subscribeStatus.textContent = 'Saved. Watch for your monthly anti-haul.';
      subscribeForm.reset();
    } catch (err) {
      subscribeStatus.classList.add('error');
      subscribeStatus.textContent = err.message || 'Something went sideways. Try again?';
    }
  });

  // Wall of recent
  async function loadWall() {
    try {
      const resp = await fetch('/api/history');
      if (!resp.ok) throw new Error('history fetch failed');
      const data = await resp.json();
      const items = (data.items || []).slice(0, 12);
      if (items.length === 0) {
        wallGrid.innerHTML = `<div class="wall-empty">No anti-receipts yet. Be the first to skip something.</div>`;
        return;
      }
      wallGrid.innerHTML = items.map(it => `
        <div class="wall-card">
          <div class="wc-item">${escapeHtml(it.item || 'something')}</div>
          <div class="wc-blurb">"${escapeHtml(it.blurb || '')}"</div>
          <div class="wc-meta">
            <span>${escapeHtml(it.vibe_label || '')}</span>
            <span class="wc-amount">${fmtMoney(it.price)}</span>
          </div>
        </div>
      `).join('');
    } catch (e) {
      wallGrid.innerHTML = `<div class="wall-empty">Wall offline. Your skip still counts.</div>`;
    }
  }

  // Init
  renderTotals();
  loadWall();
})();
