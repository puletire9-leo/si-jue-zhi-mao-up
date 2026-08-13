import {BaseEntity} from '@cool-midway/core';
import {Entity, Column} from 'typeorm';

@Entity('app_amz_ai_listing')
export class AppAmzAiListingEntity extends BaseEntity {
    @Column({comment: '本地SKU', nullable: true})
    sku: string;

    @Column({comment: 'MSKU', nullable: true})
    msku: string;

    @Column({comment: '店铺ID', nullable: true})
    shop_id: string;

    @Column({comment: '店铺名称', nullable: true})
    account_name: string;

    @Column({comment: '产品名称',length: 200, nullable: true})
    produce_name: string;
    
    @Column({comment: 'BSR 选品的 ID', type: 'int', nullable: true})
    candidate_id: number;

    @Column({comment: '线程ID', nullable: true, length: 255})
    thread_id: string;

    @Column({ comment: '状态: 1-初始状态, 2-人工复核状态, 3-已完成状态', type: 'int', default: 1 })
    status: number;

    @Column({comment: '主图链接', nullable: true})
    image_url: string;
     // 新增/修改字段
     @Column({ comment: '长尾词', type: 'json', nullable: true })
     long_tail_phrases: any[];
 
     @Column({ comment: '要点标题', type: 'json', nullable: true })
     bullet_titles: any[];
 
     @Column({ comment: '常规标题（含优化信息）', type: 'text', nullable: true })
     title: string;
 
     @Column({ comment: '高频标题（含优化信息）', type: 'text', nullable: true })
     title_more_freq: string;
 
     @Column({ comment: '低频标题（含优化信息）', type: 'text', nullable: true })
     title_less_freq: string;
 
     @Column({ comment: '描述', type: 'text', nullable: true })
     description: string;
 
     // 优化bullet points字段
     @Column({ comment: '卖点列表（完整结构）', type: 'json', nullable: true })
     bullet_points: Array<{
         content: string;
         retry_count: number;
     }>;

     @Column({ comment: '卖点1', type: 'text', nullable: true })
     bullet_points1: string;

     @Column({ comment: '卖点2', type: 'text', nullable: true })
     bullet_points2: string;

     @Column({ comment: '卖点3', type: 'text', nullable: true })
     bullet_points3: string;

     @Column({ comment: '卖点4', type: 'text', nullable: true })
     bullet_points4: string;

     @Column({ comment: '卖点5', type: 'text', nullable: true })
     bullet_points5: string;

     @Column({ comment: '最终选择的标题', type: 'text', nullable: true })
     final_title: string; 
     
     @Column({comment: '国家', length: 20, nullable: true})
     marketplace: string;

     @Column({comment: '节点编号', length: 20, nullable: true})
     bsr_node_id: string;

     @Column({comment: '节点名称', length: 50, nullable: true})
     bsr_node: string;

     @Column({comment: '类目名称', length: 50, nullable: true})
     bsr_category: string;

     @Column({ comment: '品牌名称及原因', type: 'json', nullable: true })
    brand_names: Array<{
        brand_name: string;
        reason: string;
    }>;
    @Column({ comment: '关键词列表', type: 'json', nullable: true })
    keywords: any[];
    
    @Column({ comment: '不相关的词', type: 'json', nullable: true })
    irrelevant_words: any[];

    @Column({comment: '采购意见', nullable: true})
    procurement: string;

    @Column({comment: '组合变体', nullable: true})
    selectedVariant: string;

    @Column({comment: '工厂链接', type: 'json', nullable: true})
    factory_links: string[];
    
    @Column({comment: '变体组合', type: 'json', nullable: true})
    variant_Combination: Array<{
        name: string;          // 变体名称
        factoryLinks: number[]; // 工厂链接的索引数组
    }>;
    @Column({comment: '海关编码', nullable: true})
    HS_code : string;

    @Column({ default: 0, comment: '配对状态: 0-未配对, 1-配对成功, 2-配对失败' })
    isPair: number;

}