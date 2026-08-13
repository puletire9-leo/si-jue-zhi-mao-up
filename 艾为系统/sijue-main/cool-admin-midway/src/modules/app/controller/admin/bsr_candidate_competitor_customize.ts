import {CoolController, BaseController} from '@cool-midway/core';
import {AppAmzBsrCandidateCompetitorCustomizeEntity} from "../../entity/bsr_candidate_competitor_customize";
import {AppAmzBsrCandidateEntity} from "../../entity/bsr_candidate";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";
import { Inject ,Post,Body} from '@midwayjs/core';
import {AppAmzBsrCandidateCompetitorCustomizeService} from "../../service/bsr_candidate_competitor_customize";
import {Context} from "@midwayjs/koa";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzBsrCandidateCompetitorCustomizeEntity,
  pageQueryOp: {
    keyWordLikeFields: [
      'a.asin_candidate',
      'a.asin_competitor',
      'a.item_name',
      'a.bsr_html',
      'a.marketplace'
    ],
    fieldEq: [
      'a.candidate_id',
      'a.marketplace',
      'a.asin_candidate'
    ],
    select: [
      'a.*',
      'b.image_url as candidate_image_url',
    ],
    join: [
      {
        entity: AppAmzBsrCandidateEntity,
        alias: 'b',
        condition: 'a.asin_candidate = b.asin',
        type: 'leftJoin',
      },
    ],
  },
})
@updateWithoutAmendingCreateTime
export class AdminBsrCandidateCompetitorCustomizeController extends BaseController {
  @Inject()
  AppAmzBsrCandidateCompetitorCustomizeService:AppAmzBsrCandidateCompetitorCustomizeService;
  
  @Inject()
  ctx: Context;

}


