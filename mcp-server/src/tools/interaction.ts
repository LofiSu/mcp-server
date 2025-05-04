import { captureAriaSnapshot } from "../utils/aria-snapshot.js";
import { 
  ClickTool, 
  DragTool, 
  HoverTool, 
  SelectOptionTool, 
  TypeTool,
  Tool,
} from "../types/tools.js";
import { Context } from "../types/context.js";
import { 
  createToolSchema, 
  createSnapshotResponse, 
  handleToolError,
  validateToolParams 
} from "./helpers.js";

// 点击工具
export const click: Tool = {
  schema: createToolSchema(ClickTool),
  handle: async (context: Context, params?: Record<string, any>) => {
    try {
      const validatedParams = validateToolParams(ClickTool.shape.argsSchema, params);
      // 使用新的浏览器动作发送方法
      await context.sendBrowserAction("click", validatedParams);
      const snapshot = await captureAriaSnapshot(context);
      return createSnapshotResponse(`点击了 "${validatedParams.selector}"`, snapshot.content);
    } catch (error) {
      return handleToolError(error);
    }
  },
};

// 拖拽工具
export const drag: Tool = {
  schema: createToolSchema(DragTool),
  handle: async (context: Context, params?: Record<string, any>) => {
    try {
      const validatedParams = validateToolParams(DragTool.shape.argsSchema, params);
      // 使用新的浏览器动作发送方法
      await context.sendBrowserAction("drag", validatedParams);
      const snapshot = await captureAriaSnapshot(context);
      return createSnapshotResponse(
        `将 "${validatedParams.sourceSelector}" 拖拽到 "${validatedParams.targetSelector}"`, 
        snapshot.content
      );
    } catch (error) {
      return handleToolError(error);
    }
  },
};

// 悬停工具
export const hover: Tool = {
  schema: createToolSchema(HoverTool),
  handle: async (context: Context, params?: Record<string, any>) => {
    try {
      const validatedParams = validateToolParams(HoverTool.shape.argsSchema, params);
      // 使用新的浏览器动作发送方法
      await context.sendBrowserAction("hover", validatedParams);
      const snapshot = await captureAriaSnapshot(context);
      return createSnapshotResponse(`悬停在 "${validatedParams.selector}" 上`, snapshot.content);
    } catch (error) {
      return handleToolError(error);
    }
  },
};

// 输入工具
export const type: Tool = {
  schema: createToolSchema(TypeTool),
  handle: async (context: Context, params?: Record<string, any>) => {
    try {
      const validatedParams = validateToolParams(TypeTool.shape.argsSchema, params);
      // 使用新的浏览器动作发送方法
      await context.sendBrowserAction("type", validatedParams);
      const snapshot = await captureAriaSnapshot(context);
      return createSnapshotResponse(
        `在 "${validatedParams.selector}" 中输入了 "${validatedParams.text}"`, 
        snapshot.content
      );
    } catch (error) {
      return handleToolError(error);
    }
  },
};

// 选择选项工具
export const selectOption: Tool = {
  schema: createToolSchema(SelectOptionTool),
  handle: async (context: Context, params?: Record<string, any>) => {
    try {
      const validatedParams = validateToolParams(SelectOptionTool.shape.argsSchema, params);
      // 使用新的浏览器动作发送方法
      await context.sendBrowserAction("selectOption", validatedParams);
      const snapshot = await captureAriaSnapshot(context);
      return createSnapshotResponse(`在 "${validatedParams.selector}" 中选择了选项`, snapshot.content);
    } catch (error) {
      return handleToolError(error);
    }
  },
};