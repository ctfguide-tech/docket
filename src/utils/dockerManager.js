import Docker from 'dockerode';
import { appendContainerIdToFile } from './fileManager.js';
import fs from 'fs/promises';
import { create } from 'domain';
import { sendMessage } from './discord.js';
const docker = new Docker({ socketPath: "/var/run/docker.sock" });


/**
 * Creates a Docker container with the specified username and password.
 * @param {string} username - The username for the container.
 * @param {string} password - The password for the container.
 * @param {string} commandsToRun - The commands to run in the container. (Optional)
 * @returns {Promise<string>} The ID of the created container.
 */
export async function createContainer(username, password, commandsToRun, port, root) {

  const userSetupCommands = commandsToRun;
  /*
  const knownImages = ["ctfguide"];


  if (!knownImages.includes(image)) {
    return {"status": "error", "message": "You are attempting to use an image that is not supported by Docket."}
  }
  */


  let container = await docker.createContainer({
    Image: "ctfguide",
    Cmd: [`shellinabox`],
    Tty: true,
    OpenStdin: true,
    Env: [
      "SIAB_USER=" + username,
      "SIAB_PASSWORD=" + password,
      "SIAB_SUDO=" + root,
      "SIAB_GROUPID=1004",
      "SIAB_SSL=false",
      "SIAB_USERID=1004",
      "SIAB_USERCSS=Normal:-/etc/shellinabox/options-enabled/00+Black-on-White.css,Reverse:+/etc/shellinabox/options-enabled/00_White-On-Black.css;Colors:+/etc/shellinabox/options-enabled/01+Color-Terminal.css,Monochrome:-/etc/shellinabox/options-enabled/01_Monochrome.css",
      "SIAB_PORT=" + port,
    ],
    ExposedPorts: {
      [`${port}/tcp`]: {} // Ensure the port is exposed
    },
    HostConfig: {
      PortBindings: {
        [`${port}/tcp`]: [
          {
            HostPort: `${port}`
          }
        ]
      }
    }
  });

  await container.start();
  const containerInfo = await container.inspect();
  const containerId = containerInfo.Id;

  // Run additional commands in the container

  await docker.getContainer(containerId).exec({
    Cmd: ['sh', '-c', `export flag=flag123 && export fileID=1@2@3 && cd /home/guest && rm -f /etc/update-motd.d/* && echo "\\033[1;33mWelcome to your CTFGuide Workspace. Compute is provided by STiBaRC.\nAll sessions are logged. Remember to follow our TOS when using this terminal. Happy Hacking!\n\n\\033[0m" | tee /etc/motd && ${userSetupCommands}`], // Blue color, disable other MOTD scripts
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false
  }, function (err, exec) {
    if (err) throw err;
    exec.start(function (err, stream) {
      if (err) throw err;
      stream.pipe(process.stdout);
    });
  });


  await appendContainerIdToFile(containerId);

  return containerId;
}

/**
 * Checks the status of a Docker container.
 * 
 * @param {string} containerId - The ID of the Docker container to check.
 * @param {object} node - The node associated with the container.
 * @returns {Promise<object>} - A promise that resolves to an object containing the status and stats of the container.
 * @throws {Error} - Throws an error if the container status or stats cannot be fetched.
 */
export async function checkContainer(containerId, node) {
  try {

    const container = docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });

    if (!state.Running || state.Restarting || state.OOMKilled || state.Dead) {
      return { status: 'Container is not running or has crashed', state };
    }

    return { status: 'Container is running', stats, state };


  } catch (err) {
    console.error(`Failed to fetch ${containerId}: ${error.message}`);
    throw error; // Rethrow the error to handle it in the route
  }
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
    sendMessage(`Deleted container with ID ${containerId}`)

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
