import { BaseEntity } from '@cool-midway/core';
import { Column, Index, Entity } from 'typeorm';

/**
 * 系统用户
 */
@Entity('base_sys_user')
export class BaseSysUserEntity extends BaseEntity {
  @Index()
  @Column({ comment: '部门ID', nullable: true })
  departmentId: number;

  @Column({ comment: '姓名', nullable: true })
  name: string;

  @Column({ comment: '关联id', nullable: true })
  userid: string;

  @Index({ unique: true })
  @Column({ comment: '用户名', length: 100 })
  username: string;

  @Column({ comment: '密码' })
  password: string;

  @Column({
    comment: '密码版本, 作用是改完密码，让原来的token失效',
    default: 1,
  })
  passwordV: number;

  @Column({ comment: '昵称', nullable: true })
  nickName: string;

  @Column({ comment: '头像', nullable: true })
  headImg: string;

  @Index()
  @Column({ comment: '手机', nullable: true, length: 20 })
  phone: string;

  @Column({ comment: '邮箱', nullable: true })
  email: string;

  @Column({ comment: '备注', nullable: true })
  remark: string;

  @Column({ comment: '状态 0-禁用 1-启用', default: 1 })
  status: number;
  // 部门名称
  departmentName: string;
  // 角色ID列表
  roleIdList: number[];

  @Column({ comment: 'socketId', nullable: true })
  socketId: string;

  /*=========================== 自定义业务逻辑 start ===========================*/
  @Column({comment: '领星 ERP 店铺权限', type: 'json', default: null})
  sidList: number[];


  @Column({ comment: '项目组', nullable: true })
  projectTeam: string;


  @Column({ comment: '绑定店铺名称', nullable: true })
  accountName: string;


  @Column({ comment: '领星id', nullable: true })
  lingxingID: string;

  @Column({ comment: '运营国家权限，NULL/空数组表示不限制，如["英国"]、["德国"]', type: 'json', nullable: true })
  operation_country_scope: string[];
  
  /*=========================== 自定义业务逻辑 end =============================*/
}
