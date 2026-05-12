import * as XLSX from 'xlsx'

/**
 * 产品数据接口
 */
export interface ProductData {
  sku: string | number
  productName: string
  length?: number
  width?: number
  height?: number
  weight?: number
  purchaseCost?: number
  supplierLink?: string
  supplier?: string
  ukCustomsCode?: string
  cnDeclarationName?: string
  enDeclarationName?: string
  imageUrl?: string
}

/**
 * 固定值配置接口
 */
export interface FixedConfig {
  developer: string
  productManager: string
  purchaser: string
  purchaseLeadTime: number
  auxiliarySku: string
  auxiliaryRatioMain: number
  auxiliaryRatioAux: number
}

/**
 * 生成领星导入Excel文件
 * @param products 产品数据列表
 * @param config 固定值配置
 * @param templateUrl 模板文件URL（可选，如果提供则基于模板生成）
 */
export const generateLingxingExcel = async (
  products: ProductData[],
  config: FixedConfig,
  templateUrl?: string
): Promise<void> => {
  // 创建工作簿
  let wb: XLSX.WorkBook
  
  if (templateUrl) {
    // 如果有模板，先加载模板
    try {
      const response = await fetch(templateUrl)
      const arrayBuffer = await response.arrayBuffer()
      wb = XLSX.read(arrayBuffer, { type: 'array' })
    } catch (error) {
      console.warn('加载模板失败，使用空白工作簿:', error)
      wb = XLSX.utils.book_new()
    }
  } else {
    // 创建新的工作簿
    wb = XLSX.utils.book_new()
  }
  
  // 1. 生成【产品】工作表
  const productData = generateProductSheet(products, config)
  const productWs = XLSX.utils.aoa_to_sheet(productData)
  
  // 设置列宽
  productWs['!cols'] = [
    { wch: 15 },  // A: SKU
    { wch: 30 },  // B: 产品名称
    { wch: 12 },  // S: 开发人
    { wch: 40 },  // T: 产品负责人
    { wch: 12 },  // W: 采购员
    { wch: 10 },  // X: 采购交期
    { wch: 12 },  // AG: 毛重(g)
    { wch: 10 },  // AI: 长(cm)
    { wch: 10 },  // AJ: 宽(cm)
    { wch: 10 },  // AK: 高(cm)
    { wch: 30 },  // BB: 供应商链接
    { wch: 12 },  // Y: 采购费用
    { wch: 20 },  // BF: 中文报关名
    { wch: 20 },  // BG: 英文报关名
    { wch: 20 },  // BP: 英国海关编码
    { wch: 50 },  // V: 图片URL
  ]
  
  // 删除旧的产品表（如果存在）
  if (wb.SheetNames.includes('产品')) {
    delete wb.Sheets['产品']
    wb.SheetNames = wb.SheetNames.filter(name => name !== '产品')
  }
  
  XLSX.utils.book_append_sheet(wb, productWs, '产品')
  
  // 2. 生成【关联辅料】工作表
  const accessoryData = generateAccessorySheet(products, config)
  const accessoryWs = XLSX.utils.aoa_to_sheet(accessoryData)
  
  accessoryWs['!cols'] = [
    { wch: 15 },  // A: SKU
    { wch: 15 },  // C: 辅料SKU
    { wch: 15 },  // E: 辅料比例(主料)
    { wch: 15 },  // F: 辅料比例(辅料)
  ]
  
  if (wb.SheetNames.includes('关联辅料')) {
    delete wb.Sheets['关联辅料']
    wb.SheetNames = wb.SheetNames.filter(name => name !== '关联辅料')
  }
  
  XLSX.utils.book_append_sheet(wb, accessoryWs, '关联辅料')
  
  // 3. 生成【更多供应商报价】工作表
  const supplierData = generateSupplierSheet(products)
  const supplierWs = XLSX.utils.aoa_to_sheet(supplierData)
  
  supplierWs['!cols'] = [
    { wch: 15 },  // A: SKU
    { wch: 30 },  // B: 产品名称
    { wch: 30 },  // C: 供应商
    { wch: 50 },  // K: 供应商链接
  ]
  
  if (wb.SheetNames.includes('更多供应商报价')) {
    delete wb.Sheets['更多供应商报价']
    wb.SheetNames = wb.SheetNames.filter(name => name !== '更多供应商报价')
  }
  
  XLSX.utils.book_append_sheet(wb, supplierWs, '更多供应商报价')
  
  // 生成文件名
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const filename = `产品汇总表-${config.developer || '领星导入'}-${timestamp}.xlsx`
  
  // 下载文件
  XLSX.writeFile(wb, filename)
}

