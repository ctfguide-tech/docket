import express from 'express';
import { getContainers } from '../utils/dockerManager.js';
import { sendMessage } from '../utils/discord.js';
import multer from 'multer';
import { buildAndPushImage, listUserImages, deleteImage } from '../utils/registryManager.js';
import path from 'path';
import fs from 'fs/promises';
import { createChallengeContainer, createTestDeployContainer, rebootContainer } from '../utils/challengeContainerManager.js';
import { createCloudflareDNS } from '../utils/cloudflare.js';

const router = express.Router();
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Helper to log actions
async function logAction(userId, action, targetId, targetType) {
  // Removed SQL logging code
}


/**
 * @route POST /api/challenge-containers/reboot
 * @description Reboot a specific challenge container
 * @param {string} id - The container ID
 * @returns {Promise<void>} - Resolves when the container is rebooted
 * @throws {Error} - Throws if the container is not found or cannot be rebooted
 */
router.post('/challenge-containers/reboot', async (req, res) => {
  sendMessage(`Rebooting container ${req.body.id}`);
  const { id } = req.body;
  console.log(req.body)
  if (!id) {
    return res.status(400).json({ error: 'Missing container ID' });
  }
  try {
    await rebootContainer(id);
    sendMessage(`Container ${id} rebooted successfully`);
    res.status(200).json({ message: 'Container rebooted successfully' });
  } catch (error) {
    console.error(`Failed to reboot container ${id}: ${error.message}`);
    res.status(500).json({ error: `Failed to reboot container: ${error.message}` });
  }
});

/**
 * @route GET /api/challenge-containers
 * @description Get all challenge containers for a creator
 * @returns {Object} 200 - An array of containers
 * @returns {Error} 500 - Error message on failure
 */
router.get('/challenge-containers', async (req, res) => {
  const { creatorId } = req.query;
  if (!creatorId) {
    return res.status(400).json({ error: "creatorId query parameter is required" });
  }
  try {
    const coll = await getMappingCollection();
    // Find all documents where creatorid matches the query param
    const results = await coll.find({ username: creatorId }).toArray();

    console.log(results);
    
    res.json(results);
  } catch (error) {
    console.error(`Failed to fetch containers for creatorId ${creatorId}:`, error);
    res.status(500).json({ error: `Failed to fetch containers: ${error.message}` });
  }
});

/**
 * @route GET /api/challenge-containers
 * @description Get all challenge containers for a creator
 * @returns {Object} 200 - An array of containers
 * @returns {Error} 500 - Error message on failure
 */
router.get('/admin/challenge-containers', async (req, res) => {
  try {
  
    // send back all containers
    const containers = await getContainers();

    res.json(containers);
  } catch (error) {
    console.error(`Failed to fetch challenge containers: ${error.message}`);
    res.status(500).json({ error: `Failed to fetch challenge containers: ${error.message}` });
  }
});


/**
 * @route POST /api/challenge-containers/upload
 * @description Upload a container image (as a Dockerfile or tar archive)
 * @returns {Object} 200 - Details of the uploaded image
 * @returns {Error} 400 - Invalid input
 * @returns {Error} 500 - Error on image upload failure
 */
