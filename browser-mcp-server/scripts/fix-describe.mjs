import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const dir = join(fileURLToPath(new URL(".", import.meta.url)), "..", "src", "tools");
const files = readdirSync(dir).filter(f => f.endsWith(".ts"));

const pt = [
  [" padrão", " default"], ["(padrão:", "(default:"], ["(padrão", "(default"],
  [" opcional", " optional"], ["opcional.", "optional."],
  [" máximo", " maximum"], ["mínimo", " minimum"],
  [" separados por vírgula", " comma-separated"], ["separados por virgula", "comma-separated"],
  ["Nível", "Level:"], ["nível", "level"],
  ["Nome", "Name:"], ["nome", "name:"],
  ["Código", "Code:"], ["código", "code"],
  ["Ação", "Action:"], ["ação", "action"],
  ["Idioma", "Language"],
  ["Filtrar", "Filter "], ["filtrar", "filter "],
  ["Limpa", "Clear "],
  ["Tipo", "Type:"], ["tipo", "type"],
  ["Objeto", "Object"], ["Chave", "Key"], ["Valor", "Value"],
  ["Preset", "Preset"], ["Dispositivo", "Device"],
  ["Inclui", "Includes "],
  ["Oculto", "Hidden"], ["oculto", "hidden"],
  ["Primeiro", "First"], ["primeiro", "first"],
  ["Ativar", "Activate"], ["ativar", "activate"],
  ["Gravação", "Recording"], ["gravação", "recording"],
  ["Inicia", "Start"], ["Finaliza", "Stop"],
  ["string com", "string with"], ["string de", "string of"],
  ["página", "page"], ["Página", "Page"],
  ["navegador", "browser"], ["Navegador", "Browser"],
  ["elemento", "element"], ["Elemento", "Element"],
  ["seletor", "selector"], ["Seletor", "Selector"],
  ["arquivo", "file"], ["Arquivo", "File"],
  ["caminho", "path"], ["Caminho", "Path"],
  ["diretório", "directory"],
  ["extensão", "extension"], ["Extensão", "Extension"],
  ["customizado", "custom"], ["customizada", "custom"],
  ["específica", "specific"], ["específico", "specific"],
  ["somente", "only"], ["apenas", "only"],
  ["também", "also"], ["tambem", "also"],
  ["onde", "where"], ["como", "as"],
  ["entre", "between"], ["sobre", "about"],
  ["antes", "before"], ["depois", "after"],
  ["contendo", "containing"],
  ["usando", "using"],
  ["através", "through"],
  ["Sobre", "About"],
  ["Não", "Not"], ["não", "not"],
  ["com", "with"], ["sem", "without"],
];

let totalChanged = 0;
for (const file of files) {
  const fpath = join(dir, file);
  let content = readFileSync(fpath, "utf-8");
  let changed = false;

  content = content.replace(/\.describe\(['"]([^'"]+)['"]\)/g, (match, inner) => {
    let newInner = inner;
    for (const [from, to] of pt) {
      if (newInner.includes(from)) {
        newInner = newInner.replaceAll(from, to);
        changed = true;
      }
    }
    return '.describe("' + newInner + '")';
  });

  if (changed) {
    writeFileSync(fpath, content);
    console.log("✓ " + file);
    totalChanged++;
  }
}

console.log("\n" + totalChanged + " files updated");
