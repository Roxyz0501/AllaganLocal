import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {characterArchiveReader} from '../character-archive.mjs';

test('optional archive follows exact ulong IDs, updates, corruption and removal', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'archive-reader-'));
  const file = path.join(dir, 'CharacterArchive.json');
  const lookup = characterArchiveReader(file);
  const id = '18014398549107457';
  assert.equal(await lookup(id), undefined);
  await writeFile(file, '{"Characters":[{"ContentId":18014398549107456,"Race":"Other","MainScenario":{"QuestName":"Quest A"}},{"ContentId":18014398549107457,"Race":"Test","PlayTimeMinutes":0,"ConfigFolderPath":"private"}]}');
  const [first, second] = await Promise.all([lookup(id), lookup('18014398549107456')]);
  assert.deepEqual(first.map(row => row[1]), ['0 h 0 min']);
  assert.deepEqual(second.map(row => row[1]), ['Quest A']);
  assert.equal(await lookup('42'), undefined);
  await writeFile(file, '{');
  assert.equal(await lookup(id), undefined);
  await writeFile(file, '{"Characters":[{"ContentId":18014398549107457,"ClassJob":"Paladin","Level":99,"Jobs":[{"Name":"Paladin","Level":99}],"HomeWorld":"Typhon","CurrentWorld":"Typhon"}]}');
  assert.equal(await lookup(id), undefined);
  await writeFile(file, JSON.stringify({Characters:[{ContentId:id,HomeWorld:'Typhon',CurrentWorld:'Atomos'}]}));
  assert.equal(await lookup(id), undefined);
  await unlink(file);
  assert.equal(await lookup(id), undefined);
});
