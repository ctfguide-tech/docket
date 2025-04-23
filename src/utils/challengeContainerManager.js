import Docker from 'dockerode';
import { sendMessage } from '../utils/discord.js';
const docker = new Docker({ socketPath: "/var/run/docker.sock" });
import { removeTestDeployMapping } from '../routes/challengeContainerRoutes.js';
/**
 * Create a challenge container (not a web terminal)
 * @param {string} imageName - Docker image to use
 * @param {number|string} port - Port to expose
 * @param {object} envVars - Additional environment variables (object: {VAR: value})
 * @param {string[]} [command] - Optional command to run
 * @param {object} [traefikLabels] - Optional Traefik labels for dynamic subdomain routing
 * @returns {Promise<string>} The ID of the created challenge container
 */
export async function createChallengeContainer(imageName, port, envVars = {}, command = [], traefikLabels = {}) {
  sendMessage(`Creating challenge container: ${imageName} on port ${port}`);
  // Convert envVars object to Docker env array
  const envArray = Object.entries(envVars).map(([key, value]) => `${key}=${value}`);

  // Convert traefikLabels object to Docker label array
  const labels = { ...traefikLabels };

  let currentPort = parseInt(port, 10) || 3000;
  let container = null;
  let started = false;
  let attempt = 0;
  const maxAttempts = 50; // Avoid infinite loop
  let lastError = null;

  while (!started && attempt < maxAttempts) {
    try {
      container = await docker.createContainer({
        Image: imageName,
        Cmd: command.length > 0 ? command : undefined,
        Tty: true,
        Env: envArray,
        ExposedPorts: {
          '80/tcp': {}
        },
        HostConfig: {
          PortBindings: {
            '80/tcp': [ { HostPort: `${currentPort}` } ]
          },
         // NetworkMode: 'coolify'
        },
        Labels: labels
      });
      await container.start();
      started = true;
    } catch (err) {
      // Check for port in use error (Docker error message)
      if (err.message && err.message.includes('address already in use')) {
        currentPort++;
        attempt++;
        lastError = err;
        continue;
      } else {
        throw err;
      }
    }
  }
  if (!started) {
    sendMessage(`Failed to find available port starting from ${port}: ${lastError ? lastError.message : 'Unknown error'}`);
    throw new Error(`Failed to find available port starting from ${port}: ${lastError ? lastError.message : 'Unknown error'}`);
  }
  const containerInfo = await container.inspect();
  sendMessage(`[@here] THIS IS A DEPLOYMENT/n/nCreated challenge container: ${containerInfo.Id}`);


  // Return container ID
  console.log(`Created challenge container: ${containerInfo.Id}`);
  return containerInfo.Id;
}


/**
 * Create a test deploy container (not a web terminal)
 * @param {string} imageName - Docker image to use
 * @param {number|string} port - Port to expose
 * @param {object} envVars - Additional environment variables (object: {VAR: value})
 * @param {string[]} [command] - Optional command to run
 * @param {object} [traefikLabels] - Optional Traefik labels for dynamic subdomain routing
 * @returns {Promise<string>} The ID of the created test deploy container
 */
export async function createTestDeployContainer(imageName, port, envVars = {}, command = [], traefikLabels = {}) {
  sendMessage(`Creating challenge container: ${imageName} on port ${port}`);
  // Convert envVars object to Docker env array
  const envArray = Object.entries(envVars).map(([key, value]) => `${key}=${value}`);

  // Convert traefikLabels object to Docker label array
  const labels = { ...traefikLabels };

  let currentPort = parseInt(port, 10) || 3000;
  let container = null;
  let started = false;
  let attempt = 0;
  const maxAttempts = 50; // Avoid infinite loop
  let lastError = null;

  while (!started && attempt < maxAttempts) {
    try {
      container = await docker.createContainer({
        Image: imageName,
        Cmd: command.length > 0 ? command : undefined,
        Tty: true,
        Env: envArray,
        ExposedPorts: {
          '80/tcp': {}
        },
        HostConfig: {
          PortBindings: {
            '80/tcp': [ { HostPort: `${currentPort}` } ]
          },
         // NetworkMode: 'coolify'
        },
        Labels: labels
      });
      await container.start();
      started = true;
    } catch (err) {
      // Check for port in use error (Docker error message)
      if (err.message && err.message.includes('address already in use')) {
        currentPort++;
        attempt++;
        lastError = err;
        continue;
      } else {
        throw err;
      }
    }
  }
  if (!started) {
    sendMessage(`Failed to find available port starting from ${port}: ${lastError ? lastError.message : 'Unknown error'}`);
    throw new Error(`Failed to find available port starting from ${port}: ${lastError ? lastError.message : 'Unknown error'}`);
  }
  const containerInfo = await container.inspect();
  sendMessage(`Created challenge container: ${containerInfo.Id}`);

  // Auto-kill after 5 minutes, then remove from MongoDB
  setTimeout(async () => {
    try {
      sendMessage(`Auto-killing test deploy container: ${containerInfo.Id}`);
      await container.remove({ force: true });
      // Remove mapping from MongoDB
      try {
        // Find the traefik rule label for subdomain extraction
        const subdomainRule = Object.keys(labels).find(k => k.startsWith('traefik.http.routers.') && k.endsWith('.rule'));
        if (subdomainRule) {
          const match = labels[subdomainRule].match(/Host\(`(.+?)`\)/);
          if (match && match[1]) {
            const subdomain = match[1].replace('.ctfgui.de', '');
            await removeTestDeployMapping(subdomain);
            sendMessage(`Removed testdeploy mapping for subdomain: ${subdomain}`);
          }
        }
      } catch (err) {
        sendMessage(`Failed to remove testdeploy mapping (cleanup) - ${err.message}`);
      }
    } catch (err) {
      sendMessage(`Error auto-killing/removing test deploy container: ${containerInfo.Id} - ${err.message}`);
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Return container ID
  console.log(`Created test deploy container: ${containerInfo.Id}`);
  return containerInfo.Id;
}
/**
 * Delete a challenge container by ID
 * @param {string} containerId
 * @returns {Promise<void>}
 */
export async function deleteChallengeContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.remove({ force: true });
}


/**
 * Reboot a challenge container by ID
 * @param {string} containerId
 * @returns {Promise<void>}
 */
export async function rebootContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.restart();
}
  