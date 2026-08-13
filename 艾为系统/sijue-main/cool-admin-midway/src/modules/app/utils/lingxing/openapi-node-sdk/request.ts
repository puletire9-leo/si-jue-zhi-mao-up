import axios from 'axios';

export function baseRequest(url, method, params, headers) {
  const [_params, _data] = method.toUpperCase() === 'GET' ? [params, ''] : ['', params]
  // console.log('url=', url, params)
  return new Promise((resolve, reject) => {
    axios({
      url: url,
      method: method,
      params: _params,
      data: _data,
      headers: headers || {}
    }).then(res => {
      const data = res.data
      // if (Array.isArray(data?.data) && data?.data.length > 10) {
      //   console.log('请求返回的相应数据结果集太长，暂不输出到控制台。');
      // } else {
      //   console.log('result=', data);
      // }
      resolve(data);
    }).catch(err => {
      // console.error('接口异常，' + err)
      reject(err)
    })
  })
}

export function post(url, params, headers) {
  return baseRequest(url, 'POST', params, headers)
}

export function get(url, params) {
  return baseRequest(url, 'GET', params, {})
}
