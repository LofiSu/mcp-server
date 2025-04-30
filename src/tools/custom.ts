import { zodToJsonSchema } from "zod-to-json-schema";

import { Tool, ToolResult } from "./tool.js";
import { GetConsoleLogsTool, ScreenshotTool } from "../types/tools.js";
import { Context } from "../types/context.js";

export const getConsoleLogs: Tool = {
  schema: {
    name: GetConsoleLogsTool.shape.name.value,
    description: GetConsoleLogsTool.shape.description.value,
    inputSchema: zodToJsonSchema(GetConsoleLogsTool.shape.arguments),
  },
  handle: async (context, _params) => {
    const consoleLogs = await context.sendSocketMessage(
      "browser_get_console_logs",
      {},
    );
    interface ConsoleLog {
      level: string;
      message: string;
      timestamp: number;
    }
    
    const text: string = (consoleLogs as unknown as ConsoleLog[])
      .map((log) => JSON.stringify(log))
      .join("\n");
    return {
      content: [
        {
          type: "text",
          text: text as string,
        },
      ],
    };
  },
};

export const screenshot: Tool = {
  schema: {
    name: ScreenshotTool.shape.name.value,
    description: ScreenshotTool.shape.description.value,
    inputSchema: zodToJsonSchema(ScreenshotTool.shape.arguments),
  },
  handle: async (context: Context): Promise<ToolResult> => {
    const screenshot = await context.sendSocketMessage(
      "browser_screenshot",
      {},
    );
    return {
      content: [
        {
          type: "image",
          data: screenshot as unknown as string,
          mimeType: "image/png",
        },
      ],
    };
  },
};
