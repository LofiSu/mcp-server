import { 
  GetConsoleLogsTool, 
  ScreenshotTool,
  Tool,
} from "../types/tools.js";
import { Context } from "../types/context.js";
import { 
  createToolSchema, 
  createTextResponse, 
  handleToolError
} from "./helpers.js";

// 获取控制台日志工具
export const getConsoleLogs: Tool = {
  schema: createToolSchema(GetConsoleLogsTool),
  handle: async (context: Context, params?: Record<string, any>) => {
    try {
      // 使用参数或默认值
      const options = params || {};
      // 使用新的浏览器动作发送方法
      const consoleLogs = await context.sendBrowserAction(
        "getConsoleLogs",
        options,
      );
      interface ConsoleLog {
        level: string;
        message: string;
        timestamp: number;
      }
      
      const text: string = (consoleLogs as unknown as ConsoleLog[])
        .map((log) => JSON.stringify(log))
        .join("\n");
      return createTextResponse(text);
    } catch (error) {
      return handleToolError(error);
    }
  },
};

// 截图工具
export const screenshot: Tool = {
  schema: createToolSchema(ScreenshotTool),
  handle: async (context: Context, params?: Record<string, any>) => {
    try {
      // 使用参数或默认值
      const options = params || {};
      // 使用新的浏览器动作发送方法
      const screenshot = await context.sendBrowserAction(
        "screenshot",
        options,
      );
      return {
        content: [
          {
            type: "image",
            data: screenshot as string,
            mimeType: "image/png",
          },
        ],
      };
    } catch (error) {
      return handleToolError(error);
    }
  },
};