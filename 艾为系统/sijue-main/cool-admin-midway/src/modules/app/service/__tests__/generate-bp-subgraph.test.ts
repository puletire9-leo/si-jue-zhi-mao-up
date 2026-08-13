import { ReadableStream } from 'node:stream/web';

(globalThis as any).ReadableStream = (globalThis as any).ReadableStream || ReadableStream;

const {
  pickBestBulletPoint,
} = require('../ai_listing_graph/subgraphs/generate-bp-subgraph');

describe('generate bp subgraph helpers', () => {
  it('prefers a complete body over title-only fallback when strict rules are not all met', () => {
    const picked = pickBestBulletPoint(
      [
        '',
        'This projector creates a calming ocean ambience across the room with rotating light movement and USB convenience for daily bedroom use.',
      ],
      ['christmas projector light', 'galaxy projector light for bedroom'],
      'Dynamic Water Ripple',
      ['Dynamic water ripple projection with USB convenience'],
      ['Built-in rechargeable battery'],
    );

    expect(picked).toContain('This projector creates a calming ocean ambience');
  });
});
