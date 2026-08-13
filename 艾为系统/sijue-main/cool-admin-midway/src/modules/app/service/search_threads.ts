import { Inject, Provide, Init } from '@midwayjs/decorator';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { AppAmzAiListingEntity } from "../entity/ai_listing";
import { AppAmzBsrProfitCommon } from "../entity/bsr_profit_common";
import { AppAmzBsrProfitMarket } from "../entity/bsr_profit_market";
import axios from 'axios';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { BaseSysParamEntity } from '../../base/entity/sys/param';
import { AppAmzAiListingWriteEntity } from "../entity/ai_listing_write";
import { LingXingUtils } from "../utils/lingxing/lingxingUtils";
@Provide()
export class AppAiListingService extends BaseService {


  @InjectEntityModel(AppAmzAiListingEntity)
  aiListing: Repository<AppAmzAiListingEntity>;

  @InjectEntityModel(BaseSysParamEntity)
  baseSysParamRepo: Repository<BaseSysParamEntity>;

  private bearer: string; // 存储从数据库获取的Token

  profitCommon: Repository<AppAmzBsrProfitCommon>;
  profitMarket: Repository<AppAmzBsrProfitMarket>;

  @InjectEntityModel(AppAmzAiListingWriteEntity)
  listingWriteRepo: Repository<AppAmzAiListingWriteEntity>;

  @Inject()
  lingXingUtils: LingXingUtils;
  // 在AppAiListingService类中添加以下方法
  async checkReviewData(id: number): Promise<any> {
    // 获取当前记录
    const record = await this.aiListing.findOne({ where: { id } });

    if (!record) {
      throw new CoolCommException('记录不存在');
    }

    // 1. 检查是否选择了标题和卖点
    const hasTitle = !!record.final_title;
    const hasBulletPoints = [
      record.bullet_points1,
      record.bullet_points2,
      record.bullet_points3,
      record.bullet_points4,
      record.bullet_points5
    ].every(point => !!point);

    // 2. 检查是否包含品牌词
    let hasBrand = false;
    const foundBrands = new Set<string>();

    if (hasTitle || hasBulletPoints) {
      // 获取品牌词列表（从brand_names字段）
      const brandNames = (record.brand_names || [])
        .map(brand => brand.brand_name.trim().toLowerCase())
        .filter(name => name);

      // 检查标题中的品牌词
      if (hasTitle) {
        const title = record.final_title.toLowerCase();
        brandNames.forEach(brand => {
          if (title.includes(brand)) {
            hasBrand = true;
            foundBrands.add(brand);
          }
        });
      }

      // 检查卖点中的品牌词
      [
        record.bullet_points1,
        record.bullet_points2,
        record.bullet_points3,
        record.bullet_points4,
        record.bullet_points5
      ].forEach(point => {
        if (point) {
          const bullet = point.toLowerCase();
          brandNames.forEach(brand => {
            if (bullet.includes(brand)) {
              hasBrand = true;
              foundBrands.add(brand);
            }
          });
        }
      });
    }

    return {
      hasSelected: hasTitle && hasBulletPoints,
      hasTitle,
      hasBulletPoints,
      hasBrand,
      foundBrands: Array.from(foundBrands),
      message: !hasTitle || !hasBulletPoints
        ? '请确保已选择标题和五个卖点'
        : hasBrand
          ? '标题或卖点中包含品牌词'
          : '标题和卖点中未检测到品牌词'
    };
  }
  // @Init()
  async init() {
    // 从数据库获取Bearer Token配置 艾为思觉数据切换
    const tokenParam = await this.baseSysParamRepo.findOne({
      where: { keyName: 'ai_listing_bearer' }
    });

    if (!tokenParam?.data) {
      throw new Error('AI Listing Bearer Token未配置');
    }

    this.bearer = tokenParam.data.trim();
  }