router.post('/challenge-containers/upload', upload.fields([
  { name: 'dockerfile', maxCount: 1 },
  { name: 'archive', maxCount: 1 },
  { name: 'files', maxCount: 10 } // Additional files for the build context
]), async (req, res) => {
  try {
    console.log("=== Upload Request Received ===");
    console.log("Body fields:", Object.keys(req.body));
    console.log("Files received:", req.files ? Object.keys(req.files) : "none");
    
    // Extract and validate required fields
    const { name, description, port } = req.body;
    const creatorId = req.body.creatorId;
    
    if (!name || !creatorId || !port) {
      console.error("Missing required fields:", { name, creatorId, port });
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Fix the registry URL format - Docker doesn't accept URL protocols in image names
    const registry = (process.env.DOCKER_REGISTRY || 'registry.ctfguide.com').replace(/^https?:\/\//, '');
    
    // Sanitize the name to ensure Docker compatibility - be extremely strict and simple
    const sanitizedName = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!sanitizedName || sanitizedName.length < 2) {
      console.error("Invalid image name after sanitization:", { original: name, sanitized: sanitizedName });
      return res.status(400).json({ error: "Invalid image name. Please use a name with alphanumeric characters and hyphens only." });
    }
    
    // Create Docker-compliant image name (extremely simple format)
    const imageName = `${registry}/${creatorId.toLowerCase()}/${sanitizedName}:latest`;
    
    console.log(`Creating Docker image with name: ${imageName}`);
    
    // Check if we have valid files
    if (!req.files) {
      console.error("No files were uploaded");
      return res.status(400).json({ error: "No files were uploaded" });
    }
    
    // Detailed logging of received files
    if (req.files.dockerfile) {
      console.log("Dockerfile details:", {
        originalname: req.files.dockerfile[0].originalname,
        mimetype: req.files.dockerfile[0].mimetype,
        size: req.files.dockerfile[0].size,
        path: req.files.dockerfile[0].path
      });
    }
    
    if (req.files.files) {
      console.log("Supporting files:", req.files.files.map(f => ({
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size
      })));
    }
    
    if (req.files.archive) {
      console.log("Archive details:", {
        originalname: req.files.archive[0].originalname,
        mimetype: req.files.archive[0].mimetype,
        size: req.files.archive[0].size
      }); 
    }
    
    // Check if we have a Dockerfile or an archive
    let buildPath;
    if (req.files.dockerfile && req.files.dockerfile[0]) {
      try {
        // Create a temporary build directory with unique name
        const buildDir = path.join('uploads', `build-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
        await fs.mkdir(buildDir, { recursive: true });
        console.log(`Created build directory: ${buildDir}`);
        
        // Move the Dockerfile to the build directory
        const dockerfilePath = req.files.dockerfile[0].path;
        const dockerfileDestination = path.join(buildDir, 'Dockerfile');
        await fs.copyFile(dockerfilePath, dockerfileDestination);
        console.log(`Copied Dockerfile to ${dockerfileDestination}`);
        
        // If there are additional files, move them too
        if (req.files.files) {
          for (const file of req.files.files) {
            const destination = path.join(buildDir, file.originalname);
            await fs.copyFile(file.path, destination);
            console.log(`Copied ${file.originalname} to ${destination}`);
          }
        }
        
        buildPath = buildDir;
      } catch (copyError) {
        console.error("Error preparing build files:", copyError);
        return res.status(500).json({ error: `Error preparing build files: ${copyError.message}` });
      }
    } else if (req.files.archive && req.files.archive[0]) {
      // For a tar archive, we'll just use the archive path
      buildPath = req.files.archive[0].path;
      console.log(`Using archive at path: ${buildPath}`);
    } else {
      console.error("No Dockerfile or archive provided");
      return res.status(400).json({ error: "No Dockerfile or archive provided" });
    }
    
    console.log(`Starting build with path: ${buildPath}`);
    
    try {
      // --- BUILD AND PUSH IMAGE (stream logs to client) ---
      await buildAndPushImage(imageName, buildPath, (logLine) => {
      //  res.write(logLine + '\n');
      });
    } catch (buildErr) {
      res.write(`Error during build: ${buildErr.message}\n`);
      return res.end();
    }

    // Cleanup
    try {
      if (buildPath.includes('build-')) {
        await fs.rm(buildPath, { recursive: true, force: true });
        console.log(`Cleaned up build directory: ${buildPath}`);
      }
    } catch (cleanupError) {
      console.warn(`Cleanup warning (non-fatal): ${cleanupError.message}`);
    }
    
    // Log success
    console.log(`Successfully built and pushed image: ${imageName}`);
    sendMessage(`User ${creatorId} uploaded container image "${name}"`);

    // Insert user into users table if not exists
    // Removed SQL code

    // Insert image record into the database
    // Removed SQL code

    // Send success response
    res.status(201).json({
      name,
      description,
      port,
      imageName,
      creatorId,
      status: 'uploaded',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Unhandled exception in upload handler:`, error);
    res.status(500).json({ error: `Unhandled exception: ${error.message}` });
  }
});

/**
 * @route GET /api/challenge-containers/:id/file
 * @description Get the contents of a specific file/artifact for a container/image (from inside the container)
 * @query {string} path - The absolute path to the file inside the container
 * @returns {text/plain} 200 - The file content
 * @returns {Error} 400 - Missing parameters
 * @returns {Error} 500 - Error reading file
 */
router.get('/challenge-containers/:id/file', async (req, res) => {
  const { id } = req.params;
  const { path: filePath, image: imageName } = req.query;
  if ((!id && !imageName) || !filePath) {
    return res.status(400).json({ error: "Container/Image ID or image name and file path are required" });
  }
  try {
    let container;
    let createdForThis = false;
    // If an image is specified (and container is not running), create a temp container
    if (imageName) {
      container = await docker.createContainer({ Image: imageName, Cmd: ['/bin/sh'], Tty: false });
      createdForThis = true;
    } else {
      container = docker.getContainer(id);
    }
    // Use getArchive to fetch file as tar stream
    const archiveStream = await container.getArchive({ path: filePath });
    // Extract file content from tar stream
    const extract = tar.extract();
    let fileContent = Buffer.alloc(0);
    let found = false;
    extract.on('entry', (header, streamEntry, next) => {
      if (!found && header.type === 'file') {
        found = true;
        const chunks = [];
        streamEntry.on('data', chunk => chunks.push(chunk));
        streamEntry.on('end', () => {
          fileContent = Buffer.concat(chunks);
          next();
        });
      } else {
        streamEntry.resume();
        next();
      }
    });
    extract.on('finish', async () => {
      if (createdForThis) {
        await container.remove();
      }
      if (found) {
        res.type('text/plain').send(fileContent.toString());
      } else {
        res.status(404).json({ error: 'File not found in archive.' });
      }
    });
    archiveStream.pipe(extract);
  } catch (error) {
    console.error(`Failed to fetch file content from image/container: ${error.message}`);
    res.status(500).json({ error: `Failed to fetch file content: ${error.message}` });
  }
});

// --- MongoDB mapping helper ---
import { MongoClient } from 'mongodb';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'testdeploy';

console.log('MongoDB URI:', MONGO_URI);
console.log('MongoDB DB:', DB_NAME);
const COLLECTION = 'subdomainToPort';
let mappingCollection;
async function getMappingCollection() {
  if (!mappingCollection) {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    mappingCollection = client.db(DB_NAME).collection(COLLECTION);
  }
  return mappingCollection;
}

async function setTestDeployMapping({ containerName, subdomain, port, creatorId, challengeId, containerId, imageName, env, command, createdAt, type }) {
  const coll = await getMappingCollection();
  await coll.updateOne(
    { subdomain },
    { $set: {
        subdomain,
        port,
        username: creatorId,
        createdAt: createdAt || new Date(),
        type: type || "testDeployment",
        challengeId,
        containerId,
        containerName,
        imageName,
        env,
        command
      }
    },
    { upsert: true }
  );
}

async function setDeploymentMapping({ containerName, subdomain, port, creatorId, challengeId, containerId, imageName, env, command, createdAt, type }) {
  const coll = await getMappingCollection();
  await coll.updateOne(
    { subdomain },
    { $set: {
        subdomain,
        port,
        username: creatorId,
        createdAt: createdAt || new Date(),
        type: type || "singleDeployment",
        challengeId,
        containerId,
        containerName,
        imageName,
        env,
        command
      }
    },
    { upsert: true }
  );
}

export async function removeDeployMapping(sub) {
  const coll = await getMappingCollection();
  await coll.deleteOne({ subdomain: sub });
  sendMessage(`Removed deploy mapping for subdomain: ${sub}`);
}

export async function removeTestDeployMapping(sub) {
  const coll = await getMappingCollection();
  await coll.deleteOne({ subdomain: sub });
  sendMessage(`Removed testdeploy mapping for subdomain: ${sub}`);
}

/**
 * @route GET /api/challenge-containers/:id
 * @description Get details of a specific challenge container
 * @returns {Object} 200 - Container details
 * @returns {Error} 404 - Container not found
 * @returns {Error} 500 - Error message on failure
 */
router.get('/challenge-containers/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const containerStatus = "Container is running"
    
    if (!containerStatus) {
      return res.status(404).json({ error: "Container not found" });
    }
    
    res.json({
      id,
      status: containerStatus.status === 'Container is running' ? 'running' : 'stopped',
      // Other container details would come from the database
    });
  } catch (error) {
    console.error(`Failed to get container ${id}: ${error.message}`);
    res.status(500).json({ error: `Failed to get container: ${error.message}` });
  }
});

/**
 * @route GET /api/challenge-containers/:id/files
 * @description Get all files/artifacts associated with a specific container or image
 * @returns {Object} 200 - An array of files/artifacts
 * @returns {Error} 400 - Missing container/image ID
 * @returns {Error} 500 - Error message on failure
 */
router.get('/challenge-containers/:id/files', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Container/Image ID is required" });
  }

  try {
    // This is a placeholder. In a real implementation, you would query Docker or your DB
    // to list files/artifacts associated with the container/image.
    // For now, return a static example list.
    const files = [
      { name: "Dockerfile", path: "/app/Dockerfile", size: 234 },
      { name: "challenge", path: "/app/challenge", size: 10240 },
      { name: "README.md", path: "/app/README.md", size: 1024 }
    ];
    res.json(files);
  } catch (error) {
    console.error(`Failed to fetch files for container/image ${id}: ${error.message}`);
    res.status(500).json({ error: `Failed to fetch files: ${error.message}` });
  }
});

