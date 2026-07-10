package com.sjzm.product.modules.shopcollection.rule;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * 店铺全集类目「注意 / 好品倾向」标签规则。
 *
 * <p>口径：注意与倾向层不是违禁/拒绝判断，只用于分析、筛选和前端解释。
 * ATTENTION_STRONG 只表示强注意需人工重点看；GOOD_TENDENCY 表示类目形态接近验证好品线。
 *
 * <p>第一版规则硬编码，后续可配置化。规则从 ShopCollectionService 抽出，服务与前端只消费 {@link CategoryLabel}。
 */
@Component
public class ShopProfileLabelRule {

    /** 分类结果：注意/倾向等级 + 理由 + 中文含义 + 命中标签。 */
    public record CategoryLabel(String level, String reason, String meaning,
                                List<String> attentionTags, List<String> tendencyTags) {
    }

    /** 按类目 key + 类目路径分类出注意/倾向标签。 */
    public CategoryLabel classify(String categoryKey, String nodeLabelPath) {
        String text = ((categoryKey == null ? "" : categoryKey) + " " + (nodeLabelPath == null ? "" : nodeLabelPath))
                .toLowerCase(Locale.ROOT);
        if (!StringUtils.hasText(text) || text.contains("unknown")) {
            return new CategoryLabel("UNKNOWN", "CATEGORY_UNKNOWN",
                    "类目缺失，只能先看销量、新品和商品标题", List.of(), List.of());
        }

        List<String> attentionTags = new ArrayList<>();
        List<String> tendencyTags = new ArrayList<>();

        addTagIfAny(attentionTags, "ATTN_POWER_SUPPLY", text,
                "charger", "adapter", "power supply", "plug", "socket", "outlet", "mains powered",
                "wall charger", "ac adapter", "extension cord", "power strip", "stecker", "steckdose",
                "ladegeraet", "ladegerät", "netzteil");
        addTagIfAny(attentionTags, "ATTN_CHEMICAL_EFFECT", text,
                "chlorine", "herbicide", "pesticide", "insecticide", "killer", "repellent", "bait station",
                "rust remover", "scratch remover", "headlight restoration", "algaecide", "cleaning chemical");
        addTagIfAny(attentionTags, "ATTN_SAFETY_LIABILITY", text,
                "seat belt", "life jacket", "swim vest", "gas cooker", "butane", "stove", "safety harness",
                "helmet", "child safety");
        addTagIfAny(attentionTags, "ATTN_BULKY_HEAVY", text,
                "furniture", "mattress", "car cover", "pool", "tent", "shelter", "large cage", "bed frame",
                "wardrobe", "sofa", "chair", "table", "10kg");
        addTagIfAny(attentionTags, "ATTN_OVERCLAIM_REPAIR", text,
                "deep scratch", "restore shine", "removes yellowing", "long-lasting protection",
                "repair kit", "restoration kit");

        addTagIfAny(attentionTags, "REVIEW_BATTERY_CONSUMER", text,
                "battery", "batteries", "rechargeable", "led", "electronic", "electric", "usb", "akku", "batterie");
        addTagIfAny(attentionTags, "REVIEW_LIQUID_FULFILLMENT", text,
                "liquid", "fluid", "gel", "spray", "oil", "cream", "lotion", "serum", "perfume", "fragrance",
                "shampoo", "detergent", "flussig", "flüssig", "creme", "parfum");
        addTagIfAny(attentionTags, "REVIEW_CHILD_TOY", text,
                "kids", "children", "toddler", "baby", "infant");
        addTagIfAny(attentionTags, "REVIEW_AUTO_ACCESSORY", text,
                "automotive", "car", "bike", "bicycle", "motorbike", "motorcycle", "scooter");
        addTagIfAny(attentionTags, "REVIEW_PET_PRODUCT", text,
                "pet", "dog", "cat", "bird", "hamster", "reptile", "aquarium");
        addTagIfAny(attentionTags, "REVIEW_BEAUTY_CONTACT", text,
                "skin care", "skincare", "cosmetic", "makeup", "beauty", "massage");

        addTagIfAny(tendencyTags, "GOOD_LIGHT_THEME_PRODUCT", text,
                "keyring", "keychain", "card", "sticker", "coin", "charm", "badge", "bookmark", "plaque");
        addTagIfAny(tendencyTags, "GOOD_PARTY_GIFT", text,
                "birthday", "party", "banner", "cake topper", "gift", "favour", "favor", "balloon", "garland");
        addTagIfAny(tendencyTags, "GOOD_CRAFT_DIY", text,
                "craft", "resin", "acrylic", "diamond painting", "mould", "mold", "template", "beading",
                "scrapbook", "sticker", "sewing", "quilting", "embroidery", "nail art");
        addTagIfAny(tendencyTags, "GOOD_DECOR_SMALL", text,
                "suncatcher", "sun catcher", "ornament", "figurine", "statue", "wall art", "garden stake",
                "wind spinner", "dream catcher", "miniature");
        addTagIfAny(tendencyTags, "GOOD_CUSTOM_SURFACE", text,
                "mug", "tote", "shopping bag", "drawstring bag", "cosmetic bag", "coin purse", "pouch");
        addTagIfAny(tendencyTags, "GOOD_TOY_SMALL", text,
                "fidget", "squeeze toy", "squishy", "action figure", "animal figure", "building toy",
                "card game", "puzzle", "plush", "magnetic toy");
        addTagIfAny(tendencyTags, "GOOD_SMALL_ACCESSORY", text,
                "fishing", "lure", "golf", "bike bell", "valve cap", "aquarium decor", "hair accessory",
                "bracelet", "headband");

        List<String> strongAttention = attentionTags.stream()
                .filter(tag -> tag.startsWith("ATTN_"))
                .toList();
        if (!strongAttention.isEmpty()) {
            return new CategoryLabel("ATTENTION_STRONG", String.join(",", strongAttention),
                    "强注意标签：只表示该类目有明显责任、合规、体积或功效承诺信号，需要人工判断，不是系统拒绝结论",
                    attentionTags, tendencyTags);
        }
        if (!attentionTags.isEmpty()) {
            return new CategoryLabel("ATTENTION_REVIEW", String.join(",", attentionTags),
                    "复核标签：可能涉及履约、儿童、汽车、宠物、美妆等边界，需要结合标题、图片、价格和体积判断",
                    attentionTags, tendencyTags);
        }
        if (!tendencyTags.isEmpty()) {
            return new CategoryLabel("GOOD_TENDENCY", String.join(",", tendencyTags),
                    "好品倾向标签：类目形态接近轻小、主题化、可组合、可定制的验证好品线",
                    attentionTags, tendencyTags);
        }
        return new CategoryLabel("NEUTRAL", "NO_RULE_HIT",
                "未命中初版注意标签或好品倾向标签", attentionTags, tendencyTags);
    }

    private void addTagIfAny(List<String> tags, String tag, String text, String... keywords) {
        if (containsAny(text, keywords) && !tags.contains(tag)) {
            tags.add(tag);
        }
    }

    private boolean containsAny(String text, String... keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
}
