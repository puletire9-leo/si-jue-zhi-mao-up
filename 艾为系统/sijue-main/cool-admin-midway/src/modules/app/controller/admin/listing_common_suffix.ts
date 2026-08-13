import { CoolController, BaseController } from '@cool-midway/core';
import { Body, Get, Inject, Post } from '@midwayjs/core';
import { ListingCommonSuffixService } from '../../service/listing_common_suffix';

@CoolController('/admin/app/listingCommonSuffix')
export class AdminAppListingCommonSuffixController extends BaseController {
  @Inject()
  listingCommonSuffixService: ListingCommonSuffixService;

  @Inject()
  ctx;

  private currentUserId(): number {
    const uid = Number(this.ctx?.admin?.userId || 0);
    if (!uid) throw new Error('未登录');
    return uid;
  }

  @Get('/list')
  async list() {
    const list = await this.listingCommonSuffixService.listAllWithSubmitter();
    return this.ok({ list });
  }

  @Post('/add')
  async addCommonSuffix(
    @Body()
    body: { use_scene?: string; suffix_en?: string; suffix_de?: string }
  ) {
    const userId = this.currentUserId();
    const row = await this.listingCommonSuffixService.addOne(userId, {
      use_scene: body?.use_scene,
      suffix_en: body?.suffix_en,
      suffix_de: body?.suffix_de,
    });
    return this.ok({ row });
  }

  @Post('/update')
  async updateCommonSuffix(
    @Body('id') id: number,
    @Body('use_scene') use_scene?: string,
    @Body('suffix_en') suffix_en?: string,
    @Body('suffix_de') suffix_de?: string
  ) {
    const userId = this.currentUserId();
    const row = await this.listingCommonSuffixService.updateOne(
      userId,
      Number(id),
      { use_scene, suffix_en, suffix_de }
    );
    return this.ok({ row });
  }

  @Post('/delete')
  async deleteCommonSuffix(@Body('id') id: number) {
    const userId = this.currentUserId();
    const row = await this.listingCommonSuffixService.deleteOne(
      userId,
      Number(id)
    );
    return this.ok(row);
  }

  @Post('/translateEnToDe')
  async translateEnToDe(@Body('text') text?: string) {
    const translated = await this.listingCommonSuffixService.translateEnToDe(
      String(text || '')
    );
    return this.ok({ text: translated });
  }
}
