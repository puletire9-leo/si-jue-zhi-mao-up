import {
  buildMskuLookup,
  findMskuEntityByFlexibleKey,
  mskuKeysEquivalent,
  normalizeMskuKey,
} from '../../utils/msku_key';

describe('msku_key', () => {
  const rows = [
    { msku: 'RJH-20260529-HYBNN-2GZ- ', variant: 'a' },
    { msku: 'AYT-20260526-HYBNN-2GZ-C', variant: 'b' },
  ];
  const lookup = buildMskuLookup(rows);

  it('normalizeMskuKey trims', () => {
    expect(normalizeMskuKey('  abc  ')).toBe('abc');
  });

  it('mskuKeysEquivalent ignores outer spaces', () => {
    expect(mskuKeysEquivalent('RJH-20260529-HYBNN-2GZ-', 'RJH-20260529-HYBNN-2GZ- ')).toBe(true);
    expect(mskuKeysEquivalent('AYT-x', 'AYT-y')).toBe(false);
  });

  it('lookup resolves trimmed input to canonical row', () => {
    const row = lookup.resolve('RJH-20260529-HYBNN-2GZ-');
    expect(row?.variant).toBe('a');
    expect(lookup.canonicalMsku('RJH-20260529-HYBNN-2GZ-')).toBe('RJH-20260529-HYBNN-2GZ- ');
  });

  it('lookup resolves exact dirty key', () => {
    expect(lookup.resolve('RJH-20260529-HYBNN-2GZ- ')?.variant).toBe('a');
  });

  it('findMskuEntityByFlexibleKey uses TRIM fallback', async () => {
    const repo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ msku: 'RJH-20260529-HYBNN-2GZ- ' }),
      })),
    } as any;
    const row = await findMskuEntityByFlexibleKey(repo, 'RJH-20260529-HYBNN-2GZ-');
    expect(row?.msku).toBe('RJH-20260529-HYBNN-2GZ- ');
  });
});
