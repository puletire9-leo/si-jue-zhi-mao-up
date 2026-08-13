import {BaseEntity} from '@cool-midway/core';
import {Column, Entity, Index} from 'typeorm';
import {ProductInfoSpiderResult} from "../interface/product-info-spider-result";

    @Entity('app_amz_bsr_profit_market')
    export class AppAmzBsrProfitMarket extends BaseEntity {
        @Column({comment: 'id', type: 'int', nullable: true})
        id: number;

        @Column({ type: 'int' , nullable: true})
        common_id: number;

        @Column({ type: 'char', length: 2 , nullable: true})
        country_code: string;


        @Column({ type: 'decimal', precision: 10, scale: 2 , nullable: true})
        local_price: number;


        @Column({ type: 'decimal', precision: 10, scale: 2 , nullable: true})
        shipping: number;


        @Column({ type: 'decimal', precision: 10, scale: 2 , nullable: true})
        delivery_fee: number;


        @Column({ type: 'decimal', precision: 10, scale: 4 , nullable: true})
        exchange_rate: number;


        @Column({ type: 'decimal', precision: 5, scale: 2 , nullable: true})
        tax_rate: number;


        @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
        profit: number;


        @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
        profit_rate: number;
    }
