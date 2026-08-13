import { BaseController, CoolController } from '@cool-midway/core';
import { Body, Get, Inject, Post, Query } from '@midwayjs/decorator';
import { ContentWorkItemEntity } from '../../entity/content_work_item';
import { ContentWorkbenchService } from '../../service/content_workbench';

@CoolController({
  api: [],
  entity: ContentWorkItemEntity,
})
export class AdminContentWorkbenchController extends BaseController {
  @Inject()
  contentWorkbenchService: ContentWorkbenchService;

  @Get('/page')
  async page(
    @Query('page') page = 1,
    @Query('size') size = 20,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('candidateId') candidateId?: number,
    @Query('uploadStatus') uploadStatus?: 'done' | 'todo'
  ) {
    const data = await this.contentWorkbenchService.page({
      page: Number(page),
      size: Number(size),
      keyword,
      status,
      candidateId: candidateId != null ? Number(candidateId) : undefined,
      uploadStatus:
        uploadStatus === 'done' || uploadStatus === 'todo' ? uploadStatus : undefined,
    });
    return this.ok(data);
  }

  @Get('/detail')
  async detail(@Query('id') id: number) {
    const data = await this.contentWorkbenchService.detail(Number(id));
    return this.ok(data || null);
  }

  @Get('/timeline')
  async timelineByQuery(@Query('id') id: number) {
    const data = await this.contentWorkbenchService.getTimeline(Number(id));
    return this.ok(data);
  }

  @Post('/timeline')
  async timelineByBody(@Body('id') id: number) {
    const data = await this.contentWorkbenchService.getTimeline(Number(id));
    return this.ok(data);
  }

  @Get('/skuView')
  async skuView(@Query('candidateId') candidateId: number) {
    const data = await this.contentWorkbenchService.skuView(Number(candidateId));
    return this.ok(data || null);
  }

  @Post('/retry')
  async retry(
    @Body('workItemId') workItemId: number,
    @Body('domain') domain: 'ai' | 'design' | 'all'
  ) {
    const data = await this.contentWorkbenchService.retry({
      workItemId: Number(workItemId),
      domain: domain || 'all',
    });
    return this.ok(data);
  }

  @Post('/saveListingCopy')
  async saveListingCopy(
    @Body('workItemId') workItemId: number,
    @Body('copy') copy?: Record<string, any>
  ) {
    const data = await this.contentWorkbenchService.saveListingCopy(
      Number(workItemId),
      copy
    );
    return this.ok(data);
  }

  @Post('/markListingDone')
  async markListingDone(
    @Body('workItemId') workItemId: number,
    @Body('copy') copy?: Record<string, any>
  ) {
    const row = await this.contentWorkbenchService.markListingDone(
      Number(workItemId),
      copy
    );
    return this.ok({
      workItemId: row.id,
      listing_status: row.listing_status,
      listing_finished_at: row.listing_finished_at,
    });
  }

  @Post('/markUploadDone')
  async markUploadDone(@Body('workItemId') workItemId: number) {
    const row = await this.contentWorkbenchService.markUploadDone(Number(workItemId));
    return this.ok({
      workItemId: row.id,
      upload_status: row.upload_status,
      upload_finished_at: row.upload_finished_at,
    });
  }

  @Post('/updateSellerSku')
  async updateSellerSku(
    @Body('msku') msku: string,
    @Body('seller_sku') seller_sku?: string | null
  ) {
    const data = await this.contentWorkbenchService.updateSellerSku({
      msku,
      seller_sku,
    });
    return this.ok(data);
  }
}
