function plainInline(value) {
  return value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[entity.toLowerCase()])
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (match, code) => {
      const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    })
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function tableCells(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map(value => value.trim());
}

/** Convert provider formatting to readable text. Render the result as React text only. */
export function readableChatText(content) {
  if (typeof content !== "string") return "";
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const output = [];
  let headers = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const cells = tableCells(line);
      const separator = lines[index + 1]?.trim().startsWith("|") && tableCells(lines[index + 1]).every(cell => /^:?-{3,}:?$/.test(cell));
      if (separator) { headers = cells; index += 1; continue; }
      output.push(cells.map((cell, column) => {
        const value = plainInline(cell);
        return column === 0 || !headers?.[column] ? value : `${plainInline(headers[column])}\n${value}`;
      }).join("\n\n"), "");
    } else {
      headers = null;
      if (/^\s*(?:---+|\*\*\*+|```.*)\s*$/.test(line)) { output.push(""); continue; }
      output.push(plainInline(line.replace(/^\s*#{1,6}\s+/, "").replace(/^\s*[-*]\s+/, "• ")));
    }
  }
  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
