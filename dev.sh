#!/usr/bin/env bash

# GraphQL Hive CQRS Smart Development Launcher
# Intelligent entry point with quick access to all development tools

set -e

# Colors and styling
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly BOLD='\033[1m'
readonly DIM='\033[2m'
readonly NC='\033[0m'

# Configuration
readonly PROJECT_NAME="GraphQL Hive CQRS"
readonly REQUIRED_FILES=("shell.nix" "package.json" ".envrc")

# Utility functions
check_prerequisites() {
    local missing_files=()
    for file in "${REQUIRED_FILES[@]}"; do
        if [[ ! -f "$file" ]]; then
            missing_files+=("$file")
        fi
    done

    if [[ ${#missing_files[@]} -gt 0 ]]; then
        echo -e "${RED}❌ Missing required files: ${missing_files[*]}${NC}"
        echo -e "${YELLOW}💡 Please run this script from the project root directory${NC}"
        exit 1
    fi
}

show_banner() {
    clear
    echo -e "${CYAN}╭─────────────────────────────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${WHITE}${BOLD}                    🚀 Smart Development Launcher                   ${NC}${CYAN}│${NC}"
    echo -e "${CYAN}│${DIM}              GraphQL Hive CQRS Event Sourcing Project               ${NC}${CYAN}│${NC}"
    echo -e "${CYAN}╰─────────────────────────────────────────────────────────────────────╯${NC}"
    echo ""
}

detect_environment_status() {
    local status_items=()
    local recommendations=()

    # Check Nix environment
    if command -v nix-shell >/dev/null 2>&1; then
        status_items+=("${GREEN}✓ Nix${NC}")
    else
        status_items+=("${RED}✗ Nix${NC}")
        recommendations+=("Install Nix: ${BLUE}curl -L https://nixos.org/nix/install | sh${NC}")
    fi

    # Check direnv
    if command -v direnv >/dev/null 2>&1; then
        status_items+=("${GREEN}✓ direnv${NC}")
        # Check if .envrc is allowed
        if direnv status 2>/dev/null | grep -q "Found RC allowed"; then
            status_items+=("${GREEN}✓ Environment${NC}")
        else
            status_items+=("${YELLOW}⚠ Environment${NC}")
            recommendations+=("Allow environment: ${BLUE}direnv allow${NC}")
        fi
    else
        status_items+=("${RED}✗ direnv${NC}")
        recommendations+=("Run setup: ${BLUE}./setup-dev.sh${NC}")
    fi

    # Check development tools
    if command -v bun >/dev/null 2>&1; then
        status_items+=("${GREEN}✓ Bun$(bun --version)${NC}")
    else
        status_items+=("${YELLOW}⚠ Bun${NC}")
    fi

    # Check project health
    if [[ -f "package.json" ]] && bun install --dry-run >/dev/null 2>&1; then
        status_items+=("${GREEN}✓ Dependencies${NC}")
    else
        status_items+=("${YELLOW}⚠ Dependencies${NC}")
        recommendations+=("Update dependencies: ${BLUE}bun install${NC}")
    fi

    # TypeScript health
    if bun run typecheck >/dev/null 2>&1; then
        status_items+=("${GREEN}✓ TypeScript${NC}")
    else
        status_items+=("${RED}✗ TypeScript${NC}")
        recommendations+=("Fix type errors or run: ${BLUE}generate${NC}")
    fi

    # Display status
    echo -e "${BOLD}🔍 Environment Status:${NC} $(IFS=' • '; echo "${status_items[*]}")"

    # Show recommendations if any
    if [[ ${#recommendations[@]} -gt 0 ]]; then
        echo -e "${YELLOW}💡 Quick fixes:${NC}"
        printf '   %s\n' "${recommendations[@]}"
        echo ""
    fi
}

show_quick_actions() {
    echo -e "${BOLD}${BLUE}⚡ Quick Actions${NC}"
    echo -e "${DIM}──────────────────────────────────────────────────────────────────────${NC}"
    echo -e "  ${GREEN}d)${NC} 🚀 Start development server         ${GREEN}a)${NC} 🤖 AI Development assistant"
    echo -e "  ${GREEN}t)${NC} 🧪 Run complete test suite          ${GREEN}m)${NC} 📊 Interactive dashboard"
    echo -e "  ${GREEN}g)${NC} ⚡ Generate GraphQL types            ${GREEN}z)${NC} 🐚 Enhanced Zsh environment"
    echo -e "  ${GREEN}c)${NC} 🧹 Clean & optimize project         ${GREEN}s)${NC} ⚙️  Setup development environment"
    echo ""
    echo -e "${BOLD}${BLUE}🛠  Development Tools${NC}"
    echo -e "${DIM}──────────────────────────────────────────────────────────────────────${NC}"
    echo -e "  ${GREEN}h)${NC} 🏥 Project health check             ${GREEN}b)${NC} 🏃 Benchmark performance"
    echo -e "  ${GREEN}f)${NC} 🔍 Smart search & navigation        ${GREEN}i)${NC} ℹ️  Environment information"
    echo -e "  ${GREEN}w)${NC} 🌿 Git workflow helper              ${GREEN}?)${NC} ❓ Help & documentation"
    echo ""
    echo -e "${BOLD}${BLUE}🎯 Environment Options${NC}"
    echo -e "${DIM}──────────────────────────────────────────────────────────────────────${NC}"
    echo -e "  ${GREEN}1)${NC} 🏠 Auto-detect & load best environment"
    echo -e "  ${GREEN}2)${NC} 🐚 Manual nix-shell (basic)"
    echo -e "  ${GREEN}3)${NC} 🚪 Exit launcher"
    echo ""
}

execute_quick_action() {
    local choice="$1"

    case "$choice" in
        'd')
            echo -e "${CYAN}🚀 Starting development server...${NC}"
            if command -v dev >/dev/null 2>&1; then
                dev
            else
                echo -e "${BLUE}Loading environment and starting server...${NC}"
                nix-shell --run "bun run dev"
            fi
            ;;
        't')
            echo -e "${CYAN}🧪 Running complete test suite...${NC}"
            if command -v test-all >/dev/null 2>&1; then
                test-all
            else
                nix-shell --run "bun run typecheck && bun test && bun run test:framework"
            fi
            ;;
        'g')
            echo -e "${CYAN}⚡ Generating GraphQL types...${NC}"
            if command -v generate >/dev/null 2>&1; then
                generate
            else
                nix-shell --run "bun run generate:all"
            fi
            ;;
        'c')
            echo -e "${CYAN}🧹 Cleaning and optimizing project...${NC}"
            if command -v clean >/dev/null 2>&1; then
                clean
            else
                nix-shell --run "bun run clean:unused && rm -rf dist/ build/ .bun/ node_modules/.cache/"
            fi
            ;;
        'h')
            echo -e "${CYAN}🏥 Running health check...${NC}"
            if command -v health >/dev/null 2>&1; then
                health
            else
                nix-shell --run "bun run typecheck && bun test --reporter=dot && echo 'Health check complete!'"
            fi
            ;;
        'f')
            echo -e "${CYAN}🔍 Opening smart search...${NC}"
            if command -v fzf >/dev/null 2>&1; then
                fd --type f --hidden --follow --exclude .git --exclude node_modules | \
                    fzf --preview 'bat --color=always --style=header,grid --line-range :300 {}'
            else
                echo -e "${YELLOW}⚠️  Advanced search requires nix environment${NC}"
            fi
            ;;
        'b')
            echo -e "${CYAN}🏃 Running performance benchmarks...${NC}"
            if command -v hyperfine >/dev/null 2>&1; then
                echo "TypeScript compilation:"
                hyperfine --warmup 1 "bun run typecheck"
                echo "Test suite execution:"
                hyperfine --warmup 1 "bun test"
            else
                nix-shell --run "echo 'TypeScript:' && time bun run typecheck && echo 'Tests:' && time bun test"
            fi
            ;;
        'w')
            echo -e "${CYAN}🌿 Git workflow helper...${NC}"
            echo -e "${BLUE}Current branch: ${YELLOW}$(git branch --show-current)${NC}"
            echo -e "${BLUE}Status:${NC}"
            git status --short --branch
            echo ""
            echo -e "${GREEN}Quick actions: ${BLUE}gs${NC} (status) ${BLUE}ga .${NC} (add all) ${BLUE}gc 'message'${NC} (commit)"
            ;;
        'i')
            echo -e "${CYAN}ℹ️  Environment information...${NC}"
            if command -v env-info >/dev/null 2>&1; then
                env-info
            else
                echo -e "${BLUE}System:${NC} $(uname -s) $(uname -m)"
                echo -e "${BLUE}Shell:${NC} $SHELL"
                [[ -n "$(command -v node)" ]] && echo -e "${BLUE}Node.js:${NC} $(node --version)"
                [[ -n "$(command -v bun)" ]] && echo -e "${BLUE}Bun:${NC} $(bun --version)"
                [[ -n "$(command -v tsc)" ]] && echo -e "${BLUE}TypeScript:${NC} $(tsc --version)"
            fi
            ;;
        'a')
            echo -e "${CYAN}🤖 Launching AI Development Assistant...${NC}"
            if [[ -x "./dev-assistant.sh" ]]; then
                ./dev-assistant.sh
            else
                echo -e "${YELLOW}⚠️  AI Assistant not available${NC}"
            fi
            ;;
        'm')
            echo -e "${CYAN}📊 Opening interactive dashboard...${NC}"
            if [[ -x "./dev-dashboard.sh" ]]; then
                ./dev-dashboard.sh
            else
                echo -e "${YELLOW}⚠️  Dashboard not available${NC}"
            fi
            ;;
        'z')
            echo -e "${CYAN}🐚 Launching enhanced Zsh environment...${NC}"
            if [[ -x "./dev-zsh.sh" ]]; then
                ./dev-zsh.sh
            else
                nix-shell --command zsh
            fi
            ;;
        's')
            echo -e "${CYAN}⚙️  Running development setup...${NC}"
            if [[ -x "./setup-dev.sh" ]]; then
                ./setup-dev.sh
            else
                echo -e "${YELLOW}⚠️  Setup script not available${NC}"
            fi
            ;;
        '?')
            show_help
            ;;
        *)
            echo -e "${RED}❌ Invalid choice: $choice${NC}"
            return 1
            ;;
    esac
}

