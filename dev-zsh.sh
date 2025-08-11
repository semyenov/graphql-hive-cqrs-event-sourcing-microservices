#!/usr/bin/env bash

# Development Environment Zsh Launcher
# Simple and robust launcher for the GraphQL Hive CQRS development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 GraphQL Hive CQRS Development Environment${NC}"
echo -e "${CYAN}=============================================${NC}"

# Check if we're in the right directory
if [[ ! -f "shell.nix" ]]; then
    echo -e "${RED}❌ Error: shell.nix not found${NC}"
    echo -e "${YELLOW}💡 Please run this from the project root directory${NC}"
    exit 1
fi

# Check if nix is available
if ! command -v nix-shell &> /dev/null; then
    echo -e "${RED}❌ Error: nix-shell not found${NC}"
    echo -e "${YELLOW}💡 Install Nix: curl -L https://nixos.org/nix/install | sh${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Loading development environment...${NC}"

# Create a temporary zshrc for clean environment
TEMP_ZSHRC=$(mktemp)
cat > "$TEMP_ZSHRC" << 'EOF'
# Minimal zsh configuration for development environment
autoload -U compinit
compinit -d ~/.zcompdump

# History configuration
export HISTSIZE=10000
export SAVEHIST=10000
export HISTFILE="$HOME/.zsh_history_dev"
setopt HIST_VERIFY
setopt HIST_IGNORE_ALL_DUPS
setopt SHARE_HISTORY
setopt APPEND_HISTORY

# Development aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
alias ...='cd ../..'

# Git aliases
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git pull'
alias gd='git diff'
alias gb='git branch'
alias gco='git checkout'

# Bun aliases
alias bd='bun run dev'
alias bt='bun test'
alias bi='bun install'
alias br='bun run'
alias btc='bun run typecheck'

# Project functions
dev() {
    echo "🚀 Starting development server..."
    bun run dev
}

test-all() {
    echo "🧪 Running complete test suite..."
    bun run typecheck && bun test && bun run test:framework
}

generate() {
    echo "⚡ Generating GraphQL types..."
    bun run generate:all
}

clean() {
    echo "🧹 Cleaning unused exports..."
    bun run clean:unused
}

# Simple but informative prompt
export PS1="%F{green}[dev]%f %F{blue}%~%f %F{yellow}❯%f "

# Welcome message
echo ""
echo -e "\033[0;32m✅ Development environment ready!\033[0m"
echo -e "\033[1;33mQuick commands:\033[0m"
echo -e "  • \033[0;34mdev\033[0m      - Start development server"
echo -e "  • \033[0;34mtest-all\033[0m - Run complete test suite"
echo -e "  • \033[0;34mgenerate\033[0m - Generate GraphQL types"
echo -e "  • \033[0;34mclean\033[0m    - Clean unused exports"
echo -e "  • \033[0;34mexit\033[0m     - Leave development environment"
echo ""
EOF

# Cleanup function
cleanup() {
    rm -f "$TEMP_ZSHRC"
}
trap cleanup EXIT

# Launch nix-shell with zsh
exec nix-shell --command "ZDOTDIR='$(dirname "$TEMP_ZSHRC")' zsh -f -d -c 'source \"$TEMP_ZSHRC\" && exec zsh'"
