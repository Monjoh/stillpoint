import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * THIRD_PARTY_NOTICES.txt, written into the built extension: the licence of every npm
 * package whose code ended up in it. MIT asks for its notice to travel with copies,
 * and a minified bundle strips the comments that would otherwise carry it.
 *
 * The list is read from the bundle itself, not kept by hand: the Vite plugin records
 * each package with code in an emitted chunk, across every build WXT runs, and
 * `write` is called once they are all done. A dependency added or dropped changes the
 * file on the next build.
 */
export function thirdPartyNotices(root: string) {
  const found = new Set<string>();

  const plugin: Plugin = {
    name: 'stillpoint:third-party-notices',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const [id, module] of Object.entries(output.modules)) {
          if (module.renderedLength === 0) continue;
          const name = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(id)?.[1];
          if (name) found.add(name);
        }
      }
    },
  };

  function write(outDir: string): void {
    if (found.size === 0) return;
    const sections = [...found].sort().map((name) => section(root, name));
    writeFileSync(
      join(outDir, 'THIRD_PARTY_NOTICES.txt'),
      [HEADER, ...sections].join(`\n\n${'='.repeat(78)}\n\n`) + '\n',
    );
  }

  return { plugin, write };
}

const HEADER = `Stillpoint includes the following third-party software. Each is listed with
its version and licence. Stillpoint itself is licensed under the GNU General
Public License, version 3 or later: see LICENSE.txt.`;

interface PackageJson {
  version: string;
  license?: string;
  author?: string | { name?: string };
}

function section(root: string, name: string): string {
  const dir = join(root, 'node_modules', name);
  const pkg = JSON.parse(
    readFileSync(join(dir, 'package.json'), 'utf8'),
  ) as PackageJson;
  const file = readdirSync(dir).find((f) => /^licen[cs]e(\.|$)/i.test(f));
  const heading = `${name} ${pkg.version} (${pkg.license ?? 'no licence declared'})`;

  if (file) return `${heading}\n\n${readFileSync(join(dir, file), 'utf8').trim()}`;

  // Some packages declare MIT in package.json but ship no licence file (WXT's own).
  // The MIT text is fixed; only the copyright line comes from the package.
  const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name;
  if (pkg.license === 'MIT' && author) {
    return `${heading}\n\nThis package ships no licence file; its package.json declares MIT.\n\n${mit(author.replace(/\s*<.*>$/, ''))}`;
  }
  throw new Error(
    `third-party notices: ${name} has no licence file and no MIT declaration with an author. Add its licence by hand before shipping.`,
  );
}

function mit(holder: string): string {
  return `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
}
