import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

@Entity('app_error_log')
export class AppErrorLogEntity extends BaseEntity {
  @Index()
  @Column({ comment: 'source', length: 32, default: 'backend' })
  source: string;

  @Index()
  @Column({ comment: 'level', length: 16, default: 'error' })
  level: string;

  @Index()
  @Column({ comment: 'module', length: 100, nullable: true })
  module: string;

  @Column({ comment: 'message', length: 1000 })
  message: string;

  @Column({ comment: 'stack', type: 'longtext', nullable: true })
  stack: string;

  @Column({ comment: 'url', length: 1000, nullable: true })
  url: string;

  @Column({ comment: 'method', length: 16, nullable: true })
  method: string;

  @Index()
  @Column({ comment: 'status code', type: 'int', nullable: true })
  statusCode: number;

  @Index()
  @Column({ comment: 'trace id', length: 80, nullable: true })
  traceId: string;

  @Index()
  @Column({ comment: 'user id', type: 'int', nullable: true })
  userId: number;

  @Column({ comment: 'user name', length: 100, nullable: true })
  userName: string;

  @Column({ comment: 'ip', length: 100, nullable: true })
  ip: string;

  @Column({ comment: 'user agent', length: 500, nullable: true })
  userAgent: string;

  @Column({ comment: 'request params', type: 'json', nullable: true })
  requestParams: any;

  @Column({ comment: 'response body', type: 'json', nullable: true })
  responseBody: any;

  @Column({ comment: 'extra', type: 'json', nullable: true })
  extra: any;

  @Index()
  @Column({ comment: 'handled status: 0 pending, 1 handled, 2 ignored', type: 'tinyint', default: 0 })
  handledStatus: number;

  @Column({ comment: 'handled remark', type: 'text', nullable: true })
  handledRemark: string;

  @Column({ comment: 'handled user id', type: 'int', nullable: true })
  handledUserId: number;

  @Column({ comment: 'handled user name', length: 100, nullable: true })
  handledUserName: string;

  @Column({ comment: 'handled time', type: 'datetime', nullable: true })
  handledTime: Date;
}
