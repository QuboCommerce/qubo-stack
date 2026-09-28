import { app } from "./index";

const port = Number(process.env.PORT ?? 3333);

app.listen(port, () => {
  console.log(`[peltier-api] listening on :${port}`);
});
