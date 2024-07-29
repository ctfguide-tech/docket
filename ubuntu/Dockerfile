FROM wettyoss/wetty

USER root

RUN apk add sshpass openssl curl sudo tshark nano nmap tcpdump aircrack-ng whois bind-tools netcat-openbsd
RUN apk add hping3 --update-cache --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing



COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
