import {Provide} from "@midwayjs/decorator";
import {Singleton} from "@midwayjs/core";
import * as dayjs from "dayjs";
import {Dayjs} from "dayjs";
import {appConfig} from "../../../appConfig";

@Provide()
@Singleton()
export class AppUtils {
  normalizeNumber(numberStr: string) {
    let parsed = parseFloat(
      String(numberStr).replace(/[$¥£€,\n]/g, '')
    );
    return isNaN(parsed) ? -1 : parsed;
  }

  normalizeBsrInfo(bsrText: string) {
    return bsrText?.replace(/Best Sellers Rank *:?/, '').trim() || null;
  }

  toFixed2Number(num: number): number {
    return parseFloat(num.toFixed(2));
  }

  marketplaceZhToEnCode(marketplace: string = '美国') {

    for (const key in appConfig.SITE_CODE) {
      if (marketplace === appConfig.SITE_CODE[key].zh) {
        return appConfig.SITE_CODE[key].code;
      }
    }
    return 'US';
  }

  getNextSaturday(
    date: Dayjs | Date | string,
    formatTemplate: string = 'YYYYMMDD'
  ) {
    let next_week = dayjs(date).add(7, 'day');
    let next_week_sat = next_week.day(6);
    return next_week_sat.format(formatTemplate);
  }

  getFormattedDate(
    date: Dayjs | Date | string = '',
    template: string = 'YYYYMMDD'
  ) {
    if (!date) date = new Date();
    return dayjs(date).format(template);
  }

  getNextClearanceCheckTime() {
    let now = dayjs();

    let isDST =
      dayjs().isAfter(now.month(2).date(31)) &&
      dayjs().isBefore(now.month(9).date(31));

    let offset = isDST ? 7 : 8;

    let now_uk = now.subtract(offset, 'hours');

    let cur_hour = now_uk.hour();
    if (cur_hour <= 6) now_uk = now_uk.hour(9);
    else if (cur_hour <= 9) now_uk = now_uk.hour(12);
    else if (cur_hour <= 12) now_uk = now_uk.hour(15);
    else if (cur_hour <= 15) now_uk = now_uk.hour(18);
    else if (cur_hour <= 18) now_uk = now_uk.hour(21);
    else now_uk = now_uk.add(1, 'day').hour(6);
    now_uk = now_uk.minute(0).second(0);

    let nextTick_bj = now_uk.add(offset, "hours");

    nextTick_bj = nextTick_bj.subtract(20, "minutes");

    return nextTick_bj.toDate();
  }

  getDateHourOfUk(date: Dayjs | Date | string) {
    let datetime = dayjs(date);

    let isDST =
      dayjs().isAfter(datetime.month(2).date(31)) &&
      dayjs().isBefore(datetime.month(9).date(31));

    let offset = isDST ? 7 : 8;

    return datetime.subtract(offset, 'hours').hour();
  }
}
