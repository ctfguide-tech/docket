# Docket

Manage fleets of containers across your own infrastructure. Built for CTFGuide's virtual terminal service.

## Installation
1. Install Docker by following the instructions [here](https://docs.docker.com/get-docker/).
2. Install Node.js by following the instructions [here](https://nodejs.org/en/download/).
3. Clone the repository:
4. Install dependencies:

## Usage
- Start the server:
- Access API documentation at: http://localhost:YOUR_PORT_HERE/docs

## Endpoints
- **POST /api/containers/create**
  - Create a Docker container.
  - Parameters: `username`, `password`, `commandsToRun`, `port`, `root`.
- **GET /containers/:containerId/status**
  - Check the status of a Docker container.
- **DELETE /api/containers/:id**
  - Delete a Docker container by ID.
- **GET /api/containers/:id/login**
  - DEPRECATED: Initiate login for a container.

## Supported Images
- ctfguide: ShellInABox + Ubuntu 22.10 minimal with a few essential cyber related tools installed

> Support for custom images is coming soon.

## Tooling
You'll find tools in the `src/tools` folder in this repository.

## Tools
- visualizer.js (alpha v.0.1)
  - This spins up a web interface that allows you to visualize Docket.
  - `node visualizer.js` to run.

> There will be many more tools in the future!


## Dependencies
- Express
- Dockerode

## Contributing
1. Fork the repository.
2. Create a new branch (`git checkout -b feature/awesome-feature`).
3. Make your changes.
4. Commit your changes (`git commit -am 'Add some feature'`).
5. Push to the branch (`git push origin feature/awesome-feature`).
6. Create a new Pull Request.

## License
This project is licensed under the MIT License.

## Copyright
&copy; CTFGuide Corporation 2024.
Authored by Pranav Ramesh 2024.