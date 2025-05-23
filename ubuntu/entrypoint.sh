#!/bin/sh

if [ -n "$1" ] ; then
        $@
        exit
fi

#sudo apk add --no-cache python3 py3-pip
#pip3 install requests
echo "SIAB_USER: $SIAB_USER"
echo "SIAB_PASSWORD: $SIAB_PASSWORD"
echo "SERVICE_NAME: $SERVICE_NAME"
echo "MAX_CPU: $MAX_CPU"

adduser -D -g $SIAB_USER $SIAB_USER
echo -e "$SIAB_PASSWORD\n$SIAB_PASSWORD" | passwd $SIAB_USER
if [ $? -ne 0 ]; then
    echo "Failed to set password for $SIAB_USER"
    exit 1
fi

if [ "$SIAB_SUDO" = true ]; then
    echo "$SIAB_USER ALL=(ALL) ALL" > /etc/sudoers.d/$SIAB_USER && chmod 0440 /etc/sudoers.d/$SIAB_USER
fi

adduser -D -g appuser appuser

# Set a decent random password (aiming for a 256 bit security level, but better than "monkey")
PW=$(head -c 32 /dev/urandom | base64) && echo -e "$PW\n$PW" | passwd appuser && unset PW
if [ $? -ne 0 ]; then
    echo "Failed to set password for appuser"
    exit 1
fi

ssl_dir=/home/node/ssl
ssl_key=$ssl_dir/key.pem
ssl_cert=$ssl_dir/cert.pem

mkdir -p $ssl_dir

if ! [ -f $ssl_key ] || ! [ -f $ssl_cert ] ; then
        rm -f $ssl_key $ssl_cert
        echo "One or both SSL keys were not found. Generating new ones..."

        openssl req -x509 -newkey rsa:4096 -keyout $ssl_key -out $ssl_cert \
                -days 300000 -nodes -subj "/C=YZ/ST=Hello/L=Here/O=Company/OU=Org/CN=wetty"
fi
#cd ~"$SIAB_USER"
echo $PWD
echo $SIAB_FILEID
echo "$SIAB_FILEID" > filename.txt



python3 /fileHandler.py "$SIAB_FILEID" "$SIAB_USER"
#yarn start --ssh-host 'localhost' --port 4200 --ssh-port 22 --base ${BASEURL}/ --ssl-key $ssl_key --ssl-cert $ssl_cert
yarn start --host 0.0.0.0 --port 3000 --title "CTFGuide Terminal" --ssh-user ${SIAB_USER} --ssh-password ${SIAB_PASSWORD} --allow-iframe 