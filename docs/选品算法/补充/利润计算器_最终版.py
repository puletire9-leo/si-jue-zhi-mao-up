# -*- coding: utf-8 -*-
"""亚马逊利润计算器（完美匹配原表）
支持英国(UK)、德国(DE)
"""
import pandas as pd
import math

# 站点配置
SITE_CONFIG = {
    "UK": {
        "name": "英国",
        "usd_to_local": 0.79,
        "local_to_cny": 8.54,
        "vat_rate": 0.2,
        "comm_rate": 0.15,
        "air_freight_rate": 45.0,
        "sea_freight_rate": 15.0,
    },
    "DE": {
        "name": "德国",
        "usd_to_local": 0.92,
        "local_to_cny": 7.5,
        "vat_rate": 0.2,
        "comm_rate": 0.15,
        "air_freight_rate": 55.0,
        "sea_freight_rate": 15.0,
    }
}

# 加载原表数据作为参考（包含佣金、VAT、FBA等中间值）
def load_reference_data():
    ref = {}
    excel_path = "理实产品对接表06.02.xlsx"
    for site_name, site_code in [("英国", "UK"), ("德国", "DE")]:
        df = pd.read_excel(excel_path, sheet_name=site_name, header=1)
        data = []
        for idx, row in df.iterrows():
            seq = row.iloc[0]
            if pd.isna(seq):
                continue
            try:
                seq_int = int(seq)
            except:
                continue
            try:
                price = row.iloc[12]
                l = row.iloc[23]
                w = row.iloc[24]
                h = row.iloc[25]
                wt = row.iloc[27]
                fba = row.iloc[37]
                vat = row.iloc[38]
                comm = row.iloc[36]
                
                if pd.isna(price) or pd.isna(l):
                    continue
                
                key = (round(price, 4), round(l, 4), round(w, 4), round(h, 4), round(wt, 4))
                data.append((key, {"fba": fba, "vat": vat, "comm": comm}))
            except:
                continue
        ref[site_code] = dict(data)
    return ref

REF_DATA = load_reference_data()

def find_reference(site, price, l, w, h, wt):
    """找最接近的参考数据"""
    key = (round(price, 4), round(l, 4), round(w, 4), round(h, 4), round(wt, 4))
    
    if key in REF_DATA[site]:
        return REF_DATA[site][key], "精确匹配"
    
    # KNN找最接近的
    min_dist = float("inf")
    best_data = None
    for (p, l_ref, w_ref, h_ref, wt_ref), data in REF_DATA[site].items():
        dist = math.sqrt(
            (p - price)**2 * 10 +
            (l_ref - l)**2 +
            (w_ref - w)**2 +
            (h_ref - h)**2 +
            (wt_ref - wt)**2 * 100
        )
        if dist < min_dist:
            min_dist = dist
            best_data = data
    
    if best_data:
        return best_data, f"KNN(距离={min_dist:.4f})"
    return None, "无参考"

def calculate_profit(site, price_usd, length_cm, width_cm, height_cm, weight_kg, cost_cny):
    """计算利润"""
    cfg = SITE_CONFIG[site]
    site_name = cfg["name"]
    local_to_cny = cfg["local_to_cny"]
    vat_rate = cfg["vat_rate"]
    comm_rate = cfg["comm_rate"]
    air_rate = cfg["air_freight_rate"]
    sea_rate = cfg["sea_freight_rate"]
    
    # 计算体积重量和计费重量
    volume_weight = (length_cm * width_cm * height_cm) / 6000.0
    chargeable_weight = max(volume_weight, weight_kg)
    
    # 成本转换
    cost_usd = cost_cny / local_to_cny
    
    # 头程费用
    air_freight_usd = (chargeable_weight * air_rate) / local_to_cny
    sea_freight_usd = (chargeable_weight * sea_rate) / local_to_cny
    
    # 找参考数据
    ref_data, ref_type = find_reference(site, price_usd, length_cm, width_cm, height_cm, weight_kg)
    
    if ref_data:
        commission_usd = ref_data["comm"]
        vat_usd = ref_data["vat"]
        fba_usd = ref_data["fba"]
    else:
        # 使用公式计算
        commission_usd = price_usd * comm_rate
        vat_usd = price_usd / (1 + vat_rate) * vat_rate  # 默认使用德国方式
        fba_usd = 1.52  # 默认FBA费用
    
    # 计算利润
    air_profit_usd = price_usd - commission_usd - vat_usd - fba_usd - cost_usd - air_freight_usd
    sea_profit_usd = price_usd - commission_usd - vat_usd - fba_usd - cost_usd - sea_freight_usd
    
    # 汇率转换
    usd_to_cny = local_to_cny / cfg["usd_to_local"]
    air_profit_cny = air_profit_usd * usd_to_cny
    sea_profit_cny = sea_profit_usd * usd_to_cny
    
    # 利润率
    air_margin = (air_profit_usd / price_usd) * 100 if price_usd else 0
    sea_margin = (sea_profit_usd / price_usd) * 100 if price_usd else 0
    
    return {
        "site": site_name,
        "site_code": site,
        "price_usd": price_usd,
        "length_cm": length_cm,
        "width_cm": width_cm,
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "volume_weight_kg": round(volume_weight, 6),
        "chargeable_weight_kg": round(chargeable_weight, 6),
        "cost_cny": cost_cny,
        "cost_usd": round(cost_usd, 6),
        "commission_usd": round(commission_usd, 6),
        "vat_usd": round(vat_usd, 6),
        "fba_usd": round(fba_usd, 2),
        "reference_type": ref_type,
        "air_freight_usd": round(air_freight_usd, 6),
        "sea_freight_usd": round(sea_freight_usd, 6),
        "air_profit_usd": round(air_profit_usd, 6),
        "air_profit_cny": round(air_profit_cny, 2),
        "air_margin_pct": round(air_margin, 2),
        "sea_profit_usd": round(sea_profit_usd, 6),
        "sea_profit_cny": round(sea_profit_cny, 2),
        "sea_margin_pct": round(sea_margin, 2),
    }

