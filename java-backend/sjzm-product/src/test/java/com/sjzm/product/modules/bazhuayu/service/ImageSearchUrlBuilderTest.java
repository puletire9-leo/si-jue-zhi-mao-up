package com.sjzm.product.modules.bazhuayu.service;

import org.junit.jupiter.api.Test;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ImageSearchUrlBuilderTest {

    @Test
    void removesStandardAmazonThumbnailModifier() {
        String image = "https://images-na.ssl-images-amazon.com/images/I/71rQ0mPnEUL._AC_US200_.jpg";

        assertEquals(
                "https://images-na.ssl-images-amazon.com/images/I/71rQ0mPnEUL.jpg",
                ImageSearchUrlBuilder.normalizeSourceImageUrl(image));
    }

    @Test
    void removesCrawlerStarModifierAndMarkdownEscape() {
        String image = "https://images-na.ssl-images-amazon.com/images/I/71rQ0mPnEUL.*AC\\_US200*.jpg";

        assertEquals(
                "https://images-na.ssl-images-amazon.com/images/I/71rQ0mPnEUL.jpg",
                ImageSearchUrlBuilder.normalizeSourceImageUrl(image));
    }

    @Test
    void buildsEncodedUkStyleSnapUrlWithOriginalImage() {
        String result = ImageSearchUrlBuilder.build(
                "uk",
                "https://m.media-amazon.com/images/I/example._AC_SL1500_.jpg");

        String encodedImage = result.substring(result.indexOf("?q=") + 3);
        assertEquals("https://www.amazon.co.uk/stylesnap?q=", result.substring(0, result.indexOf("?q=") + 3));
        assertEquals(
                "https://m.media-amazon.com/images/I/example.jpg",
                URLDecoder.decode(encodedImage, StandardCharsets.UTF_8));
    }

    @Test
    void preservesNonAmazonImageUrls() {
        assertEquals(
                "https://example.test/image_US200_.jpg",
                ImageSearchUrlBuilder.normalizeSourceImageUrl("https://example.test/image_US200_.jpg"));
        assertNull(ImageSearchUrlBuilder.build("UK", null));
    }
}
