import {BaseService} from '@cool-midway/core';
import {AppCpuEntity} from '../entity/cpu';
import {Provide} from '@midwayjs/decorator';
import {InjectEntityModel} from '@midwayjs/typeorm';
import {Repository} from 'typeorm';


@Provide()
export class AppCpuService extends BaseService {
  @InjectEntityModel(AppCpuEntity)
  AppCpuEntity: Repository<AppCpuEntity>;

  testLogic(message: string) {
    return `this feedback is from cpu module service. Your message provided is: ${message}`;
  }


}
