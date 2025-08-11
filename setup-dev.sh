#!/usr/bin/env bash

# Development Environment Setup Script
# This script installs direnv and sets up the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}🛠  GraphQL Hive CQRS Development Environment Setup${NC}"
echo -e "${WHITE}====================================================${NC}"

# Check if we're in the right directory
if [[ ! -f "shell.nix" ]]; then
    echo -e "${RED}❌ Error: shell.nix not found${NC}"
    echo -e "${YELLOW}💡 Please run this from the project root directory${NC}"
    exit 1
fi

# Check if Nix is installed
if ! command -v nix &> /dev/null; then
    echo -e "${RED}❌ Error: Nix is not installed${NC}"
    echo -e "${YELLOW}💡 Installing Nix...${NC}"
    echo -e "${BLUE}This will download and install Nix package manager${NC}"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        curl -L https://nixos.org/nix/install | sh
        echo -e "${GREEN}✅ Nix installed! Please restart your terminal and run this script again.${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Nix installation cancelled${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Nix is available${NC}"

# Detect shell
USER_SHELL=$(basename "$SHELL")
SHELL_CONFIG=""

case "$USER_SHELL" in
    "zsh")
        SHELL_CONFIG="$HOME/.zshrc"
        ;;
    "bash")
        if [[ "$OSTYPE" == "darwin"* ]]; then
            SHELL_CONFIG="$HOME/.bash_profile"
        else
            SHELL_CONFIG="$HOME/.bashrc"
        fi
        ;;
    *)
        echo -e "${YELLOW}⚠️  Unsupported shell: $USER_SHELL${NC}"
        echo -e "${YELLOW}This script supports zsh and bash${NC}"
        ;;
esac

echo -e "${BLUE}📍 Detected shell: $USER_SHELL${NC}"
echo -e "${BLUE}📍 Shell config: $SHELL_CONFIG${NC}"

# Check if direnv is installed
if ! command -v direnv &> /dev/null; then
    echo -e "${YELLOW}📦 Installing direnv...${NC}"

    # Try different installation methods
    if command -v brew &> /dev/null; then
        echo -e "${BLUE}Using Homebrew...${NC}"
        brew install direnv
    elif command -v apt-get &> /dev/null; then
        echo -e "${BLUE}Using apt-get...${NC}"
        sudo apt-get update && sudo apt-get install -y direnv
    elif command -v yum &> /dev/null; then
        echo -e "${BLUE}Using yum...${NC}"
        sudo yum install -y direnv
    elif command -v nix-env &> /dev/null; then
        echo -e "${BLUE}Using Nix...${NC}"
        nix-env -iA nixpkgs.direnv
    else
        echo -e "${RED}❌ Could not install direnv automatically${NC}"
        echo -e "${YELLOW}💡 Please install direnv manually:${NC}"
        echo -e "   • macOS: brew install direnv"
        echo -e "   • Ubuntu/Debian: sudo apt install direnv"
        echo -e "   • Nix: nix-env -iA nixpkgs.direnv"
        exit 1
    fi
else
    echo -e "${GREEN}✅ direnv is already installed${NC}"
fi

# Add direnv hook to shell config
if [[ -n "$SHELL_CONFIG" ]]; then
    HOOK_LINE=""
    case "$USER_SHELL" in
        "zsh")
            HOOK_LINE='eval "$(direnv hook zsh)"'
            ;;
        "bash")
            HOOK_LINE='eval "$(direnv hook bash)"'
            ;;
    esac

    if [[ -n "$HOOK_LINE" ]]; then
        if ! grep -q "direnv hook" "$SHELL_CONFIG" 2>/dev/null; then
            echo -e "${YELLOW}📝 Adding direnv hook to $SHELL_CONFIG${NC}"
            echo "" >> "$SHELL_CONFIG"
            echo "# direnv hook for automatic environment loading" >> "$SHELL_CONFIG"
            echo "$HOOK_LINE" >> "$SHELL_CONFIG"
            echo -e "${GREEN}✅ direnv hook added${NC}"
        else
            echo -e "${GREEN}✅ direnv hook already configured${NC}"
        fi
    fi
fi

# Check if .envrc exists and allow it
if [[ -f ".envrc" ]]; then
    echo -e "${BLUE}🔐 Found .envrc file${NC}"

    # Source the shell config to make direnv available in this session
    if [[ -n "$SHELL_CONFIG" && -f "$SHELL_CONFIG" ]]; then
        source "$SHELL_CONFIG" 2>/dev/null || true
    fi

    # Try to allow direnv
    if command -v direnv &> /dev/null; then
        echo -e "${YELLOW}🔓 Allowing .envrc...${NC}"
        direnv allow
        echo -e "${GREEN}✅ .envrc allowed${NC}"
    else
        echo -e "${YELLOW}⚠️  direnv not available in current session${NC}"
        echo -e "${BLUE}You'll need to restart your terminal and run 'direnv allow'${NC}"
    fi
else
    echo -e "${YELLOW}📝 Creating .envrc file...${NC}"
    echo "use nix" > .envrc
    echo -e "${GREEN}✅ .envrc created${NC}"

    if command -v direnv &> /dev/null; then
        echo -e "${YELLOW}🔓 Allowing .envrc...${NC}"
        direnv allow
        echo -e "${GREEN}✅ .envrc allowed${NC}"
    fi
fi

# Test the environment
echo -e "${BLUE}🧪 Testing environment...${NC}"
if nix-shell --run "echo 'Nix shell test: OK'" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nix shell working${NC}"
else
    echo -e "${RED}❌ Nix shell test failed${NC}"
    exit 1
fi

# Check if we can access the development tools
echo -e "${BLUE}🔍 Checking development tools...${NC}"
if nix-shell --run "bun --version && node --version && tsc --version" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Development tools available${NC}"
else
    echo -e "${YELLOW}⚠️  Some development tools might not be available${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo -e "${BLUE}1.${NC} Restart your terminal (or run: source $SHELL_CONFIG)"
echo -e "${BLUE}2.${NC} Navigate to this directory - the environment will load automatically"
echo -e "${BLUE}3.${NC} Or run: ${YELLOW}./dev-zsh.sh${NC} for the enhanced zsh experience"
echo -e "${BLUE}4.${NC} Or run: ${YELLOW}nix-shell${NC} for the basic environment"
echo ""
echo -e "${YELLOW}Quick test:${NC} cd to another directory and back to see direnv in action!"
echo -e "${YELLOW}Development commands:${NC} dev, test-all, generate, clean"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
