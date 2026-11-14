const fs = require("fs")
const path = require("path")
const ts = require("typescript")
const root = process.cwd()
const srcRoot = path.join(root, "src")
const SKIP = new Set(["i18n", "__tests__", "test", "node_modules", "types"])
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name), out) }
    else if (e.isFile() && /\.(tsx?|ts)$/.test(e.name)) out.push(path.join(dir, e.name))
  }
  return out
}
const keys = new Map()
for (const file of walk(srcRoot)) {
  const text = fs.readFileSync(file, "utf8")
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t") {
      const first = node.arguments[0]
      if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
        keys.set(first.text, (keys.get(first.text) || 0) + 1)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}
const dir = path.join(srcRoot, "i18n/ar")
const dict = new Set()
for (const f of fs.readdirSync(dir)) {
  const text = fs.readFileSync(path.join(dir, f), "utf8")
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }
  new Function("exports", "module", js)(module.exports, module)
  for (const k of Object.keys(module.exports)) {
    const obj = module.exports[k]
    if (obj && typeof obj === "object") Object.keys(obj).forEach((x) => dict.add(x))
  }
}
const missing = [...keys.keys()].filter((k) => !dict.has(k))
fs.writeFileSync("i18n-missing-new.json", JSON.stringify(missing, null, 2))
console.log("t() keys:", keys.size)
console.log("dictionary keys:", dict.size)
console.log("missing:", missing.length)
console.log(missing.join("\n"))
