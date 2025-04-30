export interface Context {
  socket?: any;
  sendSocketMessage(type: string, payload: any): Promise<any>;
  wait(ms: number): Promise<void>;
  getBrowserState(): Promise<any>;
  executeBrowserAction(action: string, params: any): Promise<any>;
}