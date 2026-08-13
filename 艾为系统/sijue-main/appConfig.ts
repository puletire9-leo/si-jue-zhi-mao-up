export const appConfig = {

  LISTING_TAGS: [
    {value: 'p1', desc: '调价策略：新品', desc_short: '新品', key: 'PRICING_NEW'},
    {value: 'p2', desc: '调价策略：竞品', desc_short: '竞品', key: 'PRICING_COMPETITOR'},
    {value: 'p3', desc: '调价策略：清仓', desc_short: '清仓', key: 'PRICING_CLEARANCE'},
    {value: 'p4', desc: '调价策略：日常', desc_short: '日常', key: 'PRICING_DEFAULT'},
  ],

  KEYWORD_STATUS: {
    CREATED: {value: 0, desc: '待调研（初始新建状态，未执行爬虫）'},
    RESEARCHING: {value: 1, desc: '调研中（已爬虫抓取信息，待数据分析）'},
    PENDING: {value: 2, desc: '待入库（已分析爬虫数据，并放入代办清单）'},
    LIBRARY: {value: 3, desc: '已入库'},
    ARCHIVED: {value: 4, desc: '已归档（不想删除但不再用时，可手动设置为该状态）'},
  },

  LISTING_COMPETITOR_SPIDER_STATUS: {
    CREATED: {value: 0, desc: '待调研（未执行爬虫）'},
    RESEARCHING: {value: 1, desc: '调研中（已爬虫抓取信息，待数据分析）'},
    RESEARCHED: {value: 2, desc: '已调研（已对爬虫结果进行筛选，并往数据库插入竞品数据）'},
  },

  COMPETITOR_STATUS: {
    PENDING: {value: 2, desc: '待入库（在代办清单中）'},
    LIBRARY: {value: 3, desc: '已入库'},
    ARCHIVED: {value: 4, desc: '已归档（不想删除但不再用时，可手动设置为该状态）'},
  },

  SPIDER_TASK: {
    TYPE: {
      KEYWORD: 'keyword',
      COMPETITOR: 'competitor',
      PRODUCT: 'product',
      BSR_TASK: 'bsr_task',
      BSR_COMPETITOR: 'bsr_competitor',
      BSR_COMPETITOR_INFO: 'bsr_competitor_info',
      BSR_HTML:'bsr_html',
      BSR_COMPETITOR2:'bsr_competitor2',
      BSR_INFO: 'bsr_info',
    },
  },

  LISTING_KEYWORD_ANAL_STATUS: {
    CREATED: {value: 0, desc: '尚未查询搜索量情况'},
    PENDING: {value: 1, desc: '待分析（已查询关键词的搜索量数据，待整理分析）'},
    ANALYSED: {value: 2, desc: '已完成分析'},
  },

  BSR_TASK_STATUS: {
    CREATED: {value: 0, desc: '待调研（未执行爬虫）'},
    CRAWLING: {value: 102, desc: '爬虫中（被 Python 端取走任务，爬虫执行中）'},
    RESEARCHING: {value: 1, desc: '调研中（已爬虫抓取信息，待数据分析）'},
    RESEARCHED: {value: 2, desc: '已调研（已对爬虫结果进行筛选，并往数据库插入竞品数据）'},
  },

  BSR_CANDIDATE_STATUS: {
    PENDING: {value: 2, desc: '待入库（在代办清单中）'},
    LIBRARY: {value: 3, desc: '待精选（待人工筛选）'},
    LIBRARY2: {value: 4, desc: '已精选'},
    RESERVED: {value: 7, desc: '预留'},
    ARCHIVED: {value: 5, desc: '已归档（不想删除但不再用时，可手动设置为该状态）'},
  },

  BSR_CANDIDATE_COMPETITOR_SPIDER_STATUS: {
    CREATED: {value: 0, desc: '待调研（未执行爬虫）'},
    RESEARCHING: {value: 1, desc: '调研中（已爬虫抓取信息，待数据分析）'},
    RESEARCHED: {value: 2, desc: '已调研（已对爬虫结果进行筛选，并往数据库插入竞品数据）'},
  },

  BSR_CANDIDATE_COMPETITOR_STATUS: {
    KEYWORD: {value: 1, desc: '关键词'},
    COMPETITOR: {value: 2, desc: '竞品'},
    PENDING: {value: 2, desc: '待入库（在代办清单中）'},
    LIBRARY: {value: 3, desc: '已入库'},
    ARCHIVED: {value: 4, desc: '已归档'},
    NON_SAME: {value: 9, desc: '非同款竞品'},
    INVENTORY_COMPLETED: {value: 20, desc: '库存抓取完成'},
  },

  LINGXING_COMPETITOR_STATUS: {
    CANDIDATE_COMPETITOR: {value: 2, desc: '选品竞品'},
    PENDING: {value: 5, desc: '待定'},
    ON_SALE: {value: 6, desc: '在售'},
    HISTORY: {value: 7, desc: '往期'},
    RECYCLE: {value: 8, desc: '回收站'},
  },

  DELIVERY_TYPE: {
    SELF_OPERATED: {value: 0, desc: '自营'},
    FBA: {value: 1, desc: 'FBA'},
    FBM: {value: 2, desc: 'FBM'},
  },

  OPERATION_LOG_TYPE: {
    PRICE: {value: 0, desc: '执行了调价'},
    INVENTORY: {value: 1, desc: '执行了补货'},
  },
  CURRENCY_CODE: {
    '美国': {code: '美元', zh: '$'},
    '加拿大': {code: '加拿大元', zh: '元'},
    '墨西哥': {code: '墨西哥元', zh: '元'},
    '巴西': {code: '巴西雷亚尔', zh: 'R$'},
    '英国': {code: '英镑', zh: '£'},
    '德国': {code: '欧元', zh: '€'},
    '法国': {code: '欧元', zh: '€'},
    '西班牙': {code: '欧元', zh: '€'},
    '意大利': {code: '欧元', zh: '€'},
    '荷兰': {code: '欧元', zh: '€'},
    '瑞典': {code: '瑞典克朗', zh: 'kr'}, 
    '波兰': {code: '波兰兹罗提', zh: 'zł'},
    '比利时': {code: '比利时法郎', zh: '€'},
    '土耳其': {code: '土耳其里拉', zh: '₤'},
    '日本': {code: '日元', zh: '¥'},
    '印度': {code: '印度卢比', zh: '₹'},
    '澳大利亚': {code: '澳大利亚元', zh: '元'},
    '新加坡': {code: '新加坡元', zh: '元'},
    '阿联酋': {code: '阿联酋迪拉姆', zh: 'د.إ'},
    '沙特阿拉伯': {code: '沙特阿拉伯里亚尔', zh: 'ر.س'},
    '埃及': {code: '埃及镑', zh: '£'},
    '中国': {code: '人民币', zh: '¥'}, 
  },
  SITE_CODE: {
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
    CN: {code: 'CN', zh: '中国'},
  },

  normalize_marketplace_code: function (marketplace: string = '美国') {

    for (const key in this.SITE_CODE) {
      if (marketplace === this.SITE_CODE[key].zh
        || marketplace === this.SITE_CODE[key].code) {
        return this.SITE_CODE[key].code;
      }
    }
    return 'US';
  },

  AMAZON_I18N: {
    'MAIN': {
      'US': 'https://www.amazon.com',
      'CA': 'https://www.amazon.ca',
      'MX': 'https://www.amazon.com.mx',
      'BR': 'https://www.amazon.com.br',
      'UK': 'https://www.amazon.co.uk',
      'DE': 'https://www.amazon.de',
      'FR': 'https://www.amazon.fr',
      'ES': 'https://www.amazon.es',
      'IT': 'https://www.amazon.it',
      'NL': 'https://www.amazon.nl',
      'SE': 'https://www.amazon.se',
      'PL': 'https://www.amazon.pl',
      'BE': 'https://www.amazon.com.be',
      'TR': 'https://www.amazon.com.tr',
      'JP': 'https://www.amazon.co.jp',
      'IN': 'https://www.amazon.in',
      'AU': 'https://www.amazon.com.au',
      'SG': 'https://www.amazon.sg',
      'AE': 'https://www.amazon.ae',
      'SA': 'https://www.amazon.sa',
      'EG': 'https://www.amazon.eg',
    },
  },

  get_amazon_url_dp: function (asin: string, marketplace: string = 'UK') {
    if (!marketplace) {
      marketplace = 'UK';
  }
    marketplace = marketplace.toLocaleUpperCase();
    marketplace = this.normalize_marketplace_code(marketplace);
    return `${this.AMAZON_I18N.MAIN[marketplace]}/dp/${asin}`;
  },

  get_amazon_url_keyword_search: function (search_string: string, marketplace: string = 'US') {
    if (!marketplace) {
      marketplace = 'US';
  } 
    marketplace = marketplace?.toLocaleUpperCase();
    marketplace = this.normalize_marketplace_code(marketplace);
    return `${this.AMAZON_I18N.MAIN[marketplace]}/s?k=${search_string}`;
  },
  

  get_amazon_url_picture_search: function (image: string, marketplace: string = 'US') {
    if (!marketplace) {
      marketplace = 'US';
  } 
    marketplace = marketplace?.toLocaleUpperCase();
    marketplace = this.normalize_marketplace_code(marketplace);
    return `${this.AMAZON_I18N.MAIN[marketplace]}/stylesnap?q=${image}`;
  },

  estimate_distribution_type: function (
    dispatches_from: string,
    sold_by: string,
    return_as_code: boolean = false,
  ): string | number {
    if (!dispatches_from || !sold_by) {
      return return_as_code ? -1 : '未知';
    }

    if (sold_by.toLowerCase().startsWith('amazon')) {
      return return_as_code ? this.DELIVERY_TYPE.SELF_OPERATED.value : this.DELIVERY_TYPE.SELF_OPERATED.desc;
    } else if (dispatches_from.toLowerCase().startsWith('amazon')) {
      return return_as_code ? this.DELIVERY_TYPE.FBA.value : this.DELIVERY_TYPE.FBA.desc;
    } else {
      return return_as_code ? this.DELIVERY_TYPE.FBM.value : this.DELIVERY_TYPE.FBM.desc;
    }
  },

  cal_listing_logical_inventory: function (listing_entity: any): number {
    return 0 + (listing_entity?.afn_fulfillable_quantity || 0) + (listing_entity?.reserved_fc_processing || 0) + (listing_entity?.afn_inbound_shipped_quantity || 0) + (listing_entity?.afn_inbound_receiving_quantity || 0);
  },

  extract_ranking_from_bsr_info: function (bsr_info: string) {
    let pieces = String(bsr_info)
      .split(' ')
      .map(piece => piece.trim())
      .filter(piece => piece !== '');

    let number_str = '';
    for (const piece of pieces) {
      if (/.*\d.*/.test(piece)) {
        number_str = piece;
        break;
      }
    }

    number_str = number_str.replace(/[#,]/g, '').replace('.', '');

    let rank = parseInt(number_str);
    return rank || 999999999;
  },

  parseDimensionsInfo(dimensions: string):
    { dimensions: string, weight: string | null } {
    let arr = String(dimensions).split(';');
    return {
      dimensions: arr[0].trim(),
      weight: this.parseWeightToKilogram(arr[1]),
    };
  },

  parseWeightToKilogram(weight_info: string): string | null {
    if (!weight_info) return null;

    let weight = weight_info.toString().trim() || null;
    if (weight) {
      let w_num = parseFloat(weight.replace(',', '.'));  // 将逗号替换成小数点

      if (!isNaN(w_num)) {
        if (weight.match(/ g/) || weight.match(/ gram/)) {
          w_num = w_num / 1000;
        } else if (weight.match(/ ounce/) || weight.match(/ oz/)) {
          w_num = w_num * 0.028349523125;
        } else if (weight.match(/ pound/) || weight.match(/ lb/))
          
          {
          w_num = w_num * 0.45359237;
        } else if (weight.match(/ Gramm/)) {  // 处理德语"Gramm"为克
          w_num = w_num / 1000;  // 克转千克
        }

        weight = `${w_num.toFixed(3)} kg`;
      }
    }

    return weight;
  },

  CUSTOM_LISTING_ASIN_PREFIX: '_CASIN_',
  CUSTOM_LISTING_MSKU_PREFIX: '_CMSKU_',

  is_custom_listing_asin: function (asin: string) {
    return String(asin).startsWith(this.CUSTOM_LISTING_ASIN_PREFIX);
  },
  is_custom_listing_msku: function (msku: string) {
    return String(msku).startsWith(this.CUSTOM_LISTING_MSKU_PREFIX);
  },
  is_custom_listing: function (listing: any) {
    return listing.is_custom_listing === 1;
  },
  get_from_custom_listing_hint: function (listing: any,
                                          fieldName: string) {
    return listing.is_custom_listing === 1 ? '（来自自定义产品）' : listing[fieldName];
  },

  getRandomInRange: function (min: number, max: number) {
    return Math.random() * (max - min) + min;
  },

  generate_custom_listing_asin_msku: function () {
    let suffix = Date.now().toString().substring(7)
      + this.getRandomInRange(1000, 9999).toFixed(0);
    return {
      asin: this.CUSTOM_LISTING_ASIN_PREFIX + suffix,
      msku: this.CUSTOM_LISTING_MSKU_PREFIX + suffix,
    }
  },
};
