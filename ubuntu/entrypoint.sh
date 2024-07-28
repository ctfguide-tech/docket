#!/bin/bash

set -e

echo "Preparing container .."

if [ "${SIAB_ADDUSER}" == "true" ]; then
  sudo=""
  if [ "${SIAB_SUDO}" == "true" ]; then
    sudo="-G sudo"
  fi
  if [ -z "$(getent group ${SIAB_GROUP})" ]; then
    /usr/sbin/groupadd -g ${SIAB_GROUPID} ${SIAB_GROUP}
  fi
  if [ -z "$(getent passwd ${SIAB_USER})" ]; then
    /usr/sbin/useradd -u ${SIAB_USERID} -g ${SIAB_GROUPID} -s ${SIAB_SHELL} -d ${SIAB_HOME} -m ${sudo} ${SIAB_USER}
    echo "${SIAB_USER}:${SIAB_PASSWORD}" | /usr/sbin/chpasswd
    unset SIAB_PASSWORD
  fi
fi

echo "Starting container .."
if [ "$@" = "wetty" ]; then
  exec wetty --port 3000 --base /wetty
else
  echo "Executing: ${@}"
  exec $@
fi

# Adding MOTD script
cd /home/guest && rm -f /etc/update-motd.d/* && echo "\\033[1;33mWelcome to your CTFGuide Workspace. Compute is provided by STiBaRC.\nAll sessions are logged. Remember to follow our TOS when using this terminal. Happy Hacking!\n\n\\033[0m" | tee /etc/motd