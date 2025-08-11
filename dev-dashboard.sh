#!/usr/bin/env bash

# GraphQL Hive CQRS Development Dashboard
# Intelligent development environment with rich UI and automation

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

# UI Components
draw_header() {
    clear
    echo -e "${CYAN}╭─────────────────────────────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${WHITE}${BOLD}              🚀 GraphQL Hive CQRS Dashboard                      ${NC}${CYAN}│${NC}"
    echo -e "${CYAN}│${DIM}                  Intelligent Development Environment                 ${NC}${CYAN}│${NC}"
    echo -e "${CYAN}╰─────────────────────────────────────────────────────────────────────╯${NC}"
    echo ""
}

draw_separator() {
    echo -e "${DIM}─────────────────────────────────────────────────────────────────────${NC}"
}

draw_status_bar() {
    local status_items=()

    # Runtime status
    if command -v bun >/dev/null 2>&1; then
        status_items+=("${GREEN}Bun $(bun --version)${NC}")
    else
        status_items+=("${RED}Bun Missing${NC}")
    fi

    # TypeScript status
    if bun run typecheck >/dev/null 2>&1; then
        status_items+=("${GREEN}TS ✓${NC}")
    else
        status_items+=("${YELLOW}TS !${NC}")
    fi

    # Git status
    if git status --porcelain 2>/dev/null | wc -l | grep -q "^0$"; then
        status_items+=("${GREEN}Git Clean${NC}")
    else
        local changes=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
        status_items+=("${YELLOW}Git ${changes}${NC}")
    fi

    # Dependencies status
    if [[ -f "package.json" ]] && bun install --dry-run >/dev/null 2>&1; then
        status_items+=("${GREEN}Deps ✓${NC}")
    else
        status_items+=("${YELLOW}Deps !${NC}")
    fi

    # Hive status
    if [[ -n "$HIVE_API_TOKEN" ]]; then
        status_items+=("${GREEN}Hive ✓${NC}")
    else
        status_items+=("${DIM}Hive -${NC}")
    fi

    echo -e "${BOLD}Status:${NC} $(IFS=' • '; echo "${status_items[*]}")"
    echo ""
}

show_project_info() {
    echo -e "${BOLD}${BLUE}📊 Project Overview${NC}"
    draw_separator

    # Code statistics
    if command -v tokei >/dev/null 2>&1; then
        echo -e "${GREEN}Code Statistics:${NC}"
        tokei --compact . | head -10
        echo ""
    fi

    # Directory structure
    if command -v exa >/dev/null 2>&1; then
        echo -e "${GREEN}Project Structure:${NC}"
        exa --tree --level=2 --icons src/ packages/ 2>/dev/null | head -15
    else
        echo -e "${GREEN}Project Structure:${NC}"
        tree -L 2 src/ packages/ 2>/dev/null | head -15 || ls -la
    fi
    echo ""
}

check_health() {
    echo -e "${BOLD}${GREEN}🏥 Health Check${NC}"
    draw_separator

    local health_score=0
    local max_score=5

    # Check 1: Dependencies
    echo -e "${BLUE}📦 Dependencies:${NC}"
    if [[ -f "package.json" ]] && bun install --dry-run >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Up to date${NC}"
        ((health_score++))
    else
        echo -e "  ${YELLOW}⚠️  Updates available${NC}"
    fi

    # Check 2: TypeScript
    echo -e "${BLUE}🔍 TypeScript:${NC}"
    if bun run typecheck >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ No errors${NC}"
        ((health_score++))
    else
        local error_count=$(bun run typecheck 2>&1 | grep -c "error TS" || echo "0")
        echo -e "  ${RED}❌ ${error_count} errors found${NC}"
    fi

    # Check 3: Tests
    echo -e "${BLUE}🧪 Tests:${NC}"
    if bun test --reporter=dot >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ All passing${NC}"
        ((health_score++))
    else
        echo -e "  ${YELLOW}⚠️  Some tests failing${NC}"
    fi

    # Check 4: Git
    echo -e "${BLUE}📝 Git:${NC}"
    if git status --porcelain 2>/dev/null | wc -l | grep -q "^0$"; then
        echo -e "  ${GREEN}✅ Working tree clean${NC}"
        ((health_score++))
    else
        local changes=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
        echo -e "  ${YELLOW}⚠️  ${changes} uncommitted changes${NC}"
    fi

    # Check 5: Environment
    echo -e "${BLUE}🌍 Environment:${NC}"
    if [[ -n "$HIVE_API_TOKEN" ]] && [[ "$NODE_ENV" == "development" ]]; then
        echo -e "  ${GREEN}✅ Fully configured${NC}"
        ((health_score++))
    else
        echo -e "  ${YELLOW}⚠️  Partial configuration${NC}"
    fi

    # Health score
    echo ""
    local percentage=$((health_score * 100 / max_score))
    if [[ $percentage -ge 80 ]]; then
        echo -e "${GREEN}🎉 Health Score: ${percentage}% (${health_score}/${max_score})${NC}"
    elif [[ $percentage -ge 60 ]]; then
        echo -e "${YELLOW}⚠️  Health Score: ${percentage}% (${health_score}/${max_score})${NC}"
    else
        echo -e "${RED}🚨 Health Score: ${percentage}% (${health_score}/${max_score})${NC}"
    fi
    echo ""
}

