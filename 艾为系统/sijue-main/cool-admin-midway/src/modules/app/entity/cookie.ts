import {BaseEntity} from '@cool-midway/core';
import {Column, Entity, Index} from 'typeorm';

@Entity('app_amz_cookie')
export class AppAmzCookieEntity extends BaseEntity {
  @Column({comment: '站点', nullable: false, default: 'US'})
  site: string;

  @Column({comment: '邮箱', nullable: true})
  email: string;

  @Column({comment: '用户名', nullable: true})
  username: string;

  @Column({comment: '密码', nullable: true})
  password: string;

  @Column({comment: 'secret_2FA', nullable: true})
  secret_2FA: string;

  @Column({comment: '内容', type: 'json', nullable: true})
  content: object;

  @Column({comment: '是否生效', default: 1, type: 'tinyint'})
  isValid: number;

  @Column({comment: '成功次数', default: 0, nullable: true})
  successCount: number;

  @Column({comment: '失败次数', default: 0, nullable: true})
  failCount: number;

  @Column({comment: '备注', nullable: true})
  remark: string;
}
