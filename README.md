<p align="center">
  <img src="https://i.ibb.co/LJxxtc7/Untitled-design-16.png" alt="Banner">
</p>

# docket

Spin up a container via an API endpoint.

## Installation

First you need to have Docker installed on your machine. You can install it by following the instructions [here](https://docs.docker.com/get-docker/).

Ensure that you have Node.js installed on your machine. You can install it by following the instructions [here](https://nodejs.org/en/download/).

You'll need to have some images on your machine. You can pull the `alpine` image by running `docker pull alpine:latest`. By default, we've set the image to `alpine:latest` on the `index.js` file. But, you can change it to any other image you have on your machine.

After installing Docker, you can clone this repository by running `git clone https://github.com/ctfguide-tech/docket.git`

You can install all the dependencies by running `npm install`.

## Deploying
On Linux, you'll need to run this command:
```socat TCP-LISTEN:2375,reuseaddr,fork UNIX-CLIENT:/var/run/docker.sock```

On MacOS, you'll need to run this command: 
```socat TCP-LISTEN:2375,reuseaddr,fork UNIX-CLIENT:$HOME/Library/Containers/com.docker.docker/Data/docker.raw.sock```

Configure the port on an .env file.

Afterwards, run `npm start` and the server will start on that port. See endpoints below.

## Endpoints
This project uses JSDOC. You can access the docs by going to http://localhost:YOUR_PORT_HERE/docs


## Dependencies

- Express
- Dockerode


