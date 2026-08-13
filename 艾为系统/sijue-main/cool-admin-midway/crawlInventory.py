import json
import multiprocessing
import os
# 禁用 requests 的全局代理，防止受本地代理软件(如Clash/v2ray)影响
os.environ['NO_PROXY'] = '*'
# 修复 Playwright mkdtemp 报错：将临时文件目录指向一个确定存在的路径，避免 8.3 短路径问题
_playwright_tmp = 'D:\\Chrome\\playwright-tmp'
os.makedirs(_playwright_tmp, exist_ok=True)
os.environ['TMPDIR'] = _playwright_tmp
os.environ['TMP'] = _playwright_tmp
os.environ['TEMP'] = _playwright_tmp
import subprocess
import threading
import time
import queue
from ctypes import c_long
from typing import List, Dict

# 新增：引入Windows API相关库（用于调整窗口大小）
import win32gui
import win32con
 
import requests
from playwright.sync_api import Playwright, sync_playwright
from playwright.sync_api import TimeoutError

# ======================== 核心配置项（保持原有，新增窗口大小配置）========================
MIDWAY_API_BASE = "http://8.138.197.75:8001/api/spider/python"
# MIDWAY_API_BASE = "http://localhost:8001/api/spider/python"
ALLOWED_SITES = {
    "www.amazon.co.uk": "英国",
    "www.amazon.de": "德国",
    "www.amazon.fr": "法国",
    "www.amazon.es": "西班牙",
    "www.amazon.it": "意大利"
}
CHROME_DEBUG_PORTS = [9990, 9991, 9992, 9993, 9994, 9995, 9996, 9997, 9998, 9999]
TASK_QUEUE_MAX_SIZE = 1000
CHROME_USER_DATA_BASE_DIR = "D:\\Chrome"

MAX_TASK_EXECUTION_TIME = 120  # 单个任务最大超时时间（秒）
MAX_TASKS_PER_BROWSER = 500   # 单个浏览器实例最大任务数
CHROME_CHECK_RETRY = 2        # 浏览器启动失败重试次数
CHROME_MIN_WINDOW_SIZE = (1, 25)  # 浏览器最小窗口尺寸（宽1px，高25px，仅显示标题栏）

# ======================== 线程安全任务队列（原有逻辑不变）========================
task_queue: List[Dict] = []  
task_set: set = set()        
queue_lock = threading.Lock()

def enqueue(value: Dict) -> None:
    with queue_lock:
        task_key = value.get("asinUrl", "")
        if not task_key or task_key in task_set:
            return
        if len(task_queue) >= TASK_QUEUE_MAX_SIZE:
            oldest_task = task_queue.pop(0)
            task_set.discard(oldest_task.get("asinUrl", ""))
        task_set.add(task_key)
        task_queue.append(value)

def dequeue() -> Dict:
    with queue_lock:
        if task_queue:
            task = task_queue.pop(0)
            task_set.discard(task.get("asinUrl", ""))
            return task
        return None

# ======================== 浏览器管理（核心新增：窗口缩成最小标题栏）========================
browser_queue = queue.Queue()

def is_chrome_cdp_available(port: int) -> bool:
    try:
        response = requests.get(f"http://localhost:{port}/json/version", timeout=3, proxies={"http": None, "https": None})
        return response.status_code == 200 and "Chrome" in response.text
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        return False

def closeChrome() -> None:
    os.system('taskkill /f /im chrome.exe 2>nul')
    time.sleep(1)
    print("✅ 已关闭所有Chrome残留进程")

# 新增：根据端口号杀死特定的Chrome进程
def killChromeByPort(port: int) -> None:
    try:
        # 1. 优先通过 wmic 查找带有特定端口号参数的 chrome.exe 的 PID
        cmd = f'wmic process where "name=\'chrome.exe\' and commandline like \'%--remote-debugging-port={port}%\'" get processid /value'
        result = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT).decode('utf-8', errors='ignore')
        for line in result.split('\n'):
            line = line.strip()
            if line.startswith('ProcessId='):
                pid = line.split('=')[1]
                print(f"🔪 找到假死的 Chrome (端口: {port}, PID: {pid})，正在结束进程树...")
                os.system(f'taskkill /F /PID {pid} /T >nul 2>&1')
        time.sleep(1)
    except subprocess.CalledProcessError:
        pass  # wmic 未找到匹配进程，正常现象
    except Exception as e:
        print(f"⚠️ 强制关闭端口 {port} 进程时出错: {e}")

