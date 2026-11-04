import "reflect-metadata";
import "./config";
import { createApp } from "./bootstrap";
import { env } from "./config";
createApp()
  .then((app) => app.listen(env.port, "0.0.0.0"))
  .then(() =>
    console.log(
      JSON.stringify({
        event: "api_ready",
        port: env.port,
        bloggerMode: env.bloggerMode,
      }),
    ),
  )
  .catch((e) => {
    console.error(
      JSON.stringify({
        event: "api_start_failed",
        type: e instanceof Error ? e.name : "Unknown",
        message: "Check environment configuration and database connectivity.",
      }),
    );
    process.exit(1);
  });
