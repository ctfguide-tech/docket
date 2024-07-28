FROM ubuntu:latest

RUN apt-get update && apt-get install -y openssl curl openssh-client sudo nodejs npm &&  \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN npm install -g wetty

RUN apt-get update && apt-get install -y build-essential
RUN apt-get install -y python3
RUN apt-get install -y python3-pip
RUN apt-get install -y vim 
RUN apt install -y git

EXPOSE 3000

VOLUME /home

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

CMD ["wetty"]