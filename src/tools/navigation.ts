import { captureAriaSnapshot } from "../utils/aria-snapshot.js";
import { 
  GoBackTool, 
  GoForwardTool, 
  NavigateTool, 
  PressKeyTool, 
  WaitTool,
  Tool,
} from "../types/tools.js";
import { Context } from "../types/context.js";
import { 
  createToolSchema, 
  createSnapshotResponse, 
  handleToolError,
  validateToolParams 
} from "./helpers.js";
import { debugLog } from "../utils/log.js";

// 导航工具
export const navigate: Tool = {
  schema: createToolSchema(NavigateTool),
  handle: async (context: Context, params?: Record<string, any>) => {
    try {
      // 添加默认参数用于测试
      const defaultParams = { url: "https://github.com/LofiSu" };
      const mergedParams = { ...defaultParams, ...(params || {}) };
      const validatedParams = validateToolParams(NavigateTool.shape.argsSchema, mergedParams);
      
      // 检查浏览器连接状态
      const browserState = await context.getBrowserState();
      if (!browserState.connected) {
        return createSnapshotResponse(
          `导航到 "${validatedParams.url}" 失败：浏览器已断开连接`,
          [{
            type: "text",
            text: "浏览器已断开连接，无法获取页面快照。请检查浏览器是否正常运行，或尝试重新启动服务器。"
          }]
        );
      }
      // 发送导航消息
      await context.sendSocketMessage("browser_navigate", { url: validatedParams.url });
      
      // 等待页面加载（5秒）
      debugLog(`⏳ 等待页面加载: ${validatedParams.url}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 捕获快照
      const snapshot = await captureAriaSnapshot(context);
      return createSnapshotResponse(`导航到 "${validatedParams.url}"`, snapshot.content);
    } catch (error) {
      return handleToolError(error);
    }
  },
};

// 后退工具
export const goBack: Tool = {
  schema: createToolSchema(GoBackTool),
  handle: async (context: Context) => {
    try {
      await context.sendSocketMessage("browser_go_back", {});
      const snapshot = await captureAriaSnapshot(context);
      return createSnapshotResponse("在浏览器历史中后退", snapshot.content);
    } catch (error) {
      return handleToolError(error);
    }
  },
};

// 前进工具
export const goForward: Tool = {
  schema: createToolSchema(GoForwardTool),
  handle: async (context: Context) => {
    try {
      await context.sendSocketMessage("browser_go_forward", {});
      const snapshot = await captureAriaSnapshot(context);
      return createSnapshotResponse("在浏览器历史中前进", snapshot.content);
    } catch (error) {
      return handleToolError(error);
    }
  },
};

// 按键工具
export const pressKey: Tool = {
  schema: createToolSchema(PressKeyTool),
  handle: async (context: Context, params?: Record<string, any>) => {
    try {
      const validatedParams = validateToolParams(PressKeyTool.shape.argsSchema, params);
      await context.sendSocketMessage("browser_press_key", { key: validatedParams.key });
      const snapshot = await captureAriaSnapshot(context);
      return createSnapshotResponse(`按下键盘按键 "${validatedParams.key}"`, snapshot.content);
    } catch (error) {
      return handleToolError(error);
    }
  },
};

// 等待工具
export const wait: Tool = {
  schema: createToolSchema(WaitTool),
  handle: async (context: Context, params?: Record<string, any>) => {
    try {
      const validatedParams = validateToolParams(WaitTool.shape.argsSchema, params);
      const time = validatedParams.time;
      
      // 等待指定时间
      await new Promise(resolve => setTimeout(resolve, time));
      
      const snapshot = await captureAriaSnapshot(context);
      return createSnapshotResponse(`等待了 ${time}ms`, snapshot.content);
    } catch (error) {
      return handleToolError(error);
    }
  },
};
