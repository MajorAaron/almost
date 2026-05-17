// Almost — landing page client (email capture + smooth scroll)
(function () {
  const form = document.getElementById('signup-form');
  const status = document.getElementById('signup-status');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      if (!email) return;
      status.classList.remove('error');
      status.textContent = 'Saving…';
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
        status.textContent = 'Saved. Now go try the tool →';
        form.reset();
        setTimeout(() => { window.location.href = '/tool.html'; }, 1200);
      } catch (err) {
        status.classList.add('error');
        status.textContent = err.message || 'Something went sideways. Try again?';
      }
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();