run_development_server() {
    echo -e "${BOLD}${GREEN}🚀 Starting Development Server${NC}"
    draw_separator
    echo -e "${BLUE}ℹ️  Server will be available at: http://localhost:${PORT:-3001}${NC}"
    echo -e "${DIM}Press Ctrl+C to stop...${NC}"
    echo ""

    # Pre-flight checks
    if ! bun run typecheck >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  TypeScript errors detected, but continuing...${NC}"
    fi

    bun run dev
}

run_tests() {
    echo -e "${BOLD}${GREEN}🧪 Test Suite${NC}"
    draw_separator

    echo -e "${YELLOW}1/3${NC} TypeScript compilation..."
    if bun run typecheck; then
        echo -e "${GREEN}✅ TypeScript check passed${NC}"

        echo -e "${YELLOW}2/3${NC} Unit tests..."
        if bun test; then
            echo -e "${GREEN}✅ Unit tests passed${NC}"

            echo -e "${YELLOW}3/3${NC} Framework tests..."
            if bun run test:framework; then
                echo -e "${GREEN}🎉 All tests passed!${NC}"
            else
                echo -e "${RED}❌ Framework tests failed${NC}"
                return 1
            fi
        else
            echo -e "${RED}❌ Unit tests failed${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ TypeScript check failed${NC}"
        return 1
    fi
}

generate_types() {
    echo -e "${BOLD}${GREEN}⚡ Code Generation${NC}"
    draw_separator

    echo -e "${BLUE}🔄 GraphQL resolver types...${NC}"
    if bun run codegen; then
        echo -e "${GREEN}✅ GraphQL codegen complete${NC}"
    else
        echo -e "${RED}❌ GraphQL codegen failed${NC}"
        return 1
    fi

    echo -e "${BLUE}🔄 gql.tada types...${NC}"
    if bun run gql:generate; then
        echo -e "${GREEN}✅ gql.tada generation complete${NC}"
    else
        echo -e "${RED}❌ gql.tada generation failed${NC}"
        return 1
    fi

    echo -e "${BLUE}🔍 Validating GraphQL operations...${NC}"
    if bun run gql:check; then
        echo -e "${GREEN}✅ GraphQL operations valid${NC}"
    else
        echo -e "${YELLOW}⚠️  GraphQL operation issues detected${NC}"
    fi
}

clean_project() {
    echo -e "${BOLD}${GREEN}🧹 Project Cleanup${NC}"
    draw_separator

    echo -e "${BLUE}🔍 Analyzing unused exports...${NC}"
    if bun run clean:unused; then
        echo -e "${GREEN}✅ Unused exports cleaned${NC}"
    fi

    echo -e "${BLUE}🗑️  Removing build artifacts...${NC}"
    rm -rf dist/ build/ .bun/ node_modules/.cache/ 2>/dev/null || true

    echo -e "${BLUE}📦 Pruning dependencies...${NC}"
    bun install --frozen-lockfile >/dev/null 2>&1

    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

benchmark_commands() {
    echo -e "${BOLD}${GREEN}🏃 Performance Benchmarks${NC}"
    draw_separator

    if ! command -v hyperfine >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  hyperfine not available, install for better benchmarks${NC}"
        echo ""
    fi

    local commands=(
        "bun run typecheck:TypeScript Check"
        "bun test:Unit Tests"
        "bun run codegen:GraphQL Codegen"
    )

    for cmd_desc in "${commands[@]}"; do
        IFS=':' read -r cmd desc <<< "$cmd_desc"
        echo -e "${BLUE}📊 Benchmarking: ${desc}${NC}"

        if command -v hyperfine >/dev/null 2>&1; then
            hyperfine --warmup 1 --min-runs 3 "$cmd" 2>/dev/null || {
                echo -e "${YELLOW}  Benchmark failed, running once...${NC}"
                time eval "$cmd" >/dev/null 2>&1
            }
        else
            time eval "$cmd" >/dev/null 2>&1
        fi
        echo ""
    done
}

interactive_search() {
    echo -e "${BOLD}${GREEN}🔍 Interactive Search${NC}"
    draw_separator

    if ! command -v fzf >/dev/null 2>&1; then
        echo -e "${RED}❌ fzf not available${NC}"
        return 1
    fi

    echo -e "${BLUE}Choose search type:${NC}"
    echo -e "  1) Files"
    echo -e "  2) Code content"
    echo -e "  3) Git commits"
    echo -e "  4) Dependencies"
    echo ""
    read -p "Enter choice (1-4): " choice

    case $choice in
        1)
            echo -e "${BLUE}📁 Searching files...${NC}"
            fd --type f --hidden --follow --exclude .git --exclude node_modules | \
                fzf --preview 'bat --color=always --style=header,grid --line-range :300 {}'
            ;;
        2)
            echo -e "${BLUE}🔍 Searching code content...${NC}"
            rg --type typescript --type javascript --type json --color=always --line-number . | \
                fzf --ansi --delimiter : --preview 'bat --color=always --highlight-line {2} {1}'
            ;;
        3)
            echo -e "${BLUE}📝 Searching git commits...${NC}"
            git log --oneline --color=always | \
                fzf --ansi --preview 'git show --color=always {1}'
            ;;
        4)
            echo -e "${BLUE}📦 Searching dependencies...${NC}"
            jq -r '.dependencies // {}, .devDependencies // {} | to_entries[] | "\(.key): \(.value)"' package.json | \
                fzf --preview 'npm info {1}'
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            ;;
    esac
}