show_help() {
    echo -e "${BOLD}${GREEN}📚 Help & Documentation${NC}"
    echo -e "${DIM}──────────────────────────────────────────────────────────────────────${NC}"
    echo ""
    echo -e "${BLUE}📋 Available Scripts:${NC}"
    echo -e "  ${CYAN}./dev.sh${NC}           - This smart launcher (you're here!)"
    echo -e "  ${CYAN}./setup-dev.sh${NC}     - One-time development environment setup"
    echo -e "  ${CYAN}./dev-zsh.sh${NC}       - Enhanced Zsh development environment"
    echo -e "  ${CYAN}./dev-dashboard.sh${NC} - Interactive development dashboard"
    echo -e "  ${CYAN}./dev-assistant.sh${NC} - AI-powered development assistant"
    echo ""
    echo -e "${BLUE}🚀 Quick Start:${NC}"
    echo -e "  1. Run ${CYAN}./setup-dev.sh${NC} (first time only)"
    echo -e "  2. Choose option ${GREEN}1${NC} to auto-detect best environment"
    echo -e "  3. Use ${GREEN}d${NC} to start development server"
    echo ""
    echo -e "${BLUE}🔧 Environment Options:${NC}"
    echo -e "  • ${GREEN}Auto-detect${NC} - Intelligent environment selection"
    echo -e "  • ${GREEN}nix-shell${NC} - Manual Nix environment"
    echo -e "  • ${GREEN}direnv${NC} - Automatic environment loading (after setup)"
    echo ""
    echo -e "${BLUE}💡 Pro Tips:${NC}"
    echo -e "  • Use single letter shortcuts for quick actions"
    echo -e "  • Set up direnv for automatic environment loading"
    echo -e "  • Try the AI assistant (${GREEN}a${NC}) for intelligent help"
    echo -e "  • Use the dashboard (${GREEN}m${NC}) for visual project management"
    echo ""
}

