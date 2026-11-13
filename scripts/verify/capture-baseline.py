import json
import os
import shutil
import time

PRESETS = ['deck', 'hangar', 'lobby', 'manor', 'overview']
PAGES = [
  'batcave',
  'agents',
  'usage',
  'task-board',
  'calendar',
  'activity',
  'memory',
  'folders',
  'logs',
  'settings'
]

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
out_dir = os.path.join(ROOT, 'docs', 'batcave-redesign', 'BASELINE', 'screens')
os.makedirs(out_dir, exist_ok=True)
perf_file = os.path.join(ROOT, 'docs', 'batcave-redesign', 'BASELINE', 'perf.json')

metrics = {
  'mockAgents12': {},
  'pages': {}
}

# 1. 3D Presets with mockAgents=12
for preset in PRESETS:
  print(f'Capturing preset: {preset}')
  goto_url(f'http://localhost:5173/?mockAgents=12&debugStats=1#/batcave')
  time.sleep(2)
  # Click the preset button in .manor-camera-widget
  js(f'''(() => {{
    const buttons = Array.from(document.querySelectorAll('.manor-camera-widget button'));
    const btn = buttons.find(b => b.textContent.toLowerCase().includes('{preset}'));
    if (btn) btn.click();
  }})()''')
  time.sleep(2)
  stats = js('window.__batcaveRenderStats || {}')
  metrics['mockAgents12'][preset] = stats
  shot = capture_screenshot()
  target = os.path.join(out_dir, f'preset-{preset}.png')
  if os.path.exists(shot):
    shutil.copyfile(shot, target)
    print(f'Saved {target}')

# 2. Each page
for page in PAGES:
  print(f'Capturing page: {page}')
  goto_url(f'http://localhost:5173/?mockAgents=12#/ {page}'.replace('/ ', '/'))
  time.sleep(1.5)
  shot = capture_screenshot()
  target = os.path.join(out_dir, f'page-{page}.png')
  if os.path.exists(shot):
    shutil.copyfile(shot, target)
    print(f'Saved {target}')

with open(perf_file, 'w', encoding='utf8') as f:
  json.dump(metrics, f, indent=2)
print('Done capturing baseline. Saved metrics to', perf_file)