# 新增：查找Chrome窗口句柄（根据端口号匹配）
def find_chrome_window(port: int) -> int:
    """根据调试端口号查找Chrome窗口句柄"""
    hwnd = None
    # Chrome窗口类名固定为"Chrome_WidgetWin_0"，标题包含端口号（如"Chrome - 9990"）
    def enum_window_callback(hwnd_param, lparam):
        nonlocal hwnd
        if win32gui.GetClassName(hwnd_param) == "Chrome_WidgetWin_0":
            window_title = win32gui.GetWindowText(hwnd_param)
            if f"Chrome - {port}" in window_title:
                hwnd = hwnd_param
                return False  # 找到后停止枚举
        return True
    # 枚举所有顶层窗口
    win32gui.EnumWindows(enum_window_callback, None)
    return hwnd

# 新增：调整Chrome窗口为最小标题栏状态
def resize_chrome_to_min(hwnd: int) -> bool:
    """将窗口调整为仅显示标题栏的最小状态"""
    if not hwnd:
        return False
    try:
        # 设置窗口位置（0,0）+ 最小尺寸，强制重绘
        win32gui.MoveWindow(
            hwnd, 
            0, 0,  # 窗口左上角坐标（可根据需求调整）
            CHROME_MIN_WINDOW_SIZE[0], CHROME_MIN_WINDOW_SIZE[1], 
            True  # 强制刷新窗口
        )
        return True
    except Exception as e:
        print(f"⚠️  调整窗口失败：{str(e)}")
        return False

