import { App, Provide } from "@midwayjs/decorator";
import { Init, Singleton } from "@midwayjs/core";
import { InjectEntityModel } from "@midwayjs/typeorm";
import { Application } from "@midwayjs/koa";
import axios from "axios";
import { BaseSysParamEntity } from "../../../base/entity/sys/param";
import { AppAmzBsrCandidateCompetitorEntity } from "../../entity/bsr_candidate_competitor";
import { AppAmzBsrCandidateEntity } from "../../entity/bsr_candidate";
import { KeywordSearchVolumeData } from "../../interface/keyword-search-volume-data";
import { AppTaskManagementEntity } from '../../entity/bzy_task_management';
import { AppSellerspriteApiLogEntity } from '../../entity/sellersprite_api_log';
import { DataSource, In, Repository } from 'typeorm';
import { AppAmzListingKeywordService } from '../../service/keyword';
import { Inject } from '@midwayjs/decorator';
import { SellerSpriteUtils } from "../sellerSpriteUtils";
import { log } from "console";
import * as dayjs from 'dayjs';

// 任务状态常量
const TASK_STATUSES = {
  UNEXECUTED: 'Unexecuted',  // 未执行
  RUNNING: 'Running',        // 执行中
  FINISHED: 'Finished',      // 执行完成
  FAILED: 'Failed',          // 执行失败
  STOPPED: 'Stopped'         // 已停止
};

interface AsinKeywordItem {
  keywords: string;
  keywordCn: string;
  searches: number | string;
  trafficPercentage: number | string;
  latest30daysAds: number | string;
  exactPpc: number | string;
  minExactPpc: number | string;
  maxExactPpc: number | string;
  searchesTrend: Array<{ dk?: string; sales?: number; month?: string; searches?: number; searchRank?: number }>;
}

interface AsinKeywordResponse {
  code: string;
  message: string;
  data: {
    total: number;
    items: AsinKeywordItem[];
  };
  success: boolean;
}

interface KeywordForAdd2 {
  asin: string;
  marketplaces: string;
  value: string;
  value_cn: string;
  search_volume_monthly: number | string;
  ad_competitor_count: number | string;
  trafficPercentage: number | string;
  ppc_bid: number | string;
  ppc_bid_min: number | string;
  ppc_bid_max: number | string;
  search_volume_data: any;
  status: number;
  competitor_spider_status: number;
  title?: string;
}

/**
 * 卖家精灵接口调用工具类（无代理+严格风控版）
 */
@Provide()
@Singleton()
export class SellerspriteTool {
  @InjectEntityModel(BaseSysParamEntity)
  baseSysParamRepo: Repository<BaseSysParamEntity>;

  @InjectEntityModel(AppAmzBsrCandidateCompetitorEntity)
  bsrCandidateCompetitorRepo: Repository<AppAmzBsrCandidateCompetitorEntity>;

  @InjectEntityModel(AppAmzBsrCandidateEntity)
  bsrCandidateRepo: Repository<AppAmzBsrCandidateEntity>;

  @InjectEntityModel(AppTaskManagementEntity)
  taskManagementRepo: Repository<AppTaskManagementEntity>;

  @InjectEntityModel(AppSellerspriteApiLogEntity)
  sellerspriteApiLogRepo: Repository<AppSellerspriteApiLogEntity>;

  // Removed circular dependency injection
  // @Inject()
  // keywordService: AppAmzListingKeywordService;

  @Inject()
  sellerSpriteUtils: SellerSpriteUtils;

  @App()
  app: Application;

  // 配置项
  private sellerspriteCookie: string = "";
  private lastCallTime: number = 0; // API调用时间戳（频率控制）

  // 智能缓存配置
  private competitorCache = new Map<string, {
    data: any;
    expireTime: number;
  }>();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 缓存24小时

  // 风控核心配置
  private readonly MIN_INTERVAL_MS = 30 * 1000; // 一分钟最多2次请求（间隔30秒）
  private readonly PAGE_INTERVAL_MS = 10 * 1000; // 翻页间隔10秒
  private readonly WORK_DURATION_MS = 60 * 60 * 1000; // 工作时长：1小时
  private readonly REST_DURATION_MS = 10 * 60 * 1000; // 休息时长：10分钟
  private readonly DAILY_MAX_CALL = 99999; // 每日最大请求数（兜底）
  private readonly MIN_HISTORY_BATCH = 3; // 历史月份最小批量阈值，低于此数量跳过当月查询

  // 时间统计变量
  private workStartTime: number = 0; // 本轮工作开始时间
  private isResting: boolean = false; // 是否处于休息状态
  private dailyCallCount: Record<string, number> = {}; // 每日请求计数

  /**
   * 初始化方法
   */
  async init() {
    // 加载卖家精灵Cookie配置
    const cookieParam = await this.baseSysParamRepo.findOne({
      where: { keyName: "sellersprite_cookie" },
    });
    if (cookieParam?.data) {
      this.sellerspriteCookie = cookieParam.data.trim();
    }
    // 初始化工作开始时间
    this.workStartTime = Date.now();
    this.isResting = false;

    // 启动定期清理过期缓存的定时器（每小时清理一次）
    setInterval(() => {
      this.cleanExpiredCache();
    }, 60 * 60 * 1000); // 1小时
  }

  /**
   * 检查Cookie状态，如果失效则自动登录
   */
  private async checkAndRefreshCookie(): Promise<void> {
    console.log("正在检查Cookie有效性...");
    const isValid = await this.isCookieValid();
    if (isValid) {
        console.log("Cookie有效，无需重新登录");
        return;
    }
    
    console.log("Cookie失效或未配置，开始自动登录...");
    await this.autoLoginAndRefreshCookie();
    // 重新加载最新配置
    await this.init();
  }

  /**
   * 验证Cookie是否有效
   */
  private async isCookieValid(): Promise<boolean> {
      if (!this.sellerspriteCookie) return false;
      
      try {
          // 尝试访问后台主页，如果未登录通常会重定向
          const response = await axios.get("https://www.sellersprite.com/v2/welcome", {
              headers: this.getCommonHeaders(),
              maxRedirects: 0, // 禁止自动跳转，以便检测302
              validateStatus: (status) => status < 500
          });
          
          // 检查重定向
          if (response.status === 302 || response.status === 301) {
              const location = response.headers['location'] || "";
              if (location.includes("login") || location.includes("signin")) {
                  console.log("Cookie失效: 检测到重定向至登录页");
                  return false;
              }
          }
          
          // 检查401/403
          if (response.status === 401 || response.status === 403) {
             console.log(`Cookie失效: 状态码 ${response.status}`);
             return false;
          }

          // 如果是200，检查内容特征（防止返回登录页HTML）
          if (response.status === 200 && typeof response.data === 'string') {
              if (response.data.includes('class="login-container"') || response.data.includes('id="login-form"')) {
                  console.log("Cookie失效: 页面包含登录表单");
                  return false;
              }
          }
          
          return true;
      } catch (error) {
          console.warn("检查Cookie有效性时发生错误，视为无效:", (error as Error).message);
          return false;
      }
  }

  /**
   * 延时函数（私有工具方法）
   */
  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 校验配置完整性
   */
  private validateConfig(): void {
    if (!this.sellerspriteCookie) {
      throw new Error("卖家精灵Cookie未配置（key：sellersprite_cookie）");
    }
  }

  /**
   * 检查每日请求量是否超限
   */
  private checkDailyLimit(): boolean {
    const today = new Date().toLocaleDateString();
    this.dailyCallCount[today] = this.dailyCallCount[today] || 0;
    
    if (this.dailyCallCount[today] >= this.DAILY_MAX_CALL) {
      console.warn(`今日请求量已达上限（${this.DAILY_MAX_CALL}次），停止抓取`);
      return false;
    }
    this.dailyCallCount[today] += 1;
    return true;
  }

  /**
   * 检查是否需要小时级休息（每工作1小时休息10分钟）
   */
  private async checkHourlyRest(): Promise<void> {
    if (this.isResting) return;

    const now = Date.now();
    const workDuration = now - this.workStartTime;

    // 工作满1小时，触发休息
    if (workDuration >= this.WORK_DURATION_MS) {
      this.isResting = true;
      console.warn(`已工作1小时，开始休息10分钟（${new Date().toLocaleString()}）`);
      await this.sleep(this.REST_DURATION_MS);
      // 休息结束，重置工作时间
      this.workStartTime = Date.now();
      this.isResting = false;
      console.warn(`休息结束，恢复工作（${new Date().toLocaleString()}）`);
    }
  }

  /**
   * 模拟正常浏览页面（穿插调用首页/后台/选产品页面）
   */
  private async mockNormalBrowsing(): Promise<void> {
    const browseUrls = [
      "https://www.sellersprite.com", // 首页
      "https://www.sellersprite.com/v2/welcome", // 后台
      "https://www.sellersprite.com/v3/product-research" // 选产品
    ];

    // 随机选一个页面访问
    const randomUrl = browseUrls[Math.floor(Math.random() * browseUrls.length)];
    const headers = this.getCommonHeaders();

    try {
      console.log(`模拟浏览：${randomUrl}`);
      await axios.get(randomUrl, {
        headers,
        timeout: 15000
      });
      // 模拟浏览停留3秒
      await this.sleep(3000);
    } catch (e) {
      // 忽略浏览失败（仅做行为模拟）
      console.warn(`模拟浏览${randomUrl}失败：${(e as Error).message}`);
    }
  }

  /**
   * 自动登录并刷新Cookie
   * @param username 用户名
   * @param password 密码
   */
  async autoLoginAndRefreshCookie(username?: string, password?: string): Promise<string> {
    // 动态导入 Playwright 相关依赖
    const { chromium } = require("playwright");
    const { addExtra } = require("playwright-extra");
    const stealth = require("puppeteer-extra-plugin-stealth");

    const playwright = addExtra(chromium);
    playwright.use(stealth());

    console.log("启动浏览器自动获取Cookie...");
    const browser = await playwright.launch({
      headless: true, // 设置为true，后台运行，不弹出窗口
      channel: "chrome", 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] // 增加反检测参数
    });

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();

      // 1. 访问登录页
      console.log("正在访问登录页...");
      // 根据用户反馈，/cn/login 返回 404，因此改回 /w/user/logout 或直接访问首页点击登录
      // 策略调整：访问首页 -> 点击登录按钮（如果有） -> 进入登录页
      // 或者直接尝试访问可能的真实登录页地址，通常是 https://www.sellersprite.com/v2/login 或类似于截图中的地址
      // 根据截图，最稳妥的是访问首页或logout页面，因为截图显示的是logout页面
      await page.goto("https://www.sellersprite.com/w/user/logout", { waitUntil: 'domcontentloaded' });
      
      // 调试信息：打印当前页面标题
      const title = await page.title();
      // console.log(`当前页面标题: ${title}`);

      // 2. 切换到账号登录
      console.log("尝试切换到账号登录...");
      try {
        // 使用更宽松的选择器，因为 "账号登录" 可能是 h4, span, div 等
        const accountLoginTab = page.locator('text="账号登录"');
        
        // 如果能看到“账号登录”标签，就点一下
         if (await accountLoginTab.isVisible()) {
            await accountLoginTab.click();
            await page.waitForTimeout(500); // 稍等动画
         }

         // 2.1 检查是否有 "密码登录" 子Tab（防止默认是验证码登录）
         const passwordLoginTab = page.locator('text="密码登录"');
         if (await passwordLoginTab.isVisible()) {
             console.log("检测到'密码登录'选项，尝试点击...");
             await passwordLoginTab.click();
             await page.waitForTimeout(500);
         }
       } catch (e) {
         console.log("切换到账号登录Tab异常:", e.message);
       }

      // 3. 填写账号密码
      console.log("正在填写账号密码...");
      
      // 检查验证码
      if (await page.isVisible('.geetest_wind')) {
          throw new Error("检测到滑动验证码，无法自动登录。");
      }

      // 策略调整：根据日志，页面是英文版，且存在隐藏的同名input
      // 这里的关键是使用 :visible 伪类来只选择可见的输入框
      const usernameSelectors = [
          'input[name="email"]:visible',
          'input[placeholder*="Email"]:visible',
          'input[placeholder*="Sub-Account"]:visible', 
          'input[name="loginName"]:visible',
          'input[placeholder*="手机"]:visible' // 保留中文兼容
      ];

      const passwordSelectors = [
          'input[name="password_otn"]:visible', // 日志显示name是password_otn
          'input[name="password"]:visible',
          'input[placeholder*="Password"]:visible',
          'input[placeholder*="密码"]:visible'
      ];

      let usernameInput = null;
      let passwordInput = null;

      // 寻找可见的用户名输入框
      for (const selector of usernameSelectors) {
          const locator = page.locator(selector).first();
          if (await locator.isVisible()) {
              usernameInput = locator;
              console.log(`找到用户名输入框: ${selector}`);
              break;
          }
      }

      // 寻找可见的密码输入框
      for (const selector of passwordSelectors) {
          const locator = page.locator(selector).first();
          if (await locator.isVisible()) {
              passwordInput = locator;
              console.log(`找到密码输入框: ${selector}`);
              break;
          }
      }

