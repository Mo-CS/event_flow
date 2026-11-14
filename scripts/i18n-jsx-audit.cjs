const fs = require("fs")
const path = require("path")
const ts = require("typescript")
const srcRoot = path.join(process.cwd(), "src")
const SKIP = new Set(["i18n", "__tests__", "test", "node_modules", "types"])
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name), out) }
    else if (e.isFile() && /\.(tsx|ts)$/.test(e.name)) out.push(path.join(dir, e.name))
  }
  return out
}
const results = []
for (const file of walk(srcRoot)) {
  const text = fs.readFileSync(file, "utf8")
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const v = node.getText(source).replace(/\s+/g, " ").trim()
      if (v && /[A-Za-z]/.test(v)) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
        results.push({ file: path.relative(process.cwd(), file), line, kind: "jsx-text", value: v })
      }
    }
    if (ts.isJsxExpression(node) && node.expression && ts.isTemplateExpression(node.expression)) {
      const v = node.expression.getText(source)
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
      results.push({ file: path.relative(process.cwd(), file), line, kind: "template", value: v })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}
fs.writeFileSync("i18n-jsx-audit.txt", results.map((r) => `${r.file}:${r.line} [${r.kind}] ${JSON.stringify(r.value)}`).join("\n"))
console.log("count", results.length)
