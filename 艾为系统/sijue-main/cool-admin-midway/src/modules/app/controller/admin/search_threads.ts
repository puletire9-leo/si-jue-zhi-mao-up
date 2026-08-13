import { CoolController, BaseController, CoolCommException } from '@cool-midway/core';
import { Context } from "@midwayjs/koa";
import { Inject, Post, Body } from '@midwayjs/decorator';
import { AppAiListingService } from "../../service/search_threads";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";

@CoolController()
@updateWithoutAmendingCreateTime
export class AdminAppAmzSearchThreadsController extends BaseController {

  @Inject()
  ctx: Context;

  @Inject()
  appAiListingService: AppAiListingService;
  
  // 前端调用的接口：传入完整 requestBody
  @Post('/createAmazonListing')
  async createAmazonListing(@Body() requestBody: any) {
    // 1. 根据产品摘要或其他字段作为线程名称创建线程
    const threadRes = await this.appAiListingService.createThreads(
      requestBody.input.product_summary || 'default name'
    );
    
    if (!threadRes || !threadRes.thread_id) {
      throw new CoolCommException('创建线程失败');
    }
    
    // 2. 将返回的 thread_id 添加到 requestBody 中
    requestBody.thread_id = threadRes.thread_id;
    
    // 3. 调用 Amazon Listing 的生成接口
    const listingRes = await this.appAiListingService.createAmazonListing(requestBody);
    return listingRes;
  }

  // 其他示例接口：如搜索线程等
  @Post('/ai_listing')
  async syncFXFromLingXing() {
    const data = await this.appAiListingService.getForeignExchangeData();
    return data;  // 返回 data 给前端
  }

  // 示例：获取线程状态
  @Post('/getState')
  async syncGetState(@Body('id') id: string) {
    const data = await this.appAiListingService.getState(id);
    return data;
  }


  @Post('/createAmazonListingFanYi')
  async createAmazonListingFanYi(@Body() requestBody: any) {
    // 1. 根据产品摘要或其他字段作为线程名称创建线程
    const threadRes = await this.appAiListingService.createThreads(
      requestBody.input.product_summary || 'default name'
    );
    
    if (!threadRes || !threadRes.thread_id) {
      throw new CoolCommException('创建线程失败');
    }
    
    // 2. 将返回的 thread_id 添加到 requestBody 中
    requestBody.thread_id = threadRes.thread_id;
    
    // 3. 调用 Amazon Listing 的生成接口
    const listingRes = await this.appAiListingService.createAmazonListingFanYi(requestBody);
    return listingRes;
  }
}
