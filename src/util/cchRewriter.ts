export function rewriteCchInSystemPrompt(upstreamBody: string): string {
    try {
        const bodyJson = JSON.parse(upstreamBody);
        if (!bodyJson.system) return upstreamBody;

        let modified = false;
        const rewriteRegex = /^\s*(x-anthropic-billing-header:[\s\S]*?cch=)[^;]+(;)/;
        
        if (typeof bodyJson.system === "string" && bodyJson.system.trim().startsWith("x-anthropic-billing-header:")) {
            const originalSystem = bodyJson.system;
            bodyJson.system = bodyJson.system.replace(rewriteRegex, "$1A1234$2");
            modified = bodyJson.system !== originalSystem;
        } else if (Array.isArray(bodyJson.system) && bodyJson.system.length > 0) {
            const block = bodyJson.system[0];
            if (block.type === "text" && typeof block.text === "string" && block.text.trim().startsWith("x-anthropic-billing-header:")) {
                const originalText = block.text;
                block.text = block.text.replace(rewriteRegex, "$1A1234$2");
                modified = block.text !== originalText;
            }
        }

        if (modified) {
            console.log("[cchRewriter] Rewrote cch in system prompt");
            return JSON.stringify(bodyJson);
        }
    } catch (e) {
        console.log("[cchRewriter] Failed to rewrite cch:", e);
    }
    return upstreamBody;
}