/**
 * @route POST /api/challenge-containers/:id/start
 * @description Start a stopped challenge container
 * @returns {Object} 200 - Success message
 * @returns {Error} 404 - Container not found
 * @returns {Error} 500 - Error message on failure
 */
router.post('/challenge-containers/:id/start', async (req, res) => {
  const { id } = req.params;
  
  try {
    // In a real implementation, you would start the container and update the database
    // This is a placeholder
    sendMessage(`Starting challenge container ${id}`);
    
    // For now, we'll just return success
    res.json({ message: `Container ${id} started successfully` });
  } catch (error) {
    console.error(`Failed to start container ${id}: ${error.message}`);
    res.status(500).json({ error: `Failed to start container: ${error.message}` });
  }
});

/**
 * @route POST /api/challenge-containers/:id/stop
 * @description Stop a running challenge container
 * @returns {Object} 200 - Success message
 * @returns {Error} 404 - Container not found
 * @returns {Error} 500 - Error message on failure
 */
router.post('/challenge-containers/:id/stop', async (req, res) => {
  const { id } = req.params;
  
  try {
    // In a real implementation, you would stop the container and update the database
    // This is a placeholder
    sendMessage(`Stopping challenge container ${id}`);
    
    // For now, we'll just return success
    res.json({ message: `Container ${id} stopped successfully` });
  } catch (error) {
    console.error(`Failed to stop container ${id}: ${error.message}`);
    res.status(500).json({ error: `Failed to stop container: ${error.message}` });
  }
});

