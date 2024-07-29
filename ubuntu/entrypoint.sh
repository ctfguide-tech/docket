if [ -n "$1" ] ; then
        $@
        exit
fi

echo $SIAB_USER
echo $SIAB_PASSWORD
echo $SERVICE_NAME
echo $MAX_CPU

adduser -D -g $SIAB_USER  $SIAB_USER 
echo -e "$SIAB_PASSWORD\n$SIAB_PASSWORD" | passwd $SIAB_USER 
export BASEURL="/ctfterminal/$SERVICE_NAME"
echo "$SIAB_USER ALL=(ALL) ALL" > /etc/sudoers.d/$SIAB_USER && chmod 0440 /etc/sudoers.d/$SIAB_USER

adduser -D -g appuser appuser

# Set a decent random password (aiming for a 256 bit security level, but better than "monkey")
PW=$(head -c 32 /dev/urandom | base64) && echo -e "$PW\n$PW" | passwd appuser && unset PW



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

echo "Current folder"

cd /home/$SIAB_USER
pwd



cd /usr/src/app


echo '#!/bin/sh
url="https://file-system-run-qi6ms4rtoa-ue.a.run.app/Terminal/setPodStatus"
while ! nc -z localhost 4200; do
  sleep 1
done

json_data="{\"terminalUserPassword\":\"$1\"}"
echo $json_data
echo "running"
response=$(curl -X POST -H "Content-Type: application/json" --data "$json_data" https://file-system-run-qi6ms4rtoa-ue.a.run.app/Terminal/setPodStatus)
response1=$(curl -X POST -H "Content-Type: application/json" --data "$json_data" https://terminal-api-prod-vchgui6lfq-ue.a.run.app/Terminal/setPodStatus)
echo "Response from the server:"
echo "$response"'>bg.sh

sudo chmod +x bg.sh

sudo nohup ./bg.sh "$SIAB_PASSWORD" &

#yarn start --ssh-host 'localhost' --port 4200 --ssh-port 22 --base ${BASEURL}/ --ssl-key $ssl_key --ssl-cert $ssl_cert
yarn start --host 0.0.0.0 --port ${SIAB_PORT} --title "CTFGuide Terminal" --ssh-user ${SIAB_USER} --ssh-password ${SIAB_PASSWORD} --base ${BASEURL}/ --allow-iframe 