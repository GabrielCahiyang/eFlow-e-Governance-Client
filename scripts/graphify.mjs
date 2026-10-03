/** Local, code-only development navigation. Never imports eFlow's runtime or .env. */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const windows = process.platform === "win32";
const python = join(root, ".graphify-venv", windows ? "Scripts/python.exe" : "bin/python");
const graph = join(root, "graphify-out", "graph.json");
const [action, ...args] = process.argv.slice(2);
const env = { ...process.env, PYTHONUTF8: "1", GRAPHIFY_OUT: "graphify-out", GRAPHIFY_NO_AUTO_REFRESH: "1", GRAPHIFY_QUERY_LOG_DISABLE: "1", GRAPHIFY_NO_TIPS: "1", GRAPHIFY_MAX_WORKERS: "4" };
for (const key of Object.keys(env)) {
  if (/^(ANTHROPIC|OPENAI|GEMINI|GOOGLE|MOONSHOT|DEEPSEEK|AZURE_OPENAI|OLLAMA|AWS)(_|$)/.test(key)
      || /^(GRAPHIFY_BACKEND|GRAPHIFY_TRIAGE|GRAPHIFY_GOOGLE_WORKSPACE)/.test(key)) delete env[key];
}
delete env.GRAPHIFY_FORCE;

function run(executable, parameters, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, parameters, { cwd: root, env, shell: false, windowsHide: true, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" });
    let output = "";
    if (capture) {
      child.stdout.on("data", chunk => { output += chunk; });
      child.stderr.on("data", chunk => { output += chunk; });
    }
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(`${executable} exited with status ${code}${capture ? ": " + output.trim() : ""}`)));
  });
}

function requireInstallation() {
  if (!existsSync(python)) throw new Error("Run npm run graph:setup first.");
}
function requireGraph() {
  if (!existsSync(graph)) throw new Error("Run npm run graph:build first.");
}
function cli(parameters) { return run(python, ["-m", "graphify", ...parameters]); }

async function setup() {
  if (!existsSync(python)) {
    const version = await run("python", ["-c", "import sys; print('.'.join(map(str,sys.version_info[:2])))"], true);
    if (version !== "3.12") throw new Error(`Graphify setup requires Python 3.12; found ${version}.`);
    await run("python", ["-m", "venv", join(root, ".graphify-venv")]);
  }
  await run(python, ["-m", "pip", "install", "--disable-pip-version-check", "-r", join(root, "scripts", "graphify-requirements.txt")]);
  console.log("Graphify is installed in .graphify-venv. Run npm run graph:build.");
}

try {
  if (action === "setup") {
    await setup();
  } else {
    requireInstallation();
    switch (action) {
      case "build":
        if (args.some(arg => arg !== "--force")) throw new Error("graph:build accepts only the optional --force flag.");
        await cli(["extract", ".", "--code-only", "--no-cluster", ...(args.includes("--force") ? ["--force"] : [])]);
        await cli(["cluster-only", ".", "--no-label"]);
        break;
      case "update":
        requireGraph();
        await cli(["update", ".", "--no-cluster"]);
        await cli(["cluster-only", ".", "--no-label"]);
        break;
      case "query":
        requireGraph();
        if (!args.length) throw new Error('Usage: npm run graph:query -- "role navigation"');
        await cli(["query", args.join(" "), "--graph", graph, "--budget", "1500"]);
        break;
      case "path":
        requireGraph();
        if (args.length !== 2) throw new Error('Usage: npm run graph:path -- "StartNode" "EndNode"');
        await cli(["path", ...args, "--graph", graph]);
        break;
      case "explain":
        requireGraph();
        if (!args.length) throw new Error('Usage: npm run graph:explain -- "NodeName"');
        await cli(["explain", args.join(" "), "--graph", graph]);
        break;
      case "open": {
        requireGraph();
        const map = join(root, "graphify-out", "graph.html");
        if (!existsSync(map)) throw new Error("Map is missing. Run npm run graph:build.");
        if (windows) {
          env.EFLOW_GRAPHIFY_MAP = map;
          await run("powershell.exe", ["-NoProfile", "-Command", "Start-Process -FilePath $env:EFLOW_GRAPHIFY_MAP"]);
        } else await run(process.platform === "darwin" ? "open" : "xdg-open", [map]);
        break;
      }
      default:
        throw new Error("Use graph:setup, graph:build, graph:update, graph:query, graph:path, graph:explain, or graph:open.");
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
