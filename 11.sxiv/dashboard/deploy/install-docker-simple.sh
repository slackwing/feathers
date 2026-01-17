#!/bin/bash
# Simple Docker installation that avoids broken repositories

set -e

echo "=== Installing Docker (ignoring broken repos) ==="
echo

if [ "$EUID" -ne 0 ]; then
    echo "Please run with sudo:"
    echo "  sudo $0"
    exit 1
fi

# Install prerequisites (should already be installed based on your output)
echo "Ensuring prerequisites are installed..."
apt-get install -y ca-certificates curl gnupg lsb-release 2>/dev/null || echo "Prerequisites already installed"

# Add Docker's official GPG key
echo "Adding Docker GPG key..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo "Setting up Docker repository..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update only Docker's repository and install
echo "Installing Docker packages..."
apt-get update -o Dir::Etc::sourcelist="sources.list.d/docker.list" \
    -o Dir::Etc::sourceparts="-" -o APT::Get::List-Cleanup="0"

apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
systemctl start docker
systemctl enable docker

echo
echo "✓ Docker installed successfully"

# Add current user to docker group
if [ -n "$SUDO_USER" ]; then
    usermod -aG docker $SUDO_USER
    echo "✓ Added user '$SUDO_USER' to docker group"
    echo
    echo "⚠️  Log out and back in for group membership to take effect"
fi

# Verify installation
echo
echo "=== Verifying Installation ==="
docker --version
docker compose version

# Test Docker (as root, since user hasn't logged out yet)
echo
echo "Testing Docker..."
docker run --rm hello-world

echo
echo "=== Installation Complete ==="
echo
echo "After logging out and back in, test as your user:"
echo "  docker run hello-world"
