import express from 'express';
import { getContainers } from '../utils/dockerManager.js';
import { sendMessage } from '../utils/discord.js';
import multer from 'multer';
import { buildAndPushImage, listUserImages, deleteImage } from '../utils/registryManager.js';
import path from 'path';
import fs from 'fs/promises';
import { createChallengeContainer } from '../utils/challengeContainerManager.js';
import { createCloudflareDNS } from '../utils/cloudflare.js';

const router = express.Router();
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Helper to log actions
async function logAction(userId, action, targetId, targetType) {
  await db.prepare(`INSERT INTO actions (user_id, action, target_id, target_type) VALUES (?, ?, ?, ?)`)
    .run(userId, action, targetId, targetType);
}

// Example: When creating a new image
// await db.prepare(`INSERT INTO images (id, name, tag, author_id) VALUES (?, ?, ?, ?);`).run(imageId, imageName, imageTag, userId);
// await logAction(userId, 'create_image', imageId, 'image');

// Example: When creating a new container
// await db.prepare(`INSERT INTO containers (id, image_id, author_id, status) VALUES (?, ?, ?, ?);`).run(containerId, imageId, userId, 'created');
// await logAction(userId, 'create_container', containerId, 'container');

// Example: When listing images with author
// const images = await db.prepare(`SELECT images.*, users.username AS author FROM images LEFT JOIN users ON images.author_id = users.id;`).all();

// Example: When listing containers with author
// const containers = await db.prepare(`SELECT containers.*, users.username AS author FROM containers LEFT JOIN users ON containers.author_id = users.id;`).all();

/**
 * @route GET /api/challenge-containers
 * @description Get all challenge containers for a creator
 * @returns {Object} 200 - An array of containers
 * @returns {Error} 500 - Error message on failure
 */
router.get('/challenge-containers', async (req, res) => {
  try {
    // // The creator's unique ID would typically come from auth middleware
    // const creatorId = req.query.creatorId;
    
    // if (!creatorId) {
    //   return res.status(400).json({ error: "Creator ID is required" });
    // }
    
    // This is a placeholder. In a real implementation, you would query a database
    // to get containers associated with the creator
    const containers = await getContainers();
    
    res.json(containers);
  } catch (error) {
    console.error(`Failed to fetch challenge containers: ${error.message}`);
    res.status(500).json({ error: `Failed to fetch challenge containers: ${error.message}` });
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
      // Build and push the image to the registry
      const result = await buildAndPushImage(imageName, buildPath);
      console.log("Build result:", result);
      
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
      await db.prepare('INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)')
        .run(creatorId, creatorId);

      // Insert image record into the database
      await db.prepare(
        'INSERT INTO images (id, name, tag, author_id, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(
        imageName, // Use imageName as unique id for now
        name,
        'latest',
        creatorId,
        new Date().toISOString()
      );

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
    } catch (buildError) {
      console.error(`Build error for ${imageName}:`, buildError);
      
      // Try to clean up even on failure
      try {
        if (buildPath.includes('build-')) {
          await fs.rm(buildPath, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.warn(`Cleanup warning: ${cleanupError.message}`);
      }
      
      res.status(500).json({ error: `Failed to build image: ${buildError.message}` });
    }
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
    // In a real implementation, you would query a database
    // This is a placeholder that checks if the container exists
    const containerStatus = await checkContainer(id);
    
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
    // Query SQLite DB for images where author_id matches creatorId
    const images = await db.prepare(`SELECT images.*, users.username AS author FROM images LEFT JOIN users ON images.author_id = users.id WHERE images.author_id = ?`).all(creatorId);
    // If no images, return empty array
    if (!images || images.length === 0) {
      return res.json([]);
    }
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
    const { imageName, port, env, command } = req.body;
    if (!imageName || !port) {
      return res.status(400).json({ error: 'Missing required fields: imageName, port' });
    }

    // Generate unique subdomain for this test deployment
    const shortid = Math.random().toString(36).substring(2, 10);
    const subdomain = `testdeploy-${shortid}`;

    // Traefik labels for dynamic routing
    const traefikLabels = {
      'traefik.enable': 'true',
      [`traefik.http.routers.${subdomain}.rule`]: `Host(\`${subdomain}.ctfgui.de\`)`,
      [`traefik.http.routers.${subdomain}.entrypoints`]: 'http',
      [`traefik.http.services.${subdomain}.loadbalancer.server.port`]: '80',
      // Optionally add more labels for https if needed
    };

    // Stream logs to client
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    let containerId;
    try {
      containerId = await createChallengeContainer(
        imageName,
        port,
        env || {},
        command || [],
        traefikLabels
      );
    } catch (err) {
      res.write(`Error creating container: ${err.message}\n`);
      return res.end();
    }

    // --- Cloudflare Tunnel Domain Logic ---
    let tunnelTarget = process.env.CLOUDFLARE_TUNNEL_CNAME || 'your-tunnel-id.cfargotunnel.com';
    let domain = '';
    try {
      domain = await createCloudflareDNS(subdomain, tunnelTarget, 'CNAME');
      res.write(`[DOMAIN] https://${domain}\n`);
    } catch (err) {
      res.write(`[DOMAIN ERROR] Failed to provision domain: ${err.message}\n`);
    }

    res.write(`Container created: ${containerId}\n`);
    // Attach to the container's logs (stdout+stderr)
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
        res.write(chunk);
      });
      logStream.on('end', () => {
        res.write('\n--- Build complete ---\n');
        res.end();
      });
      logStream.on('error', err => {
        res.write(`\nLog stream error: ${err.message}\n`);
        res.end();
      });
    } catch (err) {
      res.write(`\nError attaching to logs: ${err.message}\n`);
      res.end();
    }
  } catch (error) {
    console.error('Test deploy error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: `Test deploy failed: ${error.message}` });
    } else {
      res.write(`\nTest deploy failed: ${error.message}`);
      res.end();
    }
  }
});

export default router; 