  // 1. 创建任务线程
  async createThreads(name: string) {
    try {

      await this.init();
      const response = await axios.post(
        'http://seotools.woeau.com:2024/threads',
        {
          thread_id: "",
          metadata: {
            name: name
          },
          if_exists: "raise"
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.bearer}`

          }
        }
      );
      console.log("创建线程请求", response.data);
      return response.data;
    } catch (error) {
      console.error('创建线程请求错误:', error);
      throw new CoolCommException('创建线程失败');
    }
  }

  // 2. 创建任务运行实例（Amazon Listing 生成）
  async createAmazonListing(data: any) {
    try {

      await this.init();
      const response = await axios.post(
        `http://seotools.woeau.com:2024/threads/${data.thread_id}/runs`,
        {
          assistant_id: "amazon_listing_generator",
          input: {
            language: data.input.language,
            keywords: data.input.keywords,
            competitor_titles: data.input.competitor_titles,
            competitor_bullet_points: data.input.competitor_bullet_points,
            product_description: data.input.product_description, //选择的竞品描述    手动填写产品描述时，产品描述
            product_summary: data.input.product_summary,// 变体描述  选择了变体才能写listing  
            bullet_points_title: data.input.bullet_points_title,
            product_args: data.input.product_args,
            key_parameters: data.input.key_parameters,
            package_info: data.input.package_info,
            duplicate_num: data.input.duplicate_num
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.bearer}`
          }
        }
      );
      console.log("生成Amazon Listing请求", response.data);
      const coreKeywords = data.input.keywords.filter(item =>
        item.type === '核心大词' || item.type === '核心词'
      );
      const newListing = new AppAmzAiListingEntity();
      if (data.input.language == 'English') {
        newListing.marketplace = '英国'
      } else if (data.input.language == 'German') {
        newListing.marketplace = '德国'
      } else if (data.input.language == 'French') {
        newListing.marketplace = '法国'
      } else if (data.input.language == 'Spanish') {
        newListing.marketplace = '西班牙'
      } else if (data.input.language == 'Italian') {
        newListing.marketplace = '意大利'
      }
      newListing.thread_id = data.thread_id;     // 线程ID
      newListing.msku = data.msku;
      newListing.sku = data.sku;
      newListing.candidate_id = data.candidate_id;
      newListing.shop_id = data.seller_info.seller_account_id;
      newListing.account_name = data.seller_info.account_name;
      newListing.image_url = data.image_url;
      newListing.bsr_node_id = data.node_info.bsr_node_id;
      newListing.bsr_node = data.node_info.bsr_node;
      newListing.bsr_category = data.node_info.bsr_category;
      newListing.status = 1;
      newListing.keywords = coreKeywords; // 只保存核心词和核心大词
      newListing.procurement = data.variant.procurement;
      newListing.selectedVariant = data.variant.selectedVariant;
      newListing.factory_links = data.variant.factory_links;
      newListing.variant_Combination = data.variant.variant_Combination;
      newListing.produce_name = data.produce_name;
      return await this.aiListing.save(newListing);

      // return response.data;
    } catch (error) {
      console.error('生成Amazon Listing请求错误:', error);
      throw new CoolCommException('生成Amazon Listing失败');
    }
  }

  // 3. 获取线程状态 (GET 版本)
  async getState(thread_id: string) {
    try {
      await this.init();
      const response = await axios.get(
        `http://seotools.woeau.com:2024/threads/${thread_id}/state`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.bearer}`
          }
        }
      );
      
      console.log("获取线程状态请求", response);
      const { values, metadata, created_at } = response.data;
      console.log("完整响应数据:", response.data);
  
      if (!values || !metadata) {
        throw new CoolCommException('无效的响应数据结构');
      }
  
      // 先查询是否存在记录
      let listing = await this.aiListing.findOne({
        where: { thread_id: metadata.thread_id }
      });
  
      const countryMap = {
        '英国': 'uk', '德国': 'de', '法国': 'fr', '意大利': 'it', '西班牙': 'es'
      };
      const countryCode = countryMap[listing.marketplace];
      let msku = listing.msku;
      const mskuParts = msku.split('-');
      const baseMsku = mskuParts.length >= 3 
        ? mskuParts.slice(0, 3).join('-') 
        : msku;
      
      const allListings = await this.listingWriteRepo.find();
      const listingWrite = allListings.find(item => {
        const itemParts = item.msku.split('-');
        const itemBase = itemParts.length >= 3 
          ? itemParts.slice(0, 3).join('-') 
          : item.msku;
        return itemBase === baseMsku;
      });
  
      // 检查 listingWrite 是否存在
      if (!listingWrite) {
        console.error(`未找到msku为${msku}的listingWrite记录`);
        // 根据业务需求决定是抛出异常还是继续处理
        throw new CoolCommException(`未找到对应的listingWrite记录: ${msku}`);
      }
  
      if (!values.translated_title) {
        // 原有的处理逻辑保持不变
        listing.long_tail_phrases = values.long_tail_phrases || [];
        listing.bullet_titles = values.bullet_titles?.bullet_titles || [];
  
        const processTitle = (titleObj: any, defaultText = '未生成') => {
          if (!titleObj || !titleObj.title) return defaultText;
          return `${titleObj.title} `;
        };
  
        listing.title = processTitle(values.title, '默认标题');
        listing.title_more_freq = processTitle(values.title_more_freq, '高频版标题');
        listing.title_less_freq = processTitle(values.title_less_freq, '低频版标题');
        
        console.log('原始bullet_points数据:', {
          bullet_point_0: values.bullet_point_0,
          bullet_point_1: values.bullet_point_1,
          bullet_point_2: values.bullet_point_2,
          bullet_point_3: values.bullet_point_3,
          bullet_point_4: values.bullet_point_4,
          bullet_point_5: values.bullet_point_5,
          bullet_point_6: values.bullet_point_6,
          bullet_point_7: values.bullet_point_7
        });
  
        listing.bullet_points = [];
        for (let i = 0; i <= 7; i++) {
          const key = `bullet_point_${i}` as keyof typeof values;
          const bpData = values[key];
          if (bpData?.bullet_point) {
            listing.bullet_points.push({
              content: bpData.bullet_point,
              retry_count: bpData.retry_count || 0
            });
          }
        }
        
        console.log('处理后的bullet_points:', listing.bullet_points);
        listing.description = values.description
          ? values.description
            .replace(/\n+/g, '\n')
            .replace(/\s+/g, ' ')
            .trim()
          : '';
  
        if (values.brand_names && Array.isArray(values.brand_names)) {
          listing.brand_names = values.brand_names.map(brand => ({
            brand_name: brand.brand_name || '',
            reason: brand.reason || ''
          }));
        } else {
          listing.brand_names = [];
        }
  
        listing.irrelevant_words = values.irrelevant_words || [];
        listing.thread_id = metadata.thread_id || '';
  
        await this.aiListing.save(listing);
      } else {
        // 翻译标题存在时的处理逻辑
        listing.final_title = values.translated_title;
        listing.title = values.translated_title;
        listing.description = values.translated_description;
        
        if (values.brand_names && Array.isArray(values.brand_names)) {
          listing.brand_names = values.brand_names.map(brand => ({
            brand_name: brand.brand_name || '',
            reason: brand.reason || ''
          }));
        } else {
          listing.brand_names = [];
        }
        
        const bulletPointsToProcess = values.translated_bullet_points || [];
        listing.bullet_points = [];
  
        // 将卖点分配到单独的字段
        if (bulletPointsToProcess.length > 0) listing.bullet_points1 = bulletPointsToProcess[0];
        if (bulletPointsToProcess.length > 1) listing.bullet_points2 = bulletPointsToProcess[1];
        if (bulletPointsToProcess.length > 2) listing.bullet_points3 = bulletPointsToProcess[2];
        if (bulletPointsToProcess.length > 3) listing.bullet_points4 = bulletPointsToProcess[3];
        if (bulletPointsToProcess.length > 4) listing.bullet_points5 = bulletPointsToProcess[4];
  
        listing.bullet_points = bulletPointsToProcess.map((bp: string, index: number) => ({
          content: bp,
          position: index + 1
        }));
        
        listing.irrelevant_words = values.irrelevant_words || [];
        await this.aiListing.save(listing);
      }
  
      // 防御性检查 marketplaceNeeds
      if (!listingWrite.marketplaceNeeds || !Array.isArray(listingWrite.marketplaceNeeds) || listingWrite.marketplaceNeeds.length === 0) {
        console.error('marketplaceNeeds为空或不是数组');
        listingWrite.marketplaceNeeds = ['{"de":"0","fr":"0","it":"0","es":"0"}'];
      }
  
      let needsObj = JSON.parse(listingWrite.marketplaceNeeds[0]);
  
      if (countryCode && needsObj.hasOwnProperty(countryCode)) {
        needsObj[countryCode] = "1";
        listingWrite.marketplaceNeeds[0] = JSON.stringify(needsObj);
      }
      
      await this.listingWriteRepo.save(listingWrite);
  
    } catch (error) {
      console.error('完整错误日志:', {
        message: error.message,
        stack: error.stack,
        request: { thread_id }
      });
      throw new CoolCommException(`数据处理失败: ${error.message}`);
    }
  }

  // 4. 搜索线程（示例方法）
  async getForeignExchangeData() {
    try {

      await this.init();
      const response = await axios.post(
        'http://seotools.woeau.com:2024/threads/search',
        {
          metadata: {},
          values: {},
          status: 'idle',
          limit: 10,
          offset: 0
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.bearer}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('搜索线程请求错误:', error);
      throw new CoolCommException('搜索线程失败');
    }
  }
  async exportData(ids: number[]): Promise<{ csv: string }> {
    // 验证ids参数
    if (!ids || ids.length === 0) {
      throw new Error('请选择要导出的数据');
    }
    
    // 品牌名映射关系
    const brandMapping = {
      '壹逸': 'Lixstyea',
      '汤了个圆': 'CMANLNYK',
      '瑞君恒': 'EliphonTowne',
      '润芸': 'runpeak',
      '艾优途': 'YELKOEYN',
      '琦路': 'STEFUEWILL17'
    };
    
    const qb = this.aiListing
      .createQueryBuilder('listing')
      .leftJoinAndSelect(
        'app_amz_ai_listing_write',
        'write',
        'write.id = listing.candidate_id'
      )
      .leftJoin(
        AppAmzBsrProfitCommon,
        'profit_common',
        'profit_common.candidate_id = write.asinid'
      )
      .leftJoin(
        AppAmzBsrProfitMarket,
        'profit_market',
        `profit_market.common_id = profit_common.id 
         AND profit_market.country_code = CASE 
           WHEN listing.marketplace = '英国' THEN 'UK'
           WHEN listing.marketplace = '德国' THEN 'DE'
           WHEN listing.marketplace = '法国' THEN 'FR'
           WHEN listing.marketplace = '西班牙' THEN 'ES'
           WHEN listing.marketplace = '意大利' THEN 'IT'
           ELSE 'OTHER'
         END`
      )
      .where('listing.id IN (:...ids)', { ids })
      .select([
        // 产品识别
        'listing.marketplace AS 所属国家',
        'listing.final_title AS 商品名称',
        `listing.bsr_category AS 类目名称`,
        `listing.bsr_node_id AS 节点id`,
        `listing.account_name AS 原始品牌名`, // 保留原始值用于转换
        `listing.bsr_node AS 节点`,
        `'' AS BrandName`,
        `'我没有商品编码' AS 外部产品ID`,
        `'否' AS 外部产品ID类型`,
        'listing.id AS id',
  
        // 描述
        'listing.bullet_points1 AS 要点1',
        'listing.bullet_points2 AS 要点2',
        'listing.bullet_points3 AS 要点3',
        'listing.bullet_points4 AS 要点4',
        'listing.bullet_points5 AS 要点5',
        'listing.description AS 产品描述',
        `write.material AS 材料`,
        `write.color AS 颜色`,
        `write.size AS 尺码`,
        `listing.account_name AS 原始制造商`, // 保留原始值用于转换
        `listing.msku AS 型号`,
        'write.unit_count AS 单位计数',
        'write.product_quantity AS 产品数量',
  
        'profit_common.length AS 长',
        'profit_common.width AS 宽',
        'profit_common.height AS 高',
        `'CM' AS 单位`,
  
        'listing.msku AS 卖家SKU',
        `'New' AS 售卖类型`,
        `'FBA' AS 配送渠道`,
        'profit_market.local_price AS 您的价格',
        'profit_market.local_price AS 含税价目表',
  
        'profit_common.height AS 包装高度',
        'profit_common.length AS 包装长度',
        'profit_common.width AS 包装宽度',
        `'CM' AS 包装单位`,
        'COALESCE(profit_common.actual_weight, 0) AS 包装重量',
        `'kg' AS 包装重量单位`,
  
        // 安全与合规
        `'china' AS 原产国`
      ]);
  
    const data = await qb.getRawMany();
  
    const exportedIds = ids;
    
    // 生成CSV头部
    const headers = [
      '运行结果', '所属国家', '商品名称', '类目名称', '节点id', '品牌名', '节点', 'Brand Name', '外部产品 ID', '外部产品 ID类型',
      '要点1', '要点2', '要点3', '要点4', '要点5', '产品描述', '材料', '颜色',
      '尺码', '制造商', '型号', '单位计数', '产品数量', '长', '宽', '高', '单位',
      '卖家SKU', '售卖类型', '配送渠道', '您的价格', '含税价目表', '包装高度',
      '包装长度', '包装宽度', '包装单位', '包装重量', '包装重量单位', '原产国'
    ];
  
    let csv = headers.join(',') + '\n';
    const commaReplaceFields = new Set([
      '商品名称', '类目名称', '节点', '标题', '产品描述', '要点1', '要点2',
      '要点3', '要点4', '要点5', '节点名称', '品牌名', '制造商' // 添加了新的需要替换逗号的字段
    ]);
  
    // 填充数据并应用品牌映射
    data.forEach(item => {
      // 获取转换后的品牌名和制造商
      const brandName = brandMapping[item.原始品牌名] || item.原始品牌名;
      const manufacturer = brandMapping[item.原始制造商] || item.原始制造商;
      
      const row = headers.map(header => {
        let value;
        
        // 处理需要转换的字段
        if (header === '品牌名') {
          value = brandName;
        } else if (header === '制造商') {
          value = manufacturer;
        } else {
          value = item[header];
        }
        
        // 价格格式化
        if (['您的价格', '含税价目表'].includes(header)) {
          return value ? Number(value).toFixed(2) : '0.00';
        }
        
        // 替换逗号
        if (commaReplaceFields.has(header)) {
          value = String(value).replace(/,/g, '.');
        }
        
        return value !== null && value !== undefined ? String(value) : '';
      });
  
      csv += row.join(',') + '\n';
    });
    csv = csv.replace(/^"|"(?=,|$)/gm, '');
  
    // 更新导出记录的状态为3（已完成状态）
    if (exportedIds.length > 0) {
      await this.aiListing
        .createQueryBuilder()
        .update(AppAmzAiListingEntity)
        .set({ status: 3 })
        .where('id IN (:...ids)', { ids: exportedIds })
        .execute();
    }
    return { csv };
  }

  
  // 5.创建任务运行实例（翻译）
  async createAmazonListingFanYi(data: any) {
    try {

      await this.init();
      const response = await axios.post(
        `http://seotools.woeau.com:2024/threads/${data.thread_id}/runs`,
        {
          assistant_id: "amazon_listing_translator",
          input: {
            language: data.input.language,
            keywords: data.input.keywords,
            title: data.input.title,
            bullet_points: data.input.bullet_points,
            description: data.input.description
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.bearer}`
          }
        }
      );
      console.log("生成Amazon Listing翻译请求", response.data);
      const newListing = new AppAmzAiListingEntity();
      if (data.input.language == 'English') {
        newListing.marketplace = '英国'
      } else if (data.input.language == 'German') {
        newListing.marketplace = '德国'
      } else if (data.input.language == 'French') {
        newListing.marketplace = '法国'
      } else if (data.input.language == 'Spanish') {
        newListing.marketplace = '西班牙'
      } else if (data.input.language == 'Italian') {
        newListing.marketplace = '意大利'
      }
      newListing.thread_id = data.thread_id;     // 线程ID
      newListing.msku = data.msku;
      newListing.sku = data.sku;
      newListing.candidate_id = data.candidate_id;
      newListing.shop_id = data.shop_id;
      newListing.account_name = data.account_name;
      newListing.image_url = data.image_url;
      newListing.bsr_node_id = data.bsr_node_id;
      newListing.bsr_node = data.bsr_node;
      newListing.bsr_category = data.bsr_category;
      newListing.status = 1;
      newListing.keywords = data.keywords; // 只保存核心词和核心大词
      newListing.HS_code = data.HS_code;
      newListing.factory_links = data.factory_links;
      newListing.variant_Combination = data.variant_Combination;

      return await this.aiListing.save(newListing);

      // return response.data;
    } catch (error) {
      console.error('生成Amazon Listing请求错误:', error);
      throw new CoolCommException('生成Amazon Listing失败');
    }
  }


  async duplicate(id: number, variant: string, msku: string) {
    try {
      // 1. 获取原始记录
      const original = await this.aiListing.findOne({
        where: { id },
      });

      if (!original) {
        throw new CoolCommException('未找到指定记录');
      }

      const newRecord = new AppAmzAiListingEntity();

      Object.assign(newRecord, original);

      newRecord.id = null;
      newRecord.selectedVariant = variant
      newRecord.msku = msku
      newRecord.createTime = new Date();
      newRecord.updateTime = new Date();

      const result = await this.aiListing.save(newRecord);

      return result;
    } catch (error) {
      console.error('复制数据失败:', error);
      throw new CoolCommException('复制数据失败');
    }
  }

  async updateIsPairStatus(id: number, status: number) {
    // 更新配对状态
    await this.aiListing.update({ id }, { isPair: status });
  }
  async lingxinPair(msku: string, sku: string, id: number) {
    try {
      const payload = {
        data: [{
          msku: msku,
          sku: sku,
          is_sync_pic: 0
        }]
      };
      console.log('LingXing配对:', payload);
      const result = await this.lingXingUtils.httpPost(
        '/erp/sc/routing/data/local_inventory/createPurchasePlan',
        payload
      );
      await this.updateIsPairStatus(id, 1);

    } catch (error) {
      console.error('LingXing配对失败:', error);
      await this.updateIsPairStatus(id, 2);
      throw new CoolCommException('LingXing配对失败');

    }
  }

  async lingxinPairAll(ids: number[]) {
    try {
      // 根据ID获取所有记录的msku和sku
      const records = await this.getRecordsByIds(ids);
      // 构建领星配对数据
      const payload = {
        data: records.map(record => ({
          msku: record.msku,
          sku: record.sku,
          is_sync_pic: 0
        }))
      };

      console.log('LingXing批量配对:', payload);
      const result = await this.lingXingUtils.httpPost(
        '/erp/sc/routing/data/local_inventory/createPurchasePlan',
        payload
      );

      for (const id of ids) {
        await this.updateIsPairStatus(id, 1);
      }
      return { success: true, message: `成功配对 ${records.length} 条数据` };
    } catch (error) {
      console.error('LingXing批量配对失败:', error);

      for (const id of ids) {
        await this.updateIsPairStatus(id, 2);
      }
      throw new CoolCommException('LingXing批量配对失败');
    }
  }

  async getRecordsByIds(ids: number[]) {
    return await this.aiListing.find({
      where: { id: In(ids) },
      select: ['msku', 'sku']
    });
  }
}
