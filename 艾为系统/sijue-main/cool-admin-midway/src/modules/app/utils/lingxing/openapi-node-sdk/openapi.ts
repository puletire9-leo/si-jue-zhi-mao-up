import {baseRequest, post} from './request';
import {generateSign, restQueryUrl} from './utils'

export async function httpRequest(routeName,
                                  method,
                                  appId,
                                  accessToken,
                                  params,
                                  base_host = 'https://openapi.lingxing.com',
                                  return_raw_response: boolean = false) {

  const baseParam = {
    'access_token': accessToken,
    'app_key': appId,
    timestamp: Math.round(new Date().getTime() / 1000)
  };
  const signParams = Object.assign({}, baseParam, params)
  const sign = generateSign(signParams, appId)
  // @ts-ignore
  baseParam.sign = encodeURIComponent(sign);
  let url = base_host + routeName
  let headers = {}
  let queryParam = params
  if (method.toUpperCase() !== 'GET') {
    headers = { "Content-Type": "application/json" };
    url = restQueryUrl(url, baseParam); 
    // 请求体传原始 params 对象
    queryParam = params; 
  } else {
    queryParam = Object.assign({}, params, baseParam)
  }

  let response = await baseRequest(url, method, queryParam, headers);
  if (return_raw_response) {
    return response;
  } else {
    // @ts-ignore
    const {data, code} = response;
    return data;
  }
}

export async function generateAccessToken(appId, appSecret, base_host = 'https://openapi.lingxing.com') {
  const path = '/api/auth-server/oauth/access-token';
  const params = {
    appId,
    appSecret
  };
  const postUrl = restQueryUrl(base_host + path, params)
  // @ts-ignore
  const {data, code} = await post(postUrl);
  if (Number(code) !== 200) {
    console.log(data.throwable)
    return
  }
  return data
}

export async function refreshToken(appId, refreshToken, base_host = 'https://openapi.lingxing.com') {

  const path = '/api/auth-server/oauth/refresh';
  const params = {
    appId,
    refreshToken
  };
  const postUrl = restQueryUrl(base_host + path, params)
  // @ts-ignore
  const {data, code} = await post(postUrl);
  if (Number(code) !== 200) {
    console.log(data.throwable)
    return
  }
  return data
}
