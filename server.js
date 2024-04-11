// Express Server
import dotenv from "dotenv";
dotenv.config();

// Express Configuration
import express from "express";
const app = express();
const port = process.env.PORT;
import { join } from "path";
// Docker Configuration
import { spawn } from "child_process";
import Docker from "dockerode";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

// Function to create a new container
async function createContainer(username, password) {
  // Commands to add a new user and set their password
  const userSetupCommands = [
    `adduser -D ${username}`,
    `echo "${username}:${password}" | chpasswd && exec /bin/ash`,
  ];

  // console.log("Running this:" + `${userSetupCommands.join(" && ")}`);
  // Container Config
  let container = await docker.createContainer({
    Image: "alpine",
    Cmd: [
      "/bin/ash",
      "-c",
      `${userSetupCommands.join(" && ")} && echo Welcome to Docket!`,
    ],
    Tty: true,
    OpenStdin: true,
  });

  await container.start();

  // Get the container's ID
  const containerInfo = await container.inspect();

  const containerId = containerInfo.Id;

  console.log("================================");
  console.log(containerId);
  console.log("================================");

  // Construct the WebSocket endpoint
  const wsUrl = `ws://localhost:2375/containers/${containerId}/attach/ws?stream=1&stdin=1&stdout=1&stderr=1`;
  // Return the WebSocket URL
  return wsUrl;
}

app.get("/", (req, res) => {
  res.send("Docket OK.");
});

app.get("/client", (req, res) => {
  res.sendFile(join(process.cwd(), "client", "index.html"));
});

app.get("/create", async (req, res) => {
  let username = req.query.username;
  let password = req.query.password;

  if (!username || !password) {
    return res.status(400).send("Invalid request.");
  }

  try {
    let wsUrl = await createContainer(username, password);
    // Check if wsUrl is correctly generated
    if (wsUrl) {
      console.log("Sent back client!");
      return res.send(`
        <!doctype html>
        <html>
            <head>
                <title>Docket Testing</title>
                <meta charset="UTF-8" />
                <script src="https://cdn.jsdelivr.net/npm/xterm@5.0.0/lib/xterm.min.js"></script>
                <link
                    href="https://cdn.jsdelivr.net/npm/xterm@5.0.0/css/xterm.min.css"
                    rel="stylesheet"
                />
                <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/xterm-addon-attach@0.8.0/lib/xterm-addon-attach.min.js"></script>
                <script>
                    window.onload = function () {
                        let url = "${wsUrl}";
                        const term = new window.Terminal();
                        const fitAddon = new window.FitAddon.FitAddon();

                        const socket = new WebSocket(url);
                        const attachAddon = new AttachAddon.AttachAddon(socket);
                        term.open(document.getElementById("terminal"));
                        term.loadAddon(attachAddon);
                        fitAddon.fit();

                    };
                </script>
            </head>
            <body style="background-color: black;">
                <div id="terminal" style="width: 100%; height: 1000%; background-color:black;"></div>
            </body>
        </html>

        `);
    } else {
      return res.status(500).send("Failed to generate WebSocket URL.");
    }
  } catch (err) {
    console.error(err); // Log the error for debugging
    return res.status(500).send("Server error occurred.");
  }
});

app.listen(port, () => {
  console.log(`Docket is listening on port ${port}`);
});
