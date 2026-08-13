import {BaseService} from "@cool-midway/core";
import {Provide} from "@midwayjs/decorator";
import {InjectEntityModel} from "@midwayjs/typeorm";
import {Repository} from "typeorm";
import {AppAmzCookieEntity} from "../entity/cookie";

@Provide()
export class AppAmzCookieService extends BaseService {

  @InjectEntityModel(AppAmzCookieEntity)
  cookieRepo: Repository<AppAmzCookieEntity>;

  async getCookie(additional_where_options: object = {}): Promise<AppAmzCookieEntity> | null {
    let where_options = {isValid: 1};
    Object.assign(where_options, additional_where_options);

    return await this.cookieRepo
      .createQueryBuilder('cookie')
      .select()
      .where(where_options)
      .orderBy('RAND()')
      .getOne();
  }
}