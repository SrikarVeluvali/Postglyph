import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { makeClassifier } from './classifier.js';
import { makeHttpServer } from './http.js';

const key = process.env.TYPESAFE_API_KEY;
if (!key) {
  console.error('Set TYPESAFE_API_KEY before starting the helper.');
  process.exit(1);
}

async function localToken(): Promise<string> {
  if (process.env.POSTGLYPH_LOCAL_TOKEN) return process.env.POSTGLYPH_LOCAL_TOKEN;
  const directory = join(process.cwd(), '.postglyph');
  const file = join(directory, 'local-token');
  await mkdir(directory, { recursive: true });
  try {
    const saved = (await readFile(file, 'utf8')).trim();
    if (saved) return saved;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const generated = randomBytes(24).toString('hex');
  await writeFile(file, generated, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return generated;
}

const token = await localToken();
const server = makeHttpServer(makeClassifier(key), token);
server.listen(43187, '127.0.0.1', () => {
  console.log('Postglyph helper listening on http://127.0.0.1:43187');
  console.log(`Local helper token: ${token}`);
  console.log('Paste this token into the Postglyph popup.');
});
