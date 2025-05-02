import { debugLog } from './log.js';
import { WebSocketServer } from 'ws';
import * as WebSocket from 'ws';

// 声明全局Window接口扩展
declare global {
  interface Window {
    sendToMCP: (type: string, data: any) => Promise<any>;
  }
}

/**
 * 浏览器连接器
 * 使用WebSocket连接浏览器与MCP服务器
 */
export class BrowserConnector {
  private ws: WebSocketServer | null = null;
  private browserConnection: WebSocket.WebSocket | null = null;
  private messageHandlers: Map<string, (data: any) => any> = new Map();

  /**
   * 初始化WebSocket服务器
   * @param port WebSocket服务器端口
   */
  async initialize(port: number = 8080): Promise<void> {
    // 创建WebSocket服务器
    this.ws = new WebSocketServer({ port });
    
    debugLog(`🔌 WebSocket服务器已启动，监听端口 ${port}`);
    
    // 监听连接事件
    this.ws.on('connection', (socket: WebSocket.WebSocket) => {
      debugLog('✅ 浏览器已连接');
      this.browserConnection = socket;
      
      // 监听消息事件
      socket.on('message', async (message: WebSocket.Data) => {
        try {
          const { type, id, data } = JSON.parse(message.toString());
          debugLog(`📩 收到浏览器消息: ${type}`, data);
          
          // 处理消息
          const handler = this.messageHandlers.get(type);
          if (handler) {
            const result = await handler(data);
            // 发送响应
            this.sendResponse(id, result);
          }
        } catch (error) {
          debugLog('❌ 处理浏览器消息时出错:', error);
        }
      });
      
      // 监听关闭事件
      socket.on('close', () => {
        debugLog('❌ 浏览器已断开连接');
        this.browserConnection = null;
      });
    });
  }

  /**
   * 注册消息处理器
   * @param type 消息类型
   * @param handler 处理函数
   */
  registerHandler(type: string, handler: (data: any) => any): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * 发送消息到浏览器
   * @param type 消息类型
   * @param data 消息数据
   * @returns 浏览器响应
   */
  async sendMessage(type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.browserConnection) {
        reject(new Error('浏览器未连接'));
        return;
      }
      
      const id = Date.now().toString();
      
      // 设置超时
      const timeout = setTimeout(() => {
        reject(new Error(`发送消息超时: ${type}`));
      }, 5000);
      
      // 监听一次性响应
      const responseHandler = (message: WebSocket.Data) => {
        try {
          const response = JSON.parse(message.toString());
          if (response.id === id) {
            clearTimeout(timeout);
            this.browserConnection?.removeListener('message', responseHandler);
            resolve(response.data);
          }
        } catch (error) {
          // 忽略非JSON消息
        }
      };
      
      this.browserConnection.on('message', responseHandler);
      
      // 发送消息
      const message = JSON.stringify({ type, id, data });
      this.browserConnection.send(message);
      debugLog(`📤 发送消息到浏览器: ${type}`, data);
    });
  }

  /**
   * 发送响应
   * @param id 消息ID
   * @param data 响应数据
   */
  private sendResponse(id: string, data: any): void {
    if (!this.browserConnection) return;
    
    const response = JSON.stringify({ id, data });
    this.browserConnection.send(response);
  }

  /**
   * 关闭连接
   */
  close(): void {
    if (this.browserConnection) {
      this.browserConnection.close();
      this.browserConnection = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    debugLog('👋 WebSocket服务器已关闭');
  }

  /**
   * 检查浏览器是否已连接
   */
  isConnected(): boolean {
    return this.browserConnection !== null;
  }
}

// 创建单例实例
export const browserConnector = new BrowserConnector();