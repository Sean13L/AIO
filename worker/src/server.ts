import "dotenv/config";
import { createApp } from "./app.js";
import { startPreviewScheduler } from "./scheduler.js";

const port = Number(process.env.PORT ?? 4100);
const app = createApp();

app.listen(port, () => {
  console.log(`Worker listening on http://localhost:${port}`);
});

startPreviewScheduler();
