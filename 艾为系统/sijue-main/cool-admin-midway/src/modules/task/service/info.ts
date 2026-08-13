import {
  App,
  Inject,
  Logger,
  Provide,
  Scope,
  ScopeEnum,
} from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { TaskInfoEntity } from '../entity/info';
import { TaskLogEntity } from '../entity/log';
import { ILogger } from '@midwayjs/logger';
import * as _ from 'lodash';
import { Utils } from '../../../comm/utils';
import { TaskInfoQueue } from '../queue/task';
import { IMidwayApplication } from '@midwayjs/core';
import { TaskLocalService } from './local';
// 2026-01-13
// import * as fs from 'fs';
// import * as path from 'path';
// // eslint-disable-next-line node/no-unpublished-import
// import * as ts from 'typescript';

/**
 * 任务
 */
@Provide()
@Scope(ScopeEnum.Request, { allowDowngrade: true })
export class TaskInfoService extends BaseService {
  @InjectEntityModel(TaskInfoEntity)
  taskInfoEntity: Repository<TaskInfoEntity>;

  @Logger()
  logger: ILogger;

  @InjectEntityModel(TaskLogEntity)
  taskLogEntity: Repository<TaskLogEntity>;

  @Inject()
  taskInfoQueue: TaskInfoQueue;

  @App()
  app: IMidwayApplication;

  @Inject()
  utils: Utils;

  @Inject()
  taskLocalService: TaskLocalService;

  // 2026-01-13
  private canUseQueue() {
    return !!this.taskInfoQueue?.metaQueue;
  }

  // 2026-01-13
  // async add(param) {
  //   return await this.addOrUpdate(param);
  // }
  //
  // 2026-01-13
  // async update(param) {
  //   await this.addOrUpdate(param);
  // }

  /**
   * 停止任务
   * @param id
   */
  async stop(id) {
    // 2026-01-13
    if (!this.canUseQueue()) {
      await this.taskLocalService.stop(Number(id));
      await this.taskInfoEntity.update(Number(id), {
        status: 0,
        nextRunTime: null,
      });
      return;
    }

    const task = await this.taskInfoEntity.findOneBy({ id });
    if (task) {
      const result = await this.taskInfoQueue.getRepeatableJobs();
      const job = _.find(result, { id: task.id + '' });
      if (job) {
        await this.taskInfoQueue.removeRepeatableByKey(job.key);
      }
      task.status = 0;
      await this.taskInfoEntity.update(task.id, task);
      await this.updateNextRunTime(task.id);
    }
  }

  /**
   * 移除任务
   * @param taskId
   */
  async remove(taskId) {
    // 2026-01-13
    if (!this.canUseQueue()) {
      await this.taskLocalService.stop(Number(taskId));
      return;
    }

    const result = await this.taskInfoQueue.getRepeatableJobs();
    const job = _.find(result, { id: taskId + '' });
    await this.taskInfoQueue.removeRepeatableByKey(job.key);
  }

  /**
   * 开始任务
   * @param id
   * @param type
   */
  async start(id, type?) {
    const task = await this.taskInfoEntity.findOneBy({ id });
    task.status = 1;
    if (type || type == 0) {
      task.type = type;
    }
    await this.addOrUpdate(task);
  }

  /**
   * 手动执行一次
   * @param id
   */
  async once(id) {
    // 2026-01-13
    if (!this.canUseQueue()) {
      await this.taskLocalService.once(Number(id));
      return;
    }

    const task = await this.taskInfoEntity.findOneBy({ id });
    if (task) {
      await this.taskInfoQueue.add(
        {
          ...task,
          isOnce: true,
        },
        {
          jobId: task.id.toString(),
          removeOnComplete: true,
          removeOnFail: true,
        }
      );
    }
  }

  /**
   * 检查任务是否存在
   * @param jobId
   */
  async exist(jobId) {
    // 2026-01-13
    if (!this.canUseQueue()) {
      return this.taskLocalService.exist(Number(jobId));
    }

    const result = await this.taskInfoQueue.getRepeatableJobs();
    const ids = result.map(e => {
      return e.id;
    });
    return ids.includes(jobId.toString());
  }

