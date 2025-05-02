import { ToolResult } from "../types/tools.js";
import { Context } from "../types/context.js";


export async function captureAriaSnapshot(
  context: Context,
  status: string = "",
): Promise<ToolResult> {
  // 检查插件连接状态 (由 mcpContext 内部管理)
  if (!context.isConnected()) {
    return {
      content: [
        {
          type: "text",
          text: `浏览器插件未连接，无法获取页面快照。请确保插件已安装并运行。`,
        },
      ],
    };
  }

  try {
    // 从插件获取 URL, Title 和 Snapshot
    // 注意：这里假设插件 API 需要 'getUrl', 'getTitle', 'snapshot' 类型的消息
    const url = await context.sendSocketMessage("getUrl", undefined);
    const title = await context.sendSocketMessage("getTitle", undefined);
    const snapshot = await context.sendSocketMessage("snapshot", {});

    // 检查返回值是否有效 (插件可能返回 null 或 undefined)
    if (url === null || url === undefined || title === null || title === undefined || snapshot === null || snapshot === undefined) {
        let missingInfo = [];
        if (url === null || url === undefined) missingInfo.push("URL");
        if (title === null || title === undefined) missingInfo.push("Title");
        if (snapshot === null || snapshot === undefined) missingInfo.push("Snapshot");
        
        return {
            content: [
                {
                    type: "text",
                    text: `无法从插件获取完整的页面信息 (${missingInfo.join(', ')} missing). 插件可能未正确响应或页面状态异常。`,
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
