import express from 'express';
import cors from 'cors';
import { sendMessage } from '../../utils/discord.js';
import { deleteContainer } from '../../utils/dockerManager.js';
import { createKaliContainer, deleteKaliContainer } from '../../utils/kaliContainerManager.js';

const router = express.Router();

/**
 * @route GET /api/containers/create
 * @param {string} req.query.username - The username for the container.
 * @param {string} req.query.password - The password for the container.
 * @returns {Object} 200 - An object containing the container ID
 * @returns {Error} 400 - Username and password are required
 * @returns {Error} 500 - Error message on container creation failure
 */

// TODO: auth

router.post('/containers/create', async (req, res) => {
  console.log("Creating container...")
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send("Username and password are required");
  }

  try {
    // Create a Kali Linux container with the provided credentials
    const containerInfo = await createKaliContainer(username, password);
    
    // Return the container ID and access URL for iframe embedding
    res.status(200).json({
      containerId: containerInfo.containerId,
      accessUrl: containerInfo.accessUrl,
      port: containerInfo.port,
      message: 'Kali Linux container created successfully'
    });
  } catch (error) {
    console.error(`Error creating Kali container: ${error.message}`);
    sendMessage(`Error creating Kali container: ${error.message}`);
    res.status(500).send(`Error creating container: ${error.message}`);
  }
});



/**
 * @route DELETE /api/containers/:id
 * @param {string} req.params.id - The ID of the container to delete.
 * @returns {Object} 200 - Confirmation of container deletion
 * @returns {Error} 400 - Container ID is required
 * @returns {Error} 500 - Error message on container deletion failure
 */
router.delete('/containers/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).send("Container ID is required");
  }

  try {
    await deleteContainer(id);
    res.send({ message: `Container ${id} deleted successfully.` });
  } catch (error) {
    res.status(500).send(`Error deleting container: ${error.message}`);
  }
});


export default router;