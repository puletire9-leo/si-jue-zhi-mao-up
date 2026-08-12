    url: '/api/v1/modules/lingxing/inventory-batch/sync',
    method: 'post',
    data
  });
}

// 获取可用日期列表
export function getAvailableDates() {
  return request({
    url: '/api/v1/modules/lingxing/inventory-batch/dates',
    method: 'get'
  });
}