  /**
   * 新增或修改
   * @param params
   */
  async addOrUpdate(params, type?: 'add' | 'update') {
    delete params.repeatCount;
    // 2026-01-13：避免本地模式下在事务中读写 task_info 导致锁等待
    const useQueue = this.canUseQueue();
    let repeatConf: any;
    let saved: TaskInfoEntity;
    let taskId: number;
    await this.getOrmManager().transaction(async transactionalEntityManager => {
      if (params.taskType === 0) {
        params.limit = null;
        params.every = null;
      } else {
        params.cron = null;
      }
      saved = await transactionalEntityManager.save(TaskInfoEntity, params);
      taskId = Number(saved.id);

      if (params.status === 1) {
        // 2026-01-13
        if (useQueue) {
          const exist = await this.exist(taskId);
          if (exist) {
            await this.remove(taskId);
          }
          const { every, limit, startDate, endDate, cron } = saved;
          const repeat = {
            every,
            limit,
            jobId: taskId.toString(),
            startDate,
            endDate,
            cron,
          };
          await this.utils.removeEmptyP(repeat);
          const result = await this.taskInfoQueue.add(saved, {
            jobId: taskId.toString(),
            removeOnComplete: true,
            removeOnFail: true,
            repeat,
          });
          if (!result) {
            throw new Error('任务添加失败，请检查任务配置');
          }
          repeatConf = result.opts?.repeat;
        }
      }
    });

    // 2026-01-13：本地模式任务启停放到事务外，避免 lock wait timeout
    if (!useQueue) {
      if (params.status === 1) {
        await this.taskLocalService.start(taskId);
        const { every, limit, startDate, endDate, cron } = saved;
        const repeat = {
          every,
          limit,
          jobId: taskId.toString(),
          startDate,
          endDate,
          cron,
        };
        await this.utils.removeEmptyP(repeat);
        repeatConf = repeat;
      } else {
        await this.taskLocalService.stop(taskId);
        await this.taskInfoEntity.update(taskId, {
          nextRunTime: null,
        });
      }
    }

    if (params.status === 1) {
      this.utils.sleep(1000);
      await this.updateNextRunTime(taskId);
      await this.nativeQuery(
        'update task_info a set a.repeatConf = ? where a.id = ?',
        [JSON.stringify(repeatConf), taskId]
      );
    }
  }

  /**
   * 删除
   * @param ids
   */
  async delete(ids) {
    let idArr;
    if (ids instanceof Array) {
      idArr = ids;
    } else {
      idArr = ids.split(',');
    }
    for (const id of idArr) {
      const task = await this.taskInfoEntity.findOneBy({ id });
      const exist = await this.exist(task.id);
      if (exist) {
        this.stop(task.id);
      }
      await this.taskInfoEntity.delete({ id });
      await this.taskLogEntity.delete({ taskId: id });
    }
  }

  /**
   * 任务日志
   * @param query
   */
  async log(query) {
    const { id, status } = query;
    return await this.sqlRenderPage(
      `
      SELECT
          a.*,
          b.name AS taskName
      FROM
      task_log a
      JOIN task_info b ON a.taskId = b.id
      where 1=1
      ${this.setSql(id, 'and a.taskId = ?', [id])}
      ${this.setSql(status, 'and a.status = ?', [status])}
      `,
      query
    );
  }

  /**
   * 保存任务记录，成功任务每个任务保留最新20条日志，失败日志不会删除
   * @param task
   * @param status
   * @param detail
   */
  async record(task, status, detail?) {
    await this.taskLogEntity.save({
      taskId: task.id,
      status,
      detail: detail || '',
    });
    await this.nativeQuery(
      `DELETE a
      FROM
      task_log a,
          ( SELECT id FROM task_log where taskId = ? AND status = 1 ORDER BY id DESC LIMIT ?, 1 ) b
      WHERE
      a.taskId = ? AND
      a.status = 1 AND
      a.id < b.id`,
      [task.id, 19, task.id]
    ); // 日志保留最新的20条
  }

  /**
   * 初始化任务
   */
  async initTask() {
    try {
      // 2026-01-13
      if (!this.canUseQueue()) {
        await this.utils.sleep(3000);
        await this.taskLocalService.initFromDb();
        return;
      }

      await this.utils.sleep(3000);
      // this.logger.info('init task....');
      const runningTasks = await this.taskInfoEntity.findBy({ status: 1 });
      if (!_.isEmpty(runningTasks)) {
        for (const task of runningTasks) {
          const job = await this.exist(task.id); // 任务已存在就不添加
          if (!job) {
            // this.logger.info(`init task ${task.name}`);
            await this.addOrUpdate(task);
          }
        }
      }
    } catch (e) {}
  }

  /**
   * 任务ID
   * @param jobId
   */
  async getNextRunTime(jobId) {
    // 2026-01-13
    if (!this.canUseQueue()) {
      const task = await this.taskInfoEntity.findOneBy({ id: Number(jobId) });
      return task?.nextRunTime;
    }

    let nextRunTime;
    const result = await this.taskInfoQueue.getRepeatableJobs();
    const task = _.find(result, { id: jobId + '' });
    if (task) {
      nextRunTime = new Date(task.next);
    }
    return nextRunTime;
  }

  /**
   * 更新下次执行时间
   * @param jobId
   */
  async updateNextRunTime(jobId) {
    // 2026-01-13
    if (!this.canUseQueue()) {
      await this.taskLocalService.updateNextRunTime(Number(jobId));
      return;
    }

    await this.taskInfoEntity.update(jobId, {
      nextRunTime: await this.getNextRunTime(jobId),
    });
  }

