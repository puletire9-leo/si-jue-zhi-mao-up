package com.sjzm.product.service.impl;

import com.sjzm.product.dto.ProductTitleParseResult;
import com.sjzm.product.service.ProductTitleParsingService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ProductTitleParsingServiceImpl implements ProductTitleParsingService {

    private static final Set<String> BRAND_BLACKLIST = Set.of(
            "zhongko",
            "shirylzee",
            "orsefeliy",
            "dei",
            "tkeyts"
    );

    private static final Set<String> MATERIAL_BLACKLIST = Set.of(
            "handmade", "crochet", "acrylic", "wooden", "vinyl", "polyester",
            "cotton", "stainless", "steel", "ceramic", "silicon", "silicone",
            "metal", "felt", "plastic", "rubber", "glass", "leather", "pu"
    );

    private static final Set<String> COLOR_BLACKLIST = Set.of(
            "black", "white", "red", "blue", "gold", "pink", "silver", "brown",
            "green", "orange", "purple", "grey", "gray", "yellow", "beige",
            "champagne", "multicolor", "multicolour", "colourful", "colorful"
    );

    private static final Set<String> NOISE_WORDS = Set.of(
            "for", "with", "and", "the", "a", "an", "of", "to", "set", "gift",
            "gifts", "decor", "decoration", "decorations", "cute", "funny",
            "vintage", "portable", "waterproof", "adjustable", "reusable",
            "double", "sided", "large", "small", "creative", "collectible",
            "collectibles", "desk", "desktop", "home", "office", "party",
            "supplies", "supply", "novelty", "kit", "kits", "holder", "holders",
            "pack", "packs", "piece", "pieces", "pc", "pcs", "2pcs", "3pcs",
            "4pcs", "5pcs", "6pcs", "8pcs", "10pcs", "12pcs", "14pcs", "15pcs",
            "16pcs", "20pcs", "24pcs", "30pcs", "40pcs", "50pcs", "60pcs",
            "100pcs"
    );

    // Bootstrapped from docs/选品方法库/补充/载体元素三语映射表.md.
    // Later this should be replaced by a manually maintained selection carrier table.
    private static final List<CarrierPattern> CARRIER_PATTERNS = List.of(
            carrier("Canvas Tote", "Canvas Tote", "Baumwolltasche"),
            carrier("Tote Bag", "Tote Bag", "Tragetasche", "Einkaufstasche", "Stofftasche", "Jutebeutel"),
            carrier("Cosmetic Bag", "Cosmetic Bag", "Makeup Bag", "Make Up Bag", "Toiletry Bag",
                    "Medium Cosmetic Bag", "Large Cosmetic Bag", "Compartment Makeup Bag",
                    "Multi-pocket Cosmetic Bag", "Clear Makeup Bag",
                    "Kosmetiktasche", "Kulturbeutel", "Schminktasche", "Make-up Tasche"),
            carrier("Suncatcher", "Suncatcher", "Sun Catcher", "Acrylic Ornament", "Hanging Ornament",
                    "Window Ornament", "Stained Glass Suncatcher", "Glass Hanging", "Glass Ornament",
                    "Wooden Hanging Ornament", "Acrylic Puzzle Ornament", "Puzzle Suncatcher",
                    "Sonnenfänger", "Fensterbild", "Fensterdeko", "Glasornament", "Glasanhänger"),
            carrier("Metal Sign", "Metal Sign", "Tin Sign", "Metal Plaque", "Metal Wall Art",
                    "Tin Poster", "Round Metal Sign", "Circle Tin Sign", "Iron Wall Decor",
                    "Blechschild", "Metallschild", "Retro Schild"),
            carrier("Drawstring Bag", "Drawstring Bag", "Gym Bag", "Sports Bag", "Cinch Bag", "Swim Bag",
                    "Turnbeutel", "Sportbeutel", "Zugbeutel", "Schwimmbeutel"),
            carrier("Poster", "Poster", "Art Print", "Art Poster", "Canvas Print",
                    "Kunstdruck", "Posterdruck"),
            carrier("Paint by Numbers", "Paint by Numbers", "Painting by Numbers", "DIY Painting", "Number Painting",
                    "Malen nach Zahlen", "Zahlenmalerei"),
            carrier("Acrylic Stand", "Acrylic Stand", "Standee", "Desk Sign", "Table Sign",
                    "Acrylständer", "Aufsteller", "Tischschild"),
            carrier("Lunch Bag", "Lunch Bag", "Insulated Lunch Bag", "Cooler Bag",
                    "Double Layer Lunch Bag", "Insulated Lunch Tote",
                    "Lunchtasche", "Kühltasche", "Isoliertasche"),
            carrier("Canvas Wall Art", "Canvas Wall Art", "Framed Canvas", "Canvas Painting", "Oil Painting",
                    "Leinwandbild", "Wandkunst"),
            carrier("Book Sleeve", "Book Sleeve", "Book Cover", "Book Pouch", "Book Bag",
                    "Buchhülle", "Buchumschlag", "Buchtasche"),
            carrier("Garden Stake", "Garden Stake", "Acrylic Stake", "Plant Stake",
                    "Gartenstecker", "Acrylstecker", "Pflanzstecker", "Dekostecker"),
            carrier("Pillow Cover", "Pillow Case", "Pillow Cover", "Cushion Cover", "Throw Pillow Cover",
                    "Kissenbezug", "Kissenhülle", "Zierkissenbezug"),
            carrier("Tumbler", "Tumbler", "Car Cup", "Travel Mug", "20oz Tumbler", "Stainless Steel Tumbler",
                    "Reusable Cup", "Party Cup", "Acrylic Cup", "Plastic Cup",
                    "Autobecher", "Reisebecher", "Edelstahlbecher", "Plastikbecher",
                    "Kunststoffbecher", "Mehrwegbecher", "Partybecher", "Acrylbecher"),
            carrier("Keychain", "Keychain", "Keyring", "Key Chain", "Key Ring",
                    "Keychain Hanging", "Key Ring Ornament", "Key Charm",
                    "Schlüsselanhänger", "Schlüsselring"),
            // Avoid bare "Cap": it causes many false positives such as end cap / swim cap / dry caps.
            carrier("Cap", "Baseball Cap", "Snapback", "Hat",
                    "Baseballkappe", "Kappe", "Schirmmütze", "Basecap"),
            carrier("Bracelet", "Bracelet", "Wristband", "Charm Bracelet",
                    "Armband", "Charm Armband"),
            carrier("Coin Purse", "Coin Purse", "Wallet", "Purse", "Card Holder",
                    "Geldbörse", "Portemonnaie", "Münzgeldbörse", "Kartenetui"),
            carrier("Figure", "Action Figure", "Toy Figure", "Figurine", "Figure", "Collectible Figure",
                    "Figur", "Spielfigur", "Actionfigur", "Sammelfigur"),
            carrier("Backpack", "Backpack", "Rucksack", "School Bag", "Daypack",
                    "Schulrucksack", "Reiserucksack", "Laptop Rucksack"),
            carrier("Apron", "Apron", "Kitchen Apron", "BBQ Apron", "Cooking Apron",
                    "Schürze", "Kochschürze", "Grillschürze"),
            carrier("Diamond Painting", "Diamond Painting", "Diamond Art", "5D Diamond Painting",
                    "Diamantmalerei"),
            carrier("Beach Towel", "Beach Towel", "Beach Blanket", "Beach Mat",
                    "Strandtuch", "Stranddecke"),
            carrier("Pencil Case", "Pen Case", "Pencil Case", "Pencil Pouch", "Pen Bag", "Stationery Bag",
                    "Federmäppchen", "Stiftetui", "Federtasche"),
            carrier("Glasses Case", "Glasses Case", "Spectacle Case", "Sunglasses Case", "Eyewear Holder"),
            carrier("Mouse Pad", "Mouse Pad", "Mouse Mat", "Desk Mat", "Gaming Mouse Pad",
                    "Wrist Rest Mouse Pad", "Ergonomic Mouse Pad", "Gel Mouse Pad", "Mauspad"),
            carrier("Water Bottle", "Water Bottle", "Drink Bottle", "Sports Bottle",
                    "Small Mouth Bottle", "Narrow Neck Bottle",
                    "Trinkflasche", "Wasserflasche", "Sportflasche"),
            carrier("Sticker", "Sticker", "Decal"),
            carrier("Plush", "Plush", "Stuffed Toy", "Stuffed Animal", "Soft Toy"),
            carrier("Wooden Ornament", "Wooden Ornament", "Wood Decor", "Wooden Figurine", "Wood Craft", "Wooden Sign",
                    "Holzdeko", "Holzfigur", "Holzornament"),
            carrier("Clear Bag", "Clear Bag", "Transparent Pouch", "PVC Bag", "Waterproof Pouch",
                    "Klarsichttasche", "Transparente Tasche", "Durchsichtige Kulturtasche"),
            carrier("Car Vent Clip", "Car Air Freshener Vent Clip", "Car Vent Clip", "Acrylic Car Clip",
                    "Lüftungsclip", "Duftclip"),
            carrier("Storage Basket", "Storage Basket", "Woven Basket", "Storage Bin", "Organizer Basket",
                    "Aufbewahrungskorb", "Flechtkorb", "Ordnungskorb"),
            carrier("Shoulder Bag", "Shoulder Bag", "Crossbody Bag", "Tote Shoulder Bag",
                    "Umhängetasche", "Schultertasche"),
            carrier("Egg Cup", "Egg Shaped Cup", "Novelty Egg Cup", "Egg Cup", "Eierbecher"),
            carrier("Backdrop", "Backdrop", "Photo Backdrop", "Photography Background",
                    "Hintergrundtuch", "Fotohintergrund"),
            carrier("Placemat", "Placemat", "Place Mat", "Square Placemat", "Square Table Mat",
                    "Round Placemat", "Round Table Mat",
                    "Platzdeckchen", "Tischset", "Tischmatte"),
            carrier("Onesie", "Pregnancy Announcement Onesie", "Baby Announcement Bodysuit", "Onesie", "Bodysuit",
                    "Strampler", "Baby Body"),
            carrier("Handbag", "Small Handbag", "Mini Tote", "Small Purse",
                    "Handtasche", "Mini Tasche"),
            // Keep mug anchors specific. Bare "cup" causes many false positives:
            // World Cup, Cup Holder, Suction Cup, Bracket Cup Tool, etc.
            carrier("Mug", "Mug", "Coffee Mug", "Ceramic Mug", "Coffee Cup", "Tea Cup",
                    "Kaffeetasse", "Keramiktasse"),
            carrier("Coaster", "Coaster"),
            carrier("Towel", "Towel", "Hand Towel", "Face Towel", "Tea Towel",
                    "Handtuch", "Geschirrtuch", "Küchentuch", "Badetuch"),
            carrier("Jewelry Box", "Jewelry Box", "Jewellery Box", "Jewelry Case", "Trinket Box", "Ring Box",
                    "Schmuckkästchen", "Schmuckbox", "Ringbox"),
            carrier("Garden Flag", "Garden Flag", "Yard Flag", "House Flag",
                    "Gartenfahne", "Gartenflagge", "Hausfahne"),
            carrier("Napkin Holder", "Napkin Holder", "Tissue Holder", "Paper Towel Holder",
                    "Wooden Tissue Holder", "Wooden Napkin Holder",
                    "Serviettenhalter", "Taschentuchhalter", "Küchenrollenhalter"),
            carrier("Challenge Coin", "Challenge Coin", "Commemorative Coin")
    );

    @Override
    public ProductTitleParseResult parse(String title) {
        CarrierMatch carrierMatch = findCarrierMatch(title);
        if (carrierMatch == null) {
            return ProductTitleParseResult.empty();
        }
        return new ProductTitleParseResult(
                carrierMatch.canonical(),
                extractElement(title, carrierMatch.startIndex()),
                carrierMatch.matchedAnchor()
        );
    }

    @Override
    public List<String> listSupportedCarriers() {
        return CARRIER_PATTERNS.stream()
                .map(CarrierPattern::canonical)
                .distinct()
                .toList();
    }

    private String extractElement(String title, int carrierStartIndex) {
        if (title == null || title.isBlank()) {
            return null;
        }
        String normalizedTitle = normalizeForMatching(title);
        if (carrierStartIndex <= 0 || carrierStartIndex > normalizedTitle.length()) {
            return null;
        }
        String left = normalizedTitle.substring(0, carrierStartIndex).trim();
        left = stripLeadingBrand(left);
        if (left.isBlank()) {
            return null;
        }

        List<String> filtered = new ArrayList<>();
        for (String token : left.split("\\s+")) {
            if (token.isBlank()) {
                continue;
            }
            if (BRAND_BLACKLIST.contains(token)
                    || MATERIAL_BLACKLIST.contains(token)
                    || COLOR_BLACKLIST.contains(token)
                    || NOISE_WORDS.contains(token)
                    || token.length() == 1
                    || token.matches("\\d+")
                    || token.matches("\\d+[a-z]+")) {
                continue;
            }
            filtered.add(token);
        }

        if (filtered.isEmpty()) {
            return null;
        }

        int fromIndex = Math.max(0, filtered.size() - 3);
        List<String> candidate = filtered.subList(fromIndex, filtered.size());
        if (candidate.stream().allMatch(token -> token.length() <= 1 || token.matches("\\d+"))) {
            return null;
        }
        return formatPhrase(candidate);
    }

    private String stripLeadingBrand(String left) {
        String result = left;
        if (result.startsWith("zhongko ")) {
            return result.substring("zhongko ".length()).trim();
        }
        if (result.startsWith("shirylzee ")) {
            return result.substring("shirylzee ".length()).trim();
        }
        if (result.startsWith("orsefeliy ")) {
            return result.substring("orsefeliy ".length()).trim();
        }
        if (result.startsWith("dei tkeyts ")) {
            return result.substring("dei tkeyts ".length()).trim();
        }
        return result;
    }

    private CarrierMatch findCarrierMatch(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String normalized = normalizeForMatching(text);
        CarrierMatch best = null;
        for (CarrierPattern pattern : CARRIER_PATTERNS) {
            for (String variant : pattern.variants()) {
                String normalizedVariant = normalizeForMatching(variant);
                MatchPosition matchPosition = findVariantPosition(normalized, normalizedVariant);
                if (matchPosition == null) {
                    continue;
                }
                CarrierMatch current = new CarrierMatch(
                        pattern.canonical(),
                        matchPosition.startIndex(),
                        normalizedVariant.length(),
                        normalizedVariant
                );
                if (best == null
                        || current.startIndex() < best.startIndex()
                        || (current.startIndex() == best.startIndex() && current.matchedLength() > best.matchedLength())) {
                    best = current;
                }
            }
        }
        return best;
    }

    private MatchPosition findVariantPosition(String normalizedText, String normalizedVariant) {
        Pattern pattern = Pattern.compile("(^|\\s)" + Pattern.quote(normalizedVariant) + "(?:s|es|n|en)?(?=\\s|$)");
        Matcher matcher = pattern.matcher(normalizedText);
        while (matcher.find()) {
            int start = matcher.start();
            if (start < normalizedText.length() && normalizedText.charAt(start) == ' ') {
                start += 1;
            }
            if (isForCarrierContext(normalizedText, start)) {
                continue;
            }
            return new MatchPosition(start);
        }
        return null;
    }

    private boolean isForCarrierContext(String normalizedText, int matchStartIndex) {
        if (matchStartIndex <= 0) {
            return false;
        }
        String prefix = normalizedText.substring(0, matchStartIndex).trim();
        if (prefix.isEmpty()) {
            return false;
        }
        int lastSpace = prefix.lastIndexOf(' ');
        String previousToken = lastSpace >= 0 ? prefix.substring(lastSpace + 1) : prefix;
        return "for".equals(previousToken);
    }

    private String normalizeForMatching(String text) {
        return text.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{IsAlphabetic}\\p{IsDigit}]+", " ")
                .trim()
                .replaceAll("\\s+", " ");
    }

    private String formatPhrase(List<String> tokens) {
        List<String> formatted = new ArrayList<>(tokens.size());
        for (String token : tokens) {
            if (token.matches(".*\\d.*") || token.length() <= 2) {
                formatted.add(token.toUpperCase(Locale.ROOT));
            } else {
                formatted.add(Character.toUpperCase(token.charAt(0)) + token.substring(1));
            }
        }
        return String.join(" ", formatted);
    }

    private static CarrierPattern carrier(String canonical, String... variants) {
        return new CarrierPattern(canonical, Arrays.asList(variants));
    }

    private record CarrierPattern(String canonical, List<String> variants) {
    }

    private record CarrierMatch(String canonical, int startIndex, int matchedLength, String matchedAnchor) {
    }

    private record MatchPosition(int startIndex) {
    }
}
