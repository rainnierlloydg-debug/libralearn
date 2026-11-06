"""Package reviewed application source without credentials or runtime data."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
DIRECTORIES = ['app', 'bootstrap', 'config', 'database', 'deploy', 'docs',
               'forecasting', 'frontend', 'public', 'railway', 'resources', 'routes', 'tests']
ROOT_FILES = ['.dockerignore', '.gitattributes', '.gitignore', '.env.example', 'artisan',
              'composer.json', 'composer.lock', 'Dockerfile', 'package.json', 'package-lock.json',
              'phpunit.xml', 'phpunit.pgsql.xml', 'railway.json', 'railway.worker.json',
              'railway.cron.json', 'render.yaml', 'vite.config.js', 'README.md']
SKIP = {'node_modules', '__pycache__', '.git', '.pytest_cache', '.venv', 'vendor', 'dist'}


def include(path):
    relative = path.relative_to(ROOT)
    if any(part in SKIP for part in relative.parts) or path.is_symlink():
        return False
    if path.name.startswith('.env') and path.name != '.env.example':
        return False
    if path.suffix in {'.key', '.pem', '.log', '.sqlite', '.llsnapshot'} or path.name.endswith('.local'):
        return False
    if relative.parts[:2] == ('bootstrap', 'cache') and path.suffix == '.php':
        return False
    if relative.as_posix() == 'public/hot' or relative.parts[:2] == ('public', 'storage'):
        return False
    return path.is_file()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if not output.is_relative_to(ROOT) or output.exists():
        raise ValueError('Choose a new output path inside the project workspace.')
    candidates = [ROOT / name for name in ROOT_FILES]
    for directory in DIRECTORIES:
        candidates.extend((ROOT / directory).rglob('*'))
    candidates.extend((ROOT / 'storage').rglob('.gitignore'))
    files = sorted({path for path in candidates if include(path)})
    required = ['docs/railway-deployment.md', 'Dockerfile', 'railway/run-worker.sh',
                'app/Services/Deployment/LibrarySnapshot.php', 'frontend/src/App.jsx']
    names = {path.relative_to(ROOT).as_posix() for path in files}
    if not all(name in names for name in required):
        raise ValueError('A required deployment file is missing.')
    output.parent.mkdir(parents=True, exist_ok=True)
    manifest = {}
    with ZipFile(output, 'x', compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for path in files:
            name = path.relative_to(ROOT).as_posix()
            content = path.read_bytes()
            manifest[name] = hashlib.sha256(content).hexdigest()
            archive.writestr(name, content)
        archive.writestr('RELEASE_MANIFEST.json', json.dumps(manifest, indent=2))
    with ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise ValueError('Archive validation failed.')
    print(json.dumps({'archive': str(output), 'source_files': len(files),
                      'bytes': output.stat().st_size, 'deployment_guide_included': True,
                      'secrets_and_runtime_data_included': False}, indent=2))


if __name__ == '__main__':
    main()