git_workflow() {
    echo -e "${BOLD}${GREEN}🌿 Git Workflow${NC}"
    draw_separator

    echo -e "${BLUE}Current branch: ${YELLOW}$(git branch --show-current)${NC}"
    echo -e "${BLUE}Status:${NC}"
    git status --short --branch
    echo ""

    echo -e "${BLUE}Choose action:${NC}"
    echo -e "  1) Create feature branch"
    echo -e "  2) Quick commit"
    echo -e "  3) View recent commits"
    echo -e "  4) Interactive rebase"
    echo -e "  5) Push current branch"
    echo ""
    read -p "Enter choice (1-5): " choice

    case $choice in
        1)
            read -p "Feature name: " feature_name
            if [[ -n "$feature_name" ]]; then
                git checkout -b "feature/$feature_name"
                echo -e "${GREEN}✅ Created and switched to feature/$feature_name${NC}"
            fi
            ;;
        2)
            read -p "Commit message: " commit_msg
            if [[ -n "$commit_msg" ]]; then
                git add -A
                git commit -m "$commit_msg"
                echo -e "${GREEN}✅ Changes committed${NC}"
            fi
            ;;
        3)
            git log --oneline --graph --decorate -10
            ;;
        4)
            read -p "Number of commits to rebase: " num_commits
            if [[ "$num_commits" =~ ^[0-9]+$ ]]; then
                git rebase -i HEAD~"$num_commits"
            fi
            ;;
        5)
            git push -u origin "$(git branch --show-current)"
            echo -e "${GREEN}✅ Branch pushed to origin${NC}"
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            ;;
    esac
}

show_environment_info() {
    echo -e "${BOLD}${GREEN}🌍 Environment Information${NC}"
    draw_separator

    echo -e "${BLUE}System:${NC}"
    echo -e "  Platform: $(uname -s) $(uname -m)"
    echo -e "  Shell: $SHELL"
    echo -e "  PWD: $PWD"
    echo ""

    echo -e "${BLUE}Runtime Versions:${NC}"
    echo -e "  Node.js: $(node --version 2>/dev/null || echo 'Not available')"
    echo -e "  Bun: $(bun --version 2>/dev/null || echo 'Not available')"
    echo -e "  TypeScript: $(tsc --version 2>/dev/null || echo 'Not available')"
    echo -e "  Git: $(git --version 2>/dev/null || echo 'Not available')"
    echo ""

    echo -e "${BLUE}Environment Variables:${NC}"
    echo -e "  NODE_ENV: ${NODE_ENV:-'Not set'}"
    echo -e "  PORT: ${PORT:-'Not set'}"
    echo -e "  BUN_ENV: ${BUN_ENV:-'Not set'}"
    echo -e "  HIVE_API_TOKEN: $(if [[ -n "$HIVE_API_TOKEN" ]]; then echo '✅ Set'; else echo '❌ Not set'; fi)"
    echo ""

    echo -e "${BLUE}Package Information:${NC}"
    if [[ -f "package.json" ]]; then
        echo -e "  Name: $(jq -r '.name // "Unknown"' package.json)"
        echo -e "  Version: $(jq -r '.version // "Unknown"' package.json)"
        echo -e "  Dependencies: $(jq -r '.dependencies // {} | length' package.json)"
        echo -e "  Dev Dependencies: $(jq -r '.devDependencies // {} | length' package.json)"
    else
        echo -e "  ${YELLOW}No package.json found${NC}"
    fi
}

