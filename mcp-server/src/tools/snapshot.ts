import { Tool } from "../types/tools.js";
import { Context } from "../types/context.js";
import { captureAriaSnapshot } from "../utils/aria-snapshot.js";
import { SnapshotTool } from "../types/tools.js";
import { 
  createToolSchema, 
  handleToolError 
} from "./helpers.js";

// 快照工具
export const snapshot: Tool = {
  schema: createToolSchema(SnapshotTool),
  handle: async (context: Context) => {
    try {
      return await captureAriaSnapshot(context);
    } catch (error) {
      return handleToolError(error);
    }
  },
};
