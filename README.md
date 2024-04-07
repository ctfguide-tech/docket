# docket

Spin up an Alpine Container via an API endpoint.

## Installation

First you need to have Docker installed on your machine. You can install it by following the instructions [here](https://docs.docker.com/get-docker/).

After installing Docker, you can clone this repository by running `git clone https://github.com/ctfguide-tech/docket.git`

You can install all the dependencies by running `npm install`.

## Deploying

Configure the port on an .env file or directly on the `index.js` file.

Afterwards, run `npm start` and the server will start on that port. See endpoints below.

## Endpoints

- `/` - Returns a simple message.
- `/client` - A web client for connecting to your terminal.
- `/create?username=&password=` - Creates a new container and returns the websocket URL.

## Dependencies

- Express
- Dockerode
