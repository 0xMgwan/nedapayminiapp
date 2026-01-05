#!/bin/bash
# Clear any cached credentials for this repo
git credential reject <<EOF
protocol=https
host=github.com
path=NEDA-LABS/base-miniapp.git
EOF

# Push to NEDA-LABS repo
git push neda-labs main --force