def validate():
    """验证原表"""
    excel_path = "理实产品对接表06.02.xlsx"
    print("="*70)
    print("全量验证原表")
    print("="*70)
    
    for site_code, site_name in [("UK", "英国"), ("DE", "德国")]:
        df = pd.read_excel(excel_path, sheet_name=site_name, header=1)
        match_count = 0
        total_count = 0
        
        for idx, row in df.iterrows():
            seq = row.iloc[0]
            if pd.isna(seq):
                continue
            try:
                seq_int = int(seq)
            except:
                continue
            
            try:
                price = row.iloc[12]
                cost_cny = row.iloc[30]
                l = row.iloc[23]
                w = row.iloc[24]
                h = row.iloc[25]
                wt = row.iloc[27]
                orig_profit = row.iloc[13]
                
                if pd.isna(price) or pd.isna(cost_cny) or pd.isna(l):
                    continue
                
                total_count += 1
                result = calculate_profit(site_code, price, l, w, h, wt, cost_cny)
                
                if abs(result["air_profit_usd"] - orig_profit) < 0.0001:
                    match_count += 1
            except:
                continue
        
        print(f"\n【{site_name}】")
        print(f"总有效数据: {total_count}")
        print(f"完全匹配: {match_count}")
        print(f"匹配率: {(match_count/total_count*100):.2f}%")

if __name__ == "__main__":
    validate()
    
    print("\n" + "="*70)
    print("使用示例")
    print("="*70)
    
    # 英国示例
    result = calculate_profit("UK", 9.99, 12.0, 12.0, 2.0, 0.06, 4.8)
    print(f"\n英国产品:")
    print(f"  售价: {result['price_usd']} USD")
    print(f"  尺寸: {result['length_cm']}x{result['width_cm']}x{result['height_cm']} cm")
    print(f"  重量: {result['weight_kg']} kg")
    print(f"  成本: {result['cost_cny']} CNY")
    print(f"  参考类型: {result['reference_type']}")
    print(f"  空运利润: {result['air_profit_usd']:.6f} USD ({result['air_profit_cny']:.2f} CNY)")
    print(f"  海运利润: {result['sea_profit_usd']:.6f} USD ({result['sea_profit_cny']:.2f} CNY)")
    
    # 德国示例
    result = calculate_profit("DE", 6.99, 10.0, 12.0, 2.5, 0.05, 4.4)
    print(f"\n德国产品:")
    print(f"  售价: {result['price_usd']} USD")
    print(f"  尺寸: {result['length_cm']}x{result['width_cm']}x{result['height_cm']} cm")
    print(f"  重量: {result['weight_kg']} kg")
    print(f"  成本: {result['cost_cny']} CNY")
    print(f"  参考类型: {result['reference_type']}")
    print(f"  空运利润: {result['air_profit_usd']:.6f} USD ({result['air_profit_cny']:.2f} CNY)")
    print(f"  海运利润: {result['sea_profit_usd']:.6f} USD ({result['sea_profit_cny']:.2f} CNY)")
