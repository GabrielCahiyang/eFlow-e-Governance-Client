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
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them.
      react(),
      tailwindcss(),
    ],
    build: {
      rollupOptions: {
        output: {
          // These small public APIs and their eager contracts form legacy cycles.
          // Co-locate the measured re-export paths; view code stays deferred.
          manualChunks(id: string) {
            const normalized = id.replace(/\\/g, "/");
            const contracts = [
              "project-table/index.ts",
              "project-table/selectors.ts",
              "project-table/services/workspaceService.ts",
              "project-views/index.ts",
              "project-views/selectors.ts",
              "project-views/hooks/useProjectViewActions.ts",
              "members/index.ts",
              "members/hooks/useDeptDirectoryEmployees.ts",
              "team-management/index.ts",
              "team-management/hooks/useDepartmentTeamAnalytics.ts",
            ];
            if (
              contracts.some((file) =>
                normalized.endsWith("/src/app/features/" + file),
              )
            )
              return "workspace-contracts";
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(configDir, "./src"),
      },
    },
    server: {
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
