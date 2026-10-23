import { defineConfig, loadEnv, type Plugin } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

function viewModuleManifest(): Plugin {
  return {
    name: "eflow-view-module-manifest",
    generateBundle(_options, bundle) {
      const names = new Set(["AccountingStaffContent", "ActionCenter", "AdministrationWorkspace", "EmployeeDeadlines", "EmployeeMyProjects", "EmployeeMyTasks", "EmployeeTaskHistory", "EmployeeWorkReport", "ForReviewInbox", "HeadContent", "LeaderReviewInbox", "MemberContent", "MondayBoard", "OfficeIdentityAccessWorkspace", "PersonalWorkWorkspace", "WorkspaceOverview", "ProfilePage", "ProjectGanttView", "ProjectInsightsView", "ProjectOfficePanel", "ProjectOfficesView", "ProjectTableWorkspace", "SettingsContent", "StaffingDialog", "SubtaskWorkDrawer", "SubtasksWorkspace", "TaskDatesDialog", "TaskInspector", "TaskOfficeControl", "WorkBudgetCard"]);
      const modules: Record<string, string> = {};
      for (const entry of Object.values(bundle)) {
        if (entry.type !== "chunk") continue;
        for (const name of entry.exports)
          if (names.has(name)) modules[name] = entry.fileName;
      }
      this.emitFile({
        type: "asset",
        fileName: "eflow-view-modules.json",
        source: JSON.stringify(modules),
      });
    },
  };
}

/** Optional local performance evidence; never included in ordinary builds. */
function bundleProfile(): Plugin {
  return { name: 'eflow-local-bundle-profile', generateBundle(_options, bundle) {
    if (process.env.EFLOW_PROFILE_BUNDLE !== '1') return;
    this.emitFile({ type: 'asset', fileName: 'eflow-bundle-profile.json', source: JSON.stringify(Object.values(bundle).filter(entry => entry.type === 'chunk').map(entry => ({
      file: entry.fileName, imports: entry.imports, dynamicImports: entry.dynamicImports,
      modules: Object.entries(entry.modules).map(([id, detail]) => ({ id: path.relative(configDir, id).replace(/\\/g, '/'), renderedLength: detail.renderedLength })).sort((a, b) => b.renderedLength - a.renderedLength),
    }))) });
  } };
}

function figmaAssetResolver() {
  return {
    name: "figma-asset-resolver",
    resolveId(id: string) {
      if (id.startsWith("figma:asset/")) {
        const filename = id.replace("figma:asset/", "");
        return path.resolve(configDir, "src/assets", filename);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, configDir, "");
  Object.assign(process.env, env);

  return {
    plugins: [
      figmaAssetResolver(),
      viewModuleManifest(),
      bundleProfile(),
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them.
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(configDir, "./src"),
      },
    },
    // This repository also contains archived HTML, Python environments and
    // local graph output. Only the application HTML is a dependency entry.
    optimizeDeps: {
      entries: ["index.html"],
    },
    server: {
      watch: {
        ignored: [
          "**/.venv/**",
          "**/.graphify-venv/**",
          "**/.phase2-work/**",
          "**/.phase3-work/**",
          "**/.codex-tmp/**",
          "**/.vs/**",
          "**/graphify-out/**",
          "**/docs/**",
          "**/artifacts/**",
          "**/test-results/**",
          "**/tmp/**",
        ],
      },
      proxy: {
        // Every local backend call now enters through the JWT-protected eFlow
        // gateway. Port 8321 is deliberately never a Vite proxy target.
        "/controlpanelEflow": {
          target: "http://127.0.0.1:8322",
          changeOrigin: true,
        },
        // Temporary compatibility route for callers still using /api/*.
        "/api": {
          target: "http://127.0.0.1:8322",
          changeOrigin: true,
          rewrite: (requestPath: string) => `/controlpanelEflow${requestPath}`,
        },
      },
    },
  };
});
