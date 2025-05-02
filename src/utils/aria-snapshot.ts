import { ToolResult } from "../types/tools.js";
import { Context } from "../types/context.js";


export async function captureAriaSnapshot(
  context: Context,
  status: string = "",
): Promise<ToolResult> {
  // 检查浏览器连接状态
  const browserState = await context.getBrowserState();
  if (!browserState.connected) {
    return {
      content: [
        {
          type: "text",
          text: `浏览器已断开连接，无法获取页面快照。请检查浏览器是否正常运行，或尝试重新启动服务器。`,
        },
      ],
    };
  }

  try {
    const url = await context.sendSocketMessage("getUrl", undefined);
    const title = await context.sendSocketMessage("getTitle", undefined);
    const snapshot = await context.sendSocketMessage("browser_snapshot", {});
    
    // 检查返回值是否有效
    if (!url || !title || !snapshot) {
      return {
        content: [
          {
            type: "text",
            text: `无法获取完整的页面信息。浏览器可能在操作过程中断开了连接。`,
          },
        ],
      };
    }
    
    return {
      content: [
        {
          type: "text",
          text: `${status ? `${status}\n` : ""}
- Page URL: ${url}
- Page Title: ${title}
- Page Snapshot
\`\`\`yaml
${snapshot}
\`\`\`
`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `捕获页面快照时出错: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}
