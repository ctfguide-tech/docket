#FROM ubuntu:latest
FROM wettyoss/wetty

USER root

# Add packages
RUN apk add openssl curl sudo tshark nano nmap tcpdump aircrack-ng whois bind-tools netcat-openbsd
RUN apk add hping3 --update-cache --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing

#Kana Prerequisites
RUN sudo apk update
RUN sudo apk add musl-dev gcc


COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]