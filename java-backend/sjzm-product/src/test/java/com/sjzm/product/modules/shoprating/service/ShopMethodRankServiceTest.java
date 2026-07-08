package com.sjzm.product.modules.shoprating.service;

import com.sjzm.product.mapper.ShopMethodRankMapper;
import com.sjzm.product.modules.shoprating.dto.ShopMethodRankItem;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ShopMethodRankServiceTest {

    @Test
    void rankByMethodDispatchesM01() {
        ShopMethodRankMapper mapper = mock(ShopMethodRankMapper.class);
        ShopMethodRankService service = new ShopMethodRankService(mapper);
        List<ShopMethodRankItem> expected = List.of(new ShopMethodRankItem());

        when(mapper.selectM01ShopRanking("UK", "2026-W28", 2, 50)).thenReturn(expected);

        List<ShopMethodRankItem> actual = service.rankByMethod("M01", "UK", "2026-W28", 2, 50);

        assertEquals(expected, actual);
        verify(mapper).selectM01ShopRanking("UK", "2026-W28", 2, 50);
    }

    @Test
    void rankByMethodRejectsUnsupportedMethod() {
        ShopMethodRankService service = new ShopMethodRankService(mock(ShopMethodRankMapper.class));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> service.rankByMethod("M02", "UK", 1, 100)
        );

        assertEquals("店铺方法卡排名暂不支持 methodId=M02，当前仅支持 M01", ex.getMessage());
    }
}
