# docket

Spin up a container via an API endpoint.

## Installation

First you need to have Docker installed on your machine. You can install it by following the instructions [here](https://docs.docker.com/get-docker/).

Ensure that you have Node.js installed on your machine. You can install it by following the instructions [here](https://nodejs.org/en/download/).

You'll need to have some images on your machine. You can pull the `alpine` image by running `docker pull alpine:latest`. By default, we've set the image to `alpine:latest` on the `index.js` file. But, you can change it to any other image you have on your machine.

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

## Notice

If you're on Linux, you'll need to update the a variable called "socatProcess" on the `index.js` file to `spawn('socat', ['TCP-LISTEN:2375,reuseaddr,fork', 'UNIX:/var/run/docker.sock']);`. The current value is for MacOS.
