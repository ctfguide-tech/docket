const apiToken = process.env.API_TOKEN; // Assuming your .env file has the API token stored as API_TOKEN

/**
 * Middleware to require an API token for accessing routes.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function in the stack.
 */

export const requireApiToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(403).json({ error: 'API token is required' });
  }

  if (token !== `Bearer ${apiToken}`) {
    return res.status(401).json({ error: 'Invalid API token' });
  }

  next();
};

