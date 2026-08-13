import { App, Logger, Provide, Scope, ScopeEnum } from '@midwayjs/decorator';
import { IMidwayApplication } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { TaskInfoEntity } from '../entity/info';
import { TaskLogEntity } from '../entity/log';
import { ILogger } from '@midwayjs/logger';
import * as _ from 'lodash';

type TaskTimer =
  | { type: 'interval'; timer: NodeJS.Timeout; startTimer?: NodeJS.Timeout }
  | { type: 'cron'; timer: NodeJS.Timeout };

@Provide()
@Scope(ScopeEnum.Singleton)
export class TaskLocalService {
  @App()
  app: IMidwayApplication;

  @Logger()
  logger: ILogger;

  @InjectEntityModel(TaskInfoEntity)
  taskInfoEntity: Repository<TaskInfoEntity>;

  @InjectEntityModel(TaskLogEntity)
  taskLogEntity: Repository<TaskLogEntity>;

  private timers = new Map<number, TaskTimer>();
  private runState = new Map<number, { count: number; lastSecond: number }>();

  // 2026-01-13
  async initFromDb() {
    const runningTasks = await this.taskInfoEntity.findBy({ status: 1 });
    for (const task of runningTasks) {
      await this.start(task);
    }
  }

  // 2026-01-13
  async start(taskOrId: TaskInfoEntity | number) {
    const task =
      typeof taskOrId === 'number'
        ? await this.taskInfoEntity.findOneBy({ id: taskOrId })
        : taskOrId;

    if (!task) return;

    await this.stop(task.id);

    const now = Date.now();
    const startAt = task.startDate ? new Date(task.startDate).getTime() : 0;
    const endAt = task.endDate ? new Date(task.endDate).getTime() : 0;

    if (endAt && endAt <= now) {
      await this.taskInfoEntity.update(task.id, {
        status: 0,
        nextRunTime: null,
      });
      return;
    }

    if (task.taskType === 1) {
      await this.startIntervalTask(task, startAt, endAt);
    } else {
      await this.startCronTask(task, startAt, endAt);
    }

    await this.updateNextRunTime(task.id);
  }

  // 2026-01-13
  async stop(taskId: number) {
    const t = this.timers.get(taskId);
    if (t) {
      if (t.type === 'interval') {
        if (t.startTimer) {
          clearTimeout(t.startTimer);
        }
        clearInterval(t.timer);
      } else {
        clearInterval(t.timer);
      }
      this.timers.delete(taskId);
    }
    this.runState.delete(taskId);
  }

  // 2026-01-13
  exist(taskId: number) {
    return this.timers.has(taskId);
  }

  // 2026-01-13
  async once(taskId: number) {
    const task = await this.taskInfoEntity.findOneBy({ id: taskId });
    if (!task) return;
    await this.runTask(task, true);
  }

  // 2026-01-13
  async updateNextRunTime(taskId: number) {
    const task = await this.taskInfoEntity.findOneBy({ id: taskId });
    if (!task || task.status !== 1) return;

    const next = this.computeNextRunTime(task, new Date());
    await this.taskInfoEntity.update(taskId, { nextRunTime: next || null });
  }

  private async startIntervalTask(
    task: TaskInfoEntity,
    startAt: number,
    endAt: number
  ) {
    const every = Number(task.every || 0);
    if (!every || every < 1) return;

    const delay = startAt && startAt > Date.now() ? startAt - Date.now() : 0;

    const begin = () => {
      const timer = setInterval(async () => {
        await this.runTaskById(task.id);
      }, every);

      this.timers.set(task.id, { type: 'interval', timer });
    };

    if (delay > 0) {
      const startTimer = setTimeout(begin, delay);
      const placeholder = setInterval(() => {}, 24 * 60 * 60 * 1000);
      clearInterval(placeholder);
      this.timers.set(task.id, {
        type: 'interval',
        timer: placeholder,
        startTimer,
      });
      return;
    }

    begin();
  }

  private async startCronTask(
    task: TaskInfoEntity,
    startAt: number,
    endAt: number
  ) {
    const cron = String(task.cron || '').trim();
    if (!cron) return;

    const timer = setInterval(async () => {
      const fresh = await this.taskInfoEntity.findOneBy({ id: task.id });
      if (!fresh || fresh.status !== 1) {
        await this.stop(task.id);
        return;
      }

      const now = Date.now();
      const startOk =
        !fresh.startDate || new Date(fresh.startDate).getTime() <= now;
      const endOk = !fresh.endDate || new Date(fresh.endDate).getTime() >= now;
      if (!startOk || !endOk) return;

      const currentSecond = Math.floor(now / 1000);
      const state = this.runState.get(fresh.id) || {
        count: 0,
        lastSecond: -1,
      };
      if (state.lastSecond === currentSecond) return;

      if (this.matchCron(new Date(now), cron)) {
        state.lastSecond = currentSecond;
        this.runState.set(fresh.id, state);
        await this.runTask(fresh, false);
      }
    }, 1000);

    this.timers.set(task.id, { type: 'cron', timer });
  }

  private async runTaskById(taskId: number) {
    const task = await this.taskInfoEntity.findOneBy({ id: taskId });
    if (!task || task.status !== 1) return;
    await this.runTask(task, false);
  }

