"""Measures what navigating between Batcave pages costs (requests, loading flashes, memory).

Usage:  python scripts/verify/navigation-metrics.py [base_url] [out.json] [rounds]

Run against a server that serves the built UI (npm run build && npm start) and has a warm cache.
Reports real numbers only: nothing in the output is estimated.
"""
import json
import re
import sys
import time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3001'
OUT = sys.argv[2] if len(sys.argv) > 2 else None
ROUNDS = int(sys.argv[3]) if len(sys.argv) > 3 else 20
PAGES = ['batcave', 'missions', 'agents', 'usage', 'task-board', 'calendar', 'activity', 'memory', 'folders', 'logs', 'settings']
SETTLE_MS = 450
LOADING = re.compile(r'Connecting|Loading|Looking for', re.I)

INIT = """
window.__webglContexts = 0;
const orig = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function(type, ...rest) {
  if (type === 'webgl' || type === 'webgl2') window.__webglContexts++;
  return orig.call(this, type, ...rest);
};
window.__eventSources = 0; window.__webSockets = 0;
const ES = window.EventSource; if (ES) window.EventSource = function(...a){ window.__eventSources++; return new ES(...a) };
const WS = window.WebSocket; window.WebSocket = function(...a){ window.__webSockets++; return new WS(...a) };
"""


def counters(cdp):
    cdp.send('HeapProfiler.collectGarbage')
    metrics = {m['name']: m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
    dom = cdp.send('Memory.getDOMCounters')
    return {
        'jsHeapUsedMB': round(metrics['JSHeapUsedSize'] / 1048576, 2),
        'domNodes': dom['nodes'],
        'jsEventListeners': dom['jsEventListeners'],
    }


def warm_server():
    """Fills the server cache first, so the run measures navigation and not a cold Hermes read."""
    import urllib.request
    for path in ('usage?days=7', 'channels', 'logs', 'dashboard', 'office', 'tasks', 'calendar', 'activity', 'memory', 'folders', 'runtime'):
        started = time.time()
        try:
            urllib.request.urlopen(f'{BASE}/api/{path}', timeout=300).read()
        except Exception as error:  # the server may be down or locked; the run will say so
            print(f'warm-up {path} failed: {error}')
        print(f'warm-up /api/{path}: {time.time() - started:.1f}s')


def main():
    warm_server()
    api = []  # (timestamp, method, path)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'])
        context = browser.new_context(viewport={'width': 1366, 'height': 768})
        page = context.new_page()
        page.add_init_script(INIT)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: api.append((time.time(), r.method, re.sub(r'^https?://[^/]+', '', r.url))) if '/api/' in r.url else None)
        cdp = context.new_cdp_session(page)
        cdp.send('Performance.enable')

        started = time.time()
        page.goto(f'{BASE}/#/batcave', wait_until='domcontentloaded')
        page.wait_for_selector('.lot-app', timeout=120000)
        # Time until the crew indicator no longer says it is connecting.
        try:
            page.wait_for_function("() => /Crew connected|Crew data/.test(document.body.innerText)", timeout=90000)
        except Exception:
            print('page text at timeout:', page.evaluate('document.body.innerText')[:400])
            print('errors:', errors)
            print('api so far:', [(round(t - started, 1), path) for t, _, path in api][:30])
            raise
        initial_ready_s = round(time.time() - started, 2)
        page.wait_for_timeout(3000)
        initial_requests = len(api)

        before = counters(cdp)
        # Warm every page once so lazily loaded chunks do not count as navigation cost.
        for slug in PAGES:
            page.evaluate(f"location.hash = '/{slug}'")
            page.wait_for_timeout(SETTLE_MS)
        page.evaluate("location.hash = '/batcave'")
        page.wait_for_timeout(1500)
        before = counters(cdp)
        contexts_before = page.evaluate('window.__webglContexts')

        per_nav = []
        latencies = []
        loading_flashes = 0
        flash_pages = {}
        series = {}
        for round_number in range(1, ROUNDS + 1):
            if round_number in (1, 5, 10, 20):
                # Sample on the same page after a settle, to see whether anything grows per round.
                page.evaluate("location.hash = '/batcave'")
                page.wait_for_timeout(2500)
                series[round_number - 1] = counters(cdp)
            for slug in PAGES:
                mark = len(api)
                latency = page.evaluate(
                    """async (slug) => {
                        const t = performance.now();
                        location.hash = '/' + slug;
                        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                        return performance.now() - t;
                    }""", slug)
                latencies.append(latency)
                seen = bool(LOADING.search(page.evaluate('document.body.innerText')))
                page.wait_for_timeout(SETTLE_MS)
                if seen:
                    loading_flashes += 1
                    flash_pages[slug] = flash_pages.get(slug, 0) + 1
                per_nav.append(len(api) - mark)
        # Same page as the "before" sample, so the two readings are comparable.
        page.evaluate("location.hash = '/batcave'")
        page.wait_for_timeout(1500)
        after = counters(cdp)
        navigations = ROUNDS * len(PAGES)
        latencies.sort()
        result = {
            'base': BASE,
            'initialReadySeconds': initial_ready_s,
            'initialApiRequests': initial_requests,
            'navigations': navigations,
            'apiRequestsDuringNavigation': sum(per_nav),
            'apiRequestsPerNavigation': round(sum(per_nav) / navigations, 3),
            'loadingIndicatorShownOnNavigations': loading_flashes,
            'loadingIndicatorByPage': flash_pages,
            'navigationCommitMsMedian': round(latencies[len(latencies) // 2], 1),
            'navigationCommitMsP95': round(latencies[int(len(latencies) * 0.95)], 1),
            'memoryBefore': before,
            'memoryAfter': after,
            'memoryAfterNRounds': series,
            'webglContextsCreatedDuringNavigation': page.evaluate('window.__webglContexts') - contexts_before,
            'eventSourcesOpened': page.evaluate('window.__eventSources'),
            'webSocketsOpened': page.evaluate('window.__webSockets'),
            'pageErrors': errors,
        }
        # Per endpoint request totals during the navigation phase.
        counts = {}
        for _, _, path in api[initial_requests:]:
            key = path.split('?')[0]
            counts[key] = counts.get(key, 0) + 1
        result['requestsByEndpointDuringNavigation'] = counts
        browser.close()
    text = json.dumps(result, indent=2)
    print(text)
    if OUT:
        with open(OUT, 'w', encoding='utf8') as handle:
            handle.write(text + '\n')


main()
