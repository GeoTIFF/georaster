const fs = require("fs");

const args = process.argv.slice(2);

const pattern = /{~{[^}]*}~}/g;
const template_path = "precompiled/templates";
const outdir = "src";

const files = fs.readdirSync(template_path);

files.forEach(filename => {
  const filepath = template_path + "/" + filename;
  let text = fs.readFileSync(filepath, "utf-8");
  const targets = text.match(pattern);
  targets.forEach(target => {
    const target_filepath = target.replace("{~{","").replace("}~}","").trim();
    const insertion = fs.readFileSync(target_filepath, "utf-8");
    text = text.replace(target, insertion);
    fs.writeFileSync(outdir + "/" + filename, text, "utf-8");
  });
});