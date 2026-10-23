"""Record code/config hashes without reading secrets or generated artifacts."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path(__file__).resolve().parent / 'source-manifest.json'
EXTENSIONS = {'.ts', '.tsx', '.py', '.mjs', '.json', '.css', '.sql'}


def files(root):
    paths = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=root).decode().split('\0')
    result = {}
    for name in sorted(set(paths)):
        if not name or name.startswith(('docs/', 'public/', '.codex-tmp/', 'graphify-out/')):
            continue
        path = root / name
        if path.is_file() and path.suffix in EXTENSIONS:
            result[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


record = {'capturedAtUTC': datetime.now(timezone.utc).isoformat(),
          'baselineCommit': 'c809b34d83829650e6e052c198b510153c76d26d',
          'workingTree': 'uncommitted implementation; file hashes identify tested candidate',
          'files': files(ROOT)}
ai_root = ROOT.parent / 'Ollama reactjs LLM DeepSeek Integration'
if ai_root.is_dir():
    record['aiServer'] = {'root': str(ai_root),
                          'baselineCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ai_root).decode().strip(),
                          'files': files(ai_root)}
OUTPUT.write_text(json.dumps(record, indent=2), encoding='utf-8')
print(f"Captured {len(record['files'])} eFlow code/config hashes.")
