import Docker from 'dockerode';
import { appendContainerIdToFile } from './fileManager.js';
import fs from 'fs/promises';
import { create } from 'domain';
import { sendMessage } from './discord.js';
const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export async function getContainers() {
  const containers = await docker.listImages();
  return containers;
}

/**
 * Creates a Docker container with the specified username and password.
 * @param {string} username - The username for the container.
 * @param {string} password - The password for the container.
 * @param {string} commandsToRun - The commands to run in the container. (Optional)
 * @param {string} port - The port to expose.
 * @param {boolean} root - Whether the user should have root privileges.
 * @returns {Promise<string>} The ID of the created container.
 */
export async function createContainer(username, password, commandsToRun, port, root, fileIDs) {
  let userSetupCommands = "";
  if (commandsToRun.length > 0) {
    userSetupCommands = "&& " + commandsToRun;
  }
  console.log(`Creating terminal with username: ${username} and password: ${password}`)
  let container = await docker.createContainer({
    Image: "ctfguide_wetty",
    Cmd: [`/entrypoint.sh`],
    Tty: true,
    OpenStdin: true,
    Env: [
      "SIAB_USER=" + username,
      "SIAB_PASSWORD=" + password,
      "SIAB_SUDO=" + root,
      "SIAB_GROUPID=1004",
      "SIAB_SSL=false",
      "SIAB_USERID=1004",
      "SIAB_PORT=" + port,
      "SIAB_FLAF=flag123",
      "SIAB_FILEID=" + fileIDs
    ],
    ExposedPorts: {
      '3000/tcp': {} // Expose the default port 3000
    },
    HostConfig: {
      PortBindings: {
        '3000/tcp': [
          {
            HostPort: `${port}` // Map the default port 3000 to the custom port
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
    Cmd: ['sh', '-c', `sudo apk add sudo && echo "flag123" | sudo tee /etc/flag.txt && echo "export fileID=1@2@3" | sudo tee -a /etc/profile && cd /home/${username} && sudo rm -f /etc/update-motd.d/* && echo -e "Welcome to your CTFGuide Workspace. Compute is provided by STiBaRC.\\nAll sessions are logged. Remember to follow our TOS when using this terminal. Happy Hacking!\\n\\n" | sudo tee /etc/motd ${userSetupCommands}` ],
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
    const stats = await container.stats({ stream: true });

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

export async function runScriptInContainer(containerId, script, language) {
  try {
    const container = docker.getContainer(containerId);
    
    // Create temporary script file with appropriate extension
    const extensions = {
      'python': 'py',
      'javascript': 'js',
      'nodejs': 'js',
      'bash': 'sh',
      // Add more languages as needed
    };
    
    const ext = extensions[language.toLowerCase()] || language.toLowerCase();
    const filename = `script.${ext}`;
    
    // Write script to file in container
    const execCreateResult = await container.exec({
      Cmd: ['sh', '-c', `echo '${script}' > /tmp/${filename}`],
      AttachStdout: true,
      AttachStderr: true
    });
    
    // Execute the script based on language
    const runners = {
      'python': `python3 /tmp/${filename}`,
      'javascript': `node /tmp/${filename}`,
      'nodejs': `node /tmp/${filename}`,
      'bash': `bash /tmp/${filename}`,
      // Add more languages as needed
    };
    
    const runner = runners[language.toLowerCase()];
    if (!runner) {
      throw new Error(`Unsupported language: ${language}`);
    }
    
    const execution = await container.exec({
      Cmd: ['sh', '-c', runner],
      AttachStdout: true,
      AttachStderr: true
    });
    
    const stream = await execution.start();
    
    return new Promise((resolve, reject) => {
      let output = '';
      
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });
      
      stream.on('end', () => {
        resolve(output.trim());
      });
      
      stream.on('error', (err) => {
        reject(err);
      });
    });
    
  } catch (error) {
    throw new Error(`Failed to run script: ${error.message}`);
  }
}

