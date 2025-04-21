import Docker from 'dockerode';
import { sendMessage } from './discord.js';
import fs from 'fs/promises';
import tar from 'tar-fs';
import path from 'path';

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

/**
 * Build a Docker image from a Dockerfile or directory
 * @param {string} imageName - The name to give the built image
 * @param {string} buildPath - Path to Dockerfile or directory containing Dockerfile
 * @returns {Promise<Object>} Result of the build operation
 */
export async function buildAndPushImage(imageName, buildPath) {
  try {
    console.log(`[Registry] Starting build process for image ${imageName} from ${buildPath}`);
    sendMessage(`Building image ${imageName} from ${buildPath}`);
    
    // Validate image name according to Docker rules
    const imageNameRegex = /^(?:(?=[^:\/]{1,253})(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(?:\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-))*(?::[0-9]+)?\/)?(?:(?![._-])[a-zA-Z0-9._-]{1,128}(?<![._-])\/)?(?![.-])[a-zA-Z0-9.-]{1,128}(?<![.-])(?::[a-zA-Z0-9_.-]{1,128})?$/;
    
    if (!imageNameRegex.test(imageName)) {
      const error = new Error(`Invalid image name format: "${imageName}". Docker image names must follow specific naming conventions.`);
      console.error(`[Registry] ${error.message}`);
      sendMessage(`Error validating image name: ${error.message}`);
      throw error;
    }
    
    // Create stream from path (could be a directory or a tar file)
    let tarStream;
    try {
      const stats = await fs.stat(buildPath);
      console.log(`[Registry] Build path exists, is ${stats.isDirectory() ? 'directory' : 'file'}`);
      
      if (stats.isDirectory()) {
        // Verify the directory has a Dockerfile
        try {
          await fs.access(path.join(buildPath, 'Dockerfile'));
          console.log(`[Registry] Dockerfile found in build directory`);
        } catch (e) {
          console.error(`[Registry] No Dockerfile found in build directory: ${e.message}`);
          throw new Error(`No Dockerfile found in build directory: ${buildPath}`);
        }
        
        // If it's a directory, create a tar stream from it
        console.log(`[Registry] Creating tar stream from directory: ${buildPath}`);
        tarStream = tar.pack(buildPath);
      } else {
        // If it's a file, assume it's already a tar archive and create a stream
        console.log(`[Registry] Creating read stream from file: ${buildPath}`);
        tarStream = fs.createReadStream(buildPath);
      }
    } catch (fsError) {
      console.error(`[Registry] Error accessing build path: ${fsError.message}`);
      throw new Error(`Cannot access build path: ${fsError.message}`);
    }
    
    // Define build options with better error output
    const buildOptions = {
      t: imageName,
      nocache: false,
      rm: true,
    };
    
    console.log(`[Registry] Docker build options:`, buildOptions);
    
    // Build image
    let stream;
    try {
      console.log(`[Registry] Starting Docker build for ${imageName}`);
      sendMessage(`Starting build for ${imageName}`);
      stream = await docker.buildImage(tarStream, buildOptions);
    } catch (buildError) {
      console.error(`[Registry] Docker buildImage call failed: ${buildError.message}`);
      throw new Error(`Failed to start Docker build: ${buildError.message}`);
    }
    
    // Log the build output
    return new Promise((resolve, reject) => {
      let buildLogs = [];
      
      docker.modem.followProgress(
        stream,
        (err, result) => {
          if (err) {
            console.error(`[Registry] Build error: ${err.message}`);
            console.error(`[Registry] Build logs: ${buildLogs.join('\n')}`);
            sendMessage(`Error building image ${imageName}: ${err.message}`);
            return reject(err);
          }
          
          // Check for error messages in the build result
          const errorMessage = findErrorInBuildResult(buildLogs);
          if (errorMessage) {
            console.error(`[Registry] Build completed with error: ${errorMessage}`);
            sendMessage(`Error in build: ${errorMessage}`);
            return reject(new Error(errorMessage));
          }
          
          console.log(`[Registry] Build completed successfully for ${imageName}`);
          sendMessage(`Successfully built image ${imageName}`);
          
          // After building, push to registry
          pushImageToRegistry(imageName)
            .then(result => {
              console.log(`[Registry] Push completed for ${imageName}`);
              resolve(result);
            })
            .catch(err => {
              console.error(`[Registry] Push failed for ${imageName}: ${err.message}`);
              reject(err);
            });
        },
        (event) => {
          // Save all build logs
          if (event.stream) {
            const logLine = event.stream.trim();
            if (logLine) {
              buildLogs.push(logLine);
              console.log(`[Docker Build] ${logLine}`);
            }
          } else if (event.error) {
            buildLogs.push(`ERROR: ${event.error}`);
            console.error(`[Docker Build Error] ${event.error}`);
          } else {
            console.log(`[Docker Build Event]`, event);
          }
        }
      );
    });
  } catch (error) {
    console.error(`[Registry] Error in buildAndPushImage: ${error.message}`);
    sendMessage(`Error in buildAndPushImage: ${error.message}`);
    throw error;
  }
}

