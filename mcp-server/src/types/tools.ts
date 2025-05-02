// mcp-server/src/types/tools.ts
import { z } from "zod";

import type {
  ImageContent,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import type { JsonSchema7Type } from "zod-to-json-schema";
import { Context } from "../types/context.js";

// 基础类型定义
export type ToolSchema = {
  name: string;
  description: string;
  inputSchema: JsonSchema7Type;
};

export type ToolResult = {
  content: (ImageContent | TextContent)[];
  isError?: boolean;
};

// 自定义工具接口，兼容 SDK 的 Tool 类型
export interface CustomTool {
  schema: ToolSchema;
  handle: (
    context: Context,
    params?: Record<string, any>
  ) => Promise<ToolResult>;
}

// 使用 SDK 的 Tool 类型名称，但结构与我们自定义的一致
export type Tool = CustomTool;

export type ToolFactory = (snapshot: boolean) => Tool;

// 工具类型分组
type ToolCategory = 'navigation' | 'interaction' | 'utility' | 'snapshot';

// 工具定义辅助函数
const createTool = <T extends string, D extends string, A extends z.ZodTypeAny>(
  category: ToolCategory,
  name: T, 
  description: D, 
  argsSchema: A
) => ({
  shape: {
    name: z.literal(name),
    description: z.literal(description),
    argsSchema,
  },
  category,
});

// 导航类工具
export const NavigateTool = createTool(
  'navigation',
  'navigate',
  'Navigate to a specified URL',
  z.object({
    url: z.string().url("Invalid URL format"),
  })
);

export const GoBackTool = createTool(
  'navigation',
  'goBack',
  'Navigate back in browser history',
  z.object({})
);

export const GoForwardTool = createTool(
  'navigation',
  'goForward',
  'Navigate forward in browser history',
  z.object({})
);

// 交互类工具
export const PressKeyTool = createTool(
  'interaction',
  'pressKey',
  'Press a keyboard key',
  z.object({
    key: z.string().min(1, "Key must not be empty"),
  })
);

export const ClickTool = createTool(
  'interaction',
  'click',
  'Click on an element on the page',
  z.object({
    selector: z.string(),
    rightClick: z.boolean().optional().default(false),
    doubleClick: z.boolean().optional().default(false),
    offset: z.object({
      x: z.number(),
      y: z.number()
    }).optional()
  })
);

export const HoverTool = createTool(
  'interaction',
  'hover',
  'Hover over an element on the page',
  z.object({
    selector: z.string(),
    duration: z.number().optional().default(1000)
  })
);

export const DragTool = createTool(
  'interaction',
  'drag',
  'Drag an element to a target position',
  z.object({
    sourceSelector: z.string(),
    targetSelector: z.string().optional(),
    targetPosition: z.object({
      x: z.number(),
      y: z.number()
    }).optional()
  })
);

export const TypeTool = createTool(
  'interaction',
  'type',
  'Type text into an input element',
  z.object({
    selector: z.string(),
    text: z.string(),
    clear: z.boolean().optional().default(true),
    delay: z.number().optional().default(50)
  })
);

export const SelectOptionTool = createTool(
  'interaction',
  'selectOption',
  'Select an option from a select element',
  z.object({
    selector: z.string(),
    value: z.string().optional(),
    label: z.string().optional(),
    multiple: z.boolean().optional().default(false)
  })
);

// 工具类工具
export const WaitTool = createTool(
  'utility',
  'wait',
  'Wait for a specified duration',
  z.object({
    time: z.number().min(0, "Time must be positive"),
  })
);

export const GetConsoleLogsTool = createTool(
  'utility',
  'getConsoleLogs',
  'Get browser console logs',
  z.object({
    limit: z.number().optional(),
    level: z.enum(["info", "warn", "error", "debug"]).optional()
  })
);

export const ScreenshotTool = createTool(
  'utility',
  'screenshot',
  'Take a screenshot of the current page',
  z.object({
    selector: z.string().optional(),
    fullPage: z.boolean().optional().default(false),
    format: z.enum(["png", "jpeg"]).optional().default("png"),
    quality: z.number().min(0).max(100).optional().default(80)
  })
);

// 快照工具
export const SnapshotTool = createTool(
  'snapshot',
  'snapshot',
  'Take a snapshot of the current page state',
  z.object({
    includeDom: z.boolean().optional().default(true),
    includeAria: z.boolean().optional().default(true),
    selector: z.string().optional()
  })
);

// 按类别分组工具
export const TOOLS_BY_CATEGORY = {
  navigation: [NavigateTool, GoBackTool, GoForwardTool],
  interaction: [ClickTool, HoverTool, TypeTool, PressKeyTool, SelectOptionTool, DragTool],
  utility: [WaitTool, GetConsoleLogsTool, ScreenshotTool],
  snapshot: [SnapshotTool]
};

// 所有工具列表
export const ALL_TOOLS = [
  ...TOOLS_BY_CATEGORY.navigation,
  ...TOOLS_BY_CATEGORY.interaction,
  ...TOOLS_BY_CATEGORY.utility,
  ...TOOLS_BY_CATEGORY.snapshot
];

// 工具类型定义
export type ToolType = 
  | typeof NavigateTool
  | typeof GoBackTool
  | typeof GoForwardTool
  | typeof PressKeyTool
  | typeof WaitTool
  | typeof GetConsoleLogsTool
  | typeof ScreenshotTool
  | typeof ClickTool
  | typeof HoverTool
  | typeof DragTool
  | typeof TypeTool
  | typeof SelectOptionTool
  | typeof SnapshotTool;