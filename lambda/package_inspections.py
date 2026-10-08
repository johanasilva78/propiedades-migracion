"""Empaquetar con dependencias-pip o con --layer para usar un layer existente."""
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parent
dependencies = None if sys.argv[1] == '--layer' else Path(sys.argv[1]).resolve()
if dependencies is not None and not (dependencies / 'pg8000').is_dir():
    raise SystemExit('Instala requirements.txt con pip --target antes de empaquetar.')
target = root / ('inspections-lambda-layer.zip' if dependencies is None else 'inspections-lambda.zip')
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name in ('lambda_function.py', 'section-fields.json', 'field-types.json'):
        archive.write(root / 'inspections' / name, name)
    for item in sorted(dependencies.rglob('*')) if dependencies else []:
        if item.is_file() and '__pycache__' not in item.parts and item.suffix != '.pyc':
            archive.write(item, item.relative_to(dependencies))
print(f'Paquete creado: {target.name} ({target.stat().st_size} bytes).')
