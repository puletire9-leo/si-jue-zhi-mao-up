const CryptoJS = require("crypto-js");
const md5 = require('md5');
const Qs = require('qs');

function encrypt(content, appKey) {
  const _key = CryptoJS.enc.Utf8.parse(appKey)
  const encryptedECB = CryptoJS.AES.encrypt(content.trim(), _key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  })
  return encryptedECB.toString() 
}

export function generateSign(params, appKey) {
  // 调试输出
  // console.log('Raw params:', JSON.stringify(params, null, 2));
  
  const paramsArr = Object.keys(params)
    .filter(key => params[key] !== '' && params[key] != null)
    .sort();

  const stringArr = paramsArr.map(key => {
    const value = isPlainObject(params[key]) ? JSON.stringify(params[key]) : String(params[key])
    return `${key}=${value}`
  });
  
  const paramsUrl = stringArr.join('&');
  // 调试：打印签名原文
  console.log('[sign] raw:', paramsUrl);


  const upperUrl = md5(paramsUrl).toString().toUpperCase()
  const encryptedString = encrypt(upperUrl, appKey)
  return encryptedString
}


export function restQueryUrl(url, params) {
  const paramsUrl = Qs.stringify(params)
  return `${url}${paramsUrl ? '?' : ''}${paramsUrl}`
}

function isPlainObject(val) {
  return Object.prototype.toString.call(val) === '[object Object]' || Array.isArray(val)
}
