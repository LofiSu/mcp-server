import { WebSocketServer, WebSocket } from 'ws';
import { debugLog } from './log.js';
import { v4 as uuidv4 } from 'uuid'; 

// 定义消息格式
interface PluginMessage {
  id: string; // 用于关联请求和响应
  type: string;
  payload?: any;
  error?: string;
  result?: any;
}

/**
 * MCP上下文
 * 通过 WebSocket 提供与浏览器插件通信的接口
 */
export class McpContext {
  private wss: WebSocketServer | null = null;
  private pluginSocket: WebSocket | null = null;
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void; timer: NodeJS.Timeout }> = new Map();
  private readonly WSS_PORT = 8081; // WebSocket 服务器端口，可以根据需要修改
  private readonly RESPONSE_TIMEOUT = 15000; // 插件响应超时时间 (15秒)

  constructor() {
    this.initializeWebSocketServer();
  }

  private initializeWebSocketServer() {
    try {
      this.wss = new WebSocketServer({ port: this.WSS_PORT });
      debugLog(`🔌 WebSocket 服务器正在监听端口 ${this.WSS_PORT}`);

      this.wss.on('connection', (ws) => {
        if (this.pluginSocket) {
          debugLog('⚠️ 新的插件连接尝试，但已有连接存在。关闭新连接。');
          ws.close(1013, 'Server already has an active plugin connection.');
          return;
        }

        this.pluginSocket = ws;
        debugLog('✅ 浏览器插件已连接');

        ws.on('message', (message) => {
          this.handleIncomingMessage(message);
        });

        ws.on('close', (code, reason) => {
          debugLog(`❌ 浏览器插件连接已断开: Code=${code}, Reason=${reason.toString()}`);
          this.pluginSocket = null;
          // 清理所有待处理的请求
          this.pendingRequests.forEach((req) => {
            clearTimeout(req.timer);
            req.reject(new Error('Plugin disconnected before response received.'));
          });
          this.pendingRequests.clear();
        });

        ws.on('error', (error) => {
          debugLog('❌ 插件 WebSocket 连接出错:', error);
          if (this.pluginSocket === ws) {
            this.pluginSocket = null;
            // 清理逻辑同 'close'
            this.pendingRequests.forEach((req) => {
              clearTimeout(req.timer);
              req.reject(new Error(`Plugin connection error: ${error.message}`));
            });
            this.pendingRequests.clear();
          }
        });
      });

      this.wss.on('error', (error) => {
        debugLog('❌ WebSocket 服务器错误:', error);
        // 可以添加更健壮的错误处理，例如尝试重启服务器
        this.wss = null; 
      });

    } catch (error) {
      debugLog('❌ 初始化 WebSocket 服务器失败:', error);
      // 可以在这里抛出错误或进行其他处理
    }
  }

  private handleIncomingMessage(message: WebSocket.RawData) {
    try {
      let buffer: Buffer;
      if (Buffer.isBuffer(message)) {
        buffer = message;
      } else if (message instanceof ArrayBuffer) {
        buffer = Buffer.from(message);
      } else if (Array.isArray(message)) { // Handle Buffer[]
        buffer = Buffer.concat(message);
      } else {
        // Should not happen with 'ws', but handle defensively
        debugLog('⚠️ 收到的消息类型未知:', typeof message);
        return; 
      }

      const dataStr = buffer.toString('utf-8'); // Specify encoding
      debugLog(`📥 收到插件消息: ${dataStr}`);
      const parsedMessage: PluginMessage = JSON.parse(dataStr);

      if (parsedMessage.id && this.pendingRequests.has(parsedMessage.id)) {
        const request = this.pendingRequests.get(parsedMessage.id)!;
        clearTimeout(request.timer); // 清除超时定时器

        if (parsedMessage.error) {
          request.reject(new Error(parsedMessage.error));
        } else {
          request.resolve(parsedMessage.result);
        }
        this.pendingRequests.delete(parsedMessage.id);
      } else {
        debugLog('⚠️ 收到无法匹配或无 ID 的插件消息:', parsedMessage);
        // 可以选择处理没有 ID 的消息（例如事件通知）
      }
    } catch (error) {
      debugLog('❌ 处理插件消息时出错:', error);
    }
  }

  /**
   * 发送消息到浏览器插件并等待响应
   * @param type 消息类型
   * @param payload 消息数据
   * @returns 插件响应
   */
  async sendSocketMessage(type: string, payload: any): Promise<any> {
    if (!this.isConnected()) {
      debugLog(`❌ 插件未连接，无法发送消息: ${type}`);
      throw new Error('浏览器插件未连接');
    }

    const messageId = uuidv4();
    const message: PluginMessage = { id: messageId, type, payload };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error(`Plugin response timeout for message type: ${type}`));
      }, this.RESPONSE_TIMEOUT);

      this.pendingRequests.set(messageId, { resolve, reject, timer });

      try {
        const messageString = JSON.stringify(message);
        debugLog(`📤 发送消息到插件: ${messageString}`);
        this.pluginSocket!.send(messageString, (error) => {
          if (error) {
            clearTimeout(timer);
            this.pendingRequests.delete(messageId);
            debugLog(`❌ 发送消息到插件时出错 (ID: ${messageId}):`, error);
            reject(new Error(`Failed to send message to plugin: ${error.message}`));
          }
        });
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(messageId);
        debugLog(`❌ 序列化或发送消息时出错 (ID: ${messageId}):`, error);
        reject(error); // 将错误向上抛出
      }
    });
  }

  /**
   * 获取浏览器插件状态 (URL 和 Title)
   * @returns 插件状态对象
   */
  async getBrowserState(): Promise<{ connected: boolean; url?: string; title?: string }> {
    if (!this.isConnected()) {
      return { connected: false };
    }
    try {
      // 并行获取 URL 和 Title 以提高效率
      const [urlResult, titleResult] = await Promise.allSettled([
        this.sendSocketMessage('getUrl', undefined),
        this.sendSocketMessage('getTitle', undefined)
      ]);

      const url = urlResult.status === 'fulfilled' ? urlResult.value?.toString() : undefined;
      const title = titleResult.status === 'fulfilled' ? titleResult.value?.toString() : undefined;
      
      if (urlResult.status === 'rejected') {
          debugLog('❌ 获取插件 URL 时出错:', urlResult.reason);
      }
      if (titleResult.status === 'rejected') {
          debugLog('❌ 获取插件 Title 时出错:', titleResult.reason);
      }

      return { connected: true, url, title };
    } catch (error) {
      // sendSocketMessage 内部已记录错误，这里只确保返回连接状态
      debugLog('❌ 获取插件状态时发生意外错误:', error);
      return { connected: true }; // 即使获取失败，也认为插件是连接的
    }
  }

  /**
   * 检查插件是否连接且 WebSocket 处于打开状态
   * @returns boolean
   */
  isConnected(): boolean {
    return this.pluginSocket !== null && this.pluginSocket.readyState === WebSocket.OPEN;
  }

  // 添加一个方法用于等待插件连接，方便服务器启动时调用
  async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
    if (this.isConnected()) {
      return true;
    }
    debugLog(`⏳ 等待插件连接... (超时时间: ${timeoutMs}ms)`);
    return new Promise((resolve) => {
      const checkInterval = 100;
      let elapsedTime = 0;

      const intervalId = setInterval(() => {
        if (this.isConnected()) {
          clearInterval(intervalId);
          resolve(true);
        } else {
          elapsedTime += checkInterval;
          if (elapsedTime >= timeoutMs) {
            clearInterval(intervalId);
            debugLog('⌛️ 等待插件连接超时');
            resolve(false);
          }
        }
      }, checkInterval);
    });
  }

  // 关闭 WebSocket 服务器 (例如在程序退出时)
  close() {
    debugLog('🔌 关闭 WebSocket 服务器...');
    if (this.pluginSocket) {
      this.pluginSocket.close(1000, 'Server shutting down');
      this.pluginSocket = null;
    }
    if (this.wss) {
      this.wss.close((err) => {
        if (err) {
          debugLog('❌ 关闭 WebSocket 服务器时出错:', err);
        }
        this.wss = null;
        debugLog('🔌 WebSocket 服务器已关闭');
      });
    }
    // 清理所有待处理的请求
    this.pendingRequests.forEach((req) => {
      clearTimeout(req.timer);
      req.reject(new Error('Server shutting down.'));
    });
    this.pendingRequests.clear();
  }
}

// 创建单例实例
export const mcpContext = new McpContext();

// 添加优雅退出处理
process.on('SIGINT', () => {
  mcpContext.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  mcpContext.close();
  process.exit(0);
});