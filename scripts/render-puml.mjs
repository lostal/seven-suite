import { encode } from "plantuml-encoder";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { resolve, join } from "path";

const pumlDir = resolve("modelosUML/puml");
const svgDir = resolve("modelosUML/svg");
const pngDir = resolve("modelosUML/png");

if (!existsSync(svgDir)) mkdirSync(svgDir, { recursive: true });
if (!existsSync(pngDir)) mkdirSync(pngDir, { recursive: true });

async function render(name) {
  const pumlPath = join(pumlDir, `${name}.puml`);
  const svgPath = join(svgDir, `${name}.svg`);
  const pngPath = join(pngDir, `${name}.png`);

  if (!existsSync(pumlPath)) {
    console.log(`  SKIP: ${name}.puml no existe`);
    return;
  }

  const pumlContent = readFileSync(pumlPath, "utf-8");
  const encoded = encode(pumlContent);

  try {
    const svgUrl = `http://www.plantuml.com/plantuml/svg/${encoded}`;
    const svgRes = await fetch(svgUrl);
    if (svgRes.ok) {
      writeFileSync(svgPath, await svgRes.text());
      console.log(`  SVG: ${name}.svg`);
    } else {
      console.log(`  SVG FAIL (${svgRes.status}): ${name}.svg`);
    }

    const pngUrl = `http://www.plantuml.com/plantuml/png/${encoded}`;
    const pngRes = await fetch(pngUrl);
    if (pngRes.ok) {
      const pngBuffer = Buffer.from(await pngRes.arrayBuffer());
      writeFileSync(pngPath, pngBuffer);
      console.log(`  PNG: ${name}.png`);
    } else {
      console.log(`  PNG FAIL (${pngRes.status}): ${name}.png`);
    }
  } catch (err) {
    console.log(`  ERROR: ${name} - ${err.message}`);
  }
}

async function main() {
  const files = readdirSync(pumlDir).filter((f) => f.endsWith(".puml"));

  console.log(`Renderizando ${files.length} diagramas...\n`);

  for (const file of files) {
    const name = file.replace(".puml", "");
    console.log(`${name}:`);
    await render(name);
    console.log();
  }

  console.log("Done.");
}

main();
