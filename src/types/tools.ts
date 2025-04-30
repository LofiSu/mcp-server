// mcp-server/src/types/mcp/tool.ts
import { z } from "zod";

// 基础工具类型
const BaseTool = {
  shape: {
    name: z.string(),
    description: z.string(),
    arguments: z.object({}),
  },
};

// 导航工具
export const NavigateTool = {
  shape: {
    name: z.literal("navigate"),
    description: z.literal("Navigate to a specified URL"),
    arguments: z.object({
      url: z.string().url("Invalid URL format"),
    }),
  },
};

// 后退工具
export const GoBackTool = {
  shape: {
    name: z.literal("goBack"),
    description: z.literal("Navigate back in browser history"),
    arguments: z.object({}),
  },
};

// 前进工具
export const GoForwardTool = {
  shape: {
    name: z.literal("goForward"),
    description: z.literal("Navigate forward in browser history"),
    arguments: z.object({}),
  },
};

// 按键工具
export const PressKeyTool = {
  shape: {
    name: z.literal("pressKey"),
    description: z.literal("Press a keyboard key"),
    arguments: z.object({
      key: z.string().min(1, "Key must not be empty"),
    }),
  },
};

// 等待工具
export const WaitTool = {
  shape: {
    name: z.literal("wait"),
    description: z.literal("Wait for a specified duration"),
    arguments: z.object({
      time: z.number().min(0, "Time must be positive"),
    }),
  },
};


// 获取控制台日志工具
export const GetConsoleLogsTool = {
  shape: {
    name: z.literal("getConsoleLogs"),
    description: z.literal("Get browser console logs"),
    arguments: z.object({
      // 可选：限制返回的日志数量
      limit: z.number().optional(),
      // 可选：日志级别过滤
      level: z.enum(["info", "warn", "error", "debug"]).optional()
    })
  }
};

// 截图工具
export const ScreenshotTool = {
  shape: {
    name: z.literal("screenshot"),
    description: z.literal("Take a screenshot of the current page"),
    arguments: z.object({
      // 可选：指定截图区域
      selector: z.string().optional(),
      // 可选：是否全页面截图
      fullPage: z.boolean().optional().default(false),
      // 可选：输出格式
      format: z.enum(["png", "jpeg"]).optional().default("png"),
      // 可选：图片质量 (仅用于 JPEG)
      quality: z.number().min(0).max(100).optional().default(80)
    })
  }
};

// 点击工具
export const ClickTool = {
  shape: {
    name: z.literal("click"),
    description: z.literal("Click on an element on the page"),
    arguments: z.object({
      selector: z.string(),
      // 可选：是否右键点击
      rightClick: z.boolean().optional().default(false),
      // 可选：是否双击
      doubleClick: z.boolean().optional().default(false),
      // 可选：点击偏移量
      offset: z.object({
        x: z.number(),
        y: z.number()
      }).optional()
    })
  }
};

// 悬停工具
export const HoverTool = {
  shape: {
    name: z.literal("hover"),
    description: z.literal("Hover over an element on the page"),
    arguments: z.object({
      selector: z.string(),
      // 可选：悬停时间（毫秒）
      duration: z.number().optional().default(1000)
    })
  }
};

// 拖拽工具
export const DragTool = {
  shape: {
    name: z.literal("drag"),
    description: z.literal("Drag an element to a target position"),
    arguments: z.object({
      sourceSelector: z.string(),
      targetSelector: z.string().optional(),
      // 可选：目标坐标
      targetPosition: z.object({
        x: z.number(),
        y: z.number()
      }).optional()
    })
  }
};

// 输入文本工具
export const TypeTool = {
  shape: {
    name: z.literal("type"),
    description: z.literal("Type text into an input element"),
    arguments: z.object({
      selector: z.string(),
      text: z.string(),
      // 可选：是否清除现有内容
      clear: z.boolean().optional().default(true),
      // 可选：按键间隔（毫秒）
      delay: z.number().optional().default(50)
    })
  }
};

// 选择选项工具
export const SelectOptionTool = {
  shape: {
    name: z.literal("selectOption"),
    description: z.literal("Select an option from a select element"),
    arguments: z.object({
      selector: z.string(),
      // 可以通过值或文本选择
      value: z.string().optional(),
      label: z.string().optional(),
      // 可选：是否多选
      multiple: z.boolean().optional().default(false)
    })
  }
};

// 快照工具
export const SnapshotTool = {
  shape: {
    name: z.literal("snapshot"),
    description: z.literal("Take a snapshot of the current page state"),
    arguments: z.object({
      // 可选：是否包含DOM结构
      includeDom: z.boolean().optional().default(true),
      // 可选：是否包含可访问性树
      includeAria: z.boolean().optional().default(true),
      // 可选：指定区域
      selector: z.string().optional()
    })
  }
};


export type Tool = 
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