/**
 * 生成【产品】工作表数据
 */
const generateProductSheet = (products: ProductData[], config: FixedConfig): any[][] => {
  const data: any[][] = []
  
  // 表头（根据领星导入模板的实际列位置）
  // 注意：这里使用稀疏数组，只填充有数据的列
  const headers: Record<string, string> = {
    A: 'SKU',
    B: '产品名称',
    S: '开发人',
    T: '产品负责人',
    W: '采购员',
    X: '采购交期',
    AG: '毛重(g)',
    AI: '长(cm)',
    AJ: '宽(cm)',
    AK: '高(cm)',
    BB: '供应商链接',
    Y: '采购费用',
    BF: '中文报关名',
    BG: '英文报关名',
    BP: '英国海关编码',
    V: '图片URL',
  }
  
  // 添加表头行
  const headerRow: any[] = []
  Object.keys(headers).sort().forEach(col => {
    const colIndex = col.charCodeAt(0) - 65 // A=0, B=1, ...
    headerRow[colIndex] = headers[col]
  })
  data.push(headerRow)
  
  // 添加数据行
  products.forEach(product => {
    const row: any[] = []
    
    // A: SKU
    row[0] = product.sku
    // B: 产品名称
    row[1] = product.productName
    // S: 开发人 (第18列)
    row[18] = config.developer
    // T: 产品负责人 (第19列)
    row[19] = config.productManager
    // W: 采购员 (第22列)
    row[22] = config.purchaser
    // X: 采购交期 (第23列)
    row[23] = config.purchaseLeadTime
    // AG: 毛重(g) (第32列) - kg转g
    row[32] = product.weight ? product.weight * 1000 : ''
    // AI: 长(cm) (第34列)
    row[34] = product.length || ''
    // AJ: 宽(cm) (第35列)
    row[35] = product.width || ''
    // AK: 高(cm) (第36列)
    row[36] = product.height || ''
    // BB: 供应商链接 (第53列)
    row[53] = product.supplierLink || ''
    // Y: 采购费用 (第24列)
    row[24] = product.purchaseCost || ''
    // BF: 中文报关名 (第57列)
    row[57] = product.cnDeclarationName || ''
    // BG: 英文报关名 (第58列)
    row[58] = product.enDeclarationName || ''
    // BP: 英国海关编码 (第65列)
    row[65] = product.ukCustomsCode || ''
    // V: 图片URL (第21列)
    row[21] = product.imageUrl || ''
    
    data.push(row)
  })
  
  return data
}

/**
 * 生成【关联辅料】工作表数据
 */
const generateAccessorySheet = (products: ProductData[], config: FixedConfig): any[][] => {
  const data: any[][] = [
    ['SKU', '', '辅料SKU', '', '辅料比例(主料)', '辅料比例(辅料)']
  ]
  
  products.forEach(product => {
    data.push([
      product.sku,
      '',
      config.auxiliarySku,
      '',
      config.auxiliaryRatioMain,
      config.auxiliaryRatioAux
    ])
  })
  
  return data
}

/**
 * 生成【更多供应商报价】工作表数据
 */
const generateSupplierSheet = (products: ProductData[]): any[][] => {
  const data: any[][] = [
    ['SKU', '产品名称', '供应商', '', '', '', '', '', '', '', '供应商链接']
  ]
  
  products.forEach(product => {
    data.push([
      product.sku,
      product.productName,
      product.supplier || '',
      '', '', '', '', '', '', '',
      product.supplierLink || ''
    ])
  })
  
  return data
}

export default {
  generateLingxingExcel
}
