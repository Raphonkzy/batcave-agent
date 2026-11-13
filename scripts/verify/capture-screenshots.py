"""Captures the README screenshots from a running Batcave.

Usage:  python scripts/verify/capture-screenshots.py [base_url] [out_dir]
Needs:  pip install playwright && playwright install chromium

Two sources of agents:
  - Real data: run `npm run build && npm start` and use the default base URL (http://127.0.0.1:3001).
  - Mock crew: the `?mockAgents=N` URL flag only works in the development build, so use
    `npm run dev` and pass its address (http://localhost:5173). Shots with a query use the mock crew.

The 3D manor opens at the default camera (about 60 degrees). Batcave (the command deck) is
reached with the `]` key, which moves one floor down.
"""
import os
import sys
import time
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3001'
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'docs', 'screenshots')
os.makedirs(out, exist_ok=True)

# (file name, query, route hash, seconds to settle, keys pressed first, button to click first)
SHOTS = [
  ('manor', '?mockAgents=12', '#/batcave', 14, '', None),
  ('batcave', '?mockAgents=12', '#/batcave', 12, ']', None),
  ('briefing', '?mockAgents=12', '#/batcave', 4, '', 'Briefing'),
  ('agents', '', '#/agents', 6, '', None),
  ('settings', '', '#/settings', 5, '', None),
]

with sync_playwright() as p:
  browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
  page = browser.new_page(viewport={'width': 1600, 'height': 900})
  for name, query, route, wait, keys, button in SHOTS:
    page.goto(f'{base}/{query}{route}')
    time.sleep(wait)
    if keys:
      page.keyboard.press(keys)
      time.sleep(6)
    if button:
      page.get_by_role('button', name=button).first.click()
      time.sleep(2)
    target = os.path.join(out, f'{name}.png')
    page.screenshot(path=target, timeout=90000)
    print('saved', target)
  browser.close()
