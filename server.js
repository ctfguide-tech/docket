// Express Server
import dotenv from "dotenv";
dotenv.config();

import express from "express";
const app = express();
const port = process.env.PORT;

app.get("/", (req, res) => {
  res.send("Docket OK.");
});

app.listen(port, () => {
  console.log(`Docket is listening on port ${port}`);
});
