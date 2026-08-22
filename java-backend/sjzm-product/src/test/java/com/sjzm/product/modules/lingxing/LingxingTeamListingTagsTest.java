package com.sjzm.product.modules.lingxing;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LingxingTeamListingTagsTest {

    @Test
    void matchesExactTeamTagAndNotSubstringOfEliminationTag() {
        assertThat(LingxingTeamListingTags.matchesTagNames("欧洲精铺2025")).isTrue();
        assertThat(LingxingTeamListingTags.matchesTagNames("绿标,普通产品")).isTrue();
        assertThat(LingxingTeamListingTags.matchesTagNames("欧洲精铺2025淘汰")).isTrue();
        assertThat(LingxingTeamListingTags.matchesTagNames("普通产品,需确认")).isFalse();
        assertThat(LingxingTeamListingTags.matchesTagNames(null)).isFalse();
        assertThat(LingxingTeamListingTags.matchesTagNames("")).isFalse();
    }

    @Test
    void matchesTeamTagIds() {
        assertThat(LingxingTeamListingTags.matchesTagIds("907563170455592213,1")).isTrue();
        assertThat(LingxingTeamListingTags.matchesTagIds("1,2")).isFalse();
    }
}
