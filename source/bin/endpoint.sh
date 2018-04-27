#!/bin/sh

## generate config file
cd /opt/cronicle/conf

dockerize -template config.tmpl.json:config.json echo 'config.json saved.'

cd /opt/cronicle/bin

./control.sh setup
./debug.sh --master
