"""Run with fontTools; inputs downloaded from pinned Noto CJK source into artifacts/font-source."""
import json, pathlib, sys, hashlib
sys.path.insert(0, str(pathlib.Path(__file__).parent / 'artifacts/python-libs'))
from fontTools import subset
from fontTools.ttLib import TTFont
root=pathlib.Path(__file__).parent
dictionary=json.loads((root/'Localization.json').read_text(encoding='utf-8-sig'))
texts=''.join(v for row in dictionary.values() for v in row.values())+'日本語EnglishDeutschFrançais한국어简体中文繁體中文言語 / Language'
for locale in (root/'web/public/locales').glob('*.json'):
    texts+=''.join(json.loads(locale.read_text(encoding='utf-8-sig')).values())
chars=set(map(ord,texts))|set(range(32,127))
report={}
for region in ['jp','kr','sc','tc']:
    source=root/f'artifacts/font-source/{region}.otf'
    font=TTFont(source)
    missing=chars-set(font.getBestCmap())-{10,13}
    if missing: raise RuntimeError(f'{region} missing {missing}')
    options=subset.Options(); options.name_IDs=['*']; options.name_legacy=True; options.name_languages=['*']
    worker=subset.Subsetter(options=options); worker.populate(unicodes=chars); worker.subset(font)
    family=f'Allagan UI {region.upper()}'
    for name in font['name'].names:
        if name.nameID in [1,3,4,6,16]: name.string=(family.replace(' ','') if name.nameID==6 else family).encode(name.getEncoding())
    font['CFF '].cff.fontNames=[family.replace(' ','')]
    top=font['CFF '].cff.topDictIndex[0];top.FamilyName=family;top.FullName=family
    output=root/f'fonts/{region}.otf';font.save(output)
    report[region]={'glyphs':len(chars),'bytes':output.stat().st_size,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'missing':[]}
(root/'fonts/coverage.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