      if (!usernameInput || !passwordInput) {
          // 如果还是找不到，尝试一种非常宽泛的策略：找所有可见的text/password输入框
          console.log("精确匹配失败，尝试寻找页面上所有可见的输入框...");
          const visibleTextInputs = page.locator('input[type="text"]:visible, input[type="email"]:visible');
          const visiblePassInputs = page.locator('input[type="password"]:visible');
          
          if (await visibleTextInputs.count() > 0) usernameInput = visibleTextInputs.first();
          if (await visiblePassInputs.count() > 0) passwordInput = visiblePassInputs.first();
      }

      if (!usernameInput || !passwordInput) {
           throw new Error("无法定位到可见的用户名或密码输入框 (English/Chinese UI mismatch?)");
      }

      // 填写表单
      await usernameInput.fill(username || "awei999");
      await passwordInput.fill(password || "asdf456789");

      // 4. 点击登录
      console.log("点击登录按钮...");
      // 匹配“立即登录”、“登录”、“Sign In”、“Login”
      const loginButtonSelectors = [
          'button:has-text("Sign In")',
          'button:has-text("Login")',
          'button:has-text("立即登录")',
          'button:has-text("登录")',
          'input[type="submit"]', 
          'button[type="submit"]'
      ];
      
      let loginButton = null;
      for (const selector of loginButtonSelectors) {
          const btn = page.locator(selector).first();
          if (await btn.isVisible()) {
              loginButton = btn;
              break;
          }
      }
      
      if (loginButton) {
          await loginButton.click();
      } else {
          // 尝试回车提交
          console.log("找不到登录按钮，尝试回车提交...");
          await passwordInput.press('Enter');
      }
      
      // 5. 等待登录成功
      console.log("等待登录跳转...");
      try {
        // 等待 URL 变化，或者等待 cookie 中出现 session
        // 先等待几秒让页面加载完成，特别是等待弹窗出现
        await page.waitForTimeout(5000);
        
        // 5.1 处理可能出现的“前往个人中心”弹窗（安全风险提示）
        console.log("检查是否有'前往个人中心'弹窗...");
        // 兼容中文和英文界面的选择器
        const centerBtnSelectors = [
            'text="前往个人中心"', // 中文
            'text="Go to User Center"', // 英文猜测
            'text="Personal Center"',
            'text="My Account"',
            '.modal-content a[href*="user"]', // 模态框里的链接
            'button:has-text("前往个人中心")',
            'a:has-text("前往个人中心")'
        ];
        
        let centerBtn = null;
        for (const selector of centerBtnSelectors) {
            // 使用 try-catch 避免某个非法 selector 导致崩溃，且只查找可见元素
            try {
                const btn = page.locator(selector).first();
                if (await btn.isVisible()) {
                    centerBtn = btn;
                    console.log(`找到目标按钮: ${selector}`);
                    break;
                }
            } catch (ignore) {}
        }

        if (centerBtn) {
            console.log("检测到弹窗/按钮，正在点击'前往个人中心'...");
            await centerBtn.click();
            // 点击后等待跳转
            await page.waitForTimeout(3000);
        } else {
             console.log("未检测到特定弹窗，尝试直接获取Cookie...");
        }

        // 再次打印标题确认当前位置
        const currentTitle = await page.title();
        // console.log(`当前页面标题: ${currentTitle}`);

      } catch (e) {
         console.warn("登录后页面处理异常:", e);
         // 检查是否有错误提示
         const errorMsg = await page.locator('.error-message, .toast').textContent().catch(() => null);
         if (errorMsg) {
             throw new Error(`登录失败，页面提示: ${errorMsg}`);
         }
      }
      
      // 6. 获取 Cookie
      const cookies = await context.cookies();
      
      // 用户指定需要的 Cookie 名称列表（白名单）
      const requiredCookieNames = [
        "ecookie", "_ga", "HMACCOUNT", "MEIQIA_TRACK_ID", "MEIQIA_VISIT_ID", 
        "current_guest", "_gcl_au", "_fp", "Hm_lvt_e0dfc78949a2d7c553713cb5c573a486", 
        "_ga_CN0F80S6GL", "_gaf_fp", "rank-login-user", "rank-login-user-info", 
        "Sprite-X-Token", "ao_lo_to_n", "Hm_lpvt_e0dfc78949a2d7c553713cb5c573a486", 
        "JSESSIONID", "_ga_38NCVF2XST"
      ];

      // 过滤并格式化 Cookie
      const filteredCookies = cookies
        .filter(c => requiredCookieNames.includes(c.name)) // 只保留指定的
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
      
      console.log(`筛选后Cookie长度: ${filteredCookies.length}`);
      // console.log(`筛选后Cookie内容: ${filteredCookies}`); // 避免日志过长

      let finalCookieToSave = "";

      if (!filteredCookies) {
          console.warn("警告：筛选后Cookie为空！可能是Cookie名称不匹配或未登录成功。将尝试保存所有Cookie。");
          // 如果筛选后为空，兜底保存所有，防止完全不可用
          const allCookies = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
          finalCookieToSave = allCookies;
          
          // 再次检查是否至少包含关键的 session 或 user 信息
          if (allCookies.includes("rank-login-user") || allCookies.includes("JSESSIONID")) {
               console.log("使用全量Cookie兜底");
          } else {
               console.warn("获取到的Cookie可能无效");
          }
      } else {
          finalCookieToSave = filteredCookies;
      }
      
      // 7. 更新数据库
      let param = await this.baseSysParamRepo.findOne({
        where: { keyName: "sellersprite_cookie" },
      });

      if (param) {
          param.data = finalCookieToSave;
          await this.baseSysParamRepo.save(param);
      } else {
          await this.baseSysParamRepo.save({
              keyName: "sellersprite_cookie",
              name: "卖家精灵Cookie",
              data: finalCookieToSave,
              html: "{}",
              remark: "自动获取",
              status: 1
          });
      }

      // 更新内存中的 cookie
      this.sellerspriteCookie = finalCookieToSave;
      console.log("Cookie自动获取并保存成功");

