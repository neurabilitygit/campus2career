import http from "node:http";
import { router } from "./server";

const port = Number(process.env.PORT || 8080);

const server = http.createServer(async (req, res) => {
  try {
    await router(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "internal_server_error" }));
  }
});

server.listen(port, () => {
  console.log(`Campus2Career API listening on :${port}`);
});
