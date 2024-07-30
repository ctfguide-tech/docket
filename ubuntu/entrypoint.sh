#!/bin/sh

if [ -n "$1" ] ; then
        $@
        exit
fi

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

echo "Current folder"

# Input string with URLs separated by &&
input_string=$SIAB_FILEID
# Split the input string by '&&' and iterate over each URL
IFS="@"
counter=1
set -f  # Disable pathname expansion (globbing)
set -- $input_string
for url do
  # Trim leading and trailing whitespace
  url=$(echo "$url" | tr -d '[:space:]')
  if [ -z "$url" ]; then
    echo "Empty URL. Skipping."
    continue
  fi
  filename="data$counter.zip"
  counter=$(($counter + 1))

  # Add wget command with the -O option to specify the output filename
  command="wget $url -O /home/$SIAB_USER/$filename"

  # Run wget command
  echo "Running command: $command"
  eval "$command"

  # Check for wget exit status
  if [ $? -eq 0 ]; then
    echo "Command successful"
  else
    echo "Command failed"
    # You can choose to exit the script or handle errors differently
    exit 1
  fi
done


echo "${SIAB_FILEID}"
#yarn start --ssh-host 'localhost' --port 4200 --ssh-port 22 --base ${BASEURL}/ --ssl-key $ssl_key --ssl-cert $ssl_cert
yarn start --host 0.0.0.0 --port 3000 --title "CTFGuide Terminal" --ssh-user ${SIAB_USER} --ssh-password ${SIAB_PASSWORD} --allow-iframe 