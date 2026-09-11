import "dotenv/config";
import { createApp } from "./api/app.js";
import { startPreviewScheduler } from "./scheduler.js";

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

startPreviewScheduler();