  /**
   * 详情
   * @param id
   * @returns
   */
  async info(id: any): Promise<any> {
    const info = await this.taskInfoEntity.findOneBy({ id });
    return {
      ...info,
      repeatCount: info.limit,
    };
  }

  /**
   * 刷新任务状态
   */
  async updateStatus(jobId) {
    // 2026-01-13
    if (!this.canUseQueue()) return;

    const result = await this.taskInfoQueue.getRepeatableJobs();
    const job = _.find(result, { id: jobId + '' });
    if (!job) {
      return;
    }
    const task = await this.taskInfoEntity.findOneBy({ id: job.id });
    const nextTime = await this.getNextRunTime(task.id);
    if (task) {
      // if (task.nextRunTime.getTime() == nextTime.getTime()) {
      //   task.status = 0;
      //   task.nextRunTime = nextTime;
      //   this.taskInfoQueue.removeRepeatableByKey(job.key);
      // } else {
      task.nextRunTime = nextTime;
      // }
      await this.taskInfoEntity.update(task.id, task);
    }
  }

  /**
   * 调用service
   * @param serviceStr
   */
  async invokeService(serviceStr) {
    if (serviceStr) {
      const arr = serviceStr.split('.');
      const service = await this.app
        .getApplicationContext()
        .getAsync(_.lowerFirst(arr[0]));
      for (const child of arr) {
        if (child.includes('(')) {
          const lastArr = child.split('(');
          const param = lastArr[1].replace(')', '');
          if (!param) {
            return service[lastArr[0]]();
          } else {
            return service[lastArr[0]](JSON.parse(param));
          }
        }
      }
    }
  }

  // 2026-01-13
  // async serviceList(): Promise<string[]> {
  //   const modulesPath = path.join(this.app.getBaseDir(), 'modules');
  //   if (!fs.existsSync(modulesPath)) {
  //     return [];
  //   }
  //
  //   const tsFiles: string[] = [];
  //
  //   const collectTsFiles = (dirPath: string) => {
  //     const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  //     for (const entry of entries) {
  //       const fullPath = path.join(dirPath, entry.name);
  //       if (entry.isDirectory()) {
  //         collectTsFiles(fullPath);
  //         continue;
  //       }
  //       if (
  //         entry.isFile() &&
  //         entry.name.endsWith('.ts') &&
  //         !entry.name.endsWith('.d.ts')
  //       ) {
  //         tsFiles.push(fullPath);
  //       }
  //     }
  //   };
  //
  //   for (const entry of fs.readdirSync(modulesPath, { withFileTypes: true })) {
  //     if (!entry.isDirectory()) continue;
  //     const servicePath = path.join(modulesPath, entry.name, 'service');
  //     if (
  //       fs.existsSync(servicePath) &&
  //       fs.statSync(servicePath).isDirectory()
  //     ) {
  //       collectTsFiles(servicePath);
  //     }
  //   }
  //
  //   const result = new Set<string>();
  //
  //   for (const filePath of tsFiles) {
  //     let code = '';
  //     try {
  //       code = fs.readFileSync(filePath, 'utf8');
  //     } catch (e) {
  //       continue;
  //     }
  //     if (!code.includes('@Provide')) continue;
  //
  //     const sourceFile = ts.createSourceFile(
  //       filePath,
  //       code,
  //       ts.ScriptTarget.Latest,
  //       true
  //     );
  //
  //     const visit = (node: ts.Node) => {
  //       if (ts.isClassDeclaration(node) && node.name) {
  //         const decorators = (node as any).decorators as
  //           | ts.NodeArray<ts.Decorator>
  //           | undefined;
  //         const hasProvide = decorators?.some(d =>
  //           d.getText(sourceFile).startsWith('@Provide')
  //         );
  //         if (!hasProvide) return;
  //
  //         const serviceName = _.lowerFirst(node.name.text);
  //
  //         for (const member of node.members) {
  //           if (!ts.isMethodDeclaration(member)) continue;
  //           if (!member.name || !ts.isIdentifier(member.name)) continue;
  //
  //           const methodName = member.name.text;
  //           if (methodName === 'constructor') continue;
  //
  //           const modifiers = member.modifiers?.map(m => m.kind) || [];
  //           if (
  //             modifiers.includes(ts.SyntaxKind.PrivateKeyword) ||
  //             modifiers.includes(ts.SyntaxKind.ProtectedKeyword) ||
  //             modifiers.includes(ts.SyntaxKind.StaticKeyword)
  //           ) {
  //             continue;
  //           }
  //
  //           result.add(`${serviceName}.${methodName}()`);
  //         }
  //       }
  //
  //       node.forEachChild(visit);
  //     };
  //
  //     sourceFile.forEachChild(visit);
  //   }
  //
  //   return Array.from(result).sort((a, b) => a.localeCompare(b));
  // }
}
