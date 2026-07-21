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
 * 列索引转 Excel 列字母（0->A, 2->C, 26->AA, 52->BA）
 */
const colIndexToLetter = (index: number): string => {
  let n = index
  let letter = ''
  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return letter
}

/**
 * 解析首个工作表的 XML 文件路径（通过 workbook.xml + rels）。
 * 失败则回退 xl/worksheets/sheet1.xml。
 */
const resolveFirstSheetPath = async (zip: any): Promise<string> => {
  const fallback = 'xl/worksheets/sheet1.xml'
  try {
    const wbFile = zip.file('xl/workbook.xml')
    const relsFile = zip.file('xl/_rels/workbook.xml.rels')
    if (!wbFile || !relsFile) return fallback
    const wbXml = await wbFile.async('text')
    const relsXml = await relsFile.async('text')
    const rid = wbXml.match(/<sheet[^>]*r:id="(rId\d+)"/)?.[1]
    if (!rid) return fallback
    const target = relsXml.match(
      new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`)
    )?.[1]
    if (!target) return fallback
    // Target 可能是 worksheets/sheet1.xml（相对 xl/）
    return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\/?xl\//, '')}`
  } catch {
    return fallback
  }
}

/**
 * 提取 WPS 单元格嵌入图片（DISPIMG）。
 * 只取指定图片列的图，按行号升序对齐 SKU 行。
 */
const extractWpsCellImages = async (
  zip: any,
  cellImagesFile: any,
  jsonData: any[][],
  sheetName: string,
  skuColumnIndex: number,
  imageColumnIndex: number
): Promise<ExcelImageInfo[]> => {
  const result: ExcelImageInfo[] = []

  // 1) cellimages.xml: name(ID) -> rId（按 cellImage 元素顺序）
  const ciXml = await cellImagesFile.async('text')
  const idToRid = new Map<string, string>()
  const ciRegex = /name="(ID_[0-9A-Fa-f]+)"[\s\S]*?r:embed="(rId\d+)"/g
  let ciMatch: RegExpExecArray | null
  while ((ciMatch = ciRegex.exec(ciXml)) !== null) {
    idToRid.set(ciMatch[1], ciMatch[2])
  }

  // 2) cellimages.xml.rels: rId -> media 路径
  const ridToMedia = new Map<string, string>()
  const relsFile = zip.file('xl/_rels/cellimages.xml.rels')
  if (relsFile) {
    const relsXml = await relsFile.async('text')
    const relRegex = /Id="(rId\d+)"[^>]*Target="([^"]+)"/g
    let relMatch: RegExpExecArray | null
    while ((relMatch = relRegex.exec(relsXml)) !== null) {
      const target = relMatch[2].split('/').pop() || ''
      ridToMedia.set(relMatch[1], target)
    }
  }

  // 3) 工作表里找图片列 DISPIMG 单元格 -> (行号, ID)
  const sheetPath = await resolveFirstSheetPath(zip)
  const sheetFile = zip.file(sheetPath)
  if (!sheetFile) {
    console.warn(`[WPS图片] 找不到工作表 ${sheetPath}`)
    return result
  }
  const sheetXml = await sheetFile.async('text')

  const colLetter = colIndexToLetter(imageColumnIndex) // 2 -> "C"
  // 精确匹配图片列单元格：<c r="C2" ...>...DISPIMG("ID_xxx",1)...</c>
  // 用 \b 前锚定避免 AC2/BC2 误匹配
  const cellRegex = new RegExp(
    `<c r="${colLetter}(\\d+)"[^>]*>((?:(?!</c>)[\\s\\S])*?)</c>`,
    'g'
  )
  const picked: Array<{ excelRow: number; id: string }> = []
  let cellMatch: RegExpExecArray | null
  while ((cellMatch = cellRegex.exec(sheetXml)) !== null) {
    const excelRow = parseInt(cellMatch[1])
    const idMatch = cellMatch[2].match(/DISPIMG\(&quot;(ID_[0-9A-Fa-f]+)&quot;/)
    if (idMatch) {
      picked.push({ excelRow, id: idMatch[1] })
    }
  }

  // 4) 按行号升序（严格对齐 SKU 行），逐个解析媒体 + 同行 SKU
  picked.sort((a, b) => a.excelRow - b.excelRow)

  for (let i = 0; i < picked.length; i++) {
    const { excelRow, id } = picked[i]
    const rid = idToRid.get(id)
    const mediaName = rid ? ridToMedia.get(rid) : undefined
    if (!mediaName) {
      console.warn(`[WPS图片] ${colLetter}${excelRow} ID=${id} 无法解析媒体，跳过`)
      continue
    }
    const mediaFile = zip.file(`xl/media/${mediaName}`)
    if (!mediaFile) {
      console.warn(`[WPS图片] 找不到媒体文件 xl/media/${mediaName}`)
      continue
    }
    const imageData = await mediaFile.async('uint8array')

    const ext = mediaName.split('.').pop()?.toLowerCase()
    let mimeType = 'image/png'
    if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
    else if (ext === 'gif') mimeType = 'image/gif'
    else if (ext === 'bmp') mimeType = 'image/bmp'
    else if (ext === 'webp') mimeType = 'image/webp'

    // Excel 行号(1基,含表头) -> jsonData 索引(0基,jsonData[0]=表头)
    const dataRow = excelRow - 1
    const sku =
      jsonData[dataRow] && jsonData[dataRow][skuColumnIndex] != null
        ? String(jsonData[dataRow][skuColumnIndex]).trim()
        : undefined

    result.push({
      sheetName,
      row: dataRow,
      col: imageColumnIndex,
      imageData,
      filename: mediaName,
      mimeType,
      sku,
      visualOrder: i + 1
    })

    console.log(
      `[WPS图片] 视觉顺序${i + 1}: ${colLetter}${excelRow} -> 数据行${dataRow}, SKU=${sku || '无'}, 媒体=${mediaName}`
    )
  }

  return result
}