show_menu() {
    draw_header
    draw_status_bar

    echo -e "${BOLD}${BLUE}📋 Available Actions${NC}"
    draw_separator
    echo -e "  ${GREEN}1)${NC} 🚀 Start Development Server"
    echo -e "  ${GREEN}2)${NC} 🧪 Run Test Suite"
    echo -e "  ${GREEN}3)${NC} ⚡ Generate Types & Schema"
    echo -e "  ${GREEN}4)${NC} 🧹 Clean Project"
    echo -e "  ${GREEN}5)${NC} 🏥 Health Check"
    echo -e "  ${GREEN}6)${NC} 📊 Project Overview"
    echo -e "  ${GREEN}7)${NC} 🏃 Performance Benchmarks"
    echo -e "  ${GREEN}8)${NC} 🔍 Interactive Search"
    echo -e "  ${GREEN}9)${NC} 🌿 Git Workflow"
    echo -e "  ${GREEN}10)${NC} 🌍 Environment Info"
    echo -e "  ${GREEN}11)${NC} ❓ Help & Documentation"
    echo -e "  ${GREEN}0)${NC} 🚪 Exit Dashboard"
    echo ""
    draw_separator
}

show_help() {
    echo -e "${BOLD}${GREEN}❓ Help & Documentation${NC}"
    draw_separator

    echo -e "${BLUE}Quick Commands (available in shell):${NC}"
    echo -e "  ${CYAN}dev${NC}           - Start development server"
    echo -e "  ${CYAN}test-all${NC}      - Run complete test suite"
    echo -e "  ${CYAN}generate${NC}      - Generate GraphQL types"
    echo -e "  ${CYAN}clean${NC}         - Clean project artifacts"
    echo -e "  ${CYAN}health${NC}        - Check project health"
    echo -e "  ${CYAN}stats${NC}         - Show project statistics"
    echo ""

    echo -e "${BLUE}Enhanced Tools:${NC}"
    echo -e "  ${CYAN}bench <cmd>${NC}   - Benchmark any command"
    echo -e "  ${CYAN}search <term>${NC} - Search in codebase"
    echo -e "  ${CYAN}feature <name>${NC} - Create feature branch"
    echo -e "  ${CYAN}commit <msg>${NC}  - Quick commit with message"
    echo ""

    echo -e "${BLUE}File Operations:${NC}"
    echo -e "  ${CYAN}ll, ls${NC}        - Enhanced file listing (exa)"
    echo -e "  ${CYAN}cat${NC}           - Syntax highlighted cat (bat)"
    echo -e "  ${CYAN}find${NC}          - Better find (fd)"
    echo -e "  ${CYAN}grep${NC}          - Better grep (ripgrep)"
    echo ""

    echo -e "${BLUE}Project Scripts:${NC}"
    echo -e "  ${CYAN}./setup-dev.sh${NC} - Initial environment setup"
    echo -e "  ${CYAN}./dev-zsh.sh${NC}   - Enhanced zsh environment"
    echo -e "  ${CYAN}./dev-dashboard.sh${NC} - This dashboard"
    echo ""

    echo -e "${BLUE}Documentation:${NC}"
    echo -e "  ${CYAN}DEV_SETUP.md${NC}  - Complete setup guide"
    echo -e "  ${CYAN}CLAUDE.md${NC}     - Project architecture guide"
    echo ""
}

main() {
    # Check if we're in the right directory
    if [[ ! -f "shell.nix" ]]; then
        echo -e "${RED}❌ Error: Not in project root directory${NC}"
        echo -e "${YELLOW}Please run from: graphql-hive-cqrs-event-sourcing-microservices/${NC}"
        exit 1
    fi

    # Main loop
    while true; do
        show_menu
        read -p "Enter your choice (0-11): " choice
        echo ""

        case $choice in
            1) run_development_server ;;
            2) run_tests ;;
            3) generate_types ;;
            4) clean_project ;;
            5) check_health ;;
            6) show_project_info ;;
            7) benchmark_commands ;;
            8) interactive_search ;;
            9) git_workflow ;;
            10) show_environment_info ;;
            11) show_help ;;
            0)
                echo -e "${GREEN}👋 Happy coding!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}❌ Invalid choice. Please try again.${NC}"
                ;;
        esac

        echo ""
        read -p "Press Enter to continue..."
    done
}

# Run the dashboard
main "$@"
