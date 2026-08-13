import {Provide} from '@midwayjs/decorator';
import {BaseService} from '@cool-midway/core';
import {InjectEntityModel} from '@midwayjs/typeorm';
import {Repository, LessThan} from 'typeorm';
import {AppAmzBsrTaskEntity} from '../entity/bsr_task';

@Provide()
export class AppAmzBsrTaskService extends BaseService {
  @InjectEntityModel(AppAmzBsrTaskEntity)
  bsrTaskRepo: Repository<AppAmzBsrTaskEntity>;

  async deleteByIds(ids: number[]) {
    if (!ids?.length) return;
    console.log(ids)
    await this.bsrTaskRepo.delete(ids);
  }
}
