#!/bin/sh
set -e

python wait_for_db.py
exec "$@"