      return finalCookieToSave;
    } catch (e) {
      console.error("自动获取 Cookie 失败:", e);
      throw new Error(`自动获取 Cookie 失败: ${e.message}`);
    } finally {
      // 保持浏览器打开 10 秒供用户观察
      console.log("操作结束，保持浏览器打开 10 秒供观察...");
      await new Promise(resolve => setTimeout(resolve, 10000));
      await browser.close();
    }
  }

  /**
   * 获取通用请求头（模拟真实浏览器）
   */
  private getCommonHeaders(referer = ""): Record<string, string> {
    return {
      accept: "application/json, text/plain, */*",
      "accept-language": "zh-CN,zh;q=0.9,zh-TW;q=0.8",
      "cache-control": "no-cache",
      "content-type": "application/json;charset=UTF-8",
      cookie: this.sellerspriteCookie,
      origin: "https://www.sellersprite.com",
      pragma: "no-cache",
      referer: referer || "https://www.sellersprite.com",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
      "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    };
  }

  /**
   * 按「市场+ASIN」分组去重
   */
  private groupByMarketAndAsin(competitorList: any[]): {
    uniqueGroups: Record<string, typeof competitorList>;
    representativeItems: any[];
  } {
    const uniqueGroups: Record<string, typeof competitorList> = {};
    competitorList.forEach((item) => {
      const groupKey = `${item.marketplace}_${item.asin_competitor}`;
      uniqueGroups[groupKey] = uniqueGroups[groupKey] || [];
      uniqueGroups[groupKey].push(item);
    });

    const representativeItems = Object.values(uniqueGroups).map((group) => group[0]);
    console.log(`原始数据${competitorList.length}条，去重后唯一组合${representativeItems.length}条`);

    return { uniqueGroups, representativeItems };
  }

  private groupRepresentativesByMarketCode(representativeItems: any[]): Record<string, any[]> {
    const countryMap: Record<string, string> = {
      德国: "DE",
      英国: "UK",
      法国: "FR",
      西班牙: "ES",
      意大利: "IT",
    };

    const groupedByMarket: Record<string, any[]> = {};
    representativeItems.forEach((item) => {
      const marketCode = countryMap[item.marketplace] || "";
      if (!marketCode) {
        console.warn(`未知国家: ${item.marketplace}，跳过`);
        return;
      }
      groupedByMarket[marketCode] = groupedByMarket[marketCode] || [];
      groupedByMarket[marketCode].push({
        asin_competitor: item.asin_competitor,
        asin_candidate: item.asin_candidate,
        candidate_id: item.candidate_id,
        competitor_id: item.competitor_id,
        marketplace: item.marketplace,
        inventory_status: item.inventory_status,
      });
    });

    return groupedByMarket;
  }

  /**
   * 调用卖家精灵API（严格频率控制+无代理）
   */
  private async callApi(
    marketCode: string,
    asins: string[],
    page = 1,
    caller?: string
  ): Promise<any> {
    // 前置校验
    this.validateConfig();
    
    // 检查小时级休息
    await this.checkHourlyRest();
    
    // 检查每日请求量
    if (!this.checkDailyLimit()) {
      throw new Error("每日请求量已达上限");
    }

    // 频率控制：一分钟最多2次（间隔30秒）
    const now = Date.now();
    if (this.lastCallTime > 0) {
      const timeElapsed = now - this.lastCallTime;
      if (timeElapsed < this.MIN_INTERVAL_MS) {
        const waitTime = this.MIN_INTERVAL_MS - timeElapsed;
        console.log(`[频率控制] 需等待${waitTime/1000}秒，当前间隔${timeElapsed/1000}秒`);
        await this.sleep(waitTime);
      }
    }
    this.lastCallTime = Date.now();

    // 构造请求参数
    const requestData = {
      market: marketCode,
      monthName: "bsr_sales_nearly",
      asins,
      page: page,
      nodeIdPaths: [],
      symbolFlag: false,
      size: 60,
      order: { field: "amz_unit", desc: true },
      lowPrice: "N",
    };
    const encodedAsins = encodeURIComponent(JSON.stringify(asins));
    const headers = this.getCommonHeaders(
      `https://www.sellersprite.com/v3/competitor-lookup?market=${marketCode}&monthName=bsr_sales_nearly&asins=${encodedAsins}&page=${page}&nodeIdPaths=%5B%5D&symbolFlag=true&size=60&order%5Bfield%5D=amz_unit&order%5Bdesc%5D=true&lowPrice=N`
    );

    console.log(`[请求信息] 市场: ${marketCode}，页码: ${page}，ASIN数: ${asins.length}`);

    // API调用（无代理）
    let response;
    const RETRY_COUNT = 2;
    const RETRY_INTERVAL_MS = 5000;
    const callStartTime = Date.now();
    let responseCode: number | null = null;
    let isSuccess = 1;
    let errorMessage: string | null = null;

    for (let retry = 0; retry <= RETRY_COUNT; retry++) {
      try {
        response = await axios.post(
          "https://www.sellersprite.com/v3/api/competing-lookup",
          requestData,
          {
            headers,
            timeout: 15000 // 请求超时15秒
          }
        );
        responseCode = response.status;
        console.log(`[API响应] 状态码: ${response.status}，页码: ${page}`);
        console.log(`[API响应数据] total: ${response.data?.data?.total || 0}, items长度: ${response.data?.data?.items?.length || 0}`);
        break;
      } catch (err: any) {
        const errorMsg = err.response
          ? `状态码: ${err.response.status}，响应体: ${JSON.stringify(err.response.data)}`
          : err.message;
        if (retry >= RETRY_COUNT) {
          isSuccess = 0;
          errorMessage = errorMsg;
          throw new Error(`API调用失败（页码${page}，重试${RETRY_COUNT}次）: ${errorMsg}`);
        }
        console.warn(`[API重试] 页码${page}，第${retry + 1}次，错误: ${errorMsg}`);
        await this.sleep(RETRY_INTERVAL_MS);
      }
    }

    // 记录API调用日志
    const asinsSample = asins.slice(0, 5).join(', ');
    this.recordApiLog(
      '/v3/api/competing-lookup',
      'POST',
      asins.length,
      asinsSample,
      marketCode,
      callStartTime,
      responseCode,
      isSuccess,
      errorMessage,
      '竞品查询',
      caller
    ).catch(err => console.warn('记录API日志失败:', err));

    return response?.data;
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(asin: string, marketplace: string): string {
    const today = new Date().toISOString().split('T')[0];
    return `${asin}_${marketplace}_${today}`;
  }

  /**
   * 从缓存获取数据
   */
  private getCachedData(asin: string, marketplace: string): any | null {
    const key = this.getCacheKey(asin, marketplace);
    const cached = this.competitorCache.get(key);
    if (cached && cached.expireTime > Date.now()) {
      console.log(`[缓存命中] ASIN: ${asin}, 市场: ${marketplace}`);
      return cached.data;
    }
    return null;
  }

  /**
   * 设置缓存数据
   */
  private setCachedData(asin: string, marketplace: string, data: any): void {
    const key = this.getCacheKey(asin, marketplace);
    this.competitorCache.set(key, {
      data,
      expireTime: Date.now() + this.CACHE_TTL_MS
    });
  }

  /**
   * 批量获取缓存数据，返回需要查询的ASIN列表
   */
  private async getUniqueAsinsWithCache(asins: string[], marketplace: string): Promise<{
    cached: Map<string, any>;
    needFetch: string[];
  }> {
    const cached = new Map<string, any>();
    const needFetch: string[] = [];

    for (const asin of asins) {
      const cachedData = this.getCachedData(asin, marketplace);
      if (cachedData) {
        cached.set(asin, cachedData);
      } else {
        needFetch.push(asin);
      }
    }

    console.log(`[缓存统计] 市场: ${marketplace}, 总计: ${asins.length}, 缓存命中: ${cached.size}, 需要查询: ${needFetch.length}`);
    return { cached, needFetch };
  }

  /**

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, value] of this.competitorCache.entries()) {
      if (value.expireTime < now) {
        this.competitorCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[缓存清理] 清理了${cleanedCount}条过期缓存`);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    total: number;
    valid: number;
    expired: number;
    keys: string[];
  } {
    const now = Date.now();
    let valid = 0;
    let expired = 0;
    const keys: string[] = [];

    for (const [key, value] of this.competitorCache.entries()) {
      keys.push(key);
      if (value.expireTime > now) {
        valid++;
      } else {
        expired++;
      }
    }

    return {
      total: this.competitorCache.size,
      valid,
      expired,
      keys
    };
  }

  /**
   * 清空所有缓存
   */
  clearCache(): void {
    const count = this.competitorCache.size;
    this.competitorCache.clear();
    console.log(`[缓存清空] 清空了${count}条缓存`);
  }

  /**
   * 记录卖家精灵API调用日志
   */
  private async recordApiLog(
    apiPath: string,
    httpMethod: string,
    asinCount: number,
    asinsSample: string,
    country: string,
    callStartTime: number,
    responseCode: number | null,
    isSuccess: number,
    errorMessage: string | null,
    callLocation: string,
    apiCallerParam?: string
  ) {
    try {
      const durationMs = Date.now() - callStartTime;
      // 解析caller: "中文名称 | 入口方法名" → caller=中文, call_location=入口方法 > API调用位置
      const [displayCaller, codeEntry] = (apiCallerParam || 'SellerspriteTool').split(' | ');
      const fullCallLocation = codeEntry ? `${codeEntry} > ${callLocation}` : `${displayCaller} > ${callLocation}`;
      const log = this.sellerspriteApiLogRepo.create({
        call_date: dayjs().format('YYYY-MM-DD'),
        api_path: apiPath,
        http_method: httpMethod,
        asin_count: asinCount,
        asins_sample: asinsSample,
        country,
        credit_count: 1, // 每次API调用计1次
        response_code: responseCode,
        duration_ms: durationMs,
        is_success: isSuccess,
        error_message: errorMessage,
        caller: displayCaller,
        call_location: fullCallLocation
      });
      await this.sellerspriteApiLogRepo.save(log);
    } catch (logErr) {
      console.warn(`[卖家精灵] API日志记录失败: ${logErr?.message || logErr}`);
    }
  }

  /**
   * 批量更新竞品数据
   */
  private async updateCompetitorData(
    apiItem: any,
    duplicateItems: any[]
  ): Promise<number> {
    let updatedCount = 0;
    for (const duplicateItem of duplicateItems) {
      try {
        let competitorEntity = await this.bsrCandidateCompetitorRepo.findOne({
          where: { id: duplicateItem.competitor_id },
        });
        if (!competitorEntity) {
          competitorEntity = new AppAmzBsrCandidateCompetitorEntity();
          competitorEntity.asin_candidate = duplicateItem.asin_candidate;
          competitorEntity.asin_competitor = duplicateItem.asin_competitor;
          competitorEntity.candidate_id = duplicateItem.candidate_id;
          competitorEntity.marketplace = duplicateItem.marketplace;
        }

        // 配送方/销售方逻辑
        const subcategory = apiItem.subcategories?.[0] || {};
        const sellerName = apiItem.sellerName || "";
        const sellerType = apiItem.sellerType || "";

        let dispatches_from: string;
        if (sellerName.toLowerCase().includes("amazon")) {
          dispatches_from = "Amazon";
        } else if (sellerType === "FBA") {
          dispatches_from = "Amazon";
        } else if (sellerType === "FBM") {
          dispatches_from = sellerName;
        } else {
          dispatches_from = sellerName;
        }
        const sold_by = sellerName;

        // 配送类型
        let dispatches_type = "0";
        if (apiItem.sellerType === "FBA") dispatches_type = "1";
        else if (apiItem.sellerType === "FBM") dispatches_type = "2";
        else if (apiItem.sellerType === "AMZ") dispatches_type = "0";
        if (apiItem.item_name === null || apiItem.item_name === "")
          dispatches_type = "5";
        if (!apiItem.sellerType && apiItem.item_name) dispatches_type = "3";

        // 库存逻辑
        if (parseInt(competitorEntity.stock_quantity || "0") >= 999) {
          if (
            parseInt(competitorEntity.stock_quantity || "0") <
            (apiItem.Main_monthly_sales || 0)
          ) {
            competitorEntity.stock_quantity = apiItem.Main_monthly_sales;
          }
        }

        // 字段赋值
        competitorEntity.item_name = apiItem.title;
        competitorEntity.price = apiItem.price?.toString() || "";
        competitorEntity.review_num = apiItem.reviews || null;
        competitorEntity.last_star = apiItem.rating || null;
        competitorEntity.dispatches_from = dispatches_from;
        competitorEntity.sold_by = sold_by;
        competitorEntity.dispatches_type = dispatches_type || "";
        competitorEntity.bsr_category = apiItem.bsrLabel || "";
        competitorEntity.bsr_rank = apiItem.bsrRank || 0;
        competitorEntity.bsr_node = subcategory.label || "";
        competitorEntity.bsr_node_rank = subcategory.rank || 0;
        competitorEntity.bsr_node_id = subcategory.code || "";
        competitorEntity.date_first_available = apiItem.availableDate
          ? new Date(apiItem.availableDate)
          : null;
        competitorEntity.Main_monthly_sales = Number(apiItem.totalUnits) || 0;
        competitorEntity.Main_monthly_sales_sub = apiItem.amzUnit?.toString() || "";
        competitorEntity.variants = apiItem.variations || 0;
        competitorEntity.FBA_price = apiItem.fba || null;
        competitorEntity.dimensions = apiItem.dimensions || "";
        competitorEntity.weight = apiItem.weight || "";
        competitorEntity.parent_asin = apiItem.parent || "";
        
        // 新增字段映射
        competitorEntity.revenue = apiItem.revenue || null;
        competitorEntity.amz_sales = apiItem.amzSales || null;
        competitorEntity.units_gr = apiItem.unitsGr || null;
        competitorEntity.prime_price = apiItem.primePrice || null;
        competitorEntity.delivery_price = apiItem.deliveryPrice || null;
        competitorEntity.profit_rate = apiItem.profit || null;
        competitorEntity.bsr_cr = apiItem.bsrCr || null;
        competitorEntity.bsr_cv = apiItem.bsrCv || null;
        competitorEntity.ratings_rate = apiItem.ratingsRate || null;
        competitorEntity.ratings_cv = apiItem.ratingsCv || null;
        competitorEntity.rating_delta = apiItem.ratingDelta || null;
        competitorEntity.badge_info = apiItem.badge || null;
        competitorEntity.symbol = apiItem.symbol || "";
        competitorEntity.lqs = apiItem.lqs || null;
        competitorEntity.pkg_dimensions = apiItem.pkgDimensions || "";
        competitorEntity.pkg_weight = apiItem.pkgWeight || "";
        competitorEntity.dimensions_type = apiItem.dimensionsType || "";
        competitorEntity.pkg_dimension_type = apiItem.pkgDimensionType || "";
        competitorEntity.brand = apiItem.brand || "";
        competitorEntity.brand_url = apiItem.brandUrl || "";
        competitorEntity.sellers = apiItem.sellers || null;
        competitorEntity.seller_nation = apiItem.sellerNation || "";
        competitorEntity.node_id_path = apiItem.nodeIdPath || "";
        if (apiItem.amzUnitDate) {
            competitorEntity.amz_unit_date = new Date(apiItem.amzUnitDate);
        }
        competitorEntity.sku_info = apiItem.sku || null;

        competitorEntity.date_first_available = apiItem.availableDate ? new Date(apiItem.availableDate) : null;
        const formattedSalesData = this.convertSalesTrend(apiItem.trends || []);
        competitorEntity.sales_volume_data = (formattedSalesData.length > 0
          ? JSON.stringify(formattedSalesData)
          : "[]") as any;
        competitorEntity.expected_volume = competitorEntity.Main_monthly_sales / 30;

        if (competitorEntity.inventory_type === "XIAN") {
          competitorEntity.stock_quantity = apiItem.totalUnits || 0;
        }
        if (duplicateItem.inventory_status === "5") {
          if (dispatches_type != "0" && dispatches_type != "0") {
            competitorEntity.inventory_status = duplicateItem.inventory_status;
          }
        }
        await this.bsrCandidateCompetitorRepo.save(competitorEntity);
        updatedCount++;
      } catch (saveError) {
        console.error(`【保存失败】ASIN: ${duplicateItem.asin_competitor}，错误: ${(saveError as Error).message}`);
      }
    }
    return updatedCount;
  }

  /**
   * 通用方法：查询数据 → 调用卖家精灵API → 保存数据
   */
  /**
   * 使用 OpenApi 获取并保存竞品数据 (替代网页抓取)
   */
  async fetchAndSaveByOpenApi(querySQL: string, taskId?: number, caller?: string): Promise<any> {
    try {
      await this.init();
      
      const competitorList = await this.bsrCandidateCompetitorRepo.query(querySQL);
      console.log(`[OpenApi] 待处理数据: ${competitorList.length}`);
      
      const totalCount = competitorList.length;
      let completedCount = 0;

      if (taskId) {
        await this.updateTaskProgress(taskId, completedCount, totalCount, `开始处理，总计${totalCount}条数据`);
      }

      if (totalCount === 0) {
        if (taskId) {
          await this.updateTaskProgress(taskId, 0, 0, "无待处理数据，任务完成");
          const task = await this.taskManagementRepo.findOne({ where: { id: taskId } });
          if (task) {
            task.taskStatus = TASK_STATUSES.FINISHED;
            task.executeEndTime = new Date();
            await this.taskManagementRepo.save(task);
          }
        }
        return { success: false, message: "没有符合条件的数据" };
      }

      // 按市场分组提取竞品 ASIN
      const marketAsinMap = new Map<string, Set<string>>();
      for (const comp of competitorList) {
        if (!comp.asin_competitor || !comp.marketplace) continue;
        const market = comp.marketplace;
        if (!marketAsinMap.has(market)) marketAsinMap.set(market, new Set());
        marketAsinMap.get(market).add(comp.asin_competitor);
      }

      const results = [];
      let totalUniqueAsins = 0;
      for (const asinSet of marketAsinMap.values()) {
        totalUniqueAsins += asinSet.size;
      }
      let processedUniqueAsins = 0;

      for (const [marketplace, asinSet] of marketAsinMap) {
        const asins = Array.from(asinSet);
        console.log(`[OpenApi] 正在处理市场 ${marketplace}, 竞品数量: ${asins.length}`);

        try {
          console.log(`[OpenApi] 市场 ${marketplace}: 竞品数量: ${asins.length}`);

          const result = await this.competitorLookupOpenApi({
            marketplace: marketplace,
            asins: asins,
            caller: caller || '通用-API获取竞品 | fetchAndSaveByOpenApi'
          });

          results.push({
            ...result,
            marketplace,
          });

          processedUniqueAsins += asins.length;
          if (taskId) {
            const estimatedProgress = Math.floor((processedUniqueAsins / totalUniqueAsins) * totalCount);
            await this.updateTaskProgress(taskId, Math.min(estimatedProgress, totalCount), totalCount, `正在处理市场 ${marketplace}`);
          }
        } catch (error) {
          console.error(`[OpenApi] 处理市场 ${marketplace} 失败:`, error);
          results.push({ marketplace, success: false, error: (error as Error).message });
        }
      }

      if (taskId) {
        const finalResult = `任务完成：处理了 ${marketAsinMap.size} 个市场的数据`;
        await this.updateTaskProgress(taskId, totalCount, totalCount, finalResult);
        const task = await this.taskManagementRepo.findOne({ where: { id: taskId } });
        if (task) {
          task.taskStatus = TASK_STATUSES.FINISHED;
          task.executeEndTime = new Date();
          task.completedCount = totalCount;
          await this.taskManagementRepo.save(task);
        }
      }

      return { success: true, results, message: "OpenAPI 批量处理完成" };
    } catch (error) {
      console.error("[OpenApi] fetchAndSaveByOpenApi 异常:", error);

      if (taskId) {
        await this.updateTaskProgress(taskId, 0, 0, `任务执行失败：${(error as Error).message}`);
        const task = await this.taskManagementRepo.findOne({ where: { id: taskId } });
        if (task) {
          task.taskStatus = TASK_STATUSES.FAILED;
          task.executeEndTime = new Date();
          await this.taskManagementRepo.save(task);
        }
      }

      return { success: false, message: (error as Error).message };
    }
  }

  async fetchAndSave(querySQL: string, taskId?: number): Promise<any> {
    try {
      await this.init();
      this.validateConfig();

      // 执行查询
      const competitorList = await this.bsrCandidateCompetitorRepo.query(querySQL);
      console.log(`待处理数据: ${competitorList.length}`);
      const originalAsinList = competitorList.map(item => item.asin_competitor).filter(Boolean);
      console.log(`【1. 原始未过滤的asin_competitor列表】: 数量: ${originalAsinList.length}`);

      const totalCount = competitorList.length;
      let completedCount = 0;

      // 更新任务初始状态
      if (taskId) {
        await this.updateTaskProgress(taskId, completedCount, totalCount, `开始处理，总计${totalCount}条数据`);
      }

      if (totalCount === 0) {
        if (taskId) {
          await this.updateTaskProgress(taskId, 0, 0, "无待处理数据，任务完成");
          const task = await this.taskManagementRepo.findOne({ where: { id: taskId } });
          if (task) {
            task.taskStatus = TASK_STATUSES.FINISHED;
            task.executeEndTime = new Date();
            await this.taskManagementRepo.save(task);
          }
        }
        return { success: false, message: "没有符合条件的数据" };
      }

      // 分组去重
      const { uniqueGroups, representativeItems } = this.groupByMarketAndAsin(competitorList);
      const deduplicatedAsinList = representativeItems.map(item => item.asin_competitor).filter(Boolean);
      console.log(`【2. 按市场+ASIN去重后的asin_competitor列表】: 数量: ${deduplicatedAsinList.length}`);

      if (representativeItems.length === 0) {
        if (taskId) {
          await this.updateTaskProgress(taskId, 0, totalCount, "去重后无有效数据，任务完成");
          const task = await this.taskManagementRepo.findOne({ where: { id: taskId } });
          if (task) {
            task.taskStatus = TASK_STATUSES.FINISHED;
            task.executeEndTime = new Date();
            await this.taskManagementRepo.save(task);
          }
        }
        return { success: false, message: "去重后无有效数据" };
      }

      // 按市场编码分组
      const groupedByMarket = this.groupRepresentativesByMarketCode(representativeItems);

      // 初始化统计
      const resultStats = {
        total: totalCount,
        success: 0,
        failed: 0,
        failedList: [] as Array<{ asin: string; market: string; error: string }>,
      };

      // 每处理5个批次穿插一次模拟浏览
      let batchCount = 0;
      const BATCH_BROWSING_INTERVAL = 5;

      // 处理每个市场的批次数据
      for (const [marketCode, representativeBatchItems] of Object.entries(groupedByMarket)) {
        console.log(`处理国家: ${marketCode}，代表记录数: ${representativeBatchItems.length}`);
        const batchSize = 60;

        for (let i = 0; i < representativeBatchItems.length; i += batchSize) {
          // 每5个批次模拟一次正常浏览
          batchCount++;
          if (batchCount % BATCH_BROWSING_INTERVAL === 0) {
            await this.mockNormalBrowsing();
          }

          const batchRepresentatives = representativeBatchItems.slice(i, i + batchSize);
          const asins = batchRepresentatives.map((item) => item.asin_competitor);

          try {
            // 分页获取所有数据
            let currentPage = 1;
            let allApiItems: any[] = [];
            while (true) {
              const responseData = await this.callApi(marketCode, asins, currentPage, '选品-网页抓取竞品 | fetchAndSave');
              const isResponseSuccess = responseData.code === "OK" || responseData.success === true;

              if (!isResponseSuccess || !responseData.data?.items) {
                break;
              }

              // 收集当前页items
              const currentItems = responseData.data.items;
              allApiItems = [...allApiItems, ...currentItems];

              // 判断是否还有下一页
              const total = responseData.data.total || 0;
              const totalPages = Math.ceil(total / 60);
              if (currentPage >= totalPages) {
                break;
              }
              currentPage++;
              // 翻页间隔10秒
              console.log(`[翻页控制] 等待10秒后获取下一页数据`);
              await this.sleep(this.PAGE_INTERVAL_MS);
            }

            // 处理所有分页的items
            if (allApiItems.length > 0) {
              console.log(`批次处理：所有分页items总数: ${allApiItems.length}`);

              for (const apiItem of allApiItems) {
                const matchedRepresentative = batchRepresentatives.find(
                  (item) => item.asin_competitor.toLowerCase() === apiItem.asin.toLowerCase()
                );

                if (!matchedRepresentative) continue;

                const groupKey = `${matchedRepresentative.marketplace}_${matchedRepresentative.asin_competitor}`;
                console.log(`处理数据 ASIN: ${matchedRepresentative.marketplace}_${matchedRepresentative.asin_competitor}`);

                const duplicateItems = uniqueGroups[groupKey];
                if (!duplicateItems) {
                  console.warn(`未找到重复项，groupKey: ${groupKey}`);
                  continue;
                }

                const updatedCount = await this.updateCompetitorData(apiItem, duplicateItems);
                resultStats.success += updatedCount;
                completedCount += updatedCount;

                if (taskId) {
                  await this.updateTaskProgress(taskId, completedCount, totalCount);
                }
              }
            }
          } catch (error) {
            const errorMsg = (error as Error).message;
            const failedCount = batchRepresentatives.reduce(
              (sum, item) => sum + uniqueGroups[`${item.marketplace}_${item.asin_competitor}`].length,
              0
            );
            resultStats.failed += failedCount;
            resultStats.failedList.push(
              ...batchRepresentatives.map((item) => ({
                asin: item.asin_competitor,
                market: marketCode,
                error: errorMsg,
              }))
            );
            console.error(`处理批次失败: ${errorMsg}`);

            completedCount += failedCount;
            if (taskId) {
              await this.updateTaskProgress(taskId, completedCount, totalCount, `处理批次失败: ${errorMsg}`);
            }
          }
        }
      }

      // 任务完成
      console.log(`处理完成：总计${resultStats.total}条，成功${resultStats.success}条，失败${resultStats.failed}条`);
      if (taskId) {
        const finalResult = `任务完成：总计${resultStats.total}条，成功${resultStats.success}条，失败${resultStats.failed}条`;
        await this.updateTaskProgress(taskId, completedCount, totalCount, finalResult);
        const task = await this.taskManagementRepo.findOne({ where: { id: taskId } });
        if (task) {
          task.taskStatus = TASK_STATUSES.FINISHED;
          task.executeEndTime = new Date();
          task.completedCount = completedCount;
          await this.taskManagementRepo.save(task);
        }
      }

      return {
        success: true,
        stats: resultStats,
        message: `总计${resultStats.total}条，成功${resultStats.success}条，失败${resultStats.failed}条`,
      };
    } catch (error) {
      console.error("fetchAndSave异常:", error);

      if (taskId) {
        await this.updateTaskProgress(taskId, 0, 0, `任务执行失败：${(error as Error).message}`);
        const task = await this.taskManagementRepo.findOne({ where: { id: taskId } });
        if (task) {
          task.taskStatus = TASK_STATUSES.FAILED;
          task.executeEndTime = new Date();
          await this.taskManagementRepo.save(task);
        }
      }

      return { success: false, message: (error as Error).message };
    }
  }

  /**
   * 转换销量趋势数据
   * Modified 2026-02-06: Support both old (dk/sales) and new (month/searches) data formats
   */
  private convertSalesTrend(apiTrends: Array<any>): Array<{ date: number; searches: number }> {
    const trendMap = new Map<string, number>();
    apiTrends.forEach(item => {
      // Handle old format: dk/sales
      if (item.dk && /^\d{6}$/.test(item.dk)) {
        trendMap.set(item.dk, item.sales || 0);
      }
      // Handle new format: month/searches
      else if (item.month && /^\d{6}$/.test(item.month)) {
        trendMap.set(item.month, item.searches || 0);
      }
    });

    const getRecent13Months = (): string[] => {
      const months: string[] = [];
      const now = new Date();
      let year = now.getFullYear();
      let month = now.getMonth() + 2; // Start from next month
      if (month > 12) {
        month -= 12;
        year++;
      }

      for (let i = 0; i < 12; i++) { // Get 12 months
        const monthStr = month.toString().padStart(2, '0');
        months.push(`${year}${monthStr}`);
        month--;
        if (month < 1) {
          month = 12;
          year--;
        }
      }
      return months.reverse();
    };

    const recentMonths = getRecent13Months();
    return recentMonths.map(ym => ({
      date: parseInt(`${ym}01`, 10),
      searches: trendMap.get(ym) || 0
    }));
  }

  /**
   * 更新任务进度
   */
  private async updateTaskProgress(
    taskId: number,
    completedCount: number,
    totalCount: number,
    executeResult?: string
  ) {
    if (!taskId) return;

    try {
      const task = await this.taskManagementRepo.findOne({
        where: { id: taskId },
      });

      if (!task) return;

      task.completedCount = completedCount;
      task.executeResult = executeResult || `处理中：${completedCount}/${totalCount}条数据`;
      task.taskStatus = TASK_STATUSES.RUNNING;

      await this.taskManagementRepo.save(task);
      console.log(`[任务进度更新] 任务ID: ${taskId}，已完成: ${completedCount}/${totalCount}`);
    } catch (error) {
      console.error(`[任务进度更新失败] 任务ID: ${taskId}，错误: ${(error as Error).message}`);
    }
  }

  // 国家编码映射
  private readonly countryToMarketNumMap: Record<string, number> = {
    '英国': 3,
    '德国': 4,
    '法国': 5,
    '意大利': 6,
    '西班牙': 7
  };

  private readonly marketNumToCountryMap: Record<number, string> = {
    3: '英国',
    4: '德国',
    5: '法国',
    6: '意大利',
    7: '西班牙'
  };

  /**
   * 调用卖家精灵ASIN关键词接口（无代理+风控）
   */
  private async callAsinKeywordApi(
    marketNum: number,
    asinList: string[],
    page = 1,
    size = 100,
    caller?: string
  ): Promise<AsinKeywordResponse> {
    this.validateConfig();
    await this.checkHourlyRest();
    
    if (!this.checkDailyLimit()) {
      throw new Error("每日请求量已达上限");
    }

    // 频率控制：一分钟最多2次
    const now = Date.now();
    if (this.lastCallTime > 0) {
      const timeElapsed = now - this.lastCallTime;
      if (timeElapsed < this.MIN_INTERVAL_MS) {
        const waitTime = this.MIN_INTERVAL_MS - timeElapsed;
        console.log(`[关键词接口-频率控制] 需等待${waitTime/1000}秒`);
        await this.sleep(waitTime);
      }
    }
    this.lastCallTime = Date.now();

    // 构造请求
    const payload = {
      queryVariations: true,
      asinList: asinList,
      originAsinList: asinList,
      market: marketNum,
      page: page,
      month: "",
      size: size,
      orderColumn: 12,
      desc: true,
      exactly: false,
      ac: false,
      filterDeletedKeywords: false,
      keywordBidMatchType: "exact"
    };

    const encodedAsins = encodeURIComponent(JSON.stringify(asinList));
    const headers = this.getCommonHeaders(
      `https://www.sellersprite.com/v3/traffic/extend/asin?q=${encodedAsins}&marketId=${marketNum}&date=`
    );

    console.log(`[关键词接口-请求信息] 市场编码: ${marketNum}，页码: ${page}，ASIN数: ${asinList.length}`);

    // 调用API（无代理）
    let response;
    const RETRY_COUNT = 2;
    const RETRY_INTERVAL_MS = 5000;
    const callStartTime = Date.now();
    let responseCode: number | null = null;
    let isSuccess = 1;
    let errorMessage: string | null = null;
    const countryName = this.marketNumToCountryMap[marketNum] || '未知';

    for (let retry = 0; retry <= RETRY_COUNT; retry++) {
      try {
        response = await axios.post<AsinKeywordResponse>(
          "https://www.sellersprite.com/v3/api/traffic/extend/asin",
          payload,
          {
            headers,
            timeout: 15000
          }
        );
        responseCode = response.status;
        console.log(`[关键词接口-响应] 状态码: ${response.status}，页码: ${page}`);
        break;
      } catch (err: any) {
        const errorMsg = err.response
          ? `状态码: ${err.response.status}，响应体: ${JSON.stringify(err.response.data)}`
          : err.message;
        if (retry >= RETRY_COUNT) {
          isSuccess = 0;
          errorMessage = errorMsg;
          throw new Error(`关键词API调用失败（页码${page}，重试${RETRY_COUNT}次）: ${errorMsg}`);
        }
        console.warn(`[关键词接口-重试] 页码${page}，第${retry + 1}次，错误: ${errorMsg}`);
        await this.sleep(RETRY_INTERVAL_MS);
      }
    }

    // 记录API调用日志
    const asinsSample = asinList.slice(0, 5).join(', ');
    this.recordApiLog(
      '/v3/api/traffic/extend/asin',
      'POST',
      asinList.length,
      asinsSample,
      countryName,
      callStartTime,
      responseCode,
      isSuccess,
      errorMessage,
      'ASIN关键词查询',
      caller
    ).catch(err => console.warn('记录API日志失败:', err));

    return response?.data || null;
  }

  /**
   * 批量获取ASIN关键词并保存 (按产品代码)
   */
  async fetchAndSaveAsinKeywordsByProductCode(
    product_code: string,
    marketplace: string,
    taskId?: number,
    statusList: number[] = [6]
  ): Promise<any> {
    try {
      await this.init();
      // 检查登录状态并按需自动登录
      await this.checkAndRefreshCookie();
      this.validateConfig();

      const requiredCountries = ['英国', '德国', '法国', '西班牙', '意大利'];
      const sql = `
        WITH candidate_asins AS (
            SELECT DISTINCT asin, marketplace, item_name, msku AS sku
            FROM app_amz_bsr_product_listing_lingxing
            WHERE product_code = ? AND marketplace = ?
        ),
        ranked_competitors AS (
            SELECT 
                NULL AS candidate_id,
                c.asin AS asin_candidate,
                c.sku,
                c.marketplace AS candidate_marketplace,
                c.item_name AS candidate_item_name,
                comp.marketplace,  
                comp.asin_competitor,
                comp.item_name AS competitor_item_name,
                comp.Main_monthly_sales,
                ROW_NUMBER() OVER (
                    PARTITION BY c.asin, comp.marketplace 
                    ORDER BY 
                        CASE 
                            WHEN CAST(IF(comp.Main_monthly_sales = '', '0', comp.Main_monthly_sales) AS UNSIGNED) > 0 
                                THEN 0  
                            ELSE 1
                        END,
                        CAST(IF(comp.Main_monthly_sales = '', '0', comp.Main_monthly_sales) AS UNSIGNED) DESC,
                        CASE 
                            WHEN comp.bsr_rank = '' OR comp.bsr_rank = '0' THEN 999999999  
                            ELSE CAST(REPLACE(comp.bsr_rank, ',', '') AS UNSIGNED)
                        END,
                        CASE comp.dispatches_type
                            WHEN '1' THEN 1  
                            WHEN '0' THEN 2  
                            WHEN '2' THEN 3  
                            ELSE 4          
                        END
                ) AS row_num
            FROM candidate_asins c
            LEFT JOIN app_amz_bsr_candidate_competitor comp 
                ON comp.asin_candidate = c.asin
                AND comp.status IN (${statusList.join(',')})
                AND comp.marketplace IN ('${requiredCountries.join("','")}')
        )
        SELECT 
            candidate_id,
            asin_candidate,
            sku,
            candidate_marketplace,
            candidate_item_name,
            marketplace,  
            asin_competitor,
            competitor_item_name,
            Main_monthly_sales,
            row_num
        FROM ranked_competitors
        WHERE row_num <= 20
      `;
      const competitorQueryResult = await this.bsrCandidateCompetitorRepo.query(sql, [product_code, marketplace]);
      if (competitorQueryResult.length === 0) {
        const msg = "所选候选产品在核心市场下均无有效竞品数据";
        if (taskId) await this.updateTaskProgress(taskId, 0, 0, msg);
        if (taskId) {
          const task = await this.taskManagementRepo.findOne({ where: { id: taskId } });
          if (task) {
            task.taskStatus = TASK_STATUSES.FINISHED;
            task.executeEndTime = new Date();
            await this.taskManagementRepo.save(task);
          }
        }
        return { success: false, message: msg };
      }

      return await this.processCompetitorDataAndFetchKeywords(competitorQueryResult, taskId);

    } catch (error) {
      console.error(`[fetchAndSaveAsinKeywordsByProductCode-全局异常]`, error);
      if (taskId) {
        const errMsg = `关键词获取任务异常：${(error as Error).message}`;
        await this.updateTaskProgress(taskId, 0, 0, errMsg);
        const task = await this.taskManagementRepo.findOne({ where: { id: taskId } });
        if (task) {
          task.taskStatus = TASK_STATUSES.FAILED;
          task.executeEndTime = new Date();
          await this.taskManagementRepo.save(task);
        }
      }
      return {
        success: false,
        message: `关键词获取失败：${(error as Error).message}`
      };
    }
  }

  /**
   * 批量获取ASIN关键词并保存
   */
  async fetchAndSaveAsinKeywords(
    candidateIds: number[],
    taskId?: number,
    statusList: number[] = [1, 2]
  ): Promise<any> {
    try {
      await this.init();
      // 检查登录状态并按需自动登录
      await this.checkAndRefreshCookie();
      this.validateConfig();

      // 标题处理函数
      const processTitle = (title: string): string => {
        if (!title) return '';
        let cleanedTitle = title
          .replace(/,/g, '')
          .replace(/&/g, '')
          .replace(/–/g, '')
          .replace(/-/g, '')
          .replace(/\./g, '')
          .replace(/"/g, '')
          .replace(/\|/g, '')
          .replace(/\s+/g, ' ');
        const words = cleanedTitle.split(' ').filter(word => word.length > 0);
        if (words.length > 7) {
          words.splice(0, 1);
          return words.slice(0, 6).join(' ');
        } else if (words.length > 1) {
          words.splice(0, 1);
          return words.join(' ');
        } else {
          return cleanedTitle;
        }
      };

      // 查询竞品数据
      const requiredCountries = ['英国', '德国', '法国', '西班牙', '意大利'];
      const sql = `
        WITH ranked_competitors AS (
            SELECT 
                c.id AS candidate_id,
                c.asin AS asin_candidate,
                c.sku,
                c.marketplace AS candidate_marketplace,
                c.item_name AS candidate_item_name,
                comp.marketplace,  
                comp.asin_competitor,
                comp.item_name AS competitor_item_name,
                comp.Main_monthly_sales,
                ROW_NUMBER() OVER (
                    PARTITION BY c.id, c.asin, comp.marketplace 
                    ORDER BY 
                        CASE 
                            WHEN CAST(IF(comp.Main_monthly_sales = '', '0', comp.Main_monthly_sales) AS UNSIGNED) > 0 
                                THEN 0  
                            ELSE 1
                        END,
                        CAST(IF(comp.Main_monthly_sales = '', '0', comp.Main_monthly_sales) AS UNSIGNED) DESC,
                        CASE 
                            WHEN comp.bsr_rank = '' OR comp.bsr_rank = '0' THEN 999999999  
                            ELSE CAST(REPLACE(comp.bsr_rank, ',', '') AS UNSIGNED)
                        END,
                        CASE comp.dispatches_type
                            WHEN '1' THEN 1  
                            WHEN '0' THEN 2  
                            WHEN '2' THEN 3  
                            ELSE 4          
                        END
                ) AS row_num
            FROM app_amz_bsr_candidate c
            LEFT JOIN app_amz_bsr_candidate_competitor comp 
                ON comp.candidate_id = c.id 
                AND comp.asin_candidate = c.asin
                AND comp.status IN (${statusList.join(',')})
                AND comp.marketplace IN ('${requiredCountries.join("','")}')
            WHERE c.id IN (${candidateIds.map(() => '?').join(',')})
        )
        SELECT 
            candidate_id,
            asin_candidate,
            sku,
            candidate_marketplace,
            candidate_item_name,
            marketplace,  
            asin_competitor,
            competitor_item_name,
            Main_monthly_sales,
            row_num
        FROM ranked_competitors
        WHERE row_num <= 20
      `;
      const competitorQueryResult = await this.bsrCandidateCompetitorRepo.query(sql, candidateIds);
      if (competitorQueryResult.length === 0) {
        const msg = "所选候选产品在核心市场下均无有效竞品数据";
        if (taskId) await this.updateTaskProgress(taskId, 0, 0, msg);
        if (taskId) {
          const task = await this.taskManagementRepo.findOne({ where: { id: taskId } });
          if (task) {
            task.taskStatus = TASK_STATUSES.FINISHED;
            task.executeEndTime = new Date();
            await this.taskManagementRepo.save(task);
          }
        }
        return { success: false, message: msg };
      }

      return await this.processCompetitorDataAndFetchKeywords(competitorQueryResult, taskId);

    } catch (error) {
      console.error(`[fetchAndSaveAsinKeywords-全局异常]`, error);
      if (taskId) {
        const errMsg = `关键词获取任务异常：${(error as Error).message}`;
        await this.updateTaskProgress(taskId, 0, 0, errMsg);
        const task = await this.taskManagementRepo.findOne({ where: { id: taskId } });
        if (task) {
          task.taskStatus = TASK_STATUSES.FAILED;
          task.executeEndTime = new Date();
          await this.taskManagementRepo.save(task);
        }
      }
      return {
        success: false,
        message: `关键词获取失败：${(error as Error).message}`
      };
    }
  }

  private async processCompetitorDataAndFetchKeywords(
    competitorQueryResult: any[],
    taskId?: number
  ): Promise<any> {
    // 标题处理函数
    const processTitle = (title: string): string => {
      if (!title) return '';
      let cleanedTitle = title
        .replace(/,/g, '')
        .replace(/&/g, '')
        .replace(/–/g, '')
        .replace(/-/g, '')
        .replace(/\./g, '')
        .replace(/"/g, '')
        .replace(/\|/g, '')
        .replace(/\s+/g, ' ');
      const words = cleanedTitle.split(' ').filter(word => word.length > 0);
      if (words.length > 7) {
        words.splice(0, 1);
        return words.slice(0, 6).join(' ');
      } else if (words.length > 1) {
        words.splice(0, 1);
        return words.join(' ');
      } else {
        return cleanedTitle;
      }
    };

    // 构建分组
    interface SrcAsinCountryGroup {
      candidateId: number | string;
      asinCandidate: string;
      productCode: string; // 新增 productCode
      sku: string;
      candidateMarketplace: string;
      competitorMarketplace: string;
      competitorAsinList: string[];
      usedTitle: string;
      marketNum: number;
    }

    const srcAsinCountryGroups: SrcAsinCountryGroup[] = [];
    const groupKeyMap = new Map<string, SrcAsinCountryGroup>();
    const candidateTitleMap = new Map<string, string>();

    for (const row of competitorQueryResult) {
      const groupKey = `${row.asin_candidate}_${row.marketplace}`;
      const candidateKey = row.candidate_id != null ? String(row.candidate_id) : row.asin_candidate;

      if (!candidateTitleMap.has(candidateKey)) {
        candidateTitleMap.set(candidateKey, processTitle(row.candidate_item_name));
      }
      const processedCandidateTitle = candidateTitleMap.get(candidateKey) || '';
      const processedCompetitorTitle = processTitle(row.competitor_item_name);

      if (!groupKeyMap.has(groupKey)) {
        const marketNum = this.countryToMarketNumMap[row.marketplace] || 0;
        if (marketNum === 0) continue;

        let usedTitle = processedCandidateTitle;
        if (row.marketplace !== row.candidate_marketplace) {
          usedTitle = processedCompetitorTitle || processedCandidateTitle;
        }

        groupKeyMap.set(groupKey, {
          candidateId: row.candidate_id != null ? row.candidate_id : row.asin_candidate,
          asinCandidate: row.asin_candidate,
          productCode: row.product_code || '', // 获取 product_code，如果没有则为空字符串
          sku: row.sku,
          candidateMarketplace: row.candidate_marketplace,
          competitorMarketplace: row.marketplace,
          competitorAsinList: [],
          usedTitle: usedTitle,
          marketNum: marketNum
        });
      }

      const group = groupKeyMap.get(groupKey)!;
      if (!group.competitorAsinList.includes(row.asin_competitor)) {
        group.competitorAsinList.push(row.asin_competitor);
      }
    }

    srcAsinCountryGroups.push(...Array.from(groupKeyMap.values()).filter(group => group.competitorAsinList.length > 0));
    if (srcAsinCountryGroups.length === 0) {
      const msg = "所选产品在核心市场下均无有效竞品ASIN列表";
      if (taskId) await this.updateTaskProgress(taskId, 0, 0, msg);
      if (taskId) {
        const task = await this.taskManagementRepo.findOne({ where: { id: taskId } });
        if (task) {
          task.taskStatus = TASK_STATUSES.FINISHED;
          task.executeEndTime = new Date();
          await this.taskManagementRepo.save(task);
        }
      }
      return { success: false, message: msg };
    }

    // 初始化统计
    const totalGroups = srcAsinCountryGroups.length;
    let completedCount = 0;
    const resultStats = {
      total: totalGroups,
      success: 0,
      failed: 0,
      failedList: [] as Array<{
        asinCandidate: string;
        market: string;
        competitorAsinList: string[];
        error: string;
      }>
    };

    if (taskId) {
      await this.updateTaskProgress(taskId, completedCount, totalGroups, `开始获取竞品关键词，总计${totalGroups}组源ASIN+国家`);
    }

    // 每处理3个分组穿插一次模拟浏览
    let groupCount = 0;
    const GROUP_BROWSING_INTERVAL = 3;

    // 处理分组
    const batchSize = 100;
    for (const group of srcAsinCountryGroups) {
      // 穿插模拟浏览
      groupCount++;
      if (groupCount % GROUP_BROWSING_INTERVAL === 0) {
        await this.mockNormalBrowsing();
      }

      const { asinCandidate, productCode, competitorMarketplace, competitorAsinList, usedTitle, marketNum } = group;
      const marketCn = this.marketNumToCountryMap[marketNum];

      try {
        let allKeywordItems: any[] = [];
        for (let i = 0; i < competitorAsinList.length; i += batchSize) {
          const batchCompetitorAsins = competitorAsinList.slice(i, i + batchSize);
          const uniqueBatchAsins = [...new Set(batchCompetitorAsins)];

          const responseData = await this.callAsinKeywordApi(marketNum, uniqueBatchAsins, 1, 100, '选品-获取ASIN关键词 | fetchAndSaveAsinKeywords');
          if (responseData && responseData.code === "OK" && responseData.data?.items) {
            // 获取全部关键词，不做 slice(0, 100) 截断
            allKeywordItems.push(...responseData.data.items);
          }
        }

        // 去重关键词
        const keywordMap = new Map<string, any>();
        allKeywordItems.forEach(item => {
          const keywordKey = `${item.keywords?.toLowerCase()}_${asinCandidate}_${competitorMarketplace}`;
          if (!keywordMap.has(keywordKey)) {
            keywordMap.set(keywordKey, item);
          }
        });
        
        // 获取唯一关键词并保留前100个
        let uniqueKeywordItems = Array.from(keywordMap.values());
        if (uniqueKeywordItems.length > 100) {
          uniqueKeywordItems = uniqueKeywordItems.slice(0, 100);
        }

        if (uniqueKeywordItems.length === 0) {
          console.log(`组${asinCandidate}_${competitorMarketplace}：无关键词数据，跳过该分组`);
          completedCount++;
          if (taskId) {
            await this.updateTaskProgress(taskId, completedCount, totalGroups, `已处理${completedCount}/${totalGroups}组，当前组无关键词`);
          }
          continue;
        }
        console.log(`组${asinCandidate}_${competitorMarketplace}：共获取${uniqueKeywordItems.length}条唯一关键词`);

        // 构造add2数据
        const keywordListForAdd2: any[] = [];
        for (const keywordItem of uniqueKeywordItems) {
          const convertedTrend = this.convertSalesTrend(keywordItem.searchesTrend || []);
          
          // 使用 productCode 作为 asin 存入，如果 productCode 为空则回退到 asinCandidate
          const asinToSave = productCode ? productCode : asinCandidate;
          
          keywordListForAdd2.push({
            asin: asinToSave,
            marketplaces: competitorMarketplace,
            value: keywordItem.keywords || "",
            value_cn: keywordItem.keywordCn || "",
            search_volume_monthly: keywordItem.searches || 0,
            ad_competitor_count: keywordItem.latest30daysAds || 0,
            trafficPercentage: keywordItem.trafficPercentage || 0,
            ppc_bid: keywordItem.exactPpc || 0,
            ppc_bid_min: keywordItem.minExactPpc || 0,
            ppc_bid_max: keywordItem.exactPpc || 0,
            search_volume_data: convertedTrend,
            status: 3,
            competitor_spider_status: 0,
            title: usedTitle
          });
        }

        // 保存关键词
        if (keywordListForAdd2.length > 0) {
          console.log(`组${asinCandidate}_${competitorMarketplace}：成功保存${keywordListForAdd2.length}条关键词`);
          // Dynamic retrieval to avoid circular dependency
          const keywordService = await this.app.createAnonymousContext().requestContext.getAsync(AppAmzListingKeywordService);
          await keywordService.add2(keywordListForAdd2);
          resultStats.success += keywordListForAdd2.length;
        }

        completedCount++;
        if (taskId) {
          await this.updateTaskProgress(
            taskId,
            completedCount,
            totalGroups,
            `已处理${completedCount}/${totalGroups}组，当前组保存${keywordListForAdd2.length}个关键词`
          );
        }

      } catch (error) {
        const errorMsg = (error as Error).message;
        resultStats.failed++;
        resultStats.failedList.push({
          asinCandidate: asinCandidate,
          market: marketCn,
          competitorAsinList: competitorAsinList,
          error: errorMsg
        });
        console.error(`组${asinCandidate}_${competitorMarketplace}处理失败: ${errorMsg}`);

        completedCount++;
        if (taskId) {
          await this.updateTaskProgress(taskId, completedCount, totalGroups, `已处理${completedCount}/${totalGroups}组，当前组处理失败`);
        }
      }
    }

    // 任务完成
    const finalMsg = `关键词获取完成：总计${totalGroups}组源ASIN+国家，成功获取${resultStats.success}个关键词，失败${resultStats.failed}组`;
    if (taskId) {
      await this.updateTaskProgress(taskId, completedCount, totalGroups, finalMsg);
      const task = await this.taskManagementRepo.findOne({ where: { id: taskId } });
      if (task) {
        task.taskStatus = TASK_STATUSES.FINISHED;
        task.executeEndTime = new Date();
        task.completedCount = completedCount;
        await this.taskManagementRepo.save(task);
      }
    }

    console.log(`竞品关键词获取任务完成：`, resultStats);
    return {
      success: true,
      stats: resultStats,
      message: finalMsg
    };
  }

  private getCurrentMonthYYYYMM(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}${month}`;
  }

  private mapMarketplaceToSellerspriteCode(marketplace: string): string {
    if (!marketplace) return '';
    const trimmed = marketplace.trim();

    const map: Record<string, string> = {
      英国: 'UK',
      德国: 'DE',
      法国: 'FR',
      西班牙: 'ES',
      意大利: 'IT',
      美国: 'US',
      日本: 'JP',
      加拿大: 'CA',
      澳大利亚: 'AU'
    };

    return map[trimmed] || trimmed.toUpperCase();
  }

  async competitorLookupOpenApi(params: {
    marketplace: string;
    month?: string;
    asins: string[];
    page?: number;
    size?: number;
    historyRuleMonth?: string;
    asinStatusMap?: Record<string, number>; // ASIN -> 状态(6在售/7往期/2回收站)，用于控制历史回溯深度
    caller?: string; // 业务调用来源，用于日志追踪
  }): Promise<any> {
    const apiCaller = params.caller || '卖家精灵API调用 | competitorLookupOpenApi';
    const marketplaceCode = this.mapMarketplaceToSellerspriteCode(params.marketplace);

    // 智能缓存
    const { cached, needFetch } = await this.getUniqueAsinsWithCache(params.asins, params.marketplace);

    if (needFetch.length === 0 && cached.size > 0) {
      console.log(`[缓存优化] 全部命中缓存，跳过API调用，返回${cached.size}条缓存数据`);
      return {
        items: Array.from(cached.values()),
        fromCache: true,
        total: cached.size
      };
    }

    if (cached.size > 0) {
      console.log(`[缓存优化] 部分命中缓存${cached.size}条，只查询${needFetch.length}条新数据`);
    }

    const asinsToQuery = needFetch.length > 0 ? needFetch : params.asins;

    // 1. 时间轴
    const monthTimeline: { apiMonth: string; dataDate: number }[] = [];
    const now = new Date();
    for (let i = 0; i < 13; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const monthVal = String(d.getMonth() + 1).padStart(2, '0');
        const dayVal = String(d.getDate()).padStart(2, '0');
        monthTimeline.push({ apiMonth: `${year}${monthVal}`, dataDate: parseInt(`${year}${monthVal}${dayVal}`) });
    }

    let month = (params.month || monthTimeline[0].apiMonth).trim();
    if (month === monthTimeline[0].apiMonth) month = 'nearly';

    const page = params.page || 1;
    const size = params.size || 100;

    const asins = Array.from(new Set(asinsToQuery.map((e) => (e || '').trim()).filter(Boolean)));

    const basePayload = {
      "marketplace": marketplaceCode, "month": month, "page": page,
      "size": size, "variation":"N"
    };

    // ========== Phase 1: 主查询（不降级，只收集） ==========
    let items: any[] = [];
    const allFoundAsins = new Set<string>();

    for (let i = 0; i < asins.length; i += 40) {
        if (!this.checkDailyLimit()) throw new Error('今日请求量已达上限');
        const chunkAsins = asins.slice(i, i + 40);
        const chunkPayload = { ...basePayload, asins: chunkAsins };
        console.log(`[SellerspriteOpenApi] 正在请求竞品查询接口 (最新月):`, JSON.stringify(chunkPayload));

        const primaryApiCallStart = Date.now();
        let primaryApiSuccess = 1;
        try {
            const response = await this.sellerSpriteUtils.httpPost('/v1/product/competitor-lookup', chunkPayload);
            if (response?.code && typeof response.code === 'string' && response.code.startsWith('ERROR')) {
                primaryApiSuccess = 0;
                this.recordApiLog('/v1/product/competitor-lookup', 'POST', chunkAsins.length, chunkAsins.slice(0, 5).join(', '), marketplaceCode, primaryApiCallStart, null, primaryApiSuccess, `${response.code} - ${response.message}`, '竞品查询(OpenAPI-主查询)', apiCaller).catch(err => console.warn('记录API日志失败:', err));
                console.error(`[SellerspriteOpenApi] API返回业务错误: ${response.code} - ${response.message}, 跳过本批次`);
                continue;
            }
            this.recordApiLog('/v1/product/competitor-lookup', 'POST', chunkAsins.length, chunkAsins.slice(0, 5).join(', '), marketplaceCode, primaryApiCallStart, null, primaryApiSuccess, null, '竞品查询(OpenAPI-主查询)', apiCaller).catch(err => console.warn('记录API日志失败:', err));
            const chunkItems = response?.data?.items || response?.data?.data?.items || response?.items || [];
            console.log(`[SellerspriteOpenApi] 请求返回 items 数量: ${chunkItems.length}`);

            items = items.concat(chunkItems);
            chunkItems.forEach((item: any) => {
                if (item.asin) allFoundAsins.add(item.asin);
                if (item.parent) allFoundAsins.add(item.parent);
            });
        } catch (e) {
            this.recordApiLog('/v1/product/competitor-lookup', 'POST', chunkAsins.length, chunkAsins.slice(0, 5).join(', '), marketplaceCode, primaryApiCallStart, null, 0, (e as Error).message, '竞品查询(OpenAPI-主查询)', apiCaller).catch(err => console.warn('记录API日志失败:', err));
            console.error(`[SellerspriteOpenApi] Chunk failed for asins index ${i}`, e);
        }
    }

    // ========== Phase 2: 合并降级（所有chunk缺失ASIN汇总后统一查询） ==========
    if (month === 'nearly') {
        let missingAsins = asins.filter(a => !allFoundAsins.has(a));

        if (missingAsins.length > 0) {
            const currentMonth = this.getCurrentMonthYYYYMM();
            console.log(`[SellerspriteOpenApi] 合并降级1(当月): ${missingAsins.length}个缺失ASIN, 月份=${currentMonth}`);
            const fb1Items = await this.consolidatedFallbackQuery(missingAsins, currentMonth, basePayload, marketplaceCode, '降级1当月', undefined, apiCaller);
            if (fb1Items.length > 0) {
                items = items.concat(fb1Items);
                const fb1Found = new Set<string>();
                fb1Items.forEach((item: any) => { if (item.asin) fb1Found.add(item.asin); if (item.parent) fb1Found.add(item.parent); });
                missingAsins = missingAsins.filter(a => !fb1Found.has(a));
            }
        }

        if (missingAsins.length > 0 && params.historyRuleMonth) {
            const ruleMonth = params.historyRuleMonth.replace(/-/g, '');
            console.log(`[SellerspriteOpenApi] 合并降级2(规则月): ${missingAsins.length}个缺失ASIN, 月份=${ruleMonth}`);
            const fb2Items = await this.consolidatedFallbackQuery(missingAsins, ruleMonth, basePayload, marketplaceCode, '降级2规则月', ruleMonth, apiCaller);
            if (fb2Items.length > 0) {
                items = items.concat(fb2Items);
                const fb2Found = new Set<string>();
                fb2Items.forEach((item: any) => { if (item.asin) fb2Found.add(item.asin); if (item.parent) fb2Found.add(item.parent); });
                missingAsins = missingAsins.filter(a => !fb2Found.has(a));
            }
        }

        if (missingAsins.length > 0 && monthTimeline.length > 1) {
            const prevMonth = monthTimeline[1].apiMonth;
            console.log(`[SellerspriteOpenApi] 合并降级3(上月): ${missingAsins.length}个缺失ASIN, 月份=${prevMonth}`);
            const fb3Items = await this.consolidatedFallbackQuery(missingAsins, prevMonth, basePayload, marketplaceCode, '降级3上月', prevMonth, apiCaller);
            if (fb3Items.length > 0) items = items.concat(fb3Items);
        }
    }

    // ========== Phase 3: 更新DB ==========
    await this.updateCompetitorLookupData(asins, items, params.marketplace, undefined, true);
    console.log(`[SellerspriteOpenApi][competitor-lookup] marketplace=${marketplaceCode} month=${month} asins=${asins.length} items=${items?.length || 0}`);

    // ========== Phase 4: 历史销量 ==========
    const salesVolumeMap = new Map<string, any[]>();
    const validAsinsSet = new Set<string>();

    const dbMarketplaceMap: Record<string, string> = {
      UK: '英国', DE: '德国', FR: '法国', IT: '意大利', ES: '西班牙',
      US: '美国', JP: '日本', CA: '加拿大', AU: '澳大利亚'
    };
    const dbMarketplace = dbMarketplaceMap[marketplaceCode] || params.marketplace;

    const existingEntities = await this.bsrCandidateCompetitorRepo.find({
      where: { asin_competitor: In(asins), marketplace: dbMarketplace },
      select: ['asin_competitor', 'sales_volume_data']
    });

    const existingDataMap = new Map<string, any[]>();
    existingEntities.forEach(entity => {
      if (entity.sales_volume_data) {
        try {
          const historyData = typeof entity.sales_volume_data === 'string'
            ? JSON.parse(entity.sales_volume_data)
            : entity.sales_volume_data;
          if (Array.isArray(historyData)) {
            existingDataMap.set(entity.asin_competitor, [...historyData].reverse());
          }
        } catch (e) {
          console.warn(`解析历史销量数据失败 ASIN: ${entity.asin_competitor}`, e);
        }
      }
    });

    const asinAvailableDateMap = new Map<string, Date>();

    for (const item of items) {
        if (item.asin) {
            validAsinsSet.add(item.asin);
            const initialData = monthTimeline.map(t => ({ date: t.dataDate, searches: 0 }));

            if (item._sourceMonth) {
                const targetIdx = monthTimeline.findIndex(t => t.apiMonth === item._sourceMonth);
                if (targetIdx >= 0) {
                    initialData[targetIdx].searches = item.units || 0;
                } else {
                    try {
                        initialData.push({ date: parseInt(item._sourceMonth + '01'), searches: item.units || 0 });
                    } catch (e) { console.warn(`Failed to parse source month ${item._sourceMonth}`, e); }
                }
            } else {
                initialData[0].searches = item.units || 0;
            }
            salesVolumeMap.set(item.asin, initialData);

            if (item.availableDate) {
                let availDateObj: Date;
                if (typeof item.availableDate === 'string' && /^d+$/.test(item.availableDate)) {
                    availDateObj = new Date(parseInt(item.availableDate, 10));
                } else {
                    availDateObj = new Date(item.availableDate);
                }
                if (!isNaN(availDateObj.getTime())) {
                    asinAvailableDateMap.set(item.asin, availDateObj);
                }
            }
        }
    }

    // 确定每个 ASIN 需要查询的月份索引列表（加入状态限制）
    const HISTORY_LIMIT = 13;
    const asinTargetMonthsMap = new Map<string, Set<number>>();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 根据 ASIN 状态获取最大回溯月数: 在售(6)→12, 往期(7)→3, 回收站(2)→0
    const getMaxHistoryMonths = (asin: string): number => {
        const status = params.asinStatusMap?.[asin];
        if (status === 2) return 0;
        if (status === 7) return 3;
        return HISTORY_LIMIT - 1;
    };

    for (const asin of Array.from(validAsinsSet)) {
        const targetIndices = new Set<number>();
        const existingData = existingDataMap.get(asin);
        const availableDate = asinAvailableDateMap.get(asin);

        let hasValidHistory = false;
        if (existingData && existingData.length > 1) {
            const historyMonths = existingData.slice(1);
            hasValidHistory = historyMonths.some(h => h.searches > 0);
        }

        const maxHistoryMonths = getMaxHistoryMonths(asin);

        if (hasValidHistory) {
            targetIndices.add(1);
        } else if (maxHistoryMonths > 0) {
            let maxBacktrack = Math.min(HISTORY_LIMIT - 1, maxHistoryMonths);

            if (availableDate) {
                const monthsDiff = (currentYear - availableDate.getFullYear()) * 12 + (currentMonth - availableDate.getMonth());
                if (monthsDiff >= 0 && monthsDiff < 12) {
                    maxBacktrack = Math.min(maxBacktrack, monthsDiff);
                } else if (monthsDiff < 0) {
                    maxBacktrack = 0;
                }
            }

            for (let k = 1; k <= maxBacktrack; k++) {
                if (k < HISTORY_LIMIT) targetIndices.add(k);
            }
        }
        asinTargetMonthsMap.set(asin, targetIndices);
    }

    console.log(`[CompetitorHistory] Target months calculated for ${validAsinsSet.size} ASINs.`);

    for (const asin of Array.from(validAsinsSet)) {
        const existingHistory = existingDataMap.get(asin);
        const currentData = salesVolumeMap.get(asin);
        if (existingHistory && currentData) {
            for (let i = 1; i < HISTORY_LIMIT; i++) {
                const targetMonth = monthTimeline[i];
                const found = existingHistory.find(h => {
                    const hDateStr = String(h.date || '');
                    return hDateStr.startsWith(targetMonth.apiMonth);
                });
                if (found && found.searches !== undefined) {
                     currentData[i].searches = found.searches;
                }
            }
        }
    }

    // 按月份循环执行查询（优化：跳过少于 MIN_HISTORY_BATCH 个ASIN的月份）
    for (let i = 1; i < HISTORY_LIMIT; i++) {
        const targetMonth = monthTimeline[i];
        const asinsToFetch: string[] = [];

        for (const asin of Array.from(validAsinsSet)) {
            const targetIndices = asinTargetMonthsMap.get(asin);
            if (targetIndices && targetIndices.has(i)) {
                 const existingHistory = existingDataMap.get(asin);
                 let hasData = false;
                 if (existingHistory) {
                    const found = existingHistory.find(h => {
                       const hDateStr = String(h.date || '');
                       return hDateStr.startsWith(targetMonth.apiMonth);
                    });
                    if (found && found.searches > 0) {
                       hasData = true;
                       const currentData = salesVolumeMap.get(asin);
                       if (currentData) { currentData[i].searches = found.searches; }
                    }
                 }
                 if (!hasData) { asinsToFetch.push(asin); }
            }
        }

        console.log(`[CompetitorHistory] Month ${targetMonth.apiMonth}: Fetching ${asinsToFetch.length} ASINs.`);

        if (asinsToFetch.length === 0) continue;

        // 最小批量阈值
        if (asinsToFetch.length < this.MIN_HISTORY_BATCH) {
            console.log(`[CompetitorHistory] Month ${targetMonth.apiMonth}: 仅${asinsToFetch.length}个ASIN，低于阈值${this.MIN_HISTORY_BATCH}，跳过`);
            continue;
        }

        try {
            const historyItemsAll: any[] = [];

            for (let j = 0; j < asinsToFetch.length; j += 40) {
                if (!this.checkDailyLimit()) throw new Error('今日请求量已达上限');

                const chunkAsins = asinsToFetch.slice(j, j + 40);
                const historyPayload = {
                    marketplace: marketplaceCode, month: targetMonth.apiMonth,
                    asins: chunkAsins, page: 1, size: 100, variation: "N"
                };

                console.log(`[CompetitorHistory] Requesting API (History Month ${targetMonth.apiMonth}): Chunk ${Math.floor(j/40) + 1}/${Math.ceil(asinsToFetch.length/40)}, ASINs: ${chunkAsins.length}`);

                const historyApiCallStart = Date.now();
                let historyApiSuccess = 1;
                let historyApiError: string | null = null;
                try {
                    const historyRes = await this.sellerSpriteUtils.httpPost('/v1/product/competitor-lookup', historyPayload);
                    const chunkHistoryItems = historyRes?.data?.items || historyRes?.data?.data?.items || historyRes?.items || [];
                    historyItemsAll.push(...chunkHistoryItems);
                    this.recordApiLog('/v1/product/competitor-lookup', 'POST', chunkAsins.length, chunkAsins.slice(0, 5).join(', '), marketplaceCode, historyApiCallStart, null, historyApiSuccess, null, `竞品查询(OpenAPI-历史月${targetMonth.apiMonth})`, apiCaller).catch(err => console.warn('记录API日志失败:', err));
                } catch (e) {
                     historyApiError = (e as Error).message;
                     this.recordApiLog('/v1/product/competitor-lookup', 'POST', chunkAsins.length, chunkAsins.slice(0, 5).join(', '), marketplaceCode, historyApiCallStart, null, 0, historyApiError, `竞品查询(OpenAPI-历史月${targetMonth.apiMonth})`, apiCaller).catch(err => console.warn('记录API日志失败:', err));
                     console.error(`[CompetitorHistory] Chunk failed for month ${targetMonth.apiMonth}`, e);
                }
            }

            const historyItemMap = new Map<string, any>();
            for (const hItem of historyItemsAll) {
                if (hItem.asin) historyItemMap.set(hItem.asin, hItem);
            }

            for (const asin of asinsToFetch) {
                const hItem = historyItemMap.get(asin);
                const units = hItem?.units || 0;
                const asinData = salesVolumeMap.get(asin);
                if (asinData) { asinData[i].searches = units; }
            }

            await this.updateCompetitorLookupData(Array.from(validAsinsSet), items, params.marketplace, salesVolumeMap, false);

        } catch (err) {
            console.error(`[CompetitorHistory] Failed for month ${targetMonth.apiMonth}`, err);
            break;
        }
    }

    // 最后全量保存
    await this.updateCompetitorLookupData(asins, items, params.marketplace, salesVolumeMap, false);

    // 存入缓存
    for (const item of items) {
      if (item.asin) { this.setCachedData(item.asin, params.marketplace, item); }
    }

    // 合并缓存数据和新数据
    const allItems = [...items];
    if (cached.size > 0) {
      const cachedItems = Array.from(cached.values());
      allItems.push(...cachedItems);
      console.log(`[缓存合并] 新数据${items.length}条 + 缓存数据${cachedItems.length}条 = 总计${allItems.length}条`);
    }

    return {
      success: true,
      marketplace: marketplaceCode,
      month,
      asinsCount: params.asins.length,
      itemsCount: allItems?.length || 0,
      items: allItems,
      fromCache: cached.size > 0,
      cachedCount: cached.size,
      newCount: items.length,
      historyProcessed: true
    };
  }

  /**
   * 合并降级查询：将缺失ASIN分批调用API（每次40个），返回所有恢复的items
   */
  private async consolidatedFallbackQuery(
    missingAsins: string[],
    fallbackMonth: string,
    basePayload: any,
    marketplaceCode: string,
    logLabel: string,
    sourceMonth?: string,
    caller?: string
  ): Promise<any[]> {
    const cfbCaller = caller || '卖家精灵API调用 | consolidatedFallbackQuery';
    const allItems: any[] = [];
    for (let j = 0; j < missingAsins.length; j += 40) {
        const chunkAsins = missingAsins.slice(j, j + 40);
        const fbPayload = { ...basePayload, month: fallbackMonth, asins: chunkAsins };
        const fbCallStart = Date.now();
        let fbSuccess = 1;
        let fbError: string | null = null;
        try {
            const fbRes = await this.sellerSpriteUtils.httpPost('/v1/product/competitor-lookup', fbPayload);
            if (fbRes?.code && typeof fbRes.code === 'string' && fbRes.code.startsWith('ERROR')) {
                fbSuccess = 0;
                fbError = `${fbRes.code}`;
                console.error(`[SellerspriteOpenApi] 合并${logLabel} API返回错误: ${fbRes.code}, 跳过`);
            } else {
                const fbItems = fbRes?.data?.items || fbRes?.data?.data?.items || fbRes?.items || [];
                if (sourceMonth) {
                    fbItems.forEach((item: any) => item._sourceMonth = sourceMonth);
                }
                if (fbItems.length > 0) {
                    allItems.push(...fbItems);
                    console.log(`[SellerspriteOpenApi] 合并${logLabel} recovered ${fbItems.length} items`);
                }
            }
            this.recordApiLog('/v1/product/competitor-lookup', 'POST', chunkAsins.length, chunkAsins.slice(0, 5).join(', '), marketplaceCode, fbCallStart, null, fbSuccess, fbError, `竞品查询(OpenAPI-合并${logLabel})`, cfbCaller).catch(err => console.warn('记录API日志失败:', err));
        } catch (fbError) {
            this.recordApiLog('/v1/product/competitor-lookup', 'POST', chunkAsins.length, chunkAsins.slice(0, 5).join(', '), marketplaceCode, fbCallStart, null, 0, (fbError as Error).message, `竞品查询(OpenAPI-合并${logLabel})`, cfbCaller).catch(err => console.warn('记录API日志失败:', err));
            console.error(`[SellerspriteOpenApi] 合并${logLabel} chunk failed`, fbError);
        }
    }
    return allItems;
  }

  /**
   * 更新competitor-lookup返回的数据
   * 2026-03-19 修改：增加变体和父体入库逻辑，借用子体数据生成父体记录
   */
  private // 增加一个可选参数 isLatestMonthQuery，用于指示是否为最新月份查询
    async updateCompetitorLookupData(
      asins: string[], 
      apiItems: any[], 
      marketplace: string, 
      salesVolumeMap?: Map<string, any[]>,
      isLatestMonthQuery: boolean = false
    ) {
        if (!asins || asins.length === 0) return;

        const requestedAsins = asins;

        // 映射 marketplace 代码到中文 (数据库存的是中文)
        let dbMarketplace = marketplace;
        const marketplaceMap: Record<string, string> = {
            'UK': '英国',
            'DE': '德国',
            'FR': '法国',
            'IT': '意大利',
            'ES': '西班牙',
            'US': '美国',
            'JP': '日本',
            'CA': '加拿大',
            'AU': '澳大利亚'
        };
        if (marketplaceMap[marketplace]) {
            dbMarketplace = marketplaceMap[marketplace];
        }

        // 1. 先查找请求ASIN的实体，作为新增记录的候选关联来源
        const requestedEntities = await this.bsrCandidateCompetitorRepo.find({
            where: {
                asin_competitor: In(requestedAsins),
                marketplace: dbMarketplace
            }
        });

        const requestAsinToCandidateMap = new Map<string, { asin_candidate?: string; candidate_id?: number }>();
        for (const entity of requestedEntities) {
            requestAsinToCandidateMap.set(entity.asin_competitor, {
                asin_candidate: entity.asin_candidate,
                candidate_id: entity.candidate_id
            });
        }
        const requestedCandidates = await this.bsrCandidateRepo.find({
            where: {
                asin: In(requestedAsins),
                marketplace: dbMarketplace,
                status: 6
            },
            select: ['id', 'asin']
        });
        for (const candidate of requestedCandidates) {
            if (!requestAsinToCandidateMap.has(candidate.asin)) {
                requestAsinToCandidateMap.set(candidate.asin, {
                    asin_candidate: candidate.asin,
                    candidate_id: candidate.id
                });
            }
        }
        const apiAsins = new Set<string>();
        for (const item of apiItems) {
            if (item.asin) apiAsins.add(item.asin);
        }
        const asinsArray = Array.from(new Set<string>([...requestedAsins, ...Array.from(apiAsins)]));

        // 2. 查找所有需要处理的实体
        const entities = await this.bsrCandidateCompetitorRepo.find({
            where: {
                asin_competitor: In(asinsArray),
                marketplace: dbMarketplace
            }
        });

        const entityListMap = new Map<string, any[]>();
        for (const e of entities) {
            const list = entityListMap.get(e.asin_competitor) || [];
            list.push(e);
            entityListMap.set(e.asin_competitor, list);
        }

        // 3. 构建API返回数据的Map映射
        const apiItemMap = new Map<string, any>();
        const parentItemMap = new Map<string, any>();
        for (const item of apiItems) {
          if (item.asin) {
            apiItemMap.set(item.asin, item);
            if (item.parent) {
                const existed = parentItemMap.get(item.parent);
                const currentUnits = Number(item.units) || 0;
                const existedUnits = Number(existed?.units) || 0;
                if (!existed || currentUnits >= existedUnits) {
                    parentItemMap.set(item.parent, item);
                }
            }
          }
        }

        const apiParentAsins = Array.from(
          new Set(
            apiItems
              .map(item => item?.parent)
              .filter(parent => !!parent)
          )
        );
        const parentRelationMap = new Map<string, { asin_candidate?: string; candidate_id?: number }>();
        const requestCandidateIdSet = new Set<number>(
            Array.from(requestAsinToCandidateMap.values())
              .map(v => Number(v?.candidate_id))
              .filter(v => !!v)
        );
        if (apiParentAsins.length > 0) {
            const parentEntities = await this.bsrCandidateCompetitorRepo.find({
                where: {
                    parent_asin: In(apiParentAsins),
                    marketplace: dbMarketplace
                },
                select: ['parent_asin', 'asin_candidate', 'candidate_id']
            });
            for (const parentEntity of parentEntities) {
                if (!parentEntity.parent_asin) continue;
                if (requestCandidateIdSet.size > 0) {
                    const parentCandidateId = Number(parentEntity.candidate_id) || 0;
                    if (!requestCandidateIdSet.has(parentCandidateId)) {
                        continue;
                    }
                }
                if (!parentRelationMap.has(parentEntity.parent_asin) && (parentEntity.candidate_id || parentEntity.asin_candidate)) {
                    parentRelationMap.set(parentEntity.parent_asin, {
                        asin_candidate: parentEntity.asin_candidate,
                        candidate_id: parentEntity.candidate_id
                    });
                }
            }
        }

        // 确保所有目标 ASIN 都有对应实体，如果没有则创建
        const newEntities: any[] = [];
        for (const asin of asinsArray) {
            const existedList = entityListMap.get(asin) || [];
            if (existedList.length === 0) {
                const newEntity = new AppAmzBsrCandidateCompetitorEntity();
                newEntity.asin_competitor = asin;
                newEntity.marketplace = dbMarketplace;
                newEntity.status = 6; // 默认状态

                const apiItem = apiItemMap.get(asin);
                const relationByRequestedParent = apiItem?.parent ? requestAsinToCandidateMap.get(apiItem.parent) : undefined;
                const relationByParent = apiItem?.parent ? parentRelationMap.get(apiItem.parent) : undefined;
                const relation = requestAsinToCandidateMap.get(asin) || relationByRequestedParent || relationByParent;
                newEntity.asin_candidate = relation?.asin_candidate || null;
                newEntity.candidate_id = relation?.candidate_id || null;

                entityListMap.set(asin, [newEntity]);
                newEntities.push(newEntity);
            }
        }

        const allEntitiesToSave = Array.from(entityListMap.values()).flat();

      // 4. 遍历实体并更新
        let updatedCount = 0;
        for (const entity of allEntitiesToSave) {
          const directApiItem = apiItemMap.get(entity.asin_competitor);
          const parentMappedApiItem = parentItemMap.get(entity.asin_competitor);
          const apiItem = directApiItem || parentMappedApiItem;

          if (apiItem) {
            console.log(`[updateCompetitorLookupData] 找到 API 数据 ASIN: ${entity.asin_competitor}`);
            // 找到 -> 更新字段
            if (!entity.inventory_status) {
                 entity.inventory_status = '1'; 
            }

            
            entity.item_name = apiItem.title || entity.item_name;
            if (apiItem.imageUrl) {
                entity.image_url = apiItem.imageUrl
                    .replace(/_AC_US\d+/g, '_AC_US1000')
                    .replace(/_AC_UL\d+/g, '_AC_UL1000')
                    .replace(/_SL\d+/g, '_SL1000')
                    .replace(/SS40+/g, 'SS500')
                    .replace(/_AC_SR\d+,?\d*/g, '_AC_SR1000,1000')
                    .replace(/_SX\d+_SY\d+_CR[^_]*_/, '_SX1000_SY1000_CR,0,0,1000,1000_');
            }
            entity.price = apiItem.price?.toString() || entity.price;
            entity.review_num = apiItem.ratings || entity.review_num;
            entity.last_star = apiItem.rating || entity.last_star;
            entity.bsr_rank = apiItem.bsr || entity.bsr_rank;
            
            if (apiItem.subcategories && Array.isArray(apiItem.subcategories) && apiItem.subcategories.length > 0) {
                const sub = apiItem.subcategories[0];
                entity.bsr_node = sub.label;
                entity.bsr_node_rank = sub.rank;
                entity.bsr_node_id = sub.code;
            } else if (apiItem.nodeLabelPath) {
                const parts = apiItem.nodeLabelPath.split(':');
                if (parts.length > 0) {
                    entity.bsr_node = parts[parts.length - 1];
                }
            }

            if (apiItem.units !== undefined && apiItem.units !== null) {
                entity.Main_monthly_sales = Number(apiItem.units) || 0;
            } else if (entity.Main_monthly_sales === null || entity.Main_monthly_sales === undefined) {
                // 2026-04-24 修改：如果API返回了数据，但没有units字段（通常是0销量），确保设置销量为0，避免因null被误判为无数据而移入往期
                entity.Main_monthly_sales = 0;
            }
            entity.Main_monthly_sales_sub = apiItem.amzUnit?.toString() || "";

            if (apiItem.availableDate) {
                let availDateObj: Date;
                if (typeof apiItem.availableDate === 'string' && /^\d+$/.test(apiItem.availableDate)) {
                    availDateObj = new Date(parseInt(apiItem.availableDate, 10));
                } else {
                    availDateObj = new Date(apiItem.availableDate);
                }
                if (!isNaN(availDateObj.getTime())) {
                    entity.date_first_available = availDateObj;
                }
            }

            if (apiItem.fulfillment === 'FBA') entity.dispatches_type = '1';
            else if (apiItem.fulfillment === 'FBM') entity.dispatches_type = '2';
            else if (apiItem.fulfillment === 'AMZ') entity.dispatches_type = '0';
            
            entity.sold_by = apiItem.sellerName || entity.sold_by;
            if (apiItem.fulfillment === 'AMZ' || (apiItem.sellerName && apiItem.sellerName.includes('Amazon'))) {
                entity.dispatches_from = 'Amazon';
            } else {
                entity.dispatches_from = apiItem.sellerName;
            }
            
            entity.weight = apiItem.weight || entity.weight;
            entity.dimensions = apiItem.dimension || entity.dimensions;
            entity.variants = apiItem.variations || entity.variants;
            entity.parent_asin = apiItem.parent || entity.parent_asin;

            entity.FBA_price = apiItem.fba || entity.FBA_price;
            entity.sold_byID = apiItem.sellerId || entity.sold_byID;

            entity.revenue = apiItem.revenue || entity.revenue;
            entity.amz_sales = apiItem.amzSales || entity.amz_sales;
            entity.units_gr = apiItem.unitsGr || entity.units_gr;
            entity.prime_price = apiItem.primePrice || entity.prime_price;
            entity.delivery_price = apiItem.deliveryPrice || entity.delivery_price;
            entity.profit_rate = apiItem.profit || entity.profit_rate;
            entity.bsr_cr = apiItem.bsrCr || entity.bsr_cr;
            entity.bsr_cv = apiItem.bsrCv || entity.bsr_cv;
            entity.ratings_rate = apiItem.ratingsRate || entity.ratings_rate;
            entity.ratings_cv = apiItem.ratingsCv || entity.ratings_cv;
            entity.rating_delta = apiItem.ratingDelta || entity.rating_delta;
            entity.badge_info = apiItem.badge || entity.badge_info;
            entity.symbol = apiItem.symbol || entity.symbol;
            entity.lqs = apiItem.lqs || entity.lqs;
            entity.pkg_dimensions = apiItem.pkgDimensions || entity.pkg_dimensions;
            entity.pkg_weight = apiItem.pkgWeight || entity.pkg_weight;
            entity.dimensions_type = apiItem.dimensionsType || entity.dimensions_type;
            entity.pkg_dimension_type = apiItem.pkgDimensionType || entity.pkg_dimension_type;
            entity.brand = apiItem.brand || entity.brand;
            entity.brand_url = apiItem.brandUrl || entity.brand_url;
            entity.sellers = apiItem.sellers || entity.sellers;
            entity.seller_nation = apiItem.sellerNation || entity.seller_nation;
            entity.node_id_path = apiItem.nodeIdPath || entity.node_id_path;
            if (apiItem.amzUnitDate) {
                let amzUnitDateObj: Date;
                if (typeof apiItem.amzUnitDate === 'string' && /^\d+$/.test(apiItem.amzUnitDate)) {
                    amzUnitDateObj = new Date(parseInt(apiItem.amzUnitDate, 10));
                } else {
                    amzUnitDateObj = new Date(apiItem.amzUnitDate);
                }
                if (!isNaN(amzUnitDateObj.getTime())) {
                    entity.amz_unit_date = amzUnitDateObj;
                }
            }
            entity.sku_info = apiItem.sku || entity.sku_info;
          } else {
            console.log(`[updateCompetitorLookupData] 未找到 API 数据 ASIN: ${entity.asin_competitor}, isLatestMonthQuery: ${isLatestMonthQuery}`);
            // 未在API返回中找到，并且不是借用子体数据的父记录
            if (isLatestMonthQuery && requestedAsins.includes(entity.asin_competitor)) {
                entity.status = 7;
                // 2026-04-25 修改：如果未在最新月 API 中找到，则将其本月销量置空，这样在 applyRulesForProductCode 中的近30天规则才会正确判定为无数据并移入往期
                entity.Main_monthly_sales = null;
            }
          }

      
          // 处理历史销量数据
          const targetAsinForSales = directApiItem
            ? entity.asin_competitor
            : (parentMappedApiItem?.asin || entity.asin_competitor);

          let finalData: any[] = [];
          if (salesVolumeMap && salesVolumeMap.has(targetAsinForSales)) {
                const currentFetchData = salesVolumeMap.get(targetAsinForSales) || [];
                
                let fullHistoryData: any[] = [];
                if (entity.sales_volume_data) {
                    try {
                        const parsed = typeof entity.sales_volume_data === 'string' 
                            ? JSON.parse(entity.sales_volume_data) 
                            : entity.sales_volume_data;
                        if (Array.isArray(parsed)) {
                            fullHistoryData = parsed;
                        }
                    } catch (e) {}
                }

                const newValuesMap = new Map<string, number>();
                currentFetchData.forEach(d => {
                    newValuesMap.set(String(d.date), d.searches);
                });

                const mergedDataMap = new Map<string, any>();
                
                fullHistoryData.forEach(d => {
                    const dateStr = String(d.date);
                    mergedDataMap.set(dateStr, { ...d });
                });

                newValuesMap.forEach((searches, date) => {
                    const dateStr = String(date);
                    const oldItem = mergedDataMap.get(dateStr);
                    const oldSearches = Number(oldItem?.searches) || 0;
                    const incomingSearches = Number(searches) || 0;
                    const shouldKeepOld = incomingSearches === 0 && oldSearches > 0;

                    if (shouldKeepOld) {
                        return;
                    }

                    mergedDataMap.set(dateStr, { date: Number(dateStr), searches: incomingSearches });
                });

                finalData = Array.from(mergedDataMap.values()).sort((a, b) => a.date - b.date);

                if (finalData.length > 24) {
                    finalData = finalData.slice(finalData.length - 24);
                }

                const shouldSkipSalesUpdate = !apiItem && isLatestMonthQuery;
                
                if (finalData.length > 0 && !shouldSkipSalesUpdate) {
                    const latest = finalData[finalData.length - 1];
                    const latestSearches = Number(latest?.searches) || 0;
                    const currentMonthlySales = Number(entity.Main_monthly_sales) || 0;
                    entity.Main_monthly_sales = latestSearches === 0 && currentMonthlySales > 0
                      ? entity.Main_monthly_sales
                      : latestSearches;
                }

                entity.sales_volume_data = finalData as any;
          }

          entity.expected_volume = (Number(entity.Main_monthly_sales) || 0) / 30;

          if (entity.inventory_type === "XIAN") {
              // OpenAPI uses 'units' instead of 'totalUnits'
              entity.stock_quantity = apiItem ? (Number(apiItem.units) || 0) : 0;
          }

          try {
              await this.bsrCandidateCompetitorRepo.save(entity);
              updatedCount++;
          } catch (err) {
              console.error(`[updateCompetitorLookupData] 保存失败 ASIN:${entity.asin_competitor}`, err);
          }
        }
        console.log(`[updateCompetitorLookupData] 已处理并更新 ${updatedCount}/${allEntitiesToSave.length} 条记录`);
    }
}
