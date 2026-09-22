import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: { projectId: "wf3m3duv", dataset: "production" },
  deployment: { autoUpdates: true },
});
