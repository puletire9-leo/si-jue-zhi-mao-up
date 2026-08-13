export function collectPurchaseOrderPlanSnMap(items: Array<{ order_sn?: any; plan_sn?: any }> = []) {
  const result = new Map<string, Set<string>>();
  for (const item of items || []) {
    const orderSn = String(item?.order_sn ?? '').trim();
    const planSn = String(item?.plan_sn ?? '').trim();
    if (!orderSn || !planSn) continue;
    if (!result.has(orderSn)) {
      result.set(orderSn, new Set<string>());
    }
    result.get(orderSn)!.add(planSn);
  }
  return result;
}
