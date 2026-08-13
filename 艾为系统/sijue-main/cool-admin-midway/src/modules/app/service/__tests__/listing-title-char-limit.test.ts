import { assertMasterTitleLength } from '../listing-title-char-limit';

describe('listing-title-char-limit', () => {
  it('rejects master title over 200 chars', () => {
    expect(() => assertMasterTitleLength('a'.repeat(201), '英语')).toThrow(
      /超过 200 字上限/
    );
  });

  it('allows master title at 200 chars', () => {
    expect(() => assertMasterTitleLength('a'.repeat(200), '英语')).not.toThrow();
  });
});
