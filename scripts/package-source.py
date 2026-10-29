"""Build a portable, deterministic source ZIP (Python standard library only)."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
root = Path(__file__).resolve().parents[1]
output = root / 'public' / 'kinkaramen-waiting-source.zip'
excluded = {'node_modules', 'dist', '.git', '.openai', '.sites-runtime', '__pycache__'}
files = sorted(p for p in root.rglob('*') if p.is_file() and not excluded.intersection(p.relative_to(root).parts) and p.suffix not in {'.zip', '.tsbuildinfo'} and not p.name.startswith(('qa-', '.env')))
with ZipFile(output, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        info = ZipInfo('kinkaramen-waiting/' + path.relative_to(root).as_posix(), date_time=(2026, 10, 29, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, path.read_bytes())
print(f'{output}: {len(files)} files, {output.stat().st_size} bytes')
