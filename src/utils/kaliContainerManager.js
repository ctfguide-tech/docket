import Docker from 'dockerode';
import { appendContainerIdToFile } from './fileManager.js';
import { sendMessage } from './discord.js';

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

/**
 * Creates a Kali Linux container with the specified username and password.
 * @param {string} username - The username for the container.
 * @param {string} password - The password for the container.
 * @returns {Promise<object>} Object containing the container ID and access URL.
 */
export async function createKaliContainer(username, password) {
  try {
    // Generate a random port between 20000 and 60000 for noVNC
    const port = Math.floor(Math.random() * 40000) + 20000;
    // The image we built
    const imageName = "ctfguide/kali-novnc";

    // Create the container
    const container = await docker.createContainer({
      Image: imageName,
      Tty: true,
      OpenStdin: true,
      ExposedPorts: {
        '6080/tcp': {}
      },
      HostConfig: {
        PortBindings: {
          '6080/tcp': [
            {
              HostPort: `${port}`
            }
          ]
        },
        Privileged: true,
        SecurityOpt: ["seccomp=unconfined"],
        CapAdd: ["NET_ADMIN"],
      },
      Env: [
        `USERNAME=${username}`,
        `PASSWORD=${password}`
      ]
    });

    // Start the container
    await container.start();
    const containerInfo = await container.inspect();
    const containerId = containerInfo.Id;

    // Save container ID to file for tracking
    await appendContainerIdToFile(containerId);

    // Get the host IP or domain name (adjust as needed)
    const hostDomain = process.env.HOST_DOMAIN || 'localhost';
    // The noVNC web interface is on port 6080 inside the container, mapped to ${port} outside
    const accessUrl = `http://${hostDomain}:${port}/vnc.html?autoconnect=true&password=${password}`;

    return {
      containerId,
      accessUrl,
      port
    };
  } catch (error) {
    console.error(`Failed to create Kali container: ${error.message}`);
    throw error;
  }
}

/**
 * Deletes a Kali Linux container by ID.
 * @param {string} containerId - The ID of the Docker container to delete.
 * @returns {Promise<void>} A promise that resolves when the container is deleted.
 */
export async function deleteKaliContainer(containerId) {
  try {
    const container = docker.getContainer(containerId);
    await container.remove({ force: true });
    console.log(`Kali container ${containerId} removed successfully.`);
    // Remove container ID from tracking file
    const filePath = process.env.CONTAINER_IDS_FILE || './container_ids.txt';
    const data = await fs.readFile(filePath, 'utf8');
    const containerIds = data.split('\n').filter(id => id !== containerId && id !== '');
    await fs.writeFile(filePath, containerIds.join('\n'));
    console.log(`Container ID ${containerId} removed from tracking file.`);
  } catch (error) {
    console.error(`Failed to remove Kali container ${containerId}: ${error.message}`);
    throw error;
  }
}

/**
 * Gets the status of a Kali Linux container.
 * If the container has been running for more than 1 hour, it will be stopped and removed.
 * @param {string} containerId - The ID of the Docker container to check.
 * @returns {Promise<object>} A promise that resolves to an object containing the status of the container.
 */
export async function getKaliContainerStatus(containerId) {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    const state = info.State;
    const startedAt = new Date(state.StartedAt);
    const now = new Date();
    const running = state.Running;
    let killed = false;

    // If running and started over 1 hour ago, stop and remove
    if (running && (now - startedAt) > 60 * 60 * 1000) {
      await container.stop();
      await container.remove();
      killed = true;
    }

    return {
      id: containerId,
      running: running && !killed,
      status: killed ? 'killed (exceeded 1 hour)' : state.Status,
      startedAt: state.StartedAt,
      finishedAt: state.FinishedAt
    };
  } catch (error) {
    console.error(`Failed to get Kali container status for ${containerId}: ${error.message}`);
    throw error;
  }
}
