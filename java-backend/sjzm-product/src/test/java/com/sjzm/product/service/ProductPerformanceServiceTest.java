package com.sjzm.product.service;

import com.sjzm.product.entity.ProductPerformanceActual;
import com.sjzm.product.mapper.ProductPerformanceActualMapper;
import com.sjzm.product.service.impl.ProductPerformanceServiceImpl;
import com.sjzm.product.service.impl.ProductTitleParsingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ProductPerformanceServiceTest {

    @Mock
    ProductPerformanceActualMapper mapper;

    ProductPerformanceService service;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        service = new ProductPerformanceServiceImpl(mapper, new ProductTitleParsingServiceImpl());
    }

    @Test
    void importFromMarkdown_parsesCustomRowsAndTags() throws Exception {
        Path md = tempDir.resolve("product_performance_actual.md");
        Files.writeString(md, """
                | ASIN | 父ASIN | 售价(总价) | SKU | 销量 | 大类排名 | ACoAS | 自然点击量 | CTR | 广告CVR | 自然订单量 | FBA-可售 | 小类排名 | 退款率 | 国家 | listing标签 | 品名 | 标题 |
                | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
                | B0GQS55V98 | B0GQS55V98 | ￡4.98 | 2610362 | 29 | Home & Kitchen：909291 | 0.018 | 12 | 0.57% | 37.50% | -2 |  | Reusable Shopping Bags：4525 | 0.00% | 英国 | 欧洲精铺2025非标品,绿标,欧洲精铺2025淘汰 | 【定制】【帆布袋】世界杯元素2 | Football Canvas Tote Bag, Vibrant Flag Shoulder Bag for Football Lovers, Tote Bags for Matchday or Daily, Commemorative Soccer Merchandise for Men Women |
                | B0CKTCC9VL | B0CKTCC9VL | €11.98 | 1931617 | 22 | Küche, Haushalt & Wohnen：203469 |  | 59 | 0.00% | 0.00% | 17 | 8 | Flaschenkörbe & -träger：218 | 0.00% | 德国 | 欧洲精铺2025 | 灰色毛毡酒瓶袋12格(黑色织带)-按照要求袋装 | zhongko Flaschentasche mit 12 Fächer, Flaschenträger Flaschentasche Filz Wiederverwendbare Wein Halter Bier Flasche Tasche Getränketasche für Party Reise Picknick(Grau) |
                """);

        int imported = service.importFromMarkdown(md.toString());

        assertThat(imported).isEqualTo(2);

        ArgumentCaptor<ProductPerformanceActual> captor = ArgumentCaptor.forClass(ProductPerformanceActual.class);
        verify(mapper, times(2)).upsert(captor.capture());
        List<ProductPerformanceActual> entities = captor.getAllValues();

        ProductPerformanceActual custom = entities.get(0);
        assertThat(custom.getMarketplace()).isEqualTo("UK");
        assertThat(custom.getPrice()).hasToString("4.98");
        assertThat(custom.getAcoas()).hasToString("0.0180");
        assertThat(custom.getCtr()).hasToString("0.0057");
        assertThat(custom.getAdCvr()).hasToString("0.3750");
        assertThat(custom.getCategoryMain()).isEqualTo("Home & Kitchen");
        assertThat(custom.getCategorySub()).isEqualTo("Reusable Shopping Bags");
        assertThat(custom.getArchetype()).isEqualTo("CUSTOM");
        assertThat(custom.getCarrier()).isEqualTo("Canvas Tote");
        assertThat(custom.getElement()).isEqualTo("Football");
        assertThat(custom.getIsGreen()).isEqualTo(1);
        assertThat(custom.getIsEliminated()).isEqualTo(1);
        assertThat(custom.getBsrId()).isEqualTo("kitchen");

        ProductPerformanceActual de = entities.get(1);
        assertThat(de.getMarketplace()).isEqualTo("DE");
        assertThat(de.getCategoryMain()).isEqualTo("Küche, Haushalt & Wohnen");
        assertThat(de.getBsrId()).isEqualTo("kitchen");
        assertThat(de.getArchetype()).isEqualTo("STD");
        assertThat(de.getElement()).isNull();
        assertThat(de.getCarrier()).isNull();
    }

    @Test
    void importFromMarkdown_stripsBrandAndExtractsElement() throws Exception {
        Path md = tempDir.resolve("product_performance_brand.md");
        Files.writeString(md, """
                | ASIN | 父ASIN | 售价(总价) | SKU | 销量 | 大类排名 | ACoAS | 自然点击量 | CTR | 广告CVR | 自然订单量 | FBA-可售 | 小类排名 | 退款率 | 国家 | listing标签 | 品名 | 标题 |
                | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
                | B0GHML3D42 | B0GHML3D42 | ￡8.98 | 2550857 | 13 | Fashion：87936 |  | 37 | 0.00% | 0.00% | 13 | 21 | Women's Glasses Cases：290 | 7.69% | 英国 | 欧洲精铺2025,欧洲精铺2025非标品 | 【2pcs】卡皮巴拉堆堆眼镜盒 | Dei tkeyts 2PCS Capybara Glasses Cases Set, Cute Kids Glasses Case, Plastic Hard Spectacle Cases, Durable Sunglasses Cases for Women & Men, Capybara Pattern Protective Eyewear Holder |
                """);

        service.importFromMarkdown(md.toString());

        ArgumentCaptor<ProductPerformanceActual> captor = ArgumentCaptor.forClass(ProductPerformanceActual.class);
        verify(mapper).upsert(captor.capture());
        ProductPerformanceActual entity = captor.getValue();

        assertThat(entity.getArchetype()).isEqualTo("CUSTOM");
        assertThat(entity.getElement()).isEqualTo("Capybara");
    }

    @Test
    void importFromMarkdown_doesNotInferCustomFromSubcategoryOnly() throws Exception {
        Path md = tempDir.resolve("product_performance_subcategory_only.md");
        Files.writeString(md, """
                | ASIN | 父ASIN | 售价(总价) | SKU | 销量 | 大类排名 | ACoAS | 自然点击量 | CTR | 广告CVR | 自然订单量 | FBA-可售 | 小类排名 | 退款率 | 国家 | listing标签 | 品名 | 标题 |
                | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
                | B0SUBONLY01 | B0SUBONLY01 | ￡6.66 | 1003 | 9 | Home & Kitchen：20000 | 0.030 | 9 | 1.20% | 12.00% | 2 | 4 | Tote Bags：120 | 0.00% | 英国 | 欧洲精铺2025 | 标题不含载体 | Butterfly Floral Home Decor for Girls Bedroom |
                """);

        service.importFromMarkdown(md.toString());

        ArgumentCaptor<ProductPerformanceActual> captor = ArgumentCaptor.forClass(ProductPerformanceActual.class);
        verify(mapper).upsert(captor.capture());
        ProductPerformanceActual entity = captor.getValue();

        assertThat(entity.getCategorySub()).isEqualTo("Tote Bags");
        assertThat(entity.getArchetype()).isEqualTo("STD");
        assertThat(entity.getCarrier()).isNull();
        assertThat(entity.getElement()).isNull();
    }

    @Test
    void importFromMarkdown_doesNotTreatWorldCupAsMugCarrier() throws Exception {
        Path md = tempDir.resolve("product_performance_world_cup.md");
        Files.writeString(md, """
                | ASIN | 鐖禔SIN | 鍞环(鎬讳环) | SKU | 閿€閲?| 澶х被鎺掑悕 | ACoAS | 鑷劧鐐瑰嚮閲?| CTR | 骞垮憡CVR | 鑷劧璁㈠崟閲?| FBA-鍙敭 | 灏忕被鎺掑悕 | 閫€娆剧巼 | 鍥藉 | listing鏍囩 | 鍝佸悕 | 鏍囬 |
                | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
                | B0WORLDCUP1 | B0WORLDCUP1 | 锟?.99 | 1004 | 20 | Garden锛?000 | 0.010 | 20 | 1.00% | 10.00% | 2 | 5 | Outdoor Flags锛?10 | 0.00% | 鑻卞浗 | 娆ф床绮鹃摵2025 | 涓栫晫鏉嫇灞曟牱鏈? | World Cup Bunting Flags 48 Teams Flags, 15M 48pcs Bunting Flags Double Sided Fabric Banner for 2026 World Cup Football Party Decoration |
                """);

        service.importFromMarkdown(md.toString());

        ArgumentCaptor<ProductPerformanceActual> captor = ArgumentCaptor.forClass(ProductPerformanceActual.class);
        verify(mapper).upsert(captor.capture());
        ProductPerformanceActual entity = captor.getValue();

        assertThat(entity.getArchetype()).isEqualTo("STD");
        assertThat(entity.getCarrier()).isNull();
        assertThat(entity.getElement()).isNull();
    }

    @Test
    void importFromMarkdown_resolvesWorkspaceRelativePathFromModuleDir() throws Exception {
        Path workspaceRoot = tempDir.resolve("workspace");
        Path moduleDir = workspaceRoot.resolve("sjzm-product");
        Path docsDir = workspaceRoot.resolve("docs").resolve("选品方法库");
        Files.createDirectories(moduleDir);
        Files.createDirectories(docsDir);

        Path md = docsDir.resolve("产品表现ASIN_转换版2.md");
        Files.writeString(md, """
                | ASIN | 父ASIN | 售价(总价) | SKU | 销量 | 大类排名 | ACoAS | 自然点击量 | CTR | 广告CVR | 自然订单量 | FBA-可售 | 小类排名 | 退款率 | 国家 | listing标签 | 品名 | 标题 |
                | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
                | B0TESTPATH1 | B0TESTPATH1 | ￡9.99 | 1001 | 11 | Home & Kitchen：10000 | 0.020 | 5 | 1.00% | 10.00% | 1 | 2 | Tote Bags：100 | 0.00% | 英国 | 欧洲精铺2025非标品 | 测试路径 | Highland Cow Tote Bag |
                """);

        String originalUserDir = System.getProperty("user.dir");
        try {
            System.setProperty("user.dir", moduleDir.toString());
            int imported = service.importFromMarkdown("docs/选品方法库/产品表现ASIN_转换版2.md");
            assertThat(imported).isEqualTo(1);
        } finally {
            System.setProperty("user.dir", originalUserDir);
        }
    }

    @Test
    void importFromMarkdown_resolvesMountedDocsFallback() throws Exception {
        Path mountedDocsRoot = tempDir.resolve("mounted-docs");
        Path docsDir = mountedDocsRoot.resolve("选品方法库");
        Files.createDirectories(docsDir);

        String fallbackFilePath = "docs/选品方法库/测试用_产品表现ASIN_转换版2.md";
        Path md = docsDir.resolve("测试用_产品表现ASIN_转换版2.md");
        Files.writeString(md, """
                | ASIN | 父ASIN | 售价(总价) | SKU | 销量 | 大类排名 | ACoAS | 自然点击量 | CTR | 广告CVR | 自然订单量 | FBA-可售 | 小类排名 | 退款率 | 国家 | listing标签 | 品名 | 标题 |
                | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
                | B0TESTDOCS1 | B0TESTDOCS1 | ￡6.66 | 1002 | 15 | Home & Kitchen：20000 | 0.030 | 9 | 1.20% | 12.00% | 2 | 4 | Tote Bags：120 | 0.00% | 英国 | 欧洲精铺2025非标品 | 挂载文档测试 | Butterfly Tote Bag |
                """);

        String originalDocsRoot = System.getProperty("product.performance.docs.root");
        try {
            System.setProperty("product.performance.docs.root", mountedDocsRoot.toString());
            int imported = service.importFromMarkdown(fallbackFilePath);
            assertThat(imported).isEqualTo(1);
        } finally {
            if (originalDocsRoot == null) {
                System.clearProperty("product.performance.docs.root");
            } else {
                System.setProperty("product.performance.docs.root", originalDocsRoot);
            }
        }
    }
}
