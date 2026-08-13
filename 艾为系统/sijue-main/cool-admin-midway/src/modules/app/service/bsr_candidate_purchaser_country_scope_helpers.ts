const PURCHASER_COUNTRY_CODES = ['uk', 'de'] as const;

type PurchaserCountryCode = (typeof PURCHASER_COUNTRY_CODES)[number];

const COUNTRY_SCOPE_ALIASES: Record<PurchaserCountryCode, string[]> = {
  uk: ['uk', 'gb', '英国', '英國', 'united kingdom', 'great britain'],
  de: ['de', '德国', '德國', 'germany'],
};

function normalizeScopeToken(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export function parseCountryScope(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item ?? '').trim()).filter(Boolean);
      }
    } catch {
      return text
        .split(/[,，;；、]/)
        .map(item => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function parseCountryEnabled(value: unknown): Record<string, boolean> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, boolean>;
  }

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return {};

    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, boolean>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

export function getAllowedCountryCodesFromScope(
  scopeValue: unknown,
  supportedCodes: readonly string[] = PURCHASER_COUNTRY_CODES
) {
  const scope = parseCountryScope(scopeValue);
  if (scope.length === 0) return [...supportedCodes];

  const normalizedScope = new Set(scope.map(normalizeScopeToken));

  return supportedCodes.filter(code => {
    const aliases = COUNTRY_SCOPE_ALIASES[code as PurchaserCountryCode] || [code];
    return aliases.some(alias => normalizedScope.has(normalizeScopeToken(alias)));
  });
}

export function normalizeCountryEnabledForScope(
  countryEnabled: unknown,
  scopeValue: unknown,
  supportedCodes: readonly string[] = PURCHASER_COUNTRY_CODES
) {
  const requested = parseCountryEnabled(countryEnabled);
  const allowed = new Set(getAllowedCountryCodesFromScope(scopeValue, supportedCodes));

  return supportedCodes.reduce<Record<string, boolean>>((result, code) => {
    result[code] = Boolean(requested?.[code]) && allowed.has(code);
    return result;
  }, {});
}

export function normalizePurchasersCountryEnabled<
  T extends {
    userId?: unknown;
    purchaser?: unknown;
    country_enabled?: unknown;
  },
>(
  purchasers: T[],
  users: Array<{
    id?: unknown;
    name?: unknown;
    username?: unknown;
    nickName?: unknown;
    operation_country_scope?: unknown;
  }>
): T[] {
  const usersById = new Map<number, (typeof users)[number]>();
  const usersByName = new Map<string, (typeof users)[number]>();

  users.forEach(user => {
    const id = Number(user.id);
    if (Number.isFinite(id) && id > 0) {
      usersById.set(id, user);
    }

    [user.name, user.username, user.nickName]
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .forEach(value => usersByName.set(value, user));
  });

  return purchasers.map(purchaser => {
    const userId = Number(String(purchaser.userId || '').trim());
    const matchedUser =
      (Number.isFinite(userId) && userId > 0 ? usersById.get(userId) : undefined) ||
      usersByName.get(String(purchaser.purchaser || '').trim());

    const normalizedCountryEnabled = normalizeCountryEnabledForScope(
      purchaser.country_enabled,
      matchedUser?.operation_country_scope
    );

    return {
      ...purchaser,
      country_enabled: JSON.stringify(normalizedCountryEnabled),
    };
  });
}
