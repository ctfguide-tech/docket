import Docker from 'dockerode';
import { appendContainerIdToFile } from './fileManager.js';
import fs from 'fs/promises';

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

/**
 * Creates a Docker container with the specified username and password.
 * @param {string} username - The username for the container.
 * @param {string} password - The password for the container.
 * @param {string} commandsToRun - The commands to run in the container. (Optional)
 * @returns {Promise<string>} The ID of the created container.
 */
export async function createContainer(username, password, commandsToRun) {
  const userSetupCommands = [
    `adduser -D ${username}`,
    `echo "${username}:${password}" | chpasswd`,
    commandsToRun || '',
    `login ${username}`
  ];

  console.log(userSetupCommands);

  let container = await docker.createContainer({
    Image: "alpine",
    Cmd: ["/bin/ash", "-c", `${userSetupCommands.join(" && ")};`],
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
 * Deletes a Docker container by ID and removes its ID from the text file.
 * @param {string} containerId - The ID of the Docker container to delete.
 * @returns {Promise<void>} A promise that resolves when the container is deleted and its ID is removed from the file.
 */
export async function deleteContainer(containerId) {
    try {
      const container = docker.getContainer(containerId);
      await container.remove({ force: true });
      console.log(`Container ${containerId} removed successfully.`);
  
      // Now remove the container ID from the file
      const filePath = "../created.txt"; // Adjust the path as necessary
      const data = await fs.readFile(filePath, 'utf8');
      const containerIds = data.split('\n').filter(id => id !== containerId && id !== '');
      await fs.writeFile(filePath, containerIds.join('\n'));
      console.log(`Container ID ${containerId} removed from file.`);
    } catch (error) {
      console.error(`Failed to remove container ${containerId}: ${error.message}`);
      throw error; // Rethrow the error to handle it in the route
    }
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

/**
 * Retrieves the count of currently running Docker containers.
 * @returns {Promise<number>} A promise that resolves with the number of running containers.
 */

export async function getRunningContainersCount() {
  try {
    const containers = await docker.listContainers();
    console.log(`There are ${containers.length} running containers.`);
    return containers.length;
  } catch (error) {
    console.error('Error getting running containers:', error);
    throw error;
  }
}

/**
 * Sends a login command to a specified Docker container.
 * @param {string} containerId - The ID of the Docker container to receive the login command.
 * @returns {Promise<void>} A promise that resolves when the login command has been sent.
 */

export async function sendLoginCommandToContainer(containerId) {
    const container = docker.getContainer(containerId);
    const exec = await container.exec({
        Cmd: ['sh', '-c', 'echo "login"'],
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
    });
    return exec;
}
