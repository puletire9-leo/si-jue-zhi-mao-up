import { Provide, Inject } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { AppAmzPricingTaskEntity } from '../entity/pricing_task';

@Provide()
export class AppAmzPricingTaskService extends BaseService {
  @InjectEntityModel(AppAmzPricingTaskEntity)
  pricingTaskRepo: Repository<AppAmzPricingTaskEntity>;

  @Inject()
  ctx;

  /**
   * 启动任务
   */
  async start(params: { id: number }) {
    const task = await this.pricingTaskRepo.findOne({ where: { id: params.id } });
    if (!task) {
      throw new Error('任务不存在');
    }
    if (task.status !== 'PENDING') {
      throw new Error('只有待执行状态的任务才能启动');
    }

    await this.pricingTaskRepo.update(params.id, {
      status: 'RUNNING',
      start_date: new Date(),
      current_day: 1
    });

    return { success: true };
  }

  /**
   * 暂停任务
   */
  async pause(params: { id: number }) {
    const task = await this.pricingTaskRepo.findOne({ where: { id: params.id } });
    if (!task) {
      throw new Error('任务不存在');
    }
    if (task.status !== 'RUNNING') {
      throw new Error('只有运行中的任务才能暂停');
    }

    await this.pricingTaskRepo.update(params.id, {
      status: 'PAUSED'
    });

    return { success: true };
  }

  /**
   * 继续任务
   */
  async resume(params: { id: number }) {
    const task = await this.pricingTaskRepo.findOne({ where: { id: params.id } });
    if (!task) {
      throw new Error('任务不存在');
    }
    if (task.status !== 'PAUSED') {
      throw new Error('只有暂停状态的任务才能继续');
    }

    await this.pricingTaskRepo.update(params.id, {
      status: 'RUNNING'
    });

    return { success: true };
  }

  /**
   * 取消任务
   */
  async cancel(params: { id: number }) {
    const task = await this.pricingTaskRepo.findOne({ where: { id: params.id } });
    if (!task) {
      throw new Error('任务不存在');
    }
    if (!['PENDING', 'RUNNING', 'PAUSED'].includes(task.status)) {
      throw new Error('只有待执行、运行中或暂停状态的任务才能取消');
    }

    await this.pricingTaskRepo.update(params.id, {
      status: 'CANCELLED',
      end_date: new Date()
    });

    return { success: true };
  }

  /**
   * 批量启动任务
   */
  async batchStart(params: { ids: number[] }) {
    for (const id of params.ids) {
      await this.start({ id });
    }
    return { success: true };
  }

  /**
   * 批量暂停任务
   */
  async batchPause(params: { ids: number[] }) {
    for (const id of params.ids) {
      await this.pause({ id });
    }
    return { success: true };
  }

  /**
   * 批量取消任务
   */
  async batchCancel(params: { ids: number[] }) {
    for (const id of params.ids) {
      await this.cancel({ id });
    }
    return { success: true };
  }

  /**
   * 完成任务
   */
  async complete(params: { id: number }) {
    const task = await this.pricingTaskRepo.findOne({ where: { id: params.id } });
    if (!task) {
      throw new Error('任务不存在');
    }

    await this.pricingTaskRepo.update(params.id, {
      status: 'COMPLETED',
      end_date: new Date(),
      current_day: task.total_days
    });

    return { success: true };
  }

  /**
   * 更新任务进度
   */
  async updateProgress(params: { id: number; current_day: number; current_price?: number }) {
    const task = await this.pricingTaskRepo.findOne({ where: { id: params.id } });
    if (!task) {
      throw new Error('任务不存在');
    }

    const updateData: any = {
      current_day: params.current_day
    };

    if (params.current_price !== undefined) {
      updateData.current_price = params.current_price;
    }

    // 检查是否完成
    if (params.current_day >= task.total_days) {
      updateData.status = 'COMPLETED';
      updateData.end_date = new Date();
    }

    await this.pricingTaskRepo.update(params.id, updateData);

    return { success: true };
  }
}