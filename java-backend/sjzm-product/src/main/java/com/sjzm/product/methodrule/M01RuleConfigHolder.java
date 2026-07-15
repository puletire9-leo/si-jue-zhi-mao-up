package com.sjzm.product.methodrule;

/**
 * 把 Spring 管理的 M01 阈值配置源桥接给 {@link M01Rule} 的静态方法。
 *
 * <p>{@code M01Rule.forMarketplace} 是被 8+ 处静态调用的权威入口，无法直接注入 Spring bean。
 * 配置 service 在启动时通过 {@link #register} 把自己（的取值函数）塞进静态引用，
 * 之后 forMarketplace 就能读到 DB 覆盖值；未注册时（如单元测试、启动早期）自动回退硬编码默认。</p>
 */
public final class M01RuleConfigHolder {

    /** 按 marketplace 返回生效 M01Rule 的函数；null 表示未注册，用硬编码默认。 */
    private static volatile java.util.function.Function<String, M01Rule> resolver;

    private M01RuleConfigHolder() {}

    public static void register(M01RuleConfigProvider provider) {
        resolver = provider::effectiveRule;
    }

    /** 供 M01Rule.forMarketplace 调用：有配置源则用之，否则回退 baseline。 */
    static M01Rule resolve(String marketplace) {
        java.util.function.Function<String, M01Rule> r = resolver;
        if (r == null) {
            return M01Rule.baseline(marketplace);
        }
        M01Rule rule = r.apply(marketplace);
        return rule != null ? rule : M01Rule.baseline(marketplace);
    }

    /** 配置源需实现的最小契约，避免 methodrule 包反向依赖 service 包的具体类型。 */
    public interface M01RuleConfigProvider {
        M01Rule effectiveRule(String marketplace);
    }
}
