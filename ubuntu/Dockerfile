FROM wettyoss/wetty

USER root

RUN apk add sshpass openssl curl sudo tshark nano nmap tcpdump aircrack-ng whois bind-tools netcat-openbsd
RUN apk add hping3 --update-cache --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing

RUN apk add --no-cache python3 py3-pip
RUN pip3 install requests


COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh
COPY fileHandler.py /fileHandler.py
RUN chmod +x /fileHandler.py


ENTRYPOINT ["/entrypoint.sh"]
