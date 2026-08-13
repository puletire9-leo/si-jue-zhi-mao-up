import { BaiduTranslateService } from '../baidu_translate';

describe('BaiduTranslateService', () => {
  it('joins multi-line baidu results for a single text item', async () => {
    const service = new BaiduTranslateService() as any;
    service.requestBaiduTranslate = jest
      .fn()
      .mockResolvedValue(['第一段中文', '第二段中文']);

    const translated = await service.translateByBaidu(
      'first paragraph\nsecond paragraph',
      'zh'
    );

    expect(translated).toBe('第一段中文\n第二段中文');
  });

  it('translates multiline batch items individually so paragraphs are preserved', async () => {
    const service = new BaiduTranslateService() as any;
    service.enableOpenAIFallback = false;
    service.translateByBaidu = jest
      .fn()
      .mockImplementation(async (text: string) =>
        text === 'line 1\nline 2' ? '第一行\n第二行' : '单行结果'
      );
    service.requestBaiduTranslate = jest.fn().mockResolvedValue(['单行结果']);

    const map = await service.translateUnknownToZhBatch([
      { key: 'desc', text: 'line 1\nline 2', from: 'en' },
      { key: 'title', text: 'single line', from: 'en' },
    ]);

    expect(map).toEqual({
      desc: '第一行\n第二行',
      title: '单行结果',
    });
    expect(service.translateByBaidu).toHaveBeenCalledWith('line 1\nline 2', 'zh');
  });
});
