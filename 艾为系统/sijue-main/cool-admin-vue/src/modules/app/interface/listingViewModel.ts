import { CompetitorSpiderResult } from "../../../../../cool-admin-midway/src/modules/app/interface/competitor-spider-result";
import { KeywordSearchVolumeData } from "../../../../../cool-admin-midway/src/modules/app/interface/keyword-search-volume-data";
import { CompetitorHistory } from "../../../../../cool-admin-midway/src/modules/app/interface/competitor-history";

export interface ListingViewModel {
	id: number;
	listing_id: string;
	sid: number;
	marketplace: string;
	seller_sku: string;
	fnsku: string;
	asin: string;
	parent_asin: string;
	small_image_url: string;
	status: number;
	is_delete: number;
	item_name: string;
	local_sku: string;
	local_name: string;
	currency_code: string;
	price: string | number | undefined;
	landed_price: string;
	listing_price: string;
	shipping: string;
	ponumbers: string;
	quantity: number;
	afn_fulfillable_quantity: number;
	afn_unsellable_quantity: number;
	reserved_fc_transfers: number;
	reserved_fc_processing: number;
	reserved_customerorders: number;
	afn_inbound_shipped_quantity: number;
	afn_inbound_working_quantity: number;
	afn_inbound_receiving_quantity: number;
	open_date: string;
	open_date_display: string;
	seller_rank: number;
	seller_category: string;
	review_num: number;
	last_star: string;
	fulfillment_channel_type: string;

	daily_order_quantity: number;
	inv_age_91_to_180_days: number;

	competitor_spider_status: number;
	competitor_spider_res: Array<CompetitorSpiderResult>;
	competitor_spider_time: Date;
	competitor_amount_history: Array<CompetitorHistory>;
	competitor_amount_history_updateTime: Date;

	kw_search_volume_update_time: Date;
	kw_search_volume_status: number;
	kw_search_volume_anal_res: Array<KeywordSearchVolumeData>;
	__kw_search_volume_anal_res_clone: Array<KeywordSearchVolumeData>;
	__selectedExpectedOrdersIndex: number | undefined | string;
	__expectedOrdersFixingInput: number | undefined;

	tags: string[];
	tactic_inventory_active: number;
	tactic_inventory_min_salable_days: number;

	tactic_new_product_date: Date;
	tactic_new_product_expected_daily_order_quantity: number;
	tactic_new_product_price_alert_threshold: number;
	tactic_new_price_modify_range: number;
	tactic_new_price_modify_value: number;

	tactic_competitor_price_up_threshold: number;
	tactic_competitor_price_down_threshold: number;

	tactic_clearance_expected_daily_order_quantity: number;
	tactic_clearance_cost_price: number;
	tactic_clearance_price_modify_range: number;
	tactic_clearance_price_modify_value: number;
	tactic_clearance_price_modify_upper_limit: number;
	tactic_clearance_price_modify_lower_limit: number;
	tactic_clearance_expected_order_max_before_9: number;
	tactic_clearance_expected_order_min_before_9: number;
	tactic_clearance_expected_order_max_before_12: number;
	tactic_clearance_expected_order_min_before_12: number;
	tactic_clearance_expected_order_max_before_15: number;
	tactic_clearance_expected_order_min_before_15: number;
	tactic_clearance_expected_order_max_before_18: number;
	tactic_clearance_expected_order_min_before_18: number;
	tactic_clearance_expected_order_max_before_21: number;
	tactic_clearance_expected_order_min_before_21: number;
	tactic_clearance_expected_order_max_before_24: number;
	tactic_clearance_expected_order_min_before_24: number;

	tactic_normal_target_inventory_days: number;
	tactic_normal_target_inventory_days_min: number;
	tactic_normal_target_inventory_days_max: number;
	tactic_normal_target_daily_order_quantity: number;
	tactic_normal_target_daily_order_quantity_alert_threshold: number;
	tactic_normal_sharp_change_alert_threshold: number;
	tactic_normal_price_modify_range: number;
	tactic_normal_price_modify_value: number;

	tactic_price_suggested_new_price: number | any;
	tactic_inventory_new_quantity_plan: number | any;
	tactic_price_ignore_until: Date;
	tactic_inventory_ignore_until: Date;
	tactic_hint_price: string;
	tactic_hint_inventory: string;

	is_custom_listing: number;
	is_suspended: number;
}
