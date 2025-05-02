import { debugLog } from './log.js';
import { browserConnector } from './browser-connector.js';

/**
 * 浏览器自动化
 * 使用Playwright启动浏览器并连接到WebSocket服务器
 * 
 * 注意：使用此模块前需要安装Playwright:
 * pnpm add playwright
 */
export class BrowserAutomation {
  private browser: any = null;
  private page: any = null;
  private wsEndpoint: string = '';

  /**
   * 初始化浏览器
   * @param wsPort WebSocket服务器端口
   */
  async initialize(wsPort: number = 8080): Promise<void> {
    try {
      // 动态导入Playwright (需要先安装)
      const { chromium } = await import('playwright');
      
      // 启动浏览器
      this.browser = await chromium.launch({
        headless: false, // 设置为true可隐藏浏览器界面
      });
      
      // 创建新页面
      this.page = await this.browser.newPage();
      
      // WebSocket服务器地址
      this.wsEndpoint = `ws://localhost:${wsPort}`;
      
      // 注入WebSocket客户端脚本
      await this.page.addInitScript({
        content: `
          // 创建WebSocket连接
          const ws = new WebSocket('${this.wsEndpoint}');
          
          // 存储待处理的请求
          const pendingRequests = new Map();
          
          // 连接建立时
          ws.addEventListener('open', () => {
            console.log('[MCP] WebSocket连接已建立');
          });
          
          // 接收消息
          ws.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            
            // 如果是响应消息
            if (message.id && !message.type) {
              const resolver = pendingRequests.get(message.id);
              if (resolver) {
                resolver(message.data);
                pendingRequests.delete(message.id);
              }
              return;
            }
            
            // 处理请求消息
            handleBrowserRequest(message);
          });
          
          // 处理浏览器请求
          async function handleBrowserRequest(message) {
            const { type, id, data } = message;
            let result;
            
            try {
              console.log('[MCP] 收到请求:', type, data);
              
              // 根据消息类型执行相应操作
              switch (type) {
                case 'browser_navigate':
                  await window.location.assign(data.url);
                  result = { success: true };
                  break;
                  
                case 'browser_go_back':
                  window.history.back();
                  result = { success: true };
                  break;
                  
                case 'browser_go_forward':
                  window.history.forward();
                  result = { success: true };
                  break;
                  
                case 'browser_press_key':
                  // 这里需要更复杂的实现
                  result = { success: true, message: '按键功能需要更复杂实现' };
                  break;
                  
                case 'browser_snapshot':
                  result = document.documentElement.outerHTML;
                  break;
                  
                case 'getUrl':
                  result = window.location.href;
                  break;
                  
                case 'getTitle':
                  result = document.title;
                  break;
                  
                default:
                  result = { error: \`未知请求类型: \${type}\` };
              }
            } catch (error) {
              result = { error: error.message };
              console.error('[MCP] 处理请求出错:', error);
            }
            
            // 发送响应
            ws.send(JSON.stringify({ id, data: result }));
          }
          
          // 发送消息到服务器
          window.sendToMCP = function(type, data) {
            return new Promise((resolve) => {
              const id = Date.now().toString();
              pendingRequests.set(id, resolve);
              ws.send(JSON.stringify({ type, id, data }));
            });
          };
          
          // 错误处理
          ws.addEventListener('error', (error) => {
            console.error('[MCP] WebSocket错误:', error);
          });
          
          ws.addEventListener('close', () => {
            console.log('[MCP] WebSocket连接已关闭');
          });
          
          console.log('[MCP] 浏览器WebSocket客户端已初始化');
        `
      });
      
      // 导航到初始页面
      await this.page.goto('about:blank');
      
      debugLog('🚀 浏览器已启动并连接到WebSocket服务器');
    } catch (error) {
      debugLog('❌ 启动浏览器时出错:', error);
      throw error;
    }
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      debugLog('👋 浏览器已关闭');
    }
  }
}

// 创建单例实例
export const browserAutomation = new BrowserAutomation();