def openChrome(port: int) -> bool:
    """启动Chrome + 缩成最小标题栏（核心修改）"""
    user_data_dir = f"{CHROME_USER_DATA_BASE_DIR}{port}"
    os.makedirs(user_data_dir, exist_ok=True)
    
    # 尝试修改 Preferences 阻止恢复页面弹窗
    pref_path = os.path.join(user_data_dir, "Default", "Preferences")
    if os.path.exists(pref_path):
        try:
            with open(pref_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if 'profile' in data and 'exit_type' in data['profile']:
                data['profile']['exit_type'] = 'Normal'
            with open(pref_path, 'w', encoding='utf-8') as f:
                json.dump(data, f)
        except Exception:
            pass

    # 关键修改：1. 移除--start-maximized 2. 加--compact-navigation 3. 增加一系列防崩溃和弹窗的启动参数
    cmd = (f'start chrome.exe --user-data-dir="{user_data_dir}" '
           f'--remote-debugging-port={port} --disable-gpu --no-sandbox '
           f'--disable-blink-features=AutomationControlled --compact-navigation '
           f'--no-first-run --no-default-browser-check --hide-crash-restore-bubble '
           f'--disable-infobars --disable-features=TranslateUI --disable-session-crashed-bubble')
    os.system(cmd)
    
    # 多次重试检查浏览器是否启动成功
    for _ in range(CHROME_CHECK_RETRY):
        time.sleep(2)
        if is_chrome_cdp_available(port):
            # 新增：启动成功后，调整窗口为最小标题栏
            hwnd = find_chrome_window(port)
            if hwnd and resize_chrome_to_min(hwnd):
                print(f"✅ 端口{port}的Chrome实例启动成功（已缩成最小标题栏）")
            else:
                print(f"✅ 端口{port}的Chrome实例启动成功（窗口调整失败，不影响爬取）")
            return True
    print(f"❌ 端口{port}的Chrome实例启动失败（重试{CHROME_CHECK_RETRY}次仍不可用）")
    return False

def initBrowserQueue() -> None:
    while not browser_queue.empty():
        browser_queue.get()
    closeChrome()
    valid_ports = []
    for port in CHROME_DEBUG_PORTS:
        if openChrome(port):
            valid_ports.append(port)
            browser_queue.put(port)
    if not valid_ports:
        raise Exception("❌ 所有Chrome端口启动失败，请检查端口占用或目录权限！")
    print(f"\n📊 浏览器队列初始化完成：共{len(valid_ports)}个有效实例（端口：{valid_ports}）\n")

def fetchBrowser() -> int:
    while True:
        port = browser_queue.get(block=True)
        if not is_chrome_cdp_available(port):
            print(f"⚠️  端口{port}的Chrome已假死，尝试重启...")
            # 核心修改：在重新启动之前，先强制杀死该端口对应的僵尸Chrome进程
            killChromeByPort(port)
            time.sleep(1)
            
            if openChrome(port):
                # 修复BUG 1：不要在这里 put(port)！
                # 马上就要 return 给线程使用了，如果提前放回队列，会导致多个线程拿到同一个浏览器端口！
                return port
            else:
                print(f"❌ 端口{port}重启失败，归还队列等待下次重试")
                # 修复BUG 2：启动失败时必须放回队列！
                # 否则这个端口就永远丢失了（这就是为什么开了10个最后只剩6个的原因）
                browser_queue.put(port)
                time.sleep(2)
                continue
        return port

# ======================== 站点过滤与工具函数（原有逻辑不变）========================
def isFiltered(detail_url: str) -> bool:
    for allowed_domain in ALLOWED_SITES.keys():
        if allowed_domain in detail_url:
            return False
    print(f"🚫 过滤非目标站点：{detail_url}")
    return True

def getPostCodeByUrl(detail_url: str) -> str:
    post_code_map = {
        "www.amazon.co.uk": "WC1E 7HU",
        "www.amazon.de": "80539",
        "www.amazon.fr": "06200",
        "www.amazon.es": "08007",
        "www.amazon.it": "50121"
    }
    for domain, code in post_code_map.items():
        if domain in detail_url:
            return code
    return ""

def request_interceptor(route, request):
    block_patterns = ["adsbygoogle.js", "googleads", "doubleclick.net", "analytics.js", "gtag.js"]
    if any(pattern in request.url for pattern in block_patterns):
        route.abort()
    else:
        route.continue_()

# ======================== MidwayJS接口对接（原有逻辑不变）========================
def fetchTaskFromMidway(limit: int = 50) -> bool:
    task_api = f"{MIDWAY_API_BASE}/tasks"
    try:
        params = {
            "limit": limit,
            "marketplace": ",".join(ALLOWED_SITES.values())
        }
        response = requests.get(task_api, params=params, timeout=10, proxies={"http": None, "https": None})
        response.raise_for_status()
        result = response.json()
        if not result.get("success") or not result.get("data"):
            print(f"⚠️  拉取任务失败：{result.get('message', '无可用任务')}")
            return False
        added_count = 0
        for task in result["data"]:
            if task.get("asinUrl"):
                enqueue(task)
                added_count += 1
        with queue_lock:
            total = len(task_queue)
        print(f"✅ 从Midway拉取任务成功：新增{added_count}条，队列总长度{total}")
        return True
    except Exception as e:
        print(f"❌ 拉取任务接口异常：{str(e)}")
        return False

def updateInventoryToMidway(task_info: Dict) -> None:
    inventory_api = f"{MIDWAY_API_BASE}/inventory"
    try:
        inventory_data = {
            "id": task_info.get("id"),
            "inventory": task_info.get("inventory"),
            "inventoryType": task_info.get("inventoryType"),
            "dispatches_type": task_info.get("dispatches_type"),
            "fba_inventory_sum": task_info.get("fba_inventory_sum",0)
        }
        response = requests.post(
            inventory_api,
            json=[inventory_data],
            headers={"Content-Type": "application/json"},
            timeout=10,
            proxies={"http": None, "https": None}
        )
        response.raise_for_status()
        result = response.json()
        if result.get("success"):
            print(f"📈 库存更新成功（ID：{task_info.get('id')}，库存：{task_info.get('inventory')}）")
        else:
            print(f"⚠️  库存更新失败（ID：{task_info.get('id')}）：{result.get('message')}")
    except Exception as e:
        print(f"❌ 库存更新接口异常：{str(e)}")

def markInvalidToMidway(task_info: Dict) -> None:
    invalid_api = f"{MIDWAY_API_BASE}/invalid"
    try:
        invalid_data = {
            "asin_competitor": task_info.get("asin_competitor"),
            "marketplace": task_info.get("marketplace")
        }
        if not invalid_data["asin_competitor"] or not invalid_data["marketplace"]:
            print(f"⚠️  标记失效参数缺失：{invalid_data}")
            return
        response = requests.post(
            invalid_api,
            json=invalid_data,
            headers={"Content-Type": "application/json"},
            timeout=10,
            proxies={"http": None, "https": None}
        )
        response.raise_for_status()
        result = response.json()
        if result.get("success"):
            print(f"🚨 商品标记失效成功（ASIN：{task_info.get('asin_competitor')}）")
        else:
            print(f"⚠️  商品标记失效失败：{result.get('message')}")
    except Exception as e:
        print(f"❌ 标记失效接口异常：{str(e)}")

# 移除无用的 rollbackTaskToMidway

# ======================== 核心爬取逻辑（原有稳定性优化不变）========================
def switchLocation(page, detail_url: str) -> None:
    try:
        if page.locator('[class="center-text-desktop "] a[title="English"]').is_visible(timeout=3000):
            page.locator('[class="center-text-desktop "] a[title="English"]').click(timeout=3000)
        if page.locator('#sp-cc-accept').is_visible(timeout=3000):
            page.locator('#sp-cc-accept').click(timeout=3000)
        post_code = getPostCodeByUrl(detail_url)
        if not post_code:
            print("⚠️  无法获取目标邮编，跳过地址切换")
            return
        page.locator('#nav-global-location-slot').click(timeout=3000)
        time.sleep(0.5)
        if not page.locator('#GLUXChangePostalCodeLink').is_hidden(timeout=3000):
            page.locator('#GLUXChangePostalCodeLink').click(timeout=3000)
        if page.locator('#GLUXZipUpdateInput_0').is_visible(timeout=3000):
            page.locator('#GLUXZipUpdateInput_0').fill(post_code.split(" ")[0])
            page.locator('#GLUXZipUpdateInput_1').fill(post_code.split(" ")[1])
        elif page.locator('#GLUXZipUpdateInput').is_visible(timeout=3000):
            page.locator('#GLUXZipUpdateInput').fill(post_code)
        if page.locator('#GLUXZipUpdate').is_visible(timeout=3000):
            page.locator('#GLUXZipUpdate').click(timeout=3000)
        if page.locator('[name="glowDoneButton"]').is_visible(timeout=3000):
            page.locator('[name="glowDoneButton"]').click(timeout=3000)
        if page.locator('[class="a-popover-footer"] #GLUXConfirmClose').is_visible(timeout=3000):
            page.locator('[class="a-popover-footer"] #GLUXConfirmClose').click(timeout=3000)
        print(f"📍 地址切换完成，目标邮编：{post_code}")
    except Exception as e:
        print(f"⚠️  地址切换异常（{str(e)}），继续执行后续逻辑")


def get_dispatch_and_seller_info(page):
    """获取dispatches_from、sold_by字段"""
    dispatches_from = ""
    sold_by = ""
    
    try:
        # 获取dispatches_from：第一个fulfillerInfoFeature_feature_div中的第一个目标span
        fulfiller_div = page.locator('#fulfillerInfoFeature_feature_div').first
        if fulfiller_div.is_visible(timeout=5000):
            dispatch_span = fulfiller_div.locator(
                'span.a-size-small.offer-display-feature-text-message'
            ).first
            if dispatch_span.is_visible(timeout=3000):
                dispatches_from = dispatch_span.inner_text().strip()
                print(f"🔍 获取到dispatches_from：{dispatches_from}")
    except Exception as e:
        print(f"⚠️ 获取dispatches_from异常：{str(e)}")
    
    try:
        # 获取sold_by：第一个id为sellerProfileTriggerId的a标签
        seller_link = page.locator('#sellerProfileTriggerId').first
        if seller_link.is_visible(timeout=5000):
            sold_by = seller_link.inner_text().strip()
            print(f"🔍 获取到sold_by：{sold_by}")
    except Exception as e:
        print(f"⚠️ 获取sold_by异常：{str(e)}")
    
    return dispatches_from, sold_by

def calculate_dispatches_type(dispatches_from: str, sold_by: str) -> str:
    """根据dispatches_from和sold_by计算dispatches_type"""
    sold_by_lower = sold_by.lower()
    dispatches_from_lower = dispatches_from.lower()
    
    if sold_by_lower == 'amazon':
        return '0'
    elif dispatches_from_lower == 'amazon':
        return '1'
    else:
        return '2'
    
def calculate_fba_inventory_sum(page):
    """
    计算详情表格中：从第二行开始，配送类型为FBA的库存总和
    - 核心修复：Playwright API调用错误（Locator没有wait_for_selector）
    - 关键优化：通过Page对象定位子元素，等待库存加载完成
    """
    fba_total = 0
    try:
        # 定位表格主体和所有行（tr）
        table_body = page.locator('table.el-table__body tbody')
        table_body.wait_for(state="visible", timeout=5000)
        
        # 获取所有数据行（跳过表头，只取tbody下的tr）
        rows = table_body.locator('tr.el-table__row').all()
        if len(rows) < 2:
            print(f"⚠️  详情表格行数不足（共{len(rows)}行），无法计算第二行及以后数据")
            return fba_total
        
        print(f"🔍 详情表格共{len(rows)}行，从第二行（索引1）开始统计，等待库存加载...")
        
        # 遍历从第二行开始的所有行（索引1及以后）
        for idx, row in enumerate(rows[1:], start=1):  # start=1对应原始行索引1（第二行）
            try:
                # 获取当前行的所有列（td）
                tds = row.locator('td.el-table__cell').all()
                if len(tds) < 4:  # 至少需要4列（卖家、库存、价格、配送）
                    print(f"⚠️  第{idx+1}行列数不足（共{len(tds)}列），跳过")
                    continue
                
                # ========== 修复API调用：通过Page定位子元素，等待库存加载 ==========
                row_index = idx + 1  # 原始行号（从2开始）
                # 构造当前行库存列的唯一选择器（确保只定位当前行）
                inventory_selector = f'table.el-table__body tbody tr.el-table__row:nth-child({row_index}) td:nth-child(2) div.inventory'
                loading_selector = f'{inventory_selector} i.icon-ext-loading'  # 加载图标选择器
                inventory_text_selector = f'{inventory_selector} div:not(i)'  # 库存文本选择器
                
                # 等待加载图标消失（最长等待10秒）
                try:
                    page.wait_for_selector(loading_selector, state="hidden", timeout=10000)
                    print(f"✅ 第{row_index}行库存加载图标消失")
                except TimeoutError:
                    print(f"⚠️  第{row_index}行库存加载图标超时，检查是否已加载完成...")
                
                # 等待库存文本出现（最长等待3秒）
                try:
                    page.wait_for_selector(inventory_text_selector, state="visible", timeout=3000)
                except TimeoutError:
                    # 超时后仍尝试获取库存文本，避免误判
                    pass
                
                # 提取第二列（库存）：通过选择器直接获取当前行库存文本
                inventory_text = page.locator(inventory_text_selector).inner_text(timeout=3000).strip()
                # 提取第四列（配送类型）：索引3
                shipping_type = tds[3].inner_text(timeout=3000).strip().upper()  # 转为大写，兼容大小写
                
                # 处理库存文本：只保留数字，排除"--"等无效值
                inventory_num = ''.join(filter(str.isdigit, inventory_text))
                if not inventory_num:
                    print(f"⚠️  第{row_index}行库存无效（{inventory_text}），跳过")
                    continue
                inventory = int(inventory_num)
                
                # 筛选配送类型为FBA的行
                if shipping_type == "FBA":
                    fba_total += inventory
                    print(f"✅ 第{row_index}行：库存{inventory}，配送类型{shipping_type} → 累计FBA库存：{fba_total}")
                else:
                    print(f"ℹ️  第{row_index}行：配送类型{shipping_type}（非FBA），跳过")
            
            except Exception as e:
                print(f"⚠️  解析第{idx+1}行失败：{str(e)}")
                # 输出详细错误信息（便于调试）
                import traceback
                traceback.print_exc()
                continue
        
        print(f"📊 FBA库存总和计算完成：{fba_total}")
    except TimeoutError:
        print("⚠️  详情表格加载超时，无法计算FBA库存总和")
    except Exception as e:
        print(f"❌ 计算FBA库存总和异常：{str(e)}")
        import traceback
        traceback.print_exc()
    
    return fba_total

def parseInventoryData(page, task_info):
    try:
        # 等待surplus-table，超时时间30秒
        page.wait_for_selector(selector='[class="surplus-table"]', timeout=30000)
        
        # 2026-04-16 新增：等待具体的库存数字容器加载并可见
        page.wait_for_selector(selector='.surplus-count-num', state='visible', timeout=15000)
        
        # 2026-04-16 新增：等待2秒，确保插件的异步请求完成且数字已经渲染到DOM中
        # 避免外层表格出现了但里面的数字还是空或者加载中的情况
        time.sleep(5)
        
    except TimeoutError:  # 捕获Playwright特有的超时异常
        # 核心修改：在超时直接认定为 NORMAL=0 之前，检查是否是断货情况
        out_of_stock_elem = page.locator(
            'div.a-section.a-spacing-none span.a-size-medium.a-color-success',
            has_text='Temporarily out of stock.'
        )
        if out_of_stock_elem.count() > 0 and out_of_stock_elem.is_visible():
            print(f"📦 解析库存结果（检测到明确断货标志）：{task_info}")
            task_info['inventory'] = '0'
            task_info['inventoryType'] = 'DUANHUO'
        else:
            # 超时处理：强制设置库存为0
            num = '0'
            task_info['inventory'] = num
            task_info['inventoryType'] = 'NORMAL'  # 补充必要字段 
            print(f"解析库存结果（超时）：{task_info}")
            
        try:
            # 确保更新接口被调用
            updateInventoryToMidway(task_info)
        except Exception as e:
            print(f"超时/断货后更新库存失败：{str(e)}")
        return   
    
    dispatches_from, sold_by = get_dispatch_and_seller_info(page)
    dispatches_type = calculate_dispatches_type(dispatches_from, sold_by)
    fba_inventory_sum = 0
    try:
        # 定位“查看详细”按钮（精准匹配class和文本）
        view_detail_btn = page.locator('div[data-v-05a3885d].my-btn', has_text='查看详细').first
        if view_detail_btn.is_visible(timeout=5000):
            print("\n📥 点击查看详细按钮，开始统计FBA库存...")
            # 点击按钮（使用force=True确保触发，避免被遮挡）
            view_detail_btn.click(timeout=5000, force=True)
            # 计算FBA库存总和（核心功能）
            fba_inventory_sum = calculate_fba_inventory_sum(page)
            # 关闭弹窗（精准定位关闭按钮）
            close_btn = page.locator('div[data-v-05a3885d].pop-title-close i.el-icon').first
            if close_btn.is_visible(timeout=3000):
                close_btn.click(timeout=3000, force=True)
                print("📥 详情弹窗已关闭")
        else:
            print("⚠️  未找到“查看详细”按钮，FBA库存总和设为0")
    except Exception as e:
        print(f"❌ 查看详细/统计FBA库存异常：{str(e)}")
        fba_inventory_sum = 0  # 异常时设为0

    limit_special_elem = page.locator(
        '[class="surplus-count-num"] [class="limit el-tooltip__trigger el-tooltip__trigger"]'
    )
    if limit_special_elem.is_visible():
        # 2026-04-16 新增：等待库存数字出现，避免只拿到空或者--
        wait_start = time.time()
        while time.time() - wait_start < 15:
            num = page.locator('[class="surplus-count-header"] [class="surplus-count-num"]').inner_text().strip()
            if num and num != '--':
                break
            time.sleep(1)
            
        # 解析页面实际库存值（不再强制设0）
        num = num.replace(',', '')
        if num == '999+':
            num = '1000'
        elif num == '--':
            num = '0'

        task_info['inventory'] = num  # 传抓取的实际库存数据
        task_info['inventoryType'] = 'XIAN'  # 保留XIAN标识
        task_info['dispatches_type'] = dispatches_type
        task_info['fba_inventory_sum'] = fba_inventory_sum
        print(f"解析库存结果（包含特定limit元素）：{task_info}")
        try:
            updateInventoryToMidway(task_info)
        except Exception as e:
            print(f"特定limit元素解析后更新失败：{str(e)}")
        return  # 终止后续解析逻辑
    
    # 以下为正常解析逻辑（超时后不会执行）
    inventoryType = 'NORMAL'
    if page.locator('[class="surplus-count-num"] [class*=limit]').is_visible():
        inventoryType = 'XIAN'
    
    # 检查是否缺货
    out_of_stock_elem = page.locator(
        'div.a-section.a-spacing-none span.a-size-medium.a-color-success',
        has_text='Temporarily out of stock.'
    )
    if out_of_stock_elem.count() > 0 and out_of_stock_elem.is_visible():
        num = '0'
        inventoryType = 'DUANHUO' 
    else:
        # 2026-04-16 新增：循环等待直到库存数字不再是"--"或空，最多等待15秒
        wait_start = time.time()
        while time.time() - wait_start < 15:
            num = page.locator('[class="surplus-count-header"] [class="surplus-count-num"]').inner_text().strip()
            if num and num != '--':
                break
            time.sleep(1)
            
        if num == '999+':
            inventoryType = '999+'
            num = '1000'
        elif num == '--':
            num = '0'

    if dispatches_type != '1':
        num = '0'

    num = num.replace(',', '')
    task_info['inventory'] = num
    task_info['inventoryType'] = inventoryType
    task_info['dispatches_type'] = dispatches_type
    task_info['fba_inventory_sum'] = fba_inventory_sum  # 存入FBA库存总和

    print(f"解析库存结果：{task_info}")
    
    try:
        updateInventoryToMidway(task_info)
    except Exception as e:
        print(f"解析库存后更新失败：{str(e)}")


def refreshDetailPage(task_info: Dict) -> None:
    thread_id = threading.get_ident()
    detail_url = task_info.get("asinUrl", "")
    debug_port = None
    is_timeout = False
    page = None
    browser = None

    def timeout_handler():
        nonlocal is_timeout
        is_timeout = True
        print(f"⏰ 线程{thread_id}：任务超时（超过{MAX_TASK_EXECUTION_TIME}秒），强制终止")
    
    timer = threading.Timer(MAX_TASK_EXECUTION_TIME, timeout_handler)
    timer.start()

    try:
        if not detail_url:
            print(f"⚠️  线程{thread_id}：任务缺少asinUrl，跳过")
            return
        if isFiltered(detail_url):
            return
        
        debug_port = fetchBrowser()
        print(f"\n🚀 线程{thread_id}：使用端口{debug_port}，开始爬取：{detail_url}")
        
        with sync_playwright() as playwright:
            try:
                # 增加 CDP 连接的超时时间和重试机制
                try:
                    browser = playwright.chromium.connect_over_cdp(
                        f"http://localhost:{debug_port}",
                        timeout=30000  # 从 10000 改为 30000
                    )
                except TimeoutError:
                    print(f"⚠️  线程{thread_id}：端口{debug_port}首次连接CDP超时，尝试重试...")
                    time.sleep(2)
                    browser = playwright.chromium.connect_over_cdp(
                        f"http://localhost:{debug_port}",
                        timeout=30000
                    )
            except Exception as e:
                # 如果真的连不上，可能是浏览器假死了，直接抛出异常，由外层捕获并回滚任务
                raise Exception(f"浏览器连接失败：{str(e)}")
            
            try:
                if not browser.contexts:
                    raise Exception("浏览器无可用上下文（可能已崩溃）")
                context = browser.contexts[0]
                page = context.new_page()
                
                page.route("**/*", request_interceptor)
                page.goto(detail_url, wait_until="domcontentloaded", timeout=30000)
                if is_timeout:
                    raise Exception("任务已超时")
                
                if page.locator('[action="/errors/validateCaptcha"]').is_visible(timeout=3000):
                    print(f"⚠️  线程{thread_id}：端口{debug_port}遇验证码，跳过该任务")
                    return
                
                if page.locator('a[href="/ref=cs_404_link"]').is_visible(timeout=3000):
                    print(f"⚠️  线程{thread_id}：端口{debug_port}发现链接失效")
                    markInvalidToMidway(task_info)
                    return
                
                page.wait_for_selector('#nav-global-location-slot', timeout=10000)
                current_address = page.locator('#glow-ingress-line2').inner_text(timeout=5000)
                target_postal = getPostCodeByUrl(detail_url).split(" ")[0]
                if target_postal and target_postal not in current_address:
                    print(f"📍 线程{thread_id}：当前地址不匹配，开始切换（当前：{current_address}）")
                    switchLocation(page, detail_url)
                    time.sleep(1)
                
                parseInventoryData(page, task_info)
                page.request_gc()
                print(f"✅ 线程{thread_id}：端口{debug_port}任务完成")
            
            finally:
                if page:
                    try:
                        page.close()
                    except:
                        pass
    except Exception as e:
        print(f"❌ 线程{thread_id}：端口{debug_port}爬取异常：{str(e)}")
        # 严重异常时回滚状态：如果不修改后端，我们可以利用已有的 updateInventoryToMidway
        # 将其设置为一个特定标识，后端虽然保存为0，但能结束“获取中”的状态
        try:
            task_info['inventory'] = '0'
            task_info['inventoryType'] = 'ERROR_ROLLBACK'
            updateInventoryToMidway(task_info)
            print(f"🔄 已通过更新接口重置异常任务(ID: {task_info.get('id')})状态")
        except Exception as rollback_e:
            print(f"❌ 异常回滚失败：{str(rollback_e)}")
    finally:
        if debug_port is not None:
            # 修复BUG 3：防止端口重复归还（当全局重启触发时可能导致同一端口存在多个）
            if debug_port not in list(browser_queue.queue):
                browser_queue.put(debug_port)
                print(f"🔄 线程{thread_id}：端口{debug_port}已正常归还队列")
            else:
                print(f"⚠️  线程{thread_id}：端口{debug_port}已存在于队列，避免重复归还")
        timer.cancel()

# ======================== 线程管理（原有逻辑不变）========================
counter = multiprocessing.Value(c_long, 0)
counter_limit = multiprocessing.Value(c_long, 1000)
cond = multiprocessing.Condition()

def restartBrowserTask() -> None:
    time.sleep(10)
    while True:
        with cond:
            cond.wait()
            print(f"\n🔄 任务计数达到{counter_limit.value}，开始重启浏览器...")
            while not browser_queue.empty():
                browser_queue.get()
            initBrowserQueue()
            with counter.get_lock():
                counter.value = 0
            print(f"✅ 浏览器重启完成，计数器已重置为0\n")

def fetchTaskThread() -> None:
    time.sleep(5)
    while True:
        with queue_lock:
            need_fetch = len(task_queue) < 10
        if need_fetch:
            print(f"\n📥 任务队列不足，开始从Midway拉取任务...")
            if not fetchTaskFromMidway(limit=50):
                print(f"🔄 拉取任务失败，重试1次...")
                fetchTaskFromMidway(limit=50)
        time.sleep(30)

def runTaskThread() -> None:
    time.sleep(5)
    while True:
        task = dequeue()
        if not task:
            print(f"⚠️  线程{threading.get_ident()}：任务队列为空，等待5秒...")
            time.sleep(5)
            continue
        
        start_time = time.time()
        refreshDetailPage(task)
        execution_time = time.time() - start_time
        
        with counter.get_lock():
            counter.value += 1
            current_count = counter.value
        
        print(f"📊 线程{threading.get_ident()}：任务耗时{execution_time:.2f}秒，累计完成{current_count}个任务\n")
        
        if current_count >= counter_limit.value:
            with cond:
                cond.notify_all()

# ======================== 程序入口（原有逻辑不变）========================
if __name__ == "__main__":
    try:
        print("=" * 60)
        print("📦 亚马逊库存爬取程序（多浏览器版·最小标题栏+稳定性增强）")
        print("=" * 60)
        
        print("\n1️⃣  开始初始化浏览器队列...")
        initBrowserQueue()
        
        print("2️⃣  启动浏览器重启线程...")
        restart_thread = threading.Thread(target=restartBrowserTask)
        restart_thread.daemon = True
        restart_thread.start()
        
        print("3️⃣  启动任务拉取线程...")
        fetch_thread = threading.Thread(target=fetchTaskThread)
        fetch_thread.daemon = True
        fetch_thread.start()
        
        task_thread_count = len(CHROME_DEBUG_PORTS)
        print(f"4️⃣  启动{task_thread_count}个任务执行线程...")
        for i in range(task_thread_count):
            task_thread = threading.Thread(target=runTaskThread)
            task_thread.daemon = True
            task_thread.start()
            print(f"   - 任务执行线程{i+1}（ID：{task_thread.ident}）已启动")
        
        print("\n✅ 所有线程启动完成，程序开始正常运行...")
        print("=" * 60)
        while True:
            time.sleep(3600)
    
    except Exception as e:
        print(f"\n❌ 程序启动失败：{str(e)}")
        exit(1)
