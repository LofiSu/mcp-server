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
      const defaultParams = { url: "https://www.bilibili.com" };
      const mergedParams = { ...defaultParams, ...(params || {}) };
      const validatedParams = validateToolParams(NavigateTool.shape.argsSchema, mergedParams);
      
      // 发送导航消息到插件
      debugLog("请求插件导航到: " + validatedParams.url);
      // 使用新的浏览器动作发送方法
      await context.sendBrowserAction("navigate", { url: validatedParams.url });

      // 捕获快照 (通过插件)
      debugLog("请求插件捕获页面快照");
      try {
        const snapshot = await captureAriaSnapshot(context);
        return createSnapshotResponse("导航成功", snapshot.content);
      } catch (snapshotError: any) {
        debugLog("捕获快照失败: " + snapshotError.message);
        return createSnapshotResponse(
          "导航可能成功，但无法获取快照",
          [{
            type: "text",
            text: "Navigation may have succeeded, but snapshot failed."
          }]
        );
      }
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
      // 发送后退消息到插件
      debugLog("请求插件执行后退操作");
      // 使用新的浏览器动作发送方法
      await context.sendBrowserAction("goBack", {});

      // sendSocketMessage 包含等待响应或超时的逻辑，此处不再需要额外等待

      // 捕获快照 (通过插件)
      debugLog("请求插件捕获页面快照");
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
      // 发送前进消息到插件
      debugLog("请求插件执行前进操作");
      // 使用新的浏览器动作发送方法
      await context.sendBrowserAction("goForward", {});

      // sendSocketMessage 包含等待响应或超时的逻辑，此处不再需要额外等待

      // 捕获快照 (通过插件)
      debugLog("请求插件捕获页面快照");
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
      
      // 发送按键消息到插件
      debugLog("请求插件模拟按键: " + validatedParams.key);
      // 使用新的浏览器动作发送方法
      await context.sendBrowserAction("pressKey", { key: validatedParams.key });

      // sendSocketMessage 包含等待响应或超时的逻辑，此处不再需要额外等待

      // 捕获快照 (通过插件)
      debugLog("请求插件捕获页面快照");
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
