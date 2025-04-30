export class Context {
  private socket: WebSocket;

  constructor(socket: WebSocket) {
    this.socket = socket;
  }

  // 发送 WebSocket 消息的方法
  async sendSocketMessage(type: string, payload: any): Promise<string> {
    if (this.socket.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, payload });
      this.socket.send(message);
      return message;
    }
    return JSON.stringify({ type, payload });
  }

  // 等待特定时间的工具方法
  async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 获取当前浏览器状态
  async getBrowserState(): Promise<any> {
    // 实现获取浏览器状态的逻辑
    return {};
  }

  // 执行浏览器操作
  async executeBrowserAction(action: string, params: any): Promise<void> {
    await this.sendSocketMessage(`browser_${action}`, params);
  }
}