/**
 * @route DELETE /api/challenge-containers/:id
 * @description Delete a challenge container
 * @returns {Object} 200 - Confirmation of container deletion
 * @returns {Error} 400 - Container ID is required
 * @returns {Error} 500 - Error message on container deletion failure
 */
router.delete('/challenge-containers/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).send("Container ID is required");
  }

  try {
    await deleteContainer(id);
    sendMessage(`Deleted challenge container ${id}`);
    res.send({ message: `Container ${id} deleted successfully.` });
  } catch (error) {
    console.error(`Failed to delete container ${id}: ${error.message}`);
    res.status(500).send(`Error deleting container: ${error.message}`);
  }
});

/**
 * @route GET /api/challenge-containers/images
 * @description Get all Docker images uploaded by a creator
 * @returns {Object} 200 - An array of images
 * @returns {Error} 400 - Missing creator ID
 * @returns {Error} 500 - Error message on failure
 */
router.get('/challenge-containers/images', async (req, res) => {
  const { creatorId } = req.query;
  if (!creatorId) {
    return res.status(400).json({ error: "Creator ID is required" });
  }
  try {
    // Use listUserImages to get images for this user
    const images = await listUserImages(creatorId);
    res.json(images);
  } catch (err) {
    console.error(`Failed to fetch images for ${creatorId}:`, err);
    res.status(500).json({ error: `Failed to fetch images: ${err && err.message ? err.message : err}` });
  }
});

/**
 * @route GET /api/challenge-containers/images/simple
 * @description Get Docker images for a user by scanning local Docker images
 * @returns {Object} 200 - An array of images
 * @returns {Error} 400 - Missing creator ID
 * @returns {Error} 500 - Error message on failure
 */
