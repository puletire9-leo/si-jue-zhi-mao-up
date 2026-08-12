  return '-';
};

const getStatusType = (row: any) => {
  if (row.goodNum > 0) return 'success';
  if (row.goodTransitNum > 0) return 'warning';
  return 'info';
};

// 按SKU分组
const groupBySku = (list: InventoryBatchDetail[]) => {
  const map = new Map<string, any>();

  list.forEach(item => {
    if (!map.has(item.sku)) {
      map.set(item.sku, {
        sku: item.sku,
        productName: '', // TODO: 从listing关联
        imageUrl: '', // TODO: 从listing关联
        isBatch: false,
        hasBatches: true,
        batches: []
      });
    }

    map.get(item.sku)!.batches.push({
      ...item,
      isBatch: true
    });
  });

  // 按批次入库时间倒序（最新在上）
  map.forEach(group => {
    group.batches.sort((a: any, b: any) => {
      return (b.purchaseInTime || '').localeCompare(a.purchaseInTime || '');
    });
  });

  return Array.from(map.values());
};

// 查询数据
const handleQuery = async () => {
  loading.value = true;
  try {
    const res = await listInventoryBatch(queryParams);
    if (res.code === 0) {
      dataList.value = res.data.records || [];
      total.value = res.data.total || 0;
      groupedData.value = groupBySku(dataList.value);

      // 提取开发人/运营下拉选项
      const devSet = new Set<string>();
      const opSet = new Set<string>();
      dataList.value.forEach(item => {
        if (item.developer) devSet.add(item.developer);
        if (item.operator) opSet.add(item.operator);
      });
      developers.value = Array.from(devSet);
      operators.value = Array.from(opSet);
    }
  } catch (error) {
    console.error('查询失败', error);
    ElMessage.error('查询失败');
  } finally {
    loading.value = false;
  }
};

// 手动同步
const handleSync = async () => {
  try {
    await ElMessageBox.confirm('确认手动同步批次数据？（默认同步昨天）', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    loading.value = true;
    const res = await syncInventoryBatch({});
    loading.value = false;

    if (res.code === 0) {
      ElMessage.success(`同步完成：拉取 ${res.data.fetched} 行，写入 ${res.data.upserted} 行`);
      handleQuery();
    } else {
      ElMessage.error(res.message || '同步失败');
    }
  } catch (error: any) {
    loading.value = false;
    if (error !== 'cancel') {
      ElMessage.error('同步失败');
    }
  }
};

// 导出Excel
const handleExport = () => {
  ElMessage.info('导出功能开发中...');
};

onMounted(() => {
  // 默认查询昨天的数据
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  queryParams.dataDate = yesterday.toISOString().split('T')[0];
  handleQuery();
});
</script>

<style scoped lang="scss">
.inventory-arrival-dashboard {
  padding: 16px;

  .filter-card {
    margin-bottom: 16px;
  }

  .table-card {
    :deep(.el-table__row--level-1) {
      background-color: #f5f7fa;
    }
  }
}
</style>
