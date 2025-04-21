import Docker from 'dockerode';
const docker = new Docker({ socketPath: "/var/run/docker.sock" });

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
    throw new Error(`Failed to find available port starting from ${port}: ${lastError ? lastError.message : 'Unknown error'}`);
  }
  const containerInfo = await container.inspect();
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