router.get('/challenge-containers/images/simple', async (req, res) => {
  const { creatorId } = req.query;
  if (!creatorId) {
    return res.status(400).json({ error: "Creator ID is required" });
  }
  try {
    // Use listUserImages to get images for this user
    const images = await listUserImages(creatorId);
    res.json(images);
  } catch (err) {
    console.error(`Failed to fetch simple images for ${creatorId}:`, err);
    res.status(500).json({ error: `Failed to fetch images: ${err && err.message ? err.message : err}` });
  }
});

/**
 * @route DELETE /api/challenge-containers/images/:id
 * @description Delete a Docker image
 * @returns {Object} 200 - Success message
 * @returns {Error} 400 - Missing image name
 * @returns {Error} 500 - Error message on failure
 */
router.delete('/challenge-containers/images/:imageName', async (req, res) => {
  const { imageName } = req.params;
  
  if (!imageName) {
    return res.status(400).json({ error: "Image name is required" });
  }
  
  try {
    // Delete the image
    await deleteImage(imageName);
    sendMessage(`Deleted image ${imageName}`);
    res.json({ message: `Image ${imageName} deleted successfully` });
  } catch (error) {
    console.error(`Failed to delete image ${imageName}: ${error.message}`);
    res.status(500).json({ error: `Failed to delete image: ${error.message}` });
  }
});

/**
 * @route POST /api/challenge-containers/test-deploy
 * @description Test deploy a challenge container (build and run a container for testing purposes)
 * @returns {Object} 200 - Success or logs
 * @returns {Error} 400/500 - Error on failure
 */
router.post('/challenge-containers/test-deploy', async (req, res) => {
  try {
    const { imageName , env, command, creatorId, challengeId, containerName } = req.body;
    if (!imageName) {
      return res.status(400).json({ error: 'Missing required fields: imageName, port' });
    }

    // Generate unique subdomain for this test deployment
    const shortid = Math.random().toString(36).substring(2, 10);
    const subdomain = `testdeploy-${shortid}`;

    // Generate a unique port number within the specified ranges by checking MongoDB for existing mappings
    const generateUniquePort = async () => {
      const coll = await getMappingCollection();
      const reservedPorts = new Set();
      const usedMappings = await coll.find({}).toArray();
      usedMappings.forEach(mapping => reservedPorts.add(mapping.port));

      const ranges = [[5000, 5099], [3100, 3199]];
      for (const [start, end] of ranges) {
        for (let port = start; port <= end; port++) {
          if (!reservedPorts.has(port)) {
            return port;
          }
        }
      }
      throw new Error('No available ports within the specified ranges');
    };

    const port = await generateUniquePort();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendSSE = (data) => {
      res.write(`data: ${data.replace(/\n/g, '\ndata: ')}\n\n`);
    }

    sendSSE(`[PORT] ${port}`);

    // Traefik labels for dynamic routing
    const traefikLabels = {
      'traefik.enable': 'true',
      [`traefik.http.routers.${subdomain}.rule`]: `Host(\`${subdomain}.ctfgui.de\`)`,
      [`traefik.http.routers.${subdomain}.entrypoints`]: 'http',
      [`traefik.http.services.${subdomain}.loadbalancer.server.port`]: '80',
      // Optionally add more labels for https if needed
    };

    let containerId;
    try {
      containerId = await createTestDeployContainer(
        imageName,
        port,
        env || {},
        command || [],
        traefikLabels
      );
    } catch (err) {
      sendSSE(`Error creating container: ${err.message}`);
      res.end();
      return;
    }

    try {
      sendMessage(`Provisioning domain: https://${subdomain}.ctfgui.de`);
      sendSSE(`[DOMAIN] https://${subdomain}.ctfgui.de`);
    } catch (err) {
      sendSSE(`[DOMAIN ERROR] Failed to provision domain: ${err.message}`);
    }

    // After container creation, update the mapping in MongoDB
    await setTestDeployMapping({
      containerName,
      subdomain,
      port,
      creatorId,
      challengeId,
      containerId,
      imageName,
      env,
      command,
      createdAt: new Date(),
      type: "testDeployment"
    });

    sendSSE(`Container created: ${containerId}`);

    const Docker = (await import('dockerode')).default;
    const docker = new Docker({ socketPath: "/var/run/docker.sock" });
    const container = docker.getContainer(containerId);
    let logStream;
    try {
      logStream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: 100
      });
      logStream.on('data', chunk => {
        sendSSE(chunk.toString());
      });
      logStream.on('end', () => {
        sendSSE('\n--- Build complete ---');
        res.end();
      });
      logStream.on('error', err => {
        res.end();
      });
    } catch (err) {
      sendSSE(`\nError attaching to logs: ${err.message}`);
      res.end();
    }
  } catch (error) {
    console.error('Test deploy error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: `Test deploy failed: ${error.message}` });
    } else {
      sendSSE(`\nTest deploy failed: ${error.message}`);
      res.end();
    }
  }
});


