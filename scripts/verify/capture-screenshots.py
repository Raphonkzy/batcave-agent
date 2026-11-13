"""Captures the README screenshots from a running Batcave (built UI).

Usage:  python scripts/verify/capture-screenshots.py [base_url] [out_dir]
Needs:  pip install playwright && playwright install chromium
Run against `npm run build && npm start`. Works on Windows and Linux.
"""
import os
import sys
import time
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3001'
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'docs', 'screenshots')
os.makedirs(out, exist_ok=True)

# (file name, route hash, seconds to settle, optional button label to click first)
SHOTS = [
  ('live', '#/batcave', 14, None),
  ('briefing', '#/batcave', 3, 'Briefing'),
  ('agents', '#/agents', 6, None),
  ('settings', '#/settings', 5, None),
]

with sync_playwright() as p:
  browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
  page = browser.new_page(viewport={'width': 1600, 'height': 900})
  page.goto(f'{base}/{SHOTS[0][1]}')
  for name, route, wait, button in SHOTS:
    if not (button and page.evaluate('location.hash') == route):
      page.evaluate(f"location.hash = '{route}'")
    time.sleep(wait)
    if button:
      page.get_by_role('button', name=button).first.click()
      time.sleep(2)
    target = os.path.join(out, f'{name}.png')
    page.screenshot(path=target, timeout=90000)
    print('saved', target)
  browser.close()