smart_environment_detection() {
    echo -e "${CYAN}🔍 Detecting optimal development environment...${NC}"

    # Check if direnv is active
    if [[ -n "$DIRENV_DIR" ]] && command -v bun >/dev/null 2>&1; then
        echo -e "${GREEN}✅ direnv environment detected and active${NC}"
        echo -e "${BLUE}🚀 You're ready to develop! Try: ${GREEN}d${NC} (dev server), ${GREEN}t${NC} (tests), ${GREEN}g${NC} (generate)${NC}"
        return 0
    fi

    # Check if we're in a nix-shell
    if [[ -n "$IN_NIX_SHELL" ]]; then
        echo -e "${GREEN}✅ Nix shell environment detected${NC}"
        echo -e "${BLUE}🚀 You're ready to develop! Try: ${GREEN}d${NC} (dev server), ${GREEN}t${NC} (tests), ${GREEN}g${NC} (generate)${NC}"
        return 0
    fi

    # Check if direnv is available but not active
    if command -v direnv >/dev/null 2>&1 && [[ -f ".envrc" ]]; then
        echo -e "${YELLOW}📋 direnv available but not active${NC}"
        echo -e "${BLUE}💡 Activating direnv environment...${NC}"

        if direnv allow && eval "$(direnv export bash)"; then
            echo -e "${GREEN}✅ direnv environment activated${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  direnv activation had issues${NC}"
        fi
    fi

    # Check if nix is available
    if command -v nix-shell >/dev/null 2>&1; then
        echo -e "${BLUE}🔧 Nix available, launching enhanced environment...${NC}"
        echo -e "${DIM}Loading development tools...${NC}"

        if [[ -x "./dev-zsh.sh" ]]; then
            exec ./dev-zsh.sh
        else
            exec nix-shell
        fi
    fi

    # Fallback: basic environment
    echo -e "${YELLOW}⚠️  No optimized environment detected${NC}"
    echo -e "${BLUE}💡 Recommendations:${NC}"
    echo -e "  1. Run ${CYAN}./setup-dev.sh${NC} for full setup"
    echo -e "  2. Install Nix: ${CYAN}curl -L https://nixos.org/nix/install | sh${NC}"
    echo -e "  3. Or use basic environment with available tools"

    return 1
}

