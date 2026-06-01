/**
 * Live moisture widget for the home page (unit 03).
 * Polls terrarium.json from a public GitHub Gist.
 */
(() => {
  const GIST_USER = 'rossorudolph';
  const GIST_ID = '5c91c7daad303e56223b83657721515d';
  const REFRESH_MS = 60_000;
  const STALE_AFTER_S = 300;
  const MARKER_STROKE = 'rgba(130, 155, 138, 0.38)';
  const GRAPH_STROKE = 'rgba(143, 168, 150, 0.88)';
  const GRAPH_FILL = 'rgba(143, 168, 150, 0.16)';

  const $widget = document.getElementById('unit03-widget');
  if (!$widget) return;

  const $val = document.getElementById('unit03-val');
  const $voltage = document.getElementById('unit03-voltage');
  const $spark = document.getElementById('unit03-spark');
  const $bio = document.getElementById('main-bio');

  function alignWidgetToBio() {
    if (!$bio) return;
    const r = $bio.getBoundingClientRect();
    $widget.style.setProperty('--unit03-top', `${r.top}px`);
    $widget.style.setProperty('--unit03-inset', `${Math.round(r.left)}px`);
  }

  alignWidgetToBio();
  window.addEventListener('resize', alignWidgetToBio);
  window.addEventListener('load', alignWidgetToBio);
  if (document.fonts?.ready) {
    document.fonts.ready.then(alignWidgetToBio);
  }
  if ($bio && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(alignWidgetToBio);
    ro.observe($bio);
  }
  requestAnimationFrame(alignWidgetToBio);

  function renderSparkline(history, events) {
    if (!history || history.length < 2) {
      $spark.innerHTML = '';
      return;
    }
    const W = 132;
    const H = 32;
    const P = 3;
    const xmin = history[0].t;
    const xmax = history[history.length - 1].t;
    const xspan = Math.max(1, xmax - xmin);
    const px = (t) => P + ((t - xmin) / xspan) * (W - 2 * P);

    const moistures = history.map((p) => p.m);
    let mMin = Math.min(...moistures);
    let mMax = Math.max(...moistures);
    let mSpan = mMax - mMin;
    if (mSpan < 1) {
      mMin -= 4;
      mMax += 4;
      mSpan = mMax - mMin;
    } else {
      const pad = Math.max(1.5, mSpan * 0.1);
      mMin -= pad;
      mMax += pad;
      mSpan = mMax - mMin;
    }
    const py = (m) =>
      P + (1 - (Math.max(mMin, Math.min(mMax, m)) - mMin) / mSpan) * (H - 2 * P);
    const d = history
      .map((p, i) => (i === 0 ? 'M' : 'L') + px(p.t).toFixed(1) + ',' + py(p.m).toFixed(1))
      .join(' ');
    const dFill =
      d +
      ` L ${(W - P).toFixed(1)},${(H - P).toFixed(1)}` +
      ` L ${P.toFixed(1)},${(H - P).toFixed(1)} Z`;
    const lastY = py(history[history.length - 1].m).toFixed(1);
    const lastX = px(history[history.length - 1].t).toFixed(1);

    const eventLines = (events || [])
      .filter((e) => e.t >= xmin && e.t <= xmax)
      .map((e) => {
        const x = px(e.t).toFixed(1);
        return `<line x1="${x}" x2="${x}" y1="${P}" y2="${H - P}"
                       stroke="${MARKER_STROKE}" stroke-width="1"
                       stroke-dasharray="2,3" />`;
      })
      .join('');

    $spark.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        ${eventLines}
        <path d="${dFill}" fill="${GRAPH_FILL}" />
        <path d="${d}" fill="none" stroke="${GRAPH_STROKE}" stroke-width="1.25"
              stroke-linejoin="round" stroke-linecap="round" />
        <circle cx="${lastX}" cy="${lastY}" r="2" fill="${GRAPH_STROKE}" />
      </svg>
    `;
  }

  function render(data) {
    $widget.classList.remove('is-fogging', 'is-dry', 'is-stale', 'is-offline');
    $widget._lastData = data;

    const m = data.moisture;
    $val.textContent = (m != null ? Math.round(m) : '--') + '%';
    $voltage.textContent =
      data.voltage != null ? data.voltage.toFixed(3) + 'V' : '--V';

    renderSparkline(data.history_24h, data.events_24h);

    const age = Math.floor(Date.now() / 1000 - (data.updated_at || 0));
    if (age > STALE_AFTER_S) {
      $widget.classList.add('is-stale');
    }

    alignWidgetToBio();
  }

  function showError() {
    $widget.classList.add('is-offline');
    $val.textContent = '--%';
    $voltage.textContent = '--V';
    $spark.innerHTML = '';
  }

  async function update() {
    try {
      const url = `https://gist.githubusercontent.com/${GIST_USER}/${GIST_ID}/raw/terrarium.json?t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      render(await res.json());
    } catch (err) {
      console.error('Unit 03 feed error:', err);
      showError();
    }
  }

  update();
  setInterval(update, REFRESH_MS);
})();
