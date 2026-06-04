    }

    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // 记录请求开始时间，用于计算请求耗时
    config._startTime = Date.now()
    
    // 根据端点设置特定的超时时间
    const url = config.url || ''
    for (const endpoint in endpointConfigs) {
      if (url.includes(endpoint)) {
        config.timeout = endpointConfigs[endpoint].timeout
        break
      }
    }

    // 只对GET请求进行重复请求去重，避免误中止POST/PUT等重要请求
    // 对于blob类型的请求（大文件下载），不进行去重，避免下载中断
    if (config.responseType !== 'blob' && config.method?.toLowerCase() === 'get') {
      removePendingRequest(config)
      addPendingRequest(config)
    }

    return config
  },
  (error: any) => {
    return Promise.reject(error)

<system-reminder>
The task tools haven't been used recently. If you're working on tasks that would benefit from tracking progress, consider using TaskCreate to add new tasks and TaskUpdate to update task status (set to in_progress when starting, completed when done). Also consider cleaning up the task list if it has become stale. Only use these if relevant to the current work. This is just a gentle reminder - ignore if not applicable.

</system-reminder>