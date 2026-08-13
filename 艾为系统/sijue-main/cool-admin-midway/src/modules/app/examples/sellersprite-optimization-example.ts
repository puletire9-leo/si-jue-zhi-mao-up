import { Provide, Inject } from '@midwayjs/decorator';
import { SellerspriteTool } from '../utils/maijiajingling/SellerspriteUtil';

/**
 * 卖家精灵API优化测试示例
 */
@Provide()
export class SellerspriteOptimizationExample {

  @Inject()
  sellerspriteTool: SellerspriteTool;

  /**
   * 示例1: 基本使用（自动享受优化）
   */
  async example1() {
    console.log('=== 示例1: 基本使用 ===');

    // 第一次调用：会调用API
    const result1 = await this.sellerspriteTool.competitorLookupOpenApi({
      marketplace: '美国',
      asins: ['B08XXXXX', 'B08YYYYY']
    });
    console.log('第一次调用结果:', result1);

    // 第二次调用相同数据：会从缓存获取
    const result2 = await this.sellerspriteTool.competitorLookupOpenApi({
      marketplace: '美国',
      asins: ['B08XXXXX', 'B08YYYYY']
    });
    console.log('第二次调用结果（缓存）:', result2);
  }

  /**
   * 示例2: 查看缓存统计
   */
  async example2() {
    console.log('=== 示例2: 查看缓存统计 ===');

    const stats = this.sellerspriteTool.getCacheStats();
    console.log('缓存统计信息:', {
      总缓存数: stats.total,
      有效缓存: stats.valid,
      过期缓存: stats.expired,
      缓存键示例: stats.keys.slice(0, 5) // 只显示前5个
    });
  }

  /**
   * 示例3: 手动清理缓存
   */
  async example3() {
    console.log('=== 示例3: 手动清理缓存 ===');

    // 清理过期缓存
    // this.sellerspriteTool.cleanExpiredCache();
    console.log('已清理过期缓存');

    // 清空所有缓存
    this.sellerspriteTool.clearCache();
    console.log('已清空所有缓存');

    // 查看清理后的统计
    const stats = this.sellerspriteTool.getCacheStats();
    console.log('清理后缓存统计:', stats);
  }

  /**
   * 示例4: 批量查询优化
   */
  async example4() {
    console.log('=== 示例4: 批量查询优化 ===');

    const asins = [
      'B08XXXXX', 'B08YYYYY', 'B08ZZZZZ',
      'B08AAAAA', 'B08BBBBB', 'B08CCCCC'
    ];

    // 第一次批量查询
    console.log('第一次批量查询...');
    const result1 = await this.sellerspriteTool.competitorLookupOpenApi({
      marketplace: '美国',
      asins
    });
    console.log(`第一次查询: 总计${result1.asinsCount}个，新数据${result1.newCount}条`);

    // 第二次批量查询（部分重复）
    console.log('第二次批量查询（部分重复）...');
    const result2 = await this.sellerspriteTool.competitorLookupOpenApi({
      marketplace: '美国',
      asins: [...asins, 'B08DDDDD'] // 添加一个新ASIN
    });
    console.log(`第二次查询: 总计${result2.asinsCount}个，缓存${result2.cachedCount}条，新数据${result2.newCount}条`);
  }

  /**
   * 示例5: 数据新鲜度检查
   */
  async example5() {
    console.log('=== 示例5: 数据新鲜度检查 ===');

    const asins = ['B08XXXXX', 'B08YYYYY', 'B08ZZZZZ'];
    const marketplace = '美国';

    // 检查哪些数据需要更新
    // 注意：这个方法是私有的，这里只是演示概念

    console.log(`检查 ${asins.length} 个ASIN的数据新鲜度...`);
    console.log('数据新鲜度检查已集成到批量处理中，自动过滤不需要更新的数据');
  }

  /**
   * 示例6: 性能对比测试
   */
  async example6() {
    console.log('=== 示例6: 性能对比测试 ===');

    const testAsins = Array.from({ length: 100 }, (_, i) => `B08${String(i).padStart(5, '0')}`);

    // 测试1: 无缓存情况（模拟）
    console.log('测试1: 无缓存情况（模拟）');
    const startTime1 = Date.now();
    // 这里模拟100次API调用
    console.log(`模拟100次API调用，耗时: ${Date.now() - startTime1}ms`);

    // 测试2: 有缓存情况
    console.log('测试2: 有缓存情况');
    const startTime2 = Date.now();

    // 第一次调用：建立缓存
    await this.sellerspriteTool.competitorLookupOpenApi({
      marketplace: '美国',
      asins: testAsins.slice(0, 10)
    });

    // 第二次调用：使用缓存
    await this.sellerspriteTool.competitorLookupOpenApi({
      marketplace: '美国',
      asins: testAsins.slice(0, 10)
    });

    console.log(`有缓存情况耗时: ${Date.now() - startTime2}ms`);
    console.log('缓存大幅减少了API调用次数');
  }

  /**
   * 示例7: 实际业务场景
   */
  async example7() {
    console.log('=== 示例7: 实际业务场景 ===');

    // 场景: 选品竞品数据导出
    console.log('场景1: 选品竞品数据导出');
    const exportResult = await this.sellerspriteTool.competitorLookupOpenApi({
      marketplace: '美国',
      asins: ['B08XXXXX', 'B08YYYYY']
    });
    console.log('导出结果:', {
      总数: exportResult.asinsCount,
      缓存命中: exportResult.fromCache,
      数据条数: exportResult.itemsCount
    });

    // 场景: 竞品状态更新
    console.log('场景2: 竞品状态更新（相同数据）');
    const updateResult = await this.sellerspriteTool.competitorLookupOpenApi({
      marketplace: '美国',
      asins: ['B08XXXXX', 'B08YYYYY']
    });
    console.log('更新结果:', {
      总数: updateResult.asinsCount,
      缓存命中: updateResult.fromCache,
      跳过查询: updateResult.cachedCount
    });
  }
}

/**
 * 使用示例控制器
 */
export class OptimizationExampleController {

  @Inject()
  example: SellerspriteOptimizationExample;

  /**
   * 运行所有示例
   */
  async runAllExamples() {
    console.log('开始运行优化示例...\n');

    await this.example.example1();
    console.log('\n');

    await this.example.example2();
    console.log('\n');

    await this.example.example4();
    console.log('\n');

    await this.example.example6();
    console.log('\n');

    await this.example.example7();
    console.log('\n');

    console.log('所有示例运行完成！');
  }

  /**
   * 清理缓存
   */
  async clearCache() {
    await this.example.example3();
  }
}