/**
 * 从Excel文件中提取嵌入的图片
 * 按视觉顺序（drawing.xml中锚点的出现顺序）提取
 * @param arrayBuffer Excel文件的ArrayBuffer
 * @param skuColumnIndex SKU列的索引（默认为4，即E列）
 * @param imageColumnIndex 图片列的索引（默认为2，即C列）
 * @returns 图片数据数组
 */
export const extractImagesFromExcel = async (
  arrayBuffer: ArrayBuffer,
  skuColumnIndex: number = 4,
  imageColumnIndex: number = 2
): Promise<ExcelImageInfo[]> => {
  const images: ExcelImageInfo[] = []

  // 图片列索引（模板中"图片"在 C 列 = 索引 2）
  const IMAGE_COL_INDEX = imageColumnIndex
  // 锚点真实行号是否可信（贴进单元格的图片可信；浮动图全锚 row0 则不可信）
  let rowsReliable = false

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

    // ============ 优先：WPS 单元格嵌入图片 (DISPIMG) ============
    // WPS 把图片嵌进单元格,靠 =DISPIMG("ID_xxx",1) 公式定位,
    // drawing.xml 锚点全部堆在 A1 无位置信息。此时必须只取"图片"列(C列)的图,
    // 忽略 cpc段/采购数量 等其它列里的图。
    const cellImagesFile = zip.file('xl/cellimages.xml')
    if (cellImagesFile) {
      const wpsImages = await extractWpsCellImages(
        zip,
        cellImagesFile,
        jsonData,
        firstSheetName,
        skuColumnIndex,
        IMAGE_COL_INDEX
      )
      if (wpsImages.length > 0) {
        console.log(`[图片提取] WPS 单元格图片路径命中，提取 ${wpsImages.length} 张（仅图片列）`)
        return wpsImages
      }
      console.log('[图片提取] 存在 cellimages.xml 但图片列未命中，回退 drawing.xml 路径')
    }

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

        // 解析 xdr:twoCellAnchor / xdr:oneCellAnchor 元素获取图片位置
        // 反向引用 \1 保证开闭标签类型一致
        const anchorRegex = /<xdr:(twoCellAnchor|oneCellAnchor)[^>]*>[\s\S]*?<\/xdr:\1>/g
        const anchors = drawingXml.match(anchorRegex) || []

        console.log(`[图片提取] 找到 ${anchors.length} 个图片锚点`)

        for (let i = 0; i < anchors.length; i++) {
          const anchor = anchors[i]

          // 关键修复：<xdr:from> 内元素顺序是 col → colOff → row → rowOff，
          // col 在 row 之前。旧正则 /<xdr:from>\s*<xdr:row>/ 永远匹配不到，
          // 导致 visualOrderList 恒为空、只能走文件名兜底 → 图片顺序错乱。
          const fromMatch = anchor.match(
            /<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/
          )
          const blipMatch = anchor.match(/<a:blip[^>]*r:embed="([^"]*)"/)

          if (fromMatch && blipMatch) {
            const col = parseInt(fromMatch[1])
            const row = parseInt(fromMatch[2])
            const embedId = blipMatch[1]

            // 先全量收集，后面再按图片列过滤（避免误伤 col 定位异常的文件）
            visualOrderList.push({ embedId, row, col, visualOrder: 0 })
          }
        }
      }

      // 优先保留图片列（C列，索引2）的锚点；若该列一个都没有则退回全部锚点
      const inImageCol = visualOrderList.filter(a => a.col === IMAGE_COL_INDEX)
      const picked = inImageCol.length > 0 ? inImageCol : visualOrderList

      // 判断真实行号是否可信：存在 >1 个不同行号，说明图片是贴进各自单元格的
      const distinctRows = new Set(picked.map(a => a.row))
      rowsReliable = distinctRows.size > 1

      // 行号可信 → 按真实行号升序（严格对齐 SKU 行）；否则保持锚点出现顺序
      if (rowsReliable) {
        picked.sort((a, b) => a.row - b.row)
      }
      picked.forEach((a, idx) => { a.visualOrder = idx + 1 })

      // 用过滤+排序后的结果替换原列表
      visualOrderList.length = 0
      visualOrderList.push(...picked)

      console.log(
        `[图片提取] 解析到 ${visualOrderList.length} 个图片位置` +
        `（行号可信=${rowsReliable}，${rowsReliable ? '按真实行号排序' : '按锚点顺序'}）`
      )
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

      // 行号可信时用锚点真实行号（jsonData 与 sheet 行一一对应，第0行是表头）；
      // 否则退回按视觉顺序：第i个图片 → 第i+1行数据。
      const dataRow = rowsReliable ? item.row : i + 1
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
