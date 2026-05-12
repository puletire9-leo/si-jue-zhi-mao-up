import * as XLSX from 'xlsx'

/**
 * 图片信息接口
 */
export interface ExcelImageInfo {
  sheetName: string
  row: number
  col: number
  imageData: Uint8Array
  filename: string
  mimeType: string
  sku?: string
  visualOrder?: number // 视觉顺序号
}

/**
 * 从Excel文件中提取嵌入的图片
 * 按视觉顺序（drawing.xml中锚点的出现顺序）提取
 * @param arrayBuffer Excel文件的ArrayBuffer
 * @param skuColumnIndex SKU列的索引（默认为4，即E列）
 * @returns 图片数据数组
 */
export const extractImagesFromExcel = async (
  arrayBuffer: ArrayBuffer,
  skuColumnIndex: number = 4
): Promise<ExcelImageInfo[]> => {
  const images: ExcelImageInfo[] = []

  try {
    // 读取Excel工作簿
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    // 使用JSZip来解压xlsx文件
    const JSZip = await import('jszip')
    const zip = await JSZip.default.loadAsync(arrayBuffer)

    // 读取工作表获取数据
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

    // 查找所有媒体文件（图片）
    const mediaFiles: string[] = []
    zip.forEach((relativePath, file) => {
      if (relativePath.startsWith('xl/media/') && !file.dir) {
        mediaFiles.push(relativePath)
      }
    })

    if (mediaFiles.length === 0) {
      console.log('[图片提取] Excel文件中没有找到嵌入的图片')
      return images
    }

    console.log(`[图片提取] 找到 ${mediaFiles.length} 个媒体文件`)

    // 过滤出图片文件
    const imageFiles = mediaFiles.filter(path => {
      const ext = path.split('.').pop()?.toLowerCase()
      return ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext || '')
    })

    console.log(`[图片提取] 其中 ${imageFiles.length} 个是图片文件`)

    // 建立文件名到路径的映射
    const filePathMap = new Map<string, string>()
    mediaFiles.forEach(path => {
      const filename = path.split('/').pop() || ''
      filePathMap.set(filename, path)
    })

    // 从drawing.xml读取图片位置信息（按视觉顺序）
    const visualOrderList: Array<{
      embedId: string
      row: number
      col: number
      visualOrder: number
    }> = []

    try {
      // 查找drawing文件
      const drawingFiles: string[] = []
      zip.forEach((relativePath, file) => {
        if (relativePath.startsWith('xl/drawings/') && relativePath.endsWith('.xml')) {
          drawingFiles.push(relativePath)
        }
      })

      console.log('[图片提取] 找到drawing文件:', drawingFiles)

      // 解析drawing文件获取图片位置
      for (const drawingPath of drawingFiles) {
        const drawingFile = zip.file(drawingPath)
        if (!drawingFile) continue

        const drawingXml = await drawingFile.async('text')

        // 解析xdr:twoCellAnchor元素获取图片位置
        const anchorRegex = /<xdr:twoCellAnchor[^>]*>[\s\S]*?<\/xdr:twoCellAnchor>/g
        const anchors = drawingXml.match(anchorRegex) || []

        console.log(`[图片提取] 找到 ${anchors.length} 个图片锚点`)

        // 按锚点出现的原始顺序处理（这就是视觉顺序）
        for (let i = 0; i < anchors.length; i++) {
          const anchor = anchors[i]

          // 提取行号（从0开始）
          const rowMatch = anchor.match(/<xdr:from>\s*<xdr:row>(\d+)<\/xdr:row>/)
          const colMatch = anchor.match(/<xdr:from>\s*<xdr:col>(\d+)<\/xdr:col>/)
          const blipMatch = anchor.match(/<a:blip[^>]*r:embed="([^"]*)"/)

          if (rowMatch && colMatch && blipMatch) {
            const row = parseInt(rowMatch[1])
            const col = parseInt(colMatch[1])
            const embedId = blipMatch[1]

            // 只处理图片列（C列，索引为2）
            if (col === 2) {
              visualOrderList.push({
                embedId,
                row,
                col,
                visualOrder: visualOrderList.length + 1 // 视觉顺序号（从1开始）
              })
            }
          }
        }
      }

      console.log(`[图片提取] 从drawing.xml解析到 ${visualOrderList.length} 个图片位置（按视觉顺序）`)
    } catch (error) {
      console.error('[图片提取] 解析drawing.xml失败:', error)
    }

    // 解析_rels文件获取图片文件名映射
    const relMap = new Map<string, string>()
    try {
      const relsPath = 'xl/drawings/_rels/drawing1.xml.rels'
      const relsFile = zip.file(relsPath)
      if (relsFile) {
        const relsXml = await relsFile.async('text')

        // 提取所有关系映射
        const relRegex = /<Relationship[^>]*Id="([^"]*)"[^>]*Target="([^"]*)"/g
        let match
        while ((match = relRegex.exec(relsXml)) !== null) {
          const id = match[1]
          const target = match[2]
          const filename = target.split('/').pop() || ''
          relMap.set(id, filename)
        }
      }
    } catch (error) {
      console.error('[图片提取] 解析rels文件失败:', error)
    }

    // 按视觉顺序提取图片
    // 关键：不按drawing.xml中的行号，而是按视觉顺序直接对应数据行
    // 第1个视觉图片 -> 第1行数据
    // 第2个视觉图片 -> 第2行数据
    // 以此类推...
    
    for (let i = 0; i < visualOrderList.length; i++) {
      const item = visualOrderList[i]
      const filename = relMap.get(item.embedId)
      
      if (!filename) {
        console.warn(`[图片提取] 视觉顺序${item.visualOrder} 无文件名，跳过`)
        continue
      }

      const mediaPath = filePathMap.get(filename)
      if (!mediaPath) {
        console.warn(`[图片提取] 找不到文件: ${filename}`)
        continue
      }

      const file = zip.file(mediaPath)
      if (!file) continue

      // 读取图片数据
      const imageData = await file.async('uint8array')

      // 判断MIME类型
      const ext = filename.split('.').pop()?.toLowerCase()
      let mimeType = 'image/png'
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
      else if (ext === 'gif') mimeType = 'image/gif'
      else if (ext === 'bmp') mimeType = 'image/bmp'
      else if (ext === 'webp') mimeType = 'image/webp'

      // 关键修改：SKU根据视觉顺序对应，而不是drawing.xml中的行号
      // 第i个视觉图片对应第i+1行Excel数据（第0行是表头）
      const dataRow = i + 1
      const sku = jsonData[dataRow] && jsonData[dataRow][skuColumnIndex]
        ? String(jsonData[dataRow][skuColumnIndex]).trim()
        : undefined

      images.push({
        sheetName: firstSheetName,
        row: dataRow, // 使用数据行号，而不是drawing.xml中的行号
        col: item.col,
        imageData,
        filename,
        mimeType,
        sku,
        visualOrder: item.visualOrder
      })

      console.log(`[提取图片] 视觉顺序${item.visualOrder}: 数据行${dataRow}(Excel第${dataRow + 1}行), SKU=${sku || '无'}, 文件名=${filename}`)
    }

    // 如果drawing.xml解析失败，使用备用方案
    if (images.length === 0 && imageFiles.length > 0) {
      console.log('[WARN] drawing.xml解析失败，使用备用方案（按文件名数字排序）')

      // 按文件名中的数字排序
      imageFiles.sort((a, b) => {
        const numA = parseInt(a.match(/image(\d+)/)?.[1] || '0')
        const numB = parseInt(b.match(/image(\d+)/)?.[1] || '0')
        return numA - numB
      })

      for (let i = 0; i < imageFiles.length; i++) {
        const mediaPath = imageFiles[i]
        const file = zip.file(mediaPath)
        if (!file) continue

        const dataRow = i + 1
        if (!jsonData[dataRow]) continue

        const filename = mediaPath.split('/').pop() || 'image.png'
        const imageData = await file.async('uint8array')

        const ext = filename.split('.').pop()?.toLowerCase()
        let mimeType = 'image/png'
        if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
        else if (ext === 'gif') mimeType = 'image/gif'
        else if (ext === 'bmp') mimeType = 'image/bmp'
        else if (ext === 'webp') mimeType = 'image/webp'

        const sku = jsonData[dataRow][skuColumnIndex]
          ? String(jsonData[dataRow][skuColumnIndex]).trim()
          : undefined

        images.push({
          sheetName: firstSheetName,
          row: dataRow,
          col: 2,
          imageData,
          filename,
          mimeType,
          sku,
          visualOrder: i + 1
        })

        console.log(`[备用方案] 第${i + 1}张 -> 数据行${dataRow}, SKU=${sku || '无'}`)
      }
    }

    console.log(`[图片提取] 完成，共提取 ${images.length} 张图片（按视觉顺序）`)
    return images
  } catch (error) {
    console.error('[图片提取] 失败:', error)
    return images
  }
}

/**
 * 将Uint8Array转换为File对象
 */
export const uint8ArrayToFile = (
  imageData: Uint8Array,
  filename: string,
  mimeType: string
): File => {
  const blob = new Blob([imageData], { type: mimeType })
  return new File([blob], filename, { type: mimeType })
}
