import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';


// Equivalent of __dirname for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const filePath = "../created.txt"


/**
 * Appends a Docker container ID to a file.
 * @param {string} containerId - The ID of the Docker container to append.
 * @returns {Promise<void>} A promise that resolves when the container ID has been appended to the file.
 */
export async function appendContainerIdToFile(containerId) {
  fs.appendFileSync(filePath, `${containerId}\n`);
}