import { describe, expect, it } from 'vitest';
import { linksSettingsSchema } from './definition';
import { anyTyped, linkItems } from './items';

const rows = (links: unknown[]) => linksSettingsSchema.parse({ links }).links;

describe('linkItems', () => {
  it('reads rows saved before folders as links', () => {
    const items = linkItems(rows([{ url: 'github.com', label: 'GitHub' }]));
    expect(items).toEqual([
      { kind: 'link', link: expect.objectContaining({ label: 'GitHub' }) },
    ]);
  });

  it('makes a folder of its openable links, named Folder when unnamed', () => {
    const [folder] = linkItems(
      rows([
        {
          kind: 'folder',
          links: [{ url: 'a.com' }, { url: 'javascript:alert(1)' }, { url: 'b.com' }],
        },
      ]),
    );
    expect(folder).toMatchObject({ kind: 'folder', name: 'Folder' });
    expect(folder?.kind === 'folder' && folder.links.map((l) => l.host)).toEqual([
      'a.com',
      'b.com',
    ]);
  });

  it('leaves out a folder with nothing that opens', () => {
    expect(linkItems(rows([{ kind: 'folder', name: 'Work', links: [] }]))).toEqual([]);
    expect(anyTyped(rows([{ kind: 'folder', links: [{ url: 'nope:' }] }]))).toBe(true);
  });

  it('ignores the address a folder kept from when it was a link', () => {
    const items = linkItems(
      rows([{ kind: 'folder', url: 'old.com', links: [{ url: 'new.com' }] }]),
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe('folder');
  });
});
