"""Development-only external JSON Schema check; requires Python jsonschema.
Run from the repository root: python tests/validate-portable-schema.py
No Python dependency is installed or used by the Foundry module.
"""
import json
from pathlib import Path
import subprocess
from jsonschema import Draft202012Validator

root = Path(__file__).resolve().parent.parent
schemas = [root / 'docs/sector-portable.schema.json', root / 'docs/sector-json/sector.schema.json']
files = sorted((root / 'docs/examples').glob('*.json')) + sorted((root / 'docs/sector-json').glob('example-*.json')) + [root / 'tests/fixtures/sector-special-legacy-v1.json']
validators = []
for path in schemas:
    schema = json.loads(path.read_text())
    Draft202012Validator.check_schema(schema)
    validators.append(Draft202012Validator(schema))
count = 0
for path in files:
    original = json.loads(path.read_text())
    result = subprocess.run(['node', '--input-type=module', '-e', "import fs from 'node:fs';import {deserializeSector,serializeSector} from './scripts/portable/serialization.mjs';const file=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(serializeSector(deserializeSector(file,{code:'A1',sceneId:'schema-world'}),{moduleVersion:'0.1.55'})));"], input=json.dumps(original), text=True, capture_output=True, check=True, cwd=root)
    exported = json.loads(result.stdout)
    for validator in validators:
        validator.validate(original)
        validator.validate(exported)
        count += 2
    print('PASS', path.relative_to(root), '(input and runtime round trip, both schemas)')
base = {'format':'myz-sector-manager','formatVersion':1,'schemaVersion':1,'sector':{'sectorType':'normal'}}
bad = []
for sector in [{'sectorType':'wrong'}, {'sectorType':'normal','loot':None}, {'sectorType':'normal','threatLevel':9007199254740992}]:
    bad.append({**base, 'sector':sector})
for unknown in [[{'value':None}], [{'path':['sector','x']}]]:
    bad.append({**base, 'extensions':{'unknown':unknown}})
for validator in validators:
    for invalid in bad:
        assert not validator.is_valid(invalid), invalid
print(f'{count} valid document/schema checks and {len(bad)*len(validators)} invalid document/schema checks passed')
