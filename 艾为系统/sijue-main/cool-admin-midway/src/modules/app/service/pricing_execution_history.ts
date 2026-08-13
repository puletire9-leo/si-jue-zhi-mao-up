import { Provide, Inject } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { AppAmzPricingExecutionHistoryEntity } from '../entity/pricing_execution_history';

@Provide()
export class AppAmzPricingExecutionHistoryService extends BaseService {
  @InjectEntityModel(AppAmzPricingExecutionHistoryEntity)
  pricingExecutionHistoryRepo: Repository<AppAmzPricingExecutionHistoryEntity>;

  @Inject()
  ctx;

  /**
   * 根据任务ID查询执行历史
   */
  async getByTaskId(taskId: string) {
    return await this.pricingExecutionHistoryRepo.find({
      where: { task_id: taskId },
      order: { execution_date: 'ASC' }
    });
  }

  /**
   * 根据ASIN查询执行历史
   */
  async getByAsin(asin: string, marketplace: string) {
    return await this.pricingExecutionHistoryRepo.find({
      where: { asin, marketplace },
      order: { execution_date: 'DESC' }
    });
  }

  /**
   * 添加执行记录
   */
  async addExecutionRecord(data: any) {
    const record = this.pricingExecutionHistoryRepo.create(data);
    return await this.pricingExecutionHistoryRepo.save(record);
  }

  /**
   * 批量添加执行记录
   */
  async batchAddExecutionRecords(records: any[]) {
    const entities = records.map(record => this.pricingExecutionHistoryRepo.create(record));
    // return await this.pricingExecutionHistoryRepo.save(entities);
  }

  /**
   * 获取任务的执行统计
   */
  async getTaskStats(taskId: string) {
    const records = await this.getByTaskId(taskId);

    const stats = {
      total_executions: records.length,
      price_up_count: 0,
      price_down_count: 0,
      no_action_count: 0,
      requires_approval_count: 0,
      approved_count: 0,
      rejected_count: 0,
      failed_count: 0
    };

    for (const record of records) {
      switch (record.action_type) {
        case 'PRICE_UP':
          stats.price_up_count++;
          break;
        case 'PRICE_DOWN':
          stats.price_down_count++;
          break;
        case 'NO_ACTION':
          stats.no_action_count++;
          break;
      }

      if (record.requires_approval) {
        stats.requires_approval_count++;
      }

      if (record.approval_status === 'APPROVED') {
        stats.approved_count++;
      } else if (record.approval_status === 'REJECTED') {
        stats.rejected_count++;
      }

      if (record.execution_status === 'FAILED') {
        stats.failed_count++;
      }
    }

    return stats;
  }

  /**
   * 获取价格变化趋势
   */
  async getPriceTrend(taskId: string) {
    const records = await this.pricingExecutionHistoryRepo.find({
      where: { task_id: taskId },
      order: { execution_date: 'ASC' }
    });

    return records.map(record => ({
      date: record.execution_date,
      day: record.execution_day,
      old_price: record.old_price,
      new_price: record.new_price,
      action_type: record.action_type,
      order_quantity: record.order_quantity
    }));
  }

  /**
   * 获取待审批的记录
   */
  async getPendingApprovals() {
    return await this.pricingExecutionHistoryRepo.find({
      where: {
        requires_approval: 1,
        approval_status: 'PENDING'
      },
      order: { execution_date: 'DESC' }
    });
  }

  /**
   * 审批执行记录
   */
  async approveExecution(id: number, approved: boolean, comment?: string) {
    const record = await this.pricingExecutionHistoryRepo.findOne({ where: { id } });
    if (!record) {
      throw new Error('执行记录不存在');
    }

    if (record.approval_status !== 'PENDING') {
      throw new Error('该记录已被审批');
    }

    await this.pricingExecutionHistoryRepo.update(id, {
      approval_status: approved ? 'APPROVED' : 'REJECTED',
      approval_comment: comment,
      approval_time: new Date()
    });

    return { success: true };
  }

  /**
   * 批量审批
   */
  async batchApprove(ids: number[], approved: boolean, comment?: string) {
    for (const id of ids) {
      await this.approveExecution(id, approved, comment);
    }
    return { success: true };
  }
}