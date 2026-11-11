"""Restarts the Batcave server while a browser has the app open, and reports what the UI does.

Usage: python scripts/verify/backend-restart.py   (run from the repository root, after npm run build)

The script owns the server process: it starts it, kills it mid-session, starts it again, and
watches the status line and the page itself (a reload would reset the marker it sets).
"""
import os
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:3001'
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def start_server():
    env = dict(os.environ)
    return subprocess.Popen(['node', 'bin/batcave.js'], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def wait_up(timeout=30):
    end = time.time() + timeout
    while time.time() < end:
        try:
            urllib.request.urlopen(f'{BASE}/api/health', timeout=2).read()
            return True
        except Exception:
            time.sleep(0.3)
    return False


PILL = ".mo-settings-section:last-of-type .mo-pill"


def status(page):
    return page.evaluate("(sel) => document.querySelector(sel)?.textContent ?? null", PILL)


def wait_for(page, predicate_js, timeout_s):
    started = time.time()
    try:
        page.wait_for_function(predicate_js, timeout=timeout_s * 1000)
        return round(time.time() - started, 1)
    except Exception:
        return None


# The Settings page shows the shared connection state without rendering the 3D scene (a software
# renderer would starve the Hermes CLI of CPU and distort the timings).
server = start_server()
assert wait_up(), 'server did not start'
result = {}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 768})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(f'{BASE}/#/settings')
    page.wait_for_selector('.lot-app')
    page.evaluate('window.__notReloaded = true')
    result['connectedAfterStartS'] = wait_for(page, "() => /Hermes connected/.test(document.body.innerText)", 60)
    result['statusBefore'] = status(page)

    server.terminate()
    server.wait(timeout=10)
    killed_at = time.time()
    result['detectedServerLossS'] = wait_for(page, "() => /Reconnecting to the Batcave server/.test(document.body.innerText)", 40)
    result['statusWhileDown'] = status(page)
    result['fullScreenLoadingWhileDown'] = page.evaluate("!!document.querySelector('.loading-state')")
    result['pageRenderedWhileDown'] = page.evaluate("!!document.querySelector('.mo-page-settings')")
    time.sleep(max(0, 25 - (time.time() - killed_at)))

    server = start_server()
    assert wait_up(), 'server did not come back'
    result['recoveredAfterServerBackS'] = wait_for(page, "() => /Hermes connected/.test(document.body.innerText)", 60)
    result['statusAfter'] = status(page)
    result['pageWasReloaded'] = not page.evaluate('window.__notReloaded === true')
    result['pageErrors'] = errors
    result['serverAgentStatusAfterRestart'] = urllib.request.urlopen(f'{BASE}/api/agent/status').read().decode()[:300]
    browser.close()
server.terminate()
for key, value in result.items():
    print(f'{key}: {value}')
sys.exit(0)
