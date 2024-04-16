import express from 'express';
import { createContainer, deleteContainer } from '../utils/dockerManager.js';

const router = express.Router();

/**
 * @route GET /api/containers/create
 * @param {string} req.query.username - The username for the container.
 * @param {string} req.query.password - The password for the container.
 * @returns {Object} 200 - An object containing the container ID
 * @returns {Error} 400 - Username and password are required
 * @returns {Error} 500 - Error message on container creation failure
 */

router.get('/containers/create', async (req, res) => {
  const { username, password } = req.query;

  if (!username || !password) {
    return res.status(400).send("Username and password are required");
  }

  try {
    const containerId = await createContainer(username, password);
    res.send({ containerId });
  } catch (error) {
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