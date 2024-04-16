import fs from 'fs';
import path from 'path';

const filePath = path.join(__dirname, '..', '..', 'created.txt');


/**
 * Appends a Docker container ID to a file.
 * @param {string} containerId - The ID of the Docker container to append.
 * @returns {Promise<void>} A promise that resolves when the container ID has been appended to the file.
 */
export async function appendContainerIdToFile(containerId) {
  fs.appendFileSync(filePath, `${containerId}\n`);
}