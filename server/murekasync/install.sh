#!/bin/sh
#
# Install or update the listening together relay on a server with OpenRC,
# over ssh. Built first with make server, for the server's machine.
#
#   server/murekasync/install.sh -n 10.0.0.1      a new install
#   server/murekasync/install.sh -u 10.0.0.1      an update
#
# A new install puts in the program, the service and its settings (settings
# already there are kept), adds the service to the default runlevel and
# starts it. An update puts in the program and the service and restarts it,
# the settings on the server kept as they are.

set -eu

usage() {
    cat <<EOF
Usage: $0 -n|-u [-l login] [-p port] host

  -n          new install: program, service, settings, runlevel, start
  -u          update: program and service, restart, the settings kept
  -l login    the user to log in as, root unless given, one that may install
  -p port     the ssh port, 22 unless given
  host        the server's address or name, its VPN address for example
EOF
    exit "${1:-1}"
}

mode=""
login="root"
port="22"

while getopts "nul:p:h" opt; do

    case "$opt" in
        n) mode="new" ;;
        u) mode="update" ;;
        l) login="$OPTARG" ;;
        p) port="$OPTARG" ;;
        h) usage 0 ;;
        *) usage ;;
    esac
done

shift $((OPTIND - 1))

if [ -z "$mode" ] || [ $# -ne 1 ]; then
    usage
fi

host="$1"

# The files sit next to this script, wherever it is run from
here=$(cd "$(dirname "$0")" && pwd)

if [ ! -x "$here/murekasync" ]; then
    echo "No program to install: run make server first, with SERVER_ARCH for the server's machine" >&2
    exit 1
fi

# Copied to a folder of its own on the server, taken away again after
dir="/tmp/murekasync-install.$$"
target="$login@$host"

echo "Copying to $target"
ssh -p "$port" "$target" "mkdir -p $dir"
scp -P "$port" "$here/murekasync" "$here/murekasync.initd" "$here/murekasync.confd" "$target:$dir/"

if [ "$mode" = "new" ]; then

    echo "Installing on $host"

    # Settings already on the server are kept, a new install of a server
    # that had it before does not undo them
    ssh -p "$port" "$target" "cd $dir \
        && install -m 755 murekasync /usr/local/bin/murekasync \
        && install -m 755 murekasync.initd /etc/init.d/murekasync \
        && if [ -e /etc/conf.d/murekasync ]; then echo 'Settings kept: /etc/conf.d/murekasync'; \
            else install -m 644 murekasync.confd /etc/conf.d/murekasync; fi \
        && { rc-update add murekasync default || true; } \
        && rc-service murekasync restart; \
        s=\$?; rm -rf $dir; exit \$s"
else

    echo "Updating on $host"

    ssh -p "$port" "$target" "cd $dir \
        && install -m 755 murekasync /usr/local/bin/murekasync \
        && install -m 755 murekasync.initd /etc/init.d/murekasync \
        && rc-service murekasync restart; \
        s=\$?; rm -rf $dir; exit \$s"
fi

echo "Done"
