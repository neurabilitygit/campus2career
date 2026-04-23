import http from "node:http";
import { router } from "./server";
import { isAppError, toAppErrorResponse } from "./utils/appError";

const port = Number(process.env.PORT || 8080);

const server = http.createServer(async (req, res) => {
  try {
    await router(req, res);
  } catch (error) {
    console.error("Unhandled API error", error);
    res.setHeader("content-type", "application/json");
    if (isAppError(error)) {
      res.statusCode = error.status;
      res.end(JSON.stringify(toAppErrorResponse(error)));
      return;
    }

    res.statusCode = 500;
    res.end(JSON.stringify({ error: "internal_server_error" }));
  }
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Rising Senior API could not start because port ${port} is already in use. Stop the existing process or set PORT to a different value before restarting.`
    );
    process.exit(1);
    return;
  }

  console.error("Rising Senior API failed to start", error);
  process.exit(1);
});

server.listen(port, () => {
  console.log(`Rising Senior API listening on :${port}`);
});
