function escapeTomlString(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, "\\\"")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
}


function buildTomlString(value: string): string {
    return `"${escapeTomlString(value)}"`;
}


function upsertRootTomlValue(content: string, key: string, value: string): string {
    const tableMatch = content.match(/^(\s*\[)/m);
    const tableIndex = tableMatch?.index ?? content.length;
    let root = content.slice(0, tableIndex);
    const rest = content.slice(tableIndex);
    const keyPattern = new RegExp(`^\\s*${key}\\s*=.*(?:\\n|$)`, "m");

    if (keyPattern.test(root)) {
        root = root.replace(keyPattern, `${key} = ${value}\n`);
    } else {
        root = `${root.replace(/\s*$/, "")}\n${key} = ${value}\n`;
    }

    return `${root}${rest ? `\n${rest.replace(/^\n+/, "")}` : ""}`.replace(/^\n+/, "");
}


function upsertTomlTable(content: string, tableName: string, values: Record<string, string>): string {
    const tablePattern = new RegExp(`^\\[${tableName.replace(/\./g, "\\.")}\\]\\n[\\s\\S]*?(?=^\\[|\\s*$)`, "m");
    const lines = [`[${tableName}]`];

    for (const [key, value] of Object.entries(values)) {
        lines.push(`${key} = ${value}`);
    }

    const tableContent = `${lines.join("\n")}\n`;
    if (tablePattern.test(content)) {
        return content.replace(tablePattern, tableContent);
    }

    return `${content.replace(/\s*$/, "")}\n\n${tableContent}`;
}


function getTomlValue(content: string, key: string): string | null {
    const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, "m"));
    return match?.[1] ?? null;
}


function getTomlTableValue(content: string, tableName: string, key: string): string | null {
    const lines = content.split(/\r?\n/);
    let inTable = false;

    for (const line of lines) {
        const tableMatch = line.match(/^\s*\[([^\]]+)]\s*$/);
        if (tableMatch) {
            inTable = tableMatch[1] === tableName;
            continue;
        }

        if (!inTable) {
            continue;
        }

        const valueMatch = line.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`));
        if (valueMatch) {
            return valueMatch[1] || "";
        }
    }

    return null;
}


export default {
    buildTomlString,
    escapeTomlString,
    getTomlTableValue,
    getTomlValue,
    upsertRootTomlValue,
    upsertTomlTable,
};
