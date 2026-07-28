import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const dir = join(fileURLToPath(new URL(".", import.meta.url)), "..", "src", "tools");
const pairs = [
  ["Navegando para:", "Navigating to:"],
  ["Clicando em:", "Clicking on:"],
  ["Preenchendo campo:", "Filling field:"],
  ["Extraindo texto", "Extracting text"],
  ["Fechando navegador", "Closing browser"],
  ["Pressionando:", "Pressing:"],
  ["Arrastando:", "Dragging:"],
  ["Capturando screenshot", "Taking screenshot"],
  ["Exportando PDF", "Exporting PDF"],
  ["Rolando para:", "Scrolling to:"],
  ["Selecionando:", "Selecting:"],
  ["Destacando:", "Highlighting:"],
  ["Atualizando pagina", "Refreshing page"],
  ["Voltando", "Going back"],
  ["Abrindo nova aba", "Opening new tab"],
  ["Salvando snapshot", "Saving snapshot"],
  ["Enviando webhook", "Sending webhook"],
  ["Webhook enviado", "Webhook sent"],
  ["Encontrados", "Found"],
  ["Verificando sitemap", "Checking sitemap"],
  ["páginas", "pages"],
  ["profundidade", "depth"],
  ["violações", "violations"],
  ["Verificados:", "Checked:"],
  ["Bloqueios ativos:", "Active blocks:"],
  ["Marcador adicionado:", "Mark added:"],
  ["Todas as estrategias", "All strategies"],
  ["Gerenciando bloqueios", "Managing blocks"],
  ["Erro ao clicar", "Error clicking"],
  ["Erro ao preencher", "Error filling"],
];

let totalChanged = 0;
const files = readdirSync(dir).filter(f => f.endsWith(".ts"));

for (const file of files) {
  const fpath = join(dir, file);
  let content = readFileSync(fpath, "utf-8");
  let changed = false;
  for (const [from, to] of pairs) {
    const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    if (regex.test(content)) {
      content = content.replace(regex, to);
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(fpath, content);
    console.log("✓ " + file);
    totalChanged++;
  }
}

console.log("\n" + totalChanged + " files updated");
