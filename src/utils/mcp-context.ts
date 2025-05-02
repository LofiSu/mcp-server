import { browserConnector } from './browser-connector.js';
import { debugLog } from './log.js';

/**
 * MCP上下文
 * 提供与浏览器通信的接口
 */
export class McpContext {
  /**
   * 发送Socket消息到浏览器
   * @param type 消息类型
   * @param payload 消息数据
   * @returns 浏览器响应
   */
  async sendSocketMessage(type: string, payload: any): Promise<any> {
    try {
      // 检查浏览器是否已连接
      if (!browserConnector.isConnected()) {
        debugLog(`❌ 浏览器未连接，无法发送消息: ${type}`);
        return undefined;
      }
      
      // 发送消息到浏览器
      const result = await browserConnector.sendMessage(type, payload);
      debugLog(`📥 收到浏览器响应: ${type}`, result);
      return result;
    } catch (error) {
      debugLog(`❌ 发送Socket消息时出错: ${type}`, error);
      return undefined;
    }
  }
}

// 创建单例实例
export const mcpContext = new McpContext();