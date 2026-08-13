import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzBsrKeywordTrackingSnapshotEntity } from '../../entity/bsr_keyword_tracking_snapshot';

/**
 * 关键词跟踪快照管理
 * 独立controller，支持按 tracking_id 和 snapshot_date 查询历史快照
 */
@CoolController({
    api: ['info', 'list', 'page'],
    entity: AppAmzBsrKeywordTrackingSnapshotEntity,
    pageQueryOp: {
        keyWordLikeFields: [
            'a.snapshot_date',
        ],
        fieldEq: [
            'a.tracking_id',
            'a.snapshot_date',
        ],
        addOrderBy: {
            'a.snapshot_date': 'DESC',
        },
    },
})
export class AdminBsrKeywordTrackingSnapshotController extends BaseController {
    // 使用自动生成的CRUD接口查询快照历史
}
