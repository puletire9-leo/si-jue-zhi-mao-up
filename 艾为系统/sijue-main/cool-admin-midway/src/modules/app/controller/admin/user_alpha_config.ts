import { CoolController, BaseController } from '@cool-midway/core';
import { Inject, Post, Body } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { AppAmzUserAlphaConfigEntity } from '../../entity/user_alpha_config';

/**
 * 用户自定义α权重配置接口
 * 一条 listing + 一个用户 = 一条配置
 *
 * 定位方式：
 *   1. 优先用 listing_id
 *   2. 备选用 product_code + marketplace + asin + msku
 */
@CoolController('/admin/app/userAlphaConfig')
export class AdminAppUserAlphaConfigController extends BaseController {
    @InjectEntityModel(AppAmzUserAlphaConfigEntity)
    userAlphaConfigRepo: Repository<AppAmzUserAlphaConfigEntity>;

    @Inject()
    ctx;

    /**
     * 校验 alpha 值：必须是有限数字且在 [0, 1]
     */
    private validateAlpha(value: any, fieldName: string): string | null {
        if (value === undefined || value === null) return null;
        const num = Number(value);
        if (!Number.isFinite(num)) return `${fieldName} 必须是有效数字`;
        if (num < 0 || num > 1) return `${fieldName} 必须在 0~1 之间，当前值: ${num}`;
        return null;
    }

    /**
     * 校验 monthlyAlphas 对象中的每个值
     */
    private validateMonthlyAlphas(obj: Record<string, number> | undefined | null, fieldName: string): string | null {
        if (!obj) return null;
        for (const [month, val] of Object.entries(obj)) {
            const err = this.validateAlpha(val, `${fieldName}["${month}"]`);
            if (err) return err;
        }
        return null;
    }

    /**
     * 定位唯一一条配置记录
     * 1. listing_id 能定位就用 listing_id
     * 2. 不能就用 product_code + marketplace + asin + msku 组合定位
     */
    private async findConfig(
        userId: number,
        listing_id?: number,
        product_code?: string,
        marketplace?: string,
        asin?: string,
        msku?: string,
        store_id?: number
    ): Promise<AppAmzUserAlphaConfigEntity | null> {
        // 方式1: listing_id 精确定位
        if (listing_id) {
            const config = await this.userAlphaConfigRepo.findOne({
                where: { user_id: userId, listing_id }
            });
            if (config) return config;
        }
        // 方式2: 完整自然键组合定位
        if (product_code && marketplace) {
            const qb = this.userAlphaConfigRepo
                .createQueryBuilder('c')
                .where('c.user_id = :userId', { userId })
                .andWhere('c.product_code = :product_code', { product_code })
                .andWhere('c.marketplace = :marketplace', { marketplace });
            if (asin) {
                qb.andWhere('c.asin = :asin', { asin });
            } else {
                qb.andWhere('c.asin IS NULL');
            }
            if (msku) {
                qb.andWhere('c.msku = :msku', { msku });
            } else {
                qb.andWhere('c.msku IS NULL');
            }
            if (store_id) {
                qb.andWhere('c.store_id = :store_id', { store_id });
            } else {
                qb.andWhere('c.store_id IS NULL');
            }
            return await qb.getOne() || null;
        }
        return null;
    }

    /**
     * 保存用户α配置（新增或更新）
     */
    @Post('/save')
    async save(
        @Body('listing_id') listing_id: number,
        @Body('product_code') product_code: string,
        @Body('marketplace') marketplace: string,
        @Body('asin') asin: string,
        @Body('msku') msku: string,
        @Body('store_id') store_id: number,
        @Body('default_alpha') default_alpha: number,
        @Body('monthly_alphas') monthly_alphas: Record<string, number>,
        @Body('monthly_remarks') monthly_remarks: Record<string, string>
    ) {
        const userId = this.ctx?.admin?.userId;
        if (!userId) return this.fail('未登录');
        if (!product_code || !marketplace) return this.fail('缺少必要参数: product_code 或 marketplace');

        // 参数完整性校验：要么有 listing_id，要么有完整自然键
        if (!listing_id && (!asin || !msku || !store_id)) {
            return this.fail('缺少定位参数: 请传入 listing_id，或同时传入 asin + msku + store_id');
        }

        // α 范围校验
        const alphaErr = this.validateAlpha(default_alpha, 'default_alpha');
        if (alphaErr) return this.fail(alphaErr);
        const monthlyErr = this.validateMonthlyAlphas(monthly_alphas, 'monthly_alphas');
        if (monthlyErr) return this.fail(monthlyErr);

        try {
            const config = await this.findConfig(userId, listing_id, product_code, marketplace, asin, msku, store_id);

            if (config) {
                // 更新已有记录
                await this.userAlphaConfigRepo.update(config.id, {
                    listing_id: listing_id || config.listing_id,
                    default_alpha,
                    monthly_alphas,
                    monthly_remarks
                });
                return this.ok({ id: config.id, action: 'updated' });
            } else {
                // 新建
                const newConfig = this.userAlphaConfigRepo.create({
                    user_id: userId,
                    listing_id: listing_id || null,
                    product_code,
                    marketplace,
                    asin: asin || null,
                    msku: msku || null,
                    store_id: store_id || null,
                    default_alpha,
                    monthly_alphas,
                    monthly_remarks
                });
                const saved = await this.userAlphaConfigRepo.save(newConfig);
                return this.ok({ id: saved.id, action: 'created' });
            }
        } catch (error) {
            console.error('保存用户α配置失败:', error);
            return this.fail('保存失败: ' + error.message);
        }
    }

    /**
     * 获取用户α配置
     */
    @Post('/get')
    async get(
        @Body('listing_id') listing_id: number,
        @Body('product_code') product_code: string,
        @Body('marketplace') marketplace: string,
        @Body('asin') asin: string,
        @Body('msku') msku: string,
        @Body('store_id') store_id: number
    ) {
        const userId = this.ctx?.admin?.userId;
        if (!userId) return this.fail('未登录');

        // 参数完整性校验：要么有 listing_id，要么有完整自然键
        if (!listing_id && (!product_code || !marketplace || !asin || !msku || !store_id)) {
            return this.fail('缺少定位参数: 请传入 listing_id，或同时传入 product_code + marketplace + asin + msku + store_id');
        }

        try {
            const config = await this.findConfig(userId, listing_id, product_code, marketplace, asin, msku, store_id);
            return this.ok(config || null);
        } catch (error) {
            console.error('获取用户α配置失败:', error);
            return this.fail('获取失败: ' + error.message);
        }
    }

    /**
     * 删除用户α配置
     */
    @Post('/remove')
    async removeConfig(@Body('id') id: number) {
        const userId = this.ctx?.admin?.userId;
        if (!userId) return this.fail('未登录');
        if (!id) return this.fail('缺少参数: id');

        try {
            const config = await this.userAlphaConfigRepo.findOne({
                where: { id, user_id: userId }
            });
            if (!config) return this.fail('配置不存在或无权限');
            await this.userAlphaConfigRepo.delete(id);
            return this.ok({ deleted: true });
        } catch (error) {
            console.error('删除用户α配置失败:', error);
            return this.fail('删除失败: ' + error.message);
        }
    }
}
