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
    `echo "${username}:${password}" | chpasswd &&
        sh -c 'trap "exit" INT TERM; sleep 1800 & wait'`,
  ];

  // Container Config
  let container = await docker.createContainer({
    Image: "alpine",
    Cmd: ["/bin/ash", "-c", `${userSetupCommands.join(" && ")}`],
    Tty: true,
    OpenStdin: true,
  });

  await container.start();

  // Get the container's ID
  const containerInfo = await container.inspect();

  console.log("================================");
  console.log(containerInfo);
  console.log("================================");

  const containerId = containerInfo.Id;

  // Start socat to redirect TCP traffic to the Docker socket on macOS
  const socatProcess = spawn("socat", [
    "TCP-LISTEN:2375,reuseaddr,fork",
    "UNIX-CLIENT:/Library/Containers/com.docker.docker/Data/docker.raw.sock",
  ]);

  // LINUX:
  // const socatProcess = spawn('socat', ['TCP-LISTEN:2375,reuseaddr,fork', 'UNIX:/var/run/docker.sock']);

  socatProcess.on("error", (err) => {
    throw new Error("Failed to start socat: " + err.message);
  });

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
    return res.send(wsUrl);
  } catch (err) {
    return res.send(err);
  }
});

app.listen(port, () => {
  console.log(`Docket is listening on port ${port}`);
});
