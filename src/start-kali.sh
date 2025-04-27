#!/bin/bash
set -e

# Set up user if not exists
if ! id "$USERNAME" &>/dev/null; then
    useradd -m "$USERNAME"
    echo "$USERNAME:$PASSWORD" | chpasswd
    adduser "$USERNAME" sudo
    echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME
    chmod 0440 /etc/sudoers.d/$USERNAME
fi

#### WALLPAPER CONFIG ####

export DISPLAY=:1

## i'm like 95% sure this isn't needed 
wget -O /tmp/testwall.png https://raw.githubusercontent.com/ctfguide-tech/hosted/refs/heads/main/ctfworkspace.png
xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitor0/image-path -s /tmp/testwall.png && xfdesktop --reload
## end of 95% sure of what isn't needed

## wallpaper set logic
WALLPAPER_URL="https://raw.githubusercontent.com/ctfguide-tech/hosted/refs/heads/main/ctfworkspace.png"
for img in /usr/share/images/desktop-base/default /usr/share/images/desktop-base/desktop-background; do
    wget -O "$img" "$WALLPAPER_URL"
done

# overwrite xfce backgrounds 
for img in /usr/share/backgrounds/xfce/*; do
    wget -O "$img" "$WALLPAPER_URL"
done

# force xfce to act appropriately
USER_HOME=$(eval echo "~$USERNAME")
XFCE_CONF_DIR="$USER_HOME/.config/xfce4/xfconf/xfce-perchannel-xml"
mkdir -p "$XFCE_CONF_DIR"

cat > "$XFCE_CONF_DIR/xfce4-desktop.xml" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfce4-desktop" version="1.0">
  <property name="backdrop">
    <property name="screen0">
      <property name="monitor0">
        <property name="image-path" type="string" value="/usr/share/images/desktop-base/default"/>
        <property name="workspace0">
          <property name="last-image" type="string" value="/usr/share/images/desktop-base/default"/>
        </property>
      </property>
    </property>
  </property>
</channel>
EOF

#### END WALLPAPER CONFIG ####

# chown config
chown -R "$USERNAME":"$USERNAME" "$USER_HOME/.config"


## display nonsense

# start Xvfb
Xvfb :1 -screen 0 1280x720x24 &
# Wait until Xvfb is ready
for i in {1..10}; do
    if xdpyinfo -display :1 >/dev/null 2>&1; then
        break
    fi
    echo "Waiting for Xvfb to be ready..."
    sleep 1
done

# start desktop fore user
# i think this casues weird stuff with logout?
su - "$USERNAME" -c "DISPLAY=:1 startxfce4 &"
sleep 5

# ensure all connected "monitors" have the wallpaper
su - "$USERNAME" -c "DISPLAY=:1 xfce4-terminal -e 'bash -c \"for m in 0 1; do xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitor${m}/image-path -s /usr/share/images/desktop-base/default; xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitor${m}/last-image -s /usr/share/images/desktop-base/default; xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitor${m}/last-single-image -s /usr/share/images/desktop-base/default; done; xfdesktop --reload\"' &"

# time alerts
su - "$USERNAME" -c "DISPLAY=:1 notify-send 'CTFGuide Notice' 'You have 1 hour remaining in this Kali container session.'"

# Show warning 5 minutes before shutdown
su - "$USERNAME" -c "DISPLAY=:1 bash -c 'sleep 3300; notify-send \"CTFGuide Notice\" \"⚠️ 5 minutes left until your container expires!\"' &"

# vnc
x11vnc -display :1 -forever -shared -passwd $PASSWORD &
websockify --web=/usr/share/novnc/ 6080 localhost:5900

