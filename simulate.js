const fs = require('fs');

function rewriteCchInSystemPrompt(upstreamBody) {
    const bodyJson = JSON.parse(upstreamBody);
    if (!bodyJson.system) return upstreamBody;

    const rewriteRegex = /^\s*(x-anthropic-billing-header:[\s\S]*?cch=)[^;]+(;)/;
    
    if (typeof bodyJson.system === "string" && bodyJson.system.trim().startsWith("x-anthropic-billing-header:")) {
        bodyJson.system = bodyJson.system.replace(rewriteRegex, "$1A1234$2");
    } else if (Array.isArray(bodyJson.system) && bodyJson.system.length > 0) {
        const block = bodyJson.system[0];
        if (block.type === "text" && typeof block.text === "string" && block.text.trim().startsWith("x-anthropic-billing-header:")) {
            block.text = block.text.replace(rewriteRegex, "$1A1234$2");
        }
    }
    return JSON.stringify(bodyJson);
}

function convertRequest(clientReq) {
    const messages = [];

    if (clientReq.system) {
        let systemContent = "";
        if (typeof clientReq.system === "string") {
            systemContent = clientReq.system;
        } else if (Array.isArray(clientReq.system)) {
            systemContent = clientReq.system.map((s) => s.text).join("\n\n");
        }
        messages.push({ role: "system", content: systemContent });
    }

    for (const msg of clientReq.messages) {
        if (msg.role === "user") {
            if (typeof msg.content === "string") {
                messages.push({ role: "user", content: msg.content });
            } else if (Array.isArray(msg.content)) {
                const toolResults = msg.content.filter((b) => b.type === "tool_result");
                const normalBlocks = msg.content.filter((b) => b.type !== "tool_result");

                if (normalBlocks.length > 0) {
                    const texts = normalBlocks.map((b) => b.text || "").join("\n");
                    messages.push({ role: "user", content: texts });
                }

                for (const tr of toolResults) {
                    messages.push({
                        role: "tool",
                        tool_call_id: tr.tool_use_id,
                        content: typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content),
                    });
                }
            }
        } else if (msg.role === "assistant") {
            if (typeof msg.content === "string") {
                messages.push({ role: "assistant", content: msg.content });
            } else if (Array.isArray(msg.content)) {
                const textBlocks = msg.content.filter((b) => b.type === "text" || b.type === "thinking");
                const toolUseBlocks = msg.content.filter((b) => b.type === "tool_use");

                const combinedText = textBlocks
                    .map((b) => {
                        if (b.type === "thinking") return `<thinking>\n${b.thinking}\n</thinking>`;
                        return b.text;
                    })
                    .join("\n");

                const assistantMsg = {
                    role: "assistant",
                    content: combinedText || null,
                };

                if (toolUseBlocks.length > 0) {
                    assistantMsg.tool_calls = toolUseBlocks.map((tu) => ({
                        id: tu.id || `call_STATIC`,
                        type: "function",
                        function: {
                            name: tu.name || "",
                            arguments: JSON.stringify(tu.input || {}),
                        },
                    }));
                }
                messages.push(assistantMsg);
            }
        }
    }

    const openaiTools = clientReq.tools?.map((tool) => ({
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
        },
    }));

    return {
        model: clientReq.model,
        messages,
        tools: openaiTools,
    };
}

let d1Str = fs.readFileSync('9527.json', 'utf8');
let d2Str = fs.readFileSync('9528.json', 'utf8');

d1Str = rewriteCchInSystemPrompt(d1Str);
d2Str = rewriteCchInSystemPrompt(d2Str);

const out1 = convertRequest(JSON.parse(d1Str));
const out2 = convertRequest(JSON.parse(d2Str));

function compare(obj1, obj2, path = '') {
  if (typeof obj1 !== typeof obj2) return `Type diff at ${path}: ${typeof obj1} vs ${typeof obj2}`;
  
  if (typeof obj1 === 'object' && obj1 !== null) {
    if (Array.isArray(obj1)) {
      if (obj1.length !== obj2.length) console.log(`Array length diff at ${path}: ${obj1.length} vs ${obj2.length}`);
      for (let i = 0; i < Math.min(obj1.length, obj2.length); i++) {
        let diff = compare(obj1[i], obj2[i], `${path}[${i}]`);
        if (diff) return diff;
      }
      if (obj1.length !== obj2.length) return `Array length differs after identical prefix at ${path}`;
    } else {
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);
      for (let k of keys1) {
        let diff = compare(obj1[k], obj2[k], path ? `${path}.${k}` : k);
        if (diff) return diff;
      }
    }
  } else {
    if (obj1 !== obj2) {
      return `Value diff at ${path}:\n9527: ${String(obj1).substring(0, 100)}...\n9528: ${String(obj2).substring(0, 100)}...`;
    }
  }
  return null;
}

console.log(compare(out1, out2));

