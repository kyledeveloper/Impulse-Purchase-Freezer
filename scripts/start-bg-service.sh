#!/bin/bash
kill -9 $(lsof -t -i :8088) 2>/dev/null
pkill -f "localtunnel.*impulse-freezer-bg" 2>/dev/null

nohup node "$(dirname "$0")/bg-remover-server.js" > /tmp/bg-remover.log 2>&1 &
sleep 2

nohup npx -y localtunnel --port 8088 --subdomain impulse-freezer-bg > /tmp/localtunnel.log 2>&1 &
sleep 3
