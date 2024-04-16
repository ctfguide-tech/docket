import Docker from 'dockerode';
import { appendContainerIdToFile } from './fileManager.js';
import fs from 'fs/promises';

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

/**
 * Creates a Docker container with the specified username and password.
 * @param {string} username - The username for the container.
 * @param {string} password - The password for the container.
 * @returns {Promise<string>} The ID of the created container.
 */
export async function createContainer(username, password) {
  const userSetupCommands = [
    `adduser -D ${username}`,
    `echo "${username}:${password}" | chpasswd`,
  ];

  let container = await docker.createContainer({
    Image: "alpine",
    Cmd: ["/bin/ash", "-c", `${userSetupCommands.join(" && ")}; sleep 3600`],
    Tty: true,
    OpenStdin: true,
  });

  await container.start();
  const containerInfo = await container.inspect();
  const containerId = containerInfo.Id;

  await appendContainerIdToFile(containerId);

  return containerId;
}


/**
 * Deletes all Docker containers listed in a specified file.
 * @param {string} filePath - The path to the file containing container IDs to delete.
 * @returns {Promise<void>} A promise that resolves when all containers have been deleted.
 */
export async function deleteContainersFromFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const containerIds = data.split('\n').filter(Boolean);

    console.log(`Deleting ${containerIds.length} containers...`)

    for (const containerId of containerIds) {
      try {
        const container = docker.getContainer(containerId);
        await container.remove({ force: true });
        console.log(`Container ${containerId} removed successfully.`);
      } catch (error) {
        console.error(`Failed to remove container ${containerId}: ${error.message}`);
      }
    }

    await fs.writeFile(filePath, ''); // Clear the file
  } catch (error) {
    console.error(`Error processing file ${filePath}: ${error.message}`);
  }
}