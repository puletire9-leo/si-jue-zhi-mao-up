function normalizeText(value: any) {
  return String(value ?? '').trim();
}

export function buildAutoCompleteSnapshotDisplayState(snapshot: any) {
  if (normalizeText(snapshot?.snapshot_source) !== 'purchase_plan_remark_auto_complete') {
    return {
      auto_complete_status: '',
      auto_complete_status_label: '',
      auto_complete_warnings: [] as string[],
      warehouse_confirmation_required: false,
      blocks_shipping: false,
      source_label_suffix: '',
    };
  }
  const reconstruction =
    snapshot?.input_json?.reconstruction ||
    snapshot?.full_snapshot_json?.reconstruction ||
    snapshot?.remark_json?.auto_replenish_remark ||
    {};
  const status = normalizeText(reconstruction.auto_complete_status) || 'completed';
  const warnings = [
    ...(Array.isArray(reconstruction.warnings) ? reconstruction.warnings : []),
    ...(Array.isArray(reconstruction.current_validation_errors)
      ? reconstruction.current_validation_errors
      : []),
  ]
    .map(item => normalizeText(item))
    .filter(Boolean);
  const warehouseConfirmationRequired = Boolean(
    reconstruction.warehouse_confirmation_required ||
    reconstruction.warehouse_match?.confirmation_required
  );
  const statusLabel = status === 'needs_attention'
    ? '需处理'
    : warnings.length
      ? '有警告'
      : '已完成';
  const suffixParts = [statusLabel];
  if (warehouseConfirmationRequired) suffixParts.push('仓库未匹配');
  return {
    auto_complete_status: status,
    auto_complete_status_label: statusLabel,
    auto_complete_warnings: [...new Set(warnings)],
    warehouse_confirmation_required: warehouseConfirmationRequired,
    blocks_shipping: status === 'needs_attention',
    source_label_suffix: suffixParts.join(' · '),
  };
}
