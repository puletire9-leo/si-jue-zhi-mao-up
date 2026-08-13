import { CoolController, BaseController } from '@cool-midway/core';
import { Body, Get, Inject, Post } from '@midwayjs/core';
import {
  ListingBannedWordInput,
  ListingBannedWordService,
} from '../../service/listing_banned_word';

@CoolController('/admin/app/listingBannedWord')
export class AdminAppListingBannedWordController extends BaseController {
  @Inject()
  listingBannedWordService: ListingBannedWordService;

  @Inject()
  ctx;

  private currentUserId(): number {
    const uid = Number(this.ctx?.admin?.userId || 0);
    if (!uid) throw new Error('未登录');
    return uid;
  }

  @Get('/list')
  async list() {
    const list = await this.listingBannedWordService.listAllWithSubmitter();
    return this.ok({ list });
  }

  @Post('/saveReplace')
  async saveReplace(
    @Body('items') items?: ListingBannedWordInput[]
  ) {
    const userId = this.currentUserId();
    const list = await this.listingBannedWordService.replaceAllForUser(
      userId,
      Array.isArray(items) ? items : []
    );
    return this.ok({ list });
  }

  @Post('/add')
  async addBannedWord(@Body() body: ListingBannedWordInput) {
    const userId = this.currentUserId();
    const row = await this.listingBannedWordService.addOne(userId, {
      word: body?.word,
      reason: body?.reason,
    });
    return this.ok({ row });
  }

  @Post('/update')
  async updateBannedWord(
    @Body('id') id: number,
    @Body('word') word?: string,
    @Body('reason') reason?: string
  ) {
    const userId = this.currentUserId();
    const row = await this.listingBannedWordService.updateOne(userId, Number(id), {
      word,
      reason,
    });
    return this.ok({ row });
  }

  @Post('/delete')
  async deleteBannedWord(@Body('id') id: number) {
    const userId = this.currentUserId();
    const row = await this.listingBannedWordService.deleteOne(userId, Number(id));
    return this.ok(row);
  }
}
