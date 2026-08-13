let dayjs = require('dayjs');

// /* 今天 */
// let today = dayjs();
// console.log(today.toDate());
//
// /* 去年的今天 */
// let last_year_today = today.subtract(1, 'year')
// console.log(last_year_today.toDate());
//
//
// /* 加 7 天到达下一周 */
// let next_week = last_year_today.add(7, 'day');
// console.log(next_week.toDate());
//
// /* 取这一周的周六 */
// let next_week_sat = next_week.day(6); /* 设置为周六 */
// console.log(next_week_sat.toDate());
// console.log(next_week_sat.day()); /* 检查一下是不是周六 */


// console.log(dayjs('20240315').format('YYYY-MM-DD'));

// console.log(dayjs('2024-04-01').add(90, 'days').format('YYYY-MM-DD'));


// console.log(dayjs().toDate());

/*-------------------------------------------------------------------------------------*/

let testDate;
// testDate = '2024-04-01 01:00:00';
// testDate = '2024-04-01 03:00:00';
// testDate = '2024-04-01 05:00:00';
// testDate = '2024-04-01 07:00:00';
// testDate = '2024-04-01 09:00:00';
// testDate = '2024-04-01 11:00:00';
// testDate = '2024-04-01 13:00:00';
// testDate = '2024-04-01 15:00:00';
// testDate = '2024-04-01 17:00:00';
// testDate = '2024-04-01 19:00:00';
// testDate = '2024-04-01 21:00:00';
// testDate = '2024-04-01 23:00:00';


// /* dayjs 取值范围：hour 0~23、月份 0~11、日期 1~31 */
// let now = dayjs(testDate);
// console.log(`${now.format('YYYY-MM-DD HH:mm:ss')} 当前北京时间`);
//
// /* 是否夏令时 */
// /* 英国夏令时：每年 3 月的最后一个周日至 10 月的最后一个周日。会快一个小时 */
// /* 简化一下，从 3 月底到 10 月底（都有 31 号）之间认为是夏令时好了 */
// let isDST =
//   dayjs().isAfter(now.month(2).date(31)) &&
//   dayjs().isBefore(now.month(9).date(31));
//
// /* 英国时区为 UTC+0，正常即比北京时间 UTC+8 要慢 8 小时，处于夏令时的话，会快一个钟 */
// let offset = isDST ? 7 : 8;
//
// let now_uk = now.subtract(offset, 'hours');
// console.log(`${now_uk.format('YYYY-MM-DD HH:mm:ss')} 当前英国时间`);
//
//
// /* 下一次执行时间设置为下一个小时节点。 */
// let cur_hour = now_uk.hour(); /* 取当前英国时间的小时 */
// if (cur_hour <= 6) now_uk = now_uk.hour(9);
// else if (cur_hour <= 9) now_uk = now_uk.hour(12);
// else if (cur_hour <= 12) now_uk = now_uk.hour(15);
// else if (cur_hour <= 15) now_uk = now_uk.hour(18);
// else if (cur_hour <= 18) now_uk = now_uk.hour(21);
// else now_uk = now_uk.add(1, 'day').hour(6); /* 第二天的 6 时 */
// now_uk = now_uk.minute(0).second(0);
//
// console.log(`${now_uk.format('YYYY-MM-DD HH:mm:ss')} 下次执行的英国时间`);
//
// let nextTick_bj = now_uk.add(offset, "hours");
// console.log(`${nextTick_bj.format('YYYY-MM-DD HH:mm:ss')} 下次执行的北京时间`);
//
// /* 留出一定时间的空余，保证任务执行完成。*/
// nextTick_bj = nextTick_bj.subtract(20, "minutes");
// console.log(`${nextTick_bj.format('YYYY-MM-DD HH:mm:ss')} 下次执行的北京时间（预留时间让任务执行完）`);
/*-------------------------------------------------------------------------------------*/

let SITE_CODE = {
  US: {code: 'US', zh: '美国'},
  CA: {code: 'CA', zh: '加拿大'},
  MX: {code: 'MX', zh: '墨西哥'},
  BR: {code: 'BR', zh: '巴西'},
  UK: {code: 'UK', zh: '英国'},
  DE: {code: 'DE', zh: '德国'},
  FR: {code: 'FR', zh: '法国'},
  ES: {code: 'ES', zh: '西班牙'},
  IT: {code: 'IT', zh: '意大利'},
  NL: {code: 'NL', zh: '荷兰'},
  SE: {code: 'SE', zh: '瑞典'},
  PL: {code: 'PL', zh: '波兰'},
  BE: {code: 'BE', zh: '比利时'},
  TR: {code: 'TR', zh: '土耳其'},
  JP: {code: 'JP', zh: '日本'},
  IN: {code: 'IN', zh: '印度'},
  AU: {code: 'AU', zh: '澳大利亚'},
  SG: {code: 'SG', zh: '新加坡'},
  AE: {code: 'AE', zh: '阿联酋'},
  SA: {code: 'SA', zh: '沙特阿拉伯'},
  EG: {code: 'EG', zh: '埃及'},
};

function marketplaceZhToEnCode(marketplace = '美国') {
  for (const key in SITE_CODE) {
    if (SITE_CODE[key].zh === marketplace) {
      return SITE_CODE[key].code;
    }
  }
  return 'US';
}

// console.log(marketplaceZhToEnCode('英国'));
// console.log(marketplaceZhToEnCode('英国2'));
// console.log(Object.entries(SITE_CODE));


/* 减去的天数参数会被解析为整数，所以改成小时来算好了 */
// console.log(dayjs().subtract(3.5, "days").format('YYYY-MM-DD HH:mm:ss'));
// console.log(dayjs().subtract(24 * 3.5, "hours").format('YYYY-MM-DD HH:mm:ss'));


function getRandomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

// for (let i = 0; i < 50; i++) {
//   console.log(getRandomInRange(1000, 9999).toFixed(0));
// }


/*-------------------------------------------------------------------------------------*/

/* 假设今天是 20240731 */
function test_daily_order_history_update() {

  let today = dayjs('2024-07-31');
  let yesterday = today.subtract(1, 'day');

  let history = [
    // {date: '20240701', quantity: 10},

    {date: '20240721', quantity: 1},
    {date: '20240722', quantity: 2},
    {date: '20240723', quantity: 3},
    {date: '20240724', quantity: 4},

    // {date: '20240810', quantity: 20}, /* 测试出现了未来的日期的情况，原则上不会出现。 */
  ];

  /* 检查历史销量数据，如果最新一项（即最后一项）不是前天的（因为现在要推入的新数据是昨天销量），就需要填充中途的漏掉的日期的数据。*/
  if (history.length > 0) {
    let final_date = history[history.length - 1].date;
    if (!yesterday.subtract(1, 'day').isSame(final_date, 'day')) {
      while (dayjs(history[history.length - 1].date).isBefore(yesterday)) {
        let next_date = dayjs(history[history.length - 1].date).add(1, 'day').format('YYYYMMDD');
        let data = {
          date: next_date,
          quantity: 0,
        };
        console.log(data);
        history.push(data);
      }
    }
  }

  /* 仅保留 15 天的销量数据，并预留一个空位 */
  while (history.length > 15 - 1) {
    history.shift();
  }

  console.log(history);
}

test_daily_order_history_update();

// console.log(dayjs('20240801').isAfter(dayjs(null)));