main() {
    # Check prerequisites
    check_prerequisites

    # Handle command line arguments
    if [[ $# -gt 0 ]]; then
        case "$1" in
            '--help'|'-h')
                show_banner
                show_help
                exit 0
                ;;
            '--auto'|'-a')
                show_banner
                smart_environment_detection
                exit $?
                ;;
            '--setup'|'-s')
                show_banner
                if [[ -x "./setup-dev.sh" ]]; then
                    ./setup-dev.sh
                else
                    echo -e "${RED}❌ Setup script not found${NC}"
                    exit 1
                fi
                exit $?
                ;;
        esac
    fi

    # Main interactive loop
    while true; do
        show_banner
        detect_environment_status
        show_quick_actions

        read -p "🎯 Choose an action (or press Enter for auto-detect): " choice
        echo ""

        # Handle empty input (auto-detect)
        if [[ -z "$choice" ]]; then
            choice="1"
        fi

        case "$choice" in
            '1')
                if smart_environment_detection; then
                    echo ""
                    read -p "Press Enter to return to launcher..."
                else
                    echo ""
                    echo -e "${YELLOW}💡 Consider running setup first: ${CYAN}./setup-dev.sh${NC}"
                    read -p "Press Enter to continue..."
                fi
                ;;
            '2')
                echo -e "${CYAN}🐚 Launching manual nix-shell...${NC}"
                nix-shell
                ;;
            '3')
                echo -e "${GREEN}👋 Happy coding!${NC}"
                exit 0
                ;;
            *)
                if execute_quick_action "$choice"; then
                    echo ""
                    read -p "Press Enter to return to launcher..."
                fi
                ;;
        esac
    done
}

# Execute main function
main "$@"
