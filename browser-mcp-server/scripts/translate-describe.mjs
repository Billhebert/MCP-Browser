import { readFileSync, writeFileSync } from "fs";
import { globSync } from "glob";

const dir = new URL("../src/tools", import.meta.url).pathname;
const files = readdirSync(dir).filter(f => f.endsWith(".ts"));

const pt = [
  [" padrão", " default"], ["(padrão:", "(default:"], ["(padrão", "(default"],
  [" opcional", " optional"], ["opcional.", "optional."],
  [" máximo", " maximum"], ["maximo", "maximum"],
  [" mínimo", " minimum"], ["minimo", "minimum"],
  [" separados por vírgula", " comma-separated"],
  ["separados por virgula", "comma-separated"],
  [" separados por vírgula)", " comma-separated)"],
  [" separados por virgula)", " comma-separated)"],
  ["Se true", "If true"], ["Se false", "If false"],
  ["se true", "if true"], ["se false", "if false"],
  ["JSON string", "JSON string"],
  ["JSON array", "JSON array"],
  ["(ex: ", "(e.g. "], ["ex: ", "e.g. "],
];

for (const file of files) {
  const path = join(dir, file);
  let content = readFileSync(path, "utf-8");
  let changed = false;

  // Only replace inside .describe("...") strings
  content = content.replace(/\.describe\("([^"]*)"\)/g, (match, inner) => {
    let newInner = inner;
    for (const [from, to] of pt) {
      if (newInner.includes(from)) {
        newInner = newInner.replaceAll(from, to);
        changed = true;
      }
    }
    return `.describe("${newInner}")`;
  });

  if (changed) {
    writeFileSync(path, content);
    console.log(`✓ ${file}`);
  }
}

console.log("Done");