  private async runTask(task: TaskInfoEntity, isOnce: boolean) {
    const now = Date.now();
    const startOk =
      !task.startDate || new Date(task.startDate).getTime() <= now;
    const endOk = !task.endDate || new Date(task.endDate).getTime() >= now;
    if (!startOk || !endOk) return;

    const state = this.runState.get(task.id) || { count: 0, lastSecond: -1 };
    if (!isOnce) {
      state.count += 1;
      this.runState.set(task.id, state);

      const limit = task.limit == null ? null : Number(task.limit);
      if (limit != null && limit > 0 && state.count > limit) {
        await this.taskInfoEntity.update(task.id, {
          status: 0,
          nextRunTime: null,
        });
        await this.stop(task.id);
        return;
      }
    }

    try {
      const result = await this.invokeService(task.service);
      await this.record(task, 1, JSON.stringify(result));
    } catch (error: any) {
      await this.record(task, 0, error?.message || String(error));
    }

    if (!isOnce) {
      await this.updateNextRunTime(task.id);
    }
  }

  private async invokeService(serviceStr: string) {
    if (!serviceStr) return;

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

  private async record(task: TaskInfoEntity, status: number, detail?: string) {
    await this.taskLogEntity.save({
      taskId: task.id,
      status,
      detail: detail || '',
    });

    if (status === 1) {
      await this.taskLogEntity.query(
        `DELETE a
        FROM
        task_log a,
            ( SELECT id FROM task_log where taskId = ? AND status = 1 ORDER BY id DESC LIMIT ?, 1 ) b
        WHERE
        a.taskId = ? AND
        a.status = 1 AND
        a.id < b.id`,
        [task.id, 19, task.id]
      );
    }
  }

  private computeNextRunTime(task: TaskInfoEntity, base: Date): Date | null {
    const now = base.getTime();

    const startAt = task.startDate ? new Date(task.startDate).getTime() : 0;
    const endAt = task.endDate ? new Date(task.endDate).getTime() : 0;
    const baseAt = startAt && startAt > now ? startAt : now;

    if (endAt && baseAt > endAt) return null;

    if (task.taskType === 1) {
      const every = Number(task.every || 0);
      if (!every || every < 1) return null;
      const nextAt = baseAt + every;
      if (endAt && nextAt > endAt) return null;
      return new Date(nextAt);
    }

    const cron = String(task.cron || '').trim();
    if (!cron) return null;
    const next = this.findNextCronTime(cron, new Date(baseAt + 1000));
    if (!next) return null;
    if (endAt && next.getTime() > endAt) return null;
    return next;
  }

  private normalizeCron(cron: string) {
    const s = String(cron || '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!s) return '';
    const parts = s.split(' ');
    if (parts.length === 5) {
      return `0 ${s}`;
    }
    if (parts.length === 7) {
      return parts.slice(0, 6).join(' ');
    }
    return s;
  }

  private parseCronField(field: string, min: number, max: number) {
    if (!field || field === '*' || field === '?') {
      return { any: true, set: new Set<number>() };
    }

    const set = new Set<number>();

    const addRange = (from: number, to: number, step = 1) => {
      const f = Math.max(min, from);
      const t = Math.min(max, to);
      for (let v = f; v <= t; v += step) {
        set.add(v);
      }
    };

    const groups = field.split(',');
    for (const g0 of groups) {
      const g = g0.trim();
      if (!g) continue;

      if (g === '*') {
        addRange(min, max, 1);
        continue;
      }

      if (g.startsWith('*/')) {
        const step = Number(g.slice(2));
        if (!Number.isFinite(step) || step <= 0) return null;
        addRange(min, max, step);
        continue;
      }

      const [rangePart, stepPart] = g.split('/');
      const step = stepPart ? Number(stepPart) : 1;
      if (!Number.isFinite(step) || step <= 0) return null;

      if (rangePart === '?') {
        addRange(min, max, 1);
        continue;
      }

      if (rangePart === '*') {
        addRange(min, max, step);
        continue;
      }

      if (rangePart.includes('-')) {
        const [a, b] = rangePart.split('-').map(e => Number(e));
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
        addRange(a, b, step);
        continue;
      }

      const n = Number(rangePart);
      if (!Number.isFinite(n)) return null;
      if (stepPart) {
        addRange(n, max, step);
      } else {
        addRange(n, n, 1);
      }
    }

    return { any: false, set };
  }

  private matchCron(date: Date, cron: string) {
    const s = this.normalizeCron(cron);
    const parts = s.split(' ');
    if (parts.length !== 6) return false;

    const sec = this.parseCronField(parts[0], 0, 59);
    const min = this.parseCronField(parts[1], 0, 59);
    const hour = this.parseCronField(parts[2], 0, 23);
    const dom = this.parseCronField(parts[3], 1, 31);
    const mon = this.parseCronField(parts[4], 1, 12);
    const dow = this.parseCronField(parts[5], 0, 7);

    if (!sec || !min || !hour || !dom || !mon || !dow) return false;

    const inSet = (parsed: { any: boolean; set: Set<number> }, v: number) => {
      return parsed.any || parsed.set.has(v);
    };

    const second = date.getSeconds();
    const minute = date.getMinutes();
    const h = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const week = date.getDay();

    const okBase =
      inSet(sec, second) &&
      inSet(min, minute) &&
      inSet(hour, h) &&
      inSet(mon, month);
    if (!okBase) return false;

    const domOk = inSet(dom, day);
    const dowOk =
      inSet(dow, week) || (dow.any ? true : dow.set.has(7) && week === 0);

    if (!dom.any && !dow.any) return domOk || dowOk;
    if (!dom.any && dow.any) return domOk;
    if (dom.any && !dow.any) return dowOk;
    return true;
  }

  private findNextCronTime(cron: string, start: Date): Date | null {
    const maxScanSeconds = 10_000_000;
    let cursor = new Date(start.getTime());

    for (let i = 0; i < maxScanSeconds; i++) {
      if (this.matchCron(cursor, cron)) {
        return cursor;
      }
      cursor = new Date(cursor.getTime() + 1000);
    }
    return null;
  }
}