// Helper function to extract error messages from Docker build output
function findErrorInBuildResult(logs) {
  const errorLines = logs.filter(line => 
    line.includes('ERROR:') || 
    line.includes('error:') || 
    line.includes('failed:')
  );
  
  if (errorLines.length > 0) {
    return errorLines[errorLines.length - 1]; // Return the last error
  }
  
  return null;
}

/**
 * Push a Docker image to the private registry
 * @param {string} imageName - The name of the image to push
 * @returns {Promise<Object>} Result of the push operation
 */
async function pushImageToRegistry(imageName) {
  try {
    console.log(`[Registry] Preparing to push image ${imageName} to registry`);
    sendMessage(`Pushing image ${imageName} to registry`);
    
    // First, check if registry requires authentication
    let authConfig = null;
    
    // Only use auth if registry credentials are available
    if (process.env.REGISTRY_USERNAME && process.env.REGISTRY_PASSWORD) {
      console.log(`[Registry] Using authentication for registry push`);
      authConfig = {
        username: process.env.REGISTRY_USERNAME,
        password: process.env.REGISTRY_PASSWORD,
        serveraddress: (process.env.DOCKER_REGISTRY || 'registry.ctfguide.com').replace(/^https?:\/\//, '')
      };
    } else {
      console.log(`[Registry] No registry credentials found, attempting with default credentials`);
      // Provide default credentials for development environments
      authConfig = {
        username: 'ctfguide',
        password: 'ctfguide',
        serveraddress: (process.env.DOCKER_REGISTRY || 'registry.ctfguide.com').replace(/^https?:\/\//, '')
      };
    }
    
    // First, verify the image exists locally
    let image;
    try {
      image = docker.getImage(imageName);
      // Try to inspect the image to confirm it exists
      await image.inspect();
      console.log(`[Registry] Found local image ${imageName}`);
    } catch (inspectError) {
      console.error(`[Registry] Image ${imageName} not found locally: ${inspectError.message}`);
      throw new Error(`Cannot push image ${imageName} - not found locally`);
    }
    
    // Prepare push options
    const pushOptions = {
      authconfig: authConfig
    };
    
    console.log(`[Registry] Starting push for ${imageName} with authentication`);
    
    // Push the image
    let stream;
    try {
      stream = await image.push(pushOptions);
    } catch (pushError) {
      console.error(`[Registry] Failed to start push: ${pushError.message}`);
      
      // If we fail to push to registry, we'll still consider build successful
      // This is a fallback for development environments without a registry
      console.log(`[Registry] Push failed, but we'll consider the build successful for local usage`);
      return { status: 'local-only', message: 'Image built successfully but not pushed to registry' };
    }
    
    // Monitor the push progress
    return new Promise((resolve, reject) => {
      let pushLogs = [];
      let noProgress = 0;
      
      docker.modem.followProgress(
        stream,
        (err, result) => {
          if (err) {
            console.error(`[Registry] Push error: ${err.message}`);
            console.error(`[Registry] Push logs: ${pushLogs.join('\n')}`);
            sendMessage(`Error pushing image ${imageName}: ${err.message}`);
            
            // Check if this is an authentication error
            if (err.message.includes('authentication') || err.message.includes('authorized')) {
              return reject(new Error(`Registry authentication failed: ${err.message}`));
            }
            
            // For other errors, we'll still consider the build partially successful
            // since the local image was created correctly
            return resolve({ 
              status: 'local-only', 
              error: err.message, 
              message: 'Image built successfully but failed to push to registry'
            });
          }
          
          console.log(`[Registry] Push completed for ${imageName}`);
          sendMessage(`Successfully pushed image ${imageName} to registry`);
          resolve({
            status: 'success',
            message: 'Image built and pushed successfully'
          });
        },
        (event) => {
          // Save all push logs and print status updates
          if (event.status) {
            pushLogs.push(`${event.status} ${event.progress || ''}`);
            console.log(`[Docker Push] ${event.status} ${event.progress || ''}`);
            noProgress = 0;
          } else if (event.error) {
            pushLogs.push(`ERROR: ${event.error}`);
            console.error(`[Docker Push Error] ${event.error}`);
          } else {
            // Unknown event type - just log it
            console.log(`[Docker Push Event]`, event);
            
            // Increment no-progress counter
            noProgress++;
            
            // If we haven't seen progress in a while, something might be stuck
            if (noProgress > 100) {
              console.warn(`[Registry] No push progress for an extended period`);
            }
          }
        }
      );
    });
  } catch (error) {
    console.error(`[Registry] Error in pushImageToRegistry: ${error.message}`);
    sendMessage(`Error in pushImageToRegistry: ${error.message}`);
    throw error;
  }
}

/**
 * Get a list of images in the private registry for a specific user
 * @param {string} creatorId - The ID of the creator
 * @returns {Promise<Array>} List of images
 */
export async function listUserImages(creatorId) {
  try {
    // In a real implementation, you would query the registry API
    // or a database that tracks uploaded images
    
    // For now, we'll just list local images that match the pattern
    const registry = (process.env.DOCKER_REGISTRY || 'registry.ctfguide.com').replace(/^https?:\/\//, '');
    const imagePrefix = `${registry}/${creatorId}/`;
    
    const images = await docker.listImages();
    
    return images.filter(image => {
      if (!image.RepoTags) return false;
      // At least one tag must start with the user's prefix
      return image.RepoTags.some(tag => tag.startsWith(imagePrefix));
    }).flatMap(image => {
      // For each image, output an entry for each matching tag (user may have multiple images with different names)
      return image.RepoTags
        .filter(tag => tag.startsWith(imagePrefix))
        .map(tag => {
          const name = tag.replace(imagePrefix, '').split(':')[0];
          return {
            id: image.Id,
            name,
            fullName: tag,
            created: new Date(image.Created * 1000).toISOString(),
            size: image.Size ? (image.Size / (1024 * 1024)).toFixed(2) + ' MB' : null
          };
        });
    });
  } catch (err) {
    sendMessage(`Error in listUserImages: ${err.message}`);
    throw err;
  }
}

/**
 * Delete an image from the registry
 * @param {string} imageName - The name of the image to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteImage(imageName) {
  try {
    sendMessage(`Deleting image ${imageName}`);
    
    // Get the image
    const image = docker.getImage(imageName);
    
    // Remove the image
    await image.remove({ force: true });
    
    sendMessage(`Successfully deleted image ${imageName}`);
    return true;
  } catch (error) {
    sendMessage(`Error in deleteImage: ${error.message}`);
    throw error;
  }
} 