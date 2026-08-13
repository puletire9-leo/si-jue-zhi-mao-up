export const PURCHASER_COUNTRY_OPTIONS = [
	{ code: "uk", label: "英国" },
	{ code: "de", label: "德国" }
] as const;

export type PurchaserCountryCode = (typeof PURCHASER_COUNTRY_OPTIONS)[number]["code"];

const COUNTRY_SCOPE_ALIASES: Record<PurchaserCountryCode, string[]> = {
	uk: ["uk", "gb", "英国", "英國", "united kingdom", "great britain"],
	de: ["de", "德国", "德國", "germany"]
};

function normalizeScopeToken(value: unknown) {
	return String(value ?? "")
		.trim()
		.toLowerCase();
}

export function parseCountryScope(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((item) => String(item ?? "").trim()).filter(Boolean);
	}

	if (typeof value === "string") {
		const text = value.trim();
		if (!text) return [];

		try {
			const parsed = JSON.parse(text);
			if (Array.isArray(parsed)) {
				return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
			}
		} catch {
			return text
				.split(/[,，;；、]/)
				.map((item) => item.trim())
				.filter(Boolean);
		}
	}

	return [];
}

export function getAllowedCountryCodes(
	user: { operation_country_scope?: unknown } | undefined | null,
	supportedCodes: readonly string[] = PURCHASER_COUNTRY_OPTIONS.map((country) => country.code)
) {
	const scope = parseCountryScope(user?.operation_country_scope);
	if (scope.length === 0) return [...supportedCodes];

	const normalizedScope = new Set(scope.map(normalizeScopeToken));

	return supportedCodes.filter((code) => {
		const aliases = COUNTRY_SCOPE_ALIASES[code as PurchaserCountryCode] || [code];
		return aliases.some((alias) => normalizedScope.has(normalizeScopeToken(alias)));
	});
}

export function isCountryAllowedForUser(
	user: { operation_country_scope?: unknown } | undefined | null,
	countryCode: string
) {
	return getAllowedCountryCodes(user).includes(countryCode);
}

export function shuffleIndexes<T>(items: readonly T[], random: () => number = Math.random): T[] {
	const result = [...items];

	for (let index = result.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(random() * (index + 1));
		[result[index], result[swapIndex]] = [result[swapIndex], result[index]];
	}

	return result;
}

export function pickRandomIndexes(
	indexes: readonly number[],
	count: number,
	random: () => number = Math.random
) {
	const safeCount = Math.min(Math.max(Number(count) || 0, 0), indexes.length);
	return shuffleIndexes(indexes, random).slice(0, safeCount);
}

export function selectPurchasersByCountry({
	userIndexes,
	countryCodes,
	allowedCountryCodesByUserIndex,
	count,
	random = Math.random
}: {
	userIndexes: readonly number[];
	countryCodes: readonly string[];
	allowedCountryCodesByUserIndex: readonly (readonly string[])[];
	count: number;
	random?: () => number;
}) {
	const countryIndexes = countryCodes.reduce<Record<string, number[]>>((result, countryCode) => {
		const eligibleIndexes = userIndexes.filter((index) =>
			allowedCountryCodesByUserIndex[index]?.includes(countryCode)
		);
		result[countryCode] = pickRandomIndexes(eligibleIndexes, count, random);
		return result;
	}, {});
	const selectedIndexes = Array.from(
		new Set(Object.values(countryIndexes).flat())
	).sort((a, b) => a - b);

	return {
		countryIndexes,
		selectedIndexes
	};
}