/**
 * @route POST /api/challenge-containers/test-deploy
 * @description Test deploy a challenge container (build and run a container for testing purposes)
 * @returns {Object} 200 - Success or logs
 * @returns {Error} 400/500 - Error on failure
 */
router.post('/challenge-containers/deploy', async (req, res) => {
  try {
    const { imageName , env, command, creatorId, challengeId, containerName } = req.body;
    if (!imageName) {
      return res.status(400).json({ error: 'Missing required fields: imageName, port' });
    }

    // Generate unique subdomain for this test deployment
    const shortid = Math.random().toString(36).substring(2, 10);
    const subdomain = `${creatorId}-${shortid}`;

    // Generate a unique port number within the specified ranges by checking MongoDB for existing mappings
    const generateUniquePort = async () => {
      const coll = await getMappingCollection();
      const reservedPorts = new Set();
      const usedMappings = await coll.find({}).toArray();
      usedMappings.forEach(mapping => reservedPorts.add(mapping.port));

      const ranges = [[5000, 5099], [3100, 3199]];
      for (const [start, end] of ranges) {
        for (let port = start; port <= end; port++) {
          if (!reservedPorts.has(port)) {
            return port;
          }
        }
      }
      throw new Error('No available ports within the specified ranges');
    };

    const port = await generateUniquePort();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendSSE = (data) => {
      res.write(`data: ${data.replace(/\n/g, '\ndata: ')}\n\n`);
    }

    sendSSE(`[PORT] ${port}`);

    // Traefik labels for dynamic routing
    const traefikLabels = {
      'traefik.enable': 'true',
      [`traefik.http.routers.${subdomain}.rule`]: `Host(\`${subdomain}.ctfgui.de\`)`,
      [`traefik.http.routers.${subdomain}.entrypoints`]: 'http',
      [`traefik.http.services.${subdomain}.loadbalancer.server.port`]: '80',
      // Optionally add more labels for https if needed
    };

    let containerId;
    try {
      containerId = await createTestDeployContainer(
        imageName,
        port,
        env || {},
        command || [],
        traefikLabels
      );
    } catch (err) {
      sendSSE(`Error creating container: ${err.message}`);
      res.end();
      return;
    }

    try {
      sendMessage(`Provisioning domain: https://${subdomain}.ctfgui.de`);
      sendSSE(`[DOMAIN] https://${subdomain}.ctfgui.de`);
    } catch (err) {
      sendSSE(`[DOMAIN ERROR] Failed to provision domain: ${err.message}`);
    }

    // After container creation, update the mapping in MongoDB
    await setDeploymentMapping({
      containerName,
      subdomain,
      port,
      creatorId,
      challengeId,
      containerId,
      imageName,
      env,
      command,
      createdAt: new Date(),
      type: "singleDeployment"
    });

    sendSSE(`Container created: ${containerId}`);

    const Docker = (await import('dockerode')).default;
    const docker = new Docker({ socketPath: "/var/run/docker.sock" });
    const container = docker.getContainer(containerId);
    let logStream;
    try {
      logStream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: 100
      });
      logStream.on('data', chunk => {
        sendSSE(chunk.toString());
      });
      logStream.on('end', () => {
        sendSSE('\n--- Build complete ---');
        res.end();
      });
      logStream.on('error', err => {
        res.end();
      });
    } catch (err) {
      sendSSE(`\nError attaching to logs: ${err.message}`);
      res.end();
    }
  } catch (error) {
    console.error('Deployment error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: `Deployment failed: ${error.message}` });
    } else {
      sendSSE(`\nDeployment failed: ${error.message}`);
      res.end();
    }
  }
});





export default router;