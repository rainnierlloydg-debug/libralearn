"""Create a clean upload tree; service settings are managed through Railway API/IaC."""
import argparse
import json
from pathlib import Path
import shutil
from package_release import ROOT, DIRECTORIES, ROOT_FILES, include

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True)
args = parser.parse_args()
target = Path(args.output).resolve()
if not target.is_relative_to(ROOT) or target.exists():
    raise ValueError('Choose a new staging directory inside the workspace.')
legacy = {'railway.json', 'railway.worker.json', 'railway.cron.json'}
files = [ROOT / name for name in ROOT_FILES if name not in legacy]
for directory in DIRECTORIES:
    files.extend((ROOT / directory).rglob('*'))
files.extend((ROOT / 'storage').rglob('.gitignore'))
count = 0
for source in sorted({path for path in files if include(path)}):
    destination = target / source.relative_to(ROOT)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.suffix == '.sh':
        destination.write_bytes(source.read_bytes().replace(b'\r\n', b'\n'))
    else:
        shutil.copyfile(source, destination)
    count += 1
print(json.dumps({'upload_directory': str(target), 'files': count, 'legacy_config_files': False, 'secrets_included': False}))
