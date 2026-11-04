require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
  quiet: true,
});
const url = new URL(process.env.DATABASE_URL);
url.pathname = "/autoblog_test";
process.env.DATABASE_URL = url.href;
process.env.PUBLISH_QUEUE = "autoblog-publish-test";
process.env.BLOGGER_MODE = "mock";
process.env.AI_ENABLED = "false";
process.env.AI_BILLING_AUTHORIZED = "false";
