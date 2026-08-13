import {BaseService} from '@cool-midway/core';
import {Provide} from '@midwayjs/decorator';
import {InjectEntityModel} from '@midwayjs/typeorm';
import {Repository} from 'typeorm';
import {AppOperationLogEntity} from "../entity/operation_log";

@Provide()
export class AppOperationLogService extends BaseService {
  @InjectEntityModel(AppOperationLogEntity)
  operationLogRepo: Repository<AppOperationLogEntity>;

  async insertLog(log: AppOperationLogEntity) {
    await this.operationLogRepo.insert(log);
  }
}
