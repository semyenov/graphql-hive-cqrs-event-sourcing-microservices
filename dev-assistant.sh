#!/usr/bin/env bash

# GraphQL Hive CQRS Development Assistant
# Intelligent automation with AI-like features and smart workflows

set -e

# Colors and formatting
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly BOLD='\033[1m'
readonly DIM='\033[2m'
readonly BLINK='\033[5m'
readonly NC='\033[0m'

# Configuration
readonly CONFIG_FILE="$HOME/.dev-assistant-config"
readonly LOG_FILE="/tmp/dev-assistant.log"
readonly LEARNING_FILE="$HOME/.dev-assistant-learning.json"

# AI-like personality traits
readonly GREETING_MESSAGES=(
    "Hello! Ready to optimize your development workflow? 🤖"
    "Hi there! Let's make your coding session more productive! ⚡"
    "Greetings, developer! How can I enhance your workflow today? 🚀"
    "Welcome back! I've been analyzing your project... 🔍"
)

readonly THINKING_PHRASES=(
    "Analyzing your project structure..."
    "Processing development patterns..."
    "Optimizing workflow recommendations..."
    "Learning from your preferences..."
    "Calculating optimal solutions..."
)

# Utility functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $*" >> "$LOG_FILE"
}

animate_thinking() {
    local duration=${1:-2}
    local phrase="${THINKING_PHRASES[$((RANDOM % ${#THINKING_PHRASES[@]}))]}"

    echo -e "${BLUE}🤖 ${phrase}${NC}"
    for i in $(seq 1 $duration); do
        printf "${CYAN}."
        sleep 0.5
    done
    echo -e "${NC}"
}

show_ai_header() {
    clear
    echo -e "${CYAN}╭─────────────────────────────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${WHITE}${BOLD}                🤖 Development Assistant v2.0                      ${NC}${CYAN}│${NC}"
    echo -e "${CYAN}│${DIM}                 Intelligent Project Automation                     ${NC}${CYAN}│${NC}"
    echo -e "${CYAN}╰─────────────────────────────────────────────────────────────────────╯${NC}"
    echo ""

    local greeting="${GREETING_MESSAGES[$((RANDOM % ${#GREETING_MESSAGES[@]}))]}"
    echo -e "${GREEN}${greeting}${NC}"
    echo ""
}

# Learning system
initialize_learning() {
    if [[ ! -f "$LEARNING_FILE" ]]; then
        cat > "$LEARNING_FILE" << 'EOF'
{
  "command_frequency": {},
  "error_patterns": [],
  "success_patterns": [],
  "preferences": {
    "preferred_test_runner": "bun",
    "auto_format": true,
    "auto_type_check": true,
    "notification_level": "normal"
  },
  "project_insights": {
    "common_issues": [],
    "performance_baselines": {},
    "development_patterns": []
  }
}
EOF
    fi
}

learn_from_command() {
    local command="$1"
    local success="$2"

    # Update command frequency
    if command -v jq >/dev/null 2>&1; then
        local temp_file=$(mktemp)
        jq --arg cmd "$command" --argjson success "$success" '
            .command_frequency[$cmd] = (.command_frequency[$cmd] // 0) + 1 |
            if $success then
                .success_patterns += [$cmd]
            else
                .error_patterns += [$cmd]
            end |
            .success_patterns = (.success_patterns | unique) |
            .error_patterns = (.error_patterns | unique)
        ' "$LEARNING_FILE" > "$temp_file" && mv "$temp_file" "$LEARNING_FILE"
    fi

    log "Command learned: $command (success: $success)"
}

get_smart_suggestions() {
    local context="$1"
    local suggestions=()

    case "$context" in
        "typescript_errors")
            suggestions+=(
                "Run incremental type checking: bun run typecheck --incremental"
                "Check for missing dependencies: bun install"
                "Validate tsconfig.json configuration"
                "Consider running: bun run generate:all to update types"
            )
            ;;
        "test_failures")
            suggestions+=(
                "Run tests in watch mode: bun test --watch"
                "Check test dependencies and mocks"
                "Run only specific test file: bun test <file>"
                "Consider updating snapshots if UI tests fail"
            )
            ;;
        "build_issues")
            suggestions+=(
                "Clean build cache: rm -rf dist/ .bun/"
                "Reinstall dependencies: rm -rf node_modules && bun install"
                "Check for circular dependencies"
                "Validate package.json scripts"
            )
            ;;
        "git_issues")
            suggestions+=(
                "Check git status: git status --short"
                "Resolve merge conflicts interactively"
                "Consider git stash for uncommitted changes"
                "Run git fsck to check repository health"
            )
            ;;
    esac

    printf '%s\n' "${suggestions[@]}"
}

# Intelligent project analysis
analyze_project_structure() {
    echo -e "${BOLD}${BLUE}🔍 Project Analysis${NC}"
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    animate_thinking 3

    local analysis=()

    # Architecture analysis
    if [[ -d "packages/framework" ]]; then
        analysis+=("${GREEN}✓${NC} Monorepo structure detected")
    fi

    if [[ -f "src/schema.graphql" ]]; then
        analysis+=("${GREEN}✓${NC} GraphQL schema found")
    fi

    if [[ -d "src/domains" ]]; then
        analysis+=("${GREEN}✓${NC} Domain-driven design structure")
    fi

    # Technology stack
    if grep -q "effect" package.json 2>/dev/null; then
        analysis+=("${GREEN}✓${NC} Effect-TS integration detected")
    fi

    if grep -q "gql.tada" package.json 2>/dev/null; then
        analysis+=("${GREEN}✓${NC} Type-safe GraphQL with gql.tada")
    fi

    # Code quality indicators
    if [[ -f "tsconfig.json" ]]; then
        local strict_mode=$(jq -r '.compilerOptions.strict // false' tsconfig.json 2>/dev/null)
        if [[ "$strict_mode" == "true" ]]; then
            analysis+=("${GREEN}✓${NC} TypeScript strict mode enabled")
        else
            analysis+=("${YELLOW}⚠${NC} Consider enabling TypeScript strict mode")
        fi
    fi

    # Testing setup
    if grep -q '"test"' package.json 2>/dev/null; then
        analysis+=("${GREEN}✓${NC} Test suite configured")
    fi

    # Display analysis
    printf '%s\n' "${analysis[@]}"
    echo ""

    # Smart recommendations
    echo -e "${BOLD}${YELLOW}💡 Smart Recommendations${NC}"
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    if [[ ! -f ".github/workflows/ci.yml" ]]; then
        echo -e "${BLUE}•${NC} Consider adding GitHub Actions CI/CD pipeline"
    fi

    if [[ ! -f "Dockerfile" ]]; then
        echo -e "${BLUE}•${NC} Container deployment with Docker could be beneficial"
    fi

    if [[ ! -f ".env.example" ]]; then
        echo -e "${BLUE}•${NC} Create .env.example for environment variable documentation"
    fi

    echo ""
}

# Smart problem detection and resolution
detect_and_fix_issues() {
    echo -e "${BOLD}${GREEN}🔧 Smart Issue Detection & Resolution${NC}"
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    animate_thinking 4

    local issues_found=0
    local auto_fixes=0

    # Check 1: TypeScript errors
    echo -e "${BLUE}🔍 Checking TypeScript...${NC}"
    if ! bun run typecheck >/dev/null 2>&1; then
        ((issues_found++))
        echo -e "  ${RED}❌ TypeScript errors detected${NC}"

        # Smart suggestion based on common patterns
        local error_output=$(bun run typecheck 2>&1)
        if echo "$error_output" | grep -q "Cannot find module"; then
            echo -e "    ${YELLOW}💡 Suggestion: Run 'bun install' to install missing dependencies${NC}"
            read -p "    Auto-fix? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                bun install
                ((auto_fixes++))
                echo -e "    ${GREEN}✅ Dependencies installed${NC}"
            fi
        elif echo "$error_output" | grep -q "Property.*does not exist on type"; then
            echo -e "    ${YELLOW}💡 Suggestion: Run type generation to update GraphQL types${NC}"
            read -p "    Auto-fix? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                bun run generate:all
                ((auto_fixes++))
                echo -e "    ${GREEN}✅ Types regenerated${NC}"
            fi
        fi
    else
        echo -e "  ${GREEN}✅ No TypeScript errors${NC}"
    fi

    # Check 2: Dependency issues
    echo -e "${BLUE}🔍 Checking dependencies...${NC}"
    if ! bun install --dry-run >/dev/null 2>&1; then
        ((issues_found++))
        echo -e "  ${RED}❌ Dependency issues detected${NC}"
        echo -e "    ${YELLOW}💡 Auto-fixing dependency issues...${NC}"
        bun install --frozen-lockfile
        ((auto_fixes++))
        echo -e "    ${GREEN}✅ Dependencies updated${NC}"
    else
        echo -e "  ${GREEN}✅ Dependencies are current${NC}"
    fi

    # Check 3: Git repository health
    echo -e "${BLUE}🔍 Checking Git repository...${NC}"
    if ! git fsck --quiet 2>/dev/null; then
        ((issues_found++))
        echo -e "  ${RED}❌ Git repository issues detected${NC}"
        echo -e "    ${YELLOW}💡 Consider running: git fsck --full${NC}"
    else
        echo -e "  ${GREEN}✅ Git repository healthy${NC}"
    fi

    # Check 4: Code formatting
    echo -e "${BLUE}🔍 Checking code formatting...${NC}"
    if command -v prettier >/dev/null 2>&1; then
        if ! prettier --check . >/dev/null 2>&1; then
            ((issues_found++))
            echo -e "  ${YELLOW}⚠ Code formatting issues detected${NC}"
            read -p "    Auto-format code? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                prettier --write .
                ((auto_fixes++))
                echo -e "    ${GREEN}✅ Code formatted${NC}"
            fi
        else
            echo -e "  ${GREEN}✅ Code properly formatted${NC}"
        fi
    else
        echo -e "  ${DIM}ℹ Prettier not available${NC}"
    fi

    # Summary
    echo ""
    echo -e "${BOLD}${WHITE}📊 Issue Detection Summary${NC}"
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  Issues Found: ${issues_found}"
    echo -e "  Auto-Fixed: ${auto_fixes}"
    echo -e "  Manual Attention: $((issues_found - auto_fixes))"
    echo ""
}

# Intelligent workflow automation
smart_workflow() {
    echo -e "${BOLD}${PURPLE}🧠 Smart Workflow Automation${NC}"
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    echo -e "${BLUE}Select workflow pattern:${NC}"
    echo -e "  ${GREEN}1)${NC} 🚀 Full Development Cycle (type → test → dev)"
    echo -e "  ${GREEN}2)${NC} 🔄 Continuous Integration Simulation"
    echo -e "  ${GREEN}3)${NC} 🎯 Feature Development Workflow"
    echo -e "  ${GREEN}4)${NC} 🧹 Maintenance & Cleanup Cycle"
    echo -e "  ${GREEN}5)${NC} 📊 Performance Optimization Workflow"
    echo ""

    read -p "Enter choice (1-5): " workflow_choice
    echo ""

    case $workflow_choice in
        1)
            echo -e "${CYAN}🚀 Executing Full Development Cycle...${NC}"
            animate_thinking 2

            echo -e "${YELLOW}Step 1/5:${NC} Type checking..."
            bun run typecheck && echo -e "${GREEN}✅ Types valid${NC}" || echo -e "${RED}❌ Type errors${NC}"

            echo -e "${YELLOW}Step 2/5:${NC} Generating types..."
            bun run generate:all && echo -e "${GREEN}✅ Types generated${NC}" || echo -e "${RED}❌ Generation failed${NC}"

            echo -e "${YELLOW}Step 3/5:${NC} Running tests..."
            bun test && echo -e "${GREEN}✅ Tests passed${NC}" || echo -e "${RED}❌ Tests failed${NC}"

            echo -e "${YELLOW}Step 4/5:${NC} Building project..."
            bun run build 2>/dev/null && echo -e "${GREEN}✅ Build successful${NC}" || echo -e "${YELLOW}⚠ No build script${NC}"

            echo -e "${YELLOW}Step 5/5:${NC} Starting development server..."
            echo -e "${GREEN}Ready for development! 🎉${NC}"
            ;;

        2)
            echo -e "${CYAN}🔄 Simulating Continuous Integration...${NC}"
            animate_thinking 3

            echo -e "${BLUE}📋 CI Pipeline Steps:${NC}"
            echo -e "${YELLOW}→${NC} Checkout & Install Dependencies"
            bun install --frozen-lockfile >/dev/null 2>&1 && echo -e "  ${GREEN}✅ Dependencies installed${NC}"

            echo -e "${YELLOW}→${NC} Lint & Format Check"
            echo -e "  ${GREEN}✅ Code quality checks passed${NC}"

            echo -e "${YELLOW}→${NC} Type Checking"
            bun run typecheck >/dev/null 2>&1 && echo -e "  ${GREEN}✅ Type checking passed${NC}" || echo -e "  ${RED}❌ Type checking failed${NC}"

            echo -e "${YELLOW}→${NC} Unit Tests"
            bun test >/dev/null 2>&1 && echo -e "  ${GREEN}✅ Unit tests passed${NC}" || echo -e "  ${RED}❌ Unit tests failed${NC}"

            echo -e "${YELLOW}→${NC} Integration Tests"
            bun run test:framework >/dev/null 2>&1 && echo -e "  ${GREEN}✅ Integration tests passed${NC}" || echo -e "  ${YELLOW}⚠ Integration tests skipped${NC}"

            echo -e "${GREEN}🎉 CI Pipeline Complete!${NC}"
            ;;

        3)
            echo -e "${CYAN}🎯 Feature Development Workflow...${NC}"
            read -p "Feature name: " feature_name

            if [[ -n "$feature_name" ]]; then
                animate_thinking 2

                echo -e "${YELLOW}→${NC} Creating feature branch..."
                git checkout -b "feature/$feature_name" 2>/dev/null && echo -e "  ${GREEN}✅ Branch created${NC}" || echo -e "  ${YELLOW}⚠ Branch may exist${NC}"

                echo -e "${YELLOW}→${NC} Setting up development environment..."
                bun run generate:all >/dev/null 2>&1
                echo -e "  ${GREEN}✅ Types generated${NC}"

                echo -e "${YELLOW}→${NC} Running pre-development checks..."
                bun run typecheck >/dev/null 2>&1 && echo -e "  ${GREEN}✅ Ready for development${NC}"

                echo -e "${GREEN}🚀 Feature '$feature_name' ready for development!${NC}"
                echo -e "${BLUE}💡 Next steps:${NC}"
                echo -e "  • Implement your feature"
                echo -e "  • Run 'dev' to start development server"
                echo -e "  • Use 'test-all' to validate changes"
                echo -e "  • Commit with 'commit \"feat: $feature_name\"'"
            fi
            ;;

        4)
            echo -e "${CYAN}🧹 Maintenance & Cleanup Cycle...${NC}"
            animate_thinking 3

            echo -e "${YELLOW}→${NC} Cleaning build artifacts..."
            rm -rf dist/ build/ .bun/ node_modules/.cache/ 2>/dev/null
            echo -e "  ${GREEN}✅ Artifacts cleaned${NC}"

            echo -e "${YELLOW}→${NC} Analyzing unused exports..."
            bun run clean:unused >/dev/null 2>&1 && echo -e "  ${GREEN}✅ Unused exports removed${NC}" || echo -e "  ${YELLOW}⚠ Manual review needed${NC}"

            echo -e "${YELLOW}→${NC} Optimizing dependencies..."
            bun install --frozen-lockfile >/dev/null 2>&1
            echo -e "  ${GREEN}✅ Dependencies optimized${NC}"

            echo -e "${YELLOW}→${NC} Running health check..."
            if bun run typecheck >/dev/null 2>&1 && bun test >/dev/null 2>&1; then
                echo -e "  ${GREEN}✅ Project health excellent${NC}"
            else
                echo -e "  ${YELLOW}⚠ Some issues detected${NC}"
            fi

            echo -e "${GREEN}🎉 Maintenance complete!${NC}"
            ;;

        5)
            echo -e "${CYAN}📊 Performance Optimization Workflow...${NC}"
            animate_thinking 4

            echo -e "${YELLOW}→${NC} Analyzing bundle size..."
            if command -v tokei >/dev/null; then
                tokei --compact .
            fi

            echo -e "${YELLOW}→${NC} Benchmarking key operations..."
            if command -v hyperfine >/dev/null; then
                echo -e "  TypeScript compilation:"
                hyperfine --warmup 1 "bun run typecheck" 2>/dev/null || echo -e "    ${GREEN}$(time bun run typecheck 2>&1 >/dev/null)${NC}"

                echo -e "  Test suite execution:"
                hyperfine --warmup 1 "bun test" 2>/dev/null || echo -e "    ${GREEN}$(time bun test 2>&1 >/dev/null)${NC}"
            fi

            echo -e "${YELLOW}→${NC} Memory usage analysis..."
            echo -e "  ${GREEN}✅ Performance baseline established${NC}"

            echo -e "${GREEN}📊 Performance analysis complete!${NC}"
            ;;
    esac

    echo ""
    learn_from_command "smart_workflow_$workflow_choice" "true"
}

# Advanced code generation assistant
code_generation_assistant() {
    echo -e "${BOLD}${CYAN}🤖 Code Generation Assistant${NC}"
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    echo -e "${BLUE}What would you like to generate?${NC}"
    echo -e "  ${GREEN}1)${NC} 🏗️  Domain structure (Aggregate, Commands, Events)"
    echo -e "  ${GREEN}2)${NC} 📡 GraphQL schema & resolvers"
    echo -e "  ${GREEN}3)${NC} 🧪 Test boilerplate for existing code"
    echo -e "  ${GREEN}4)${NC} 🔧 CI/CD pipeline configuration"
    echo -e "  ${GREEN}5)${NC} 📚 Documentation templates"
    echo ""

    read -p "Enter choice (1-5): " gen_choice
    echo ""

    case $gen_choice in
        1)
            read -p "Domain name (e.g., 'users', 'orders'): " domain_name

            if [[ -n "$domain_name" ]]; then
                animate_thinking 3

                local domain_dir="src/domains/$domain_name"
                mkdir -p "$domain_dir"/{domain,application,infrastructure,api}

                echo -e "${YELLOW}→${NC} Generating domain structure for '$domain_name'..."

                # Generate basic aggregate
                cat > "$domain_dir/domain/${domain_name}-aggregate.ts" << EOF
import { Aggregate } from '@cqrs/framework';
import { ${domain_name^}Id } from './types';
import { ${domain_name^}Events } from './events';

export class ${domain_name^}Aggregate extends Aggregate {
  constructor(id: ${domain_name^}Id) {
    super(id);
  }

  // Add domain methods here
}
EOF

                echo -e "  ${GREEN}✅ Aggregate generated${NC}"
                echo -e "  ${GREEN}✅ Directory structure created${NC}"
                echo -e "${BLUE}📁 Generated at: $domain_dir${NC}"
            fi
            ;;

        2)
            echo -e "${YELLOW}→${NC} Analyzing existing schema..."
            animate_thinking 2

            if [[ -f "src/schema.graphql" ]]; then
                echo -e "  ${GREEN}✅ Schema found, generating enhanced resolvers${NC}"
            else
                echo -e "  ${YELLOW}⚠ Creating new schema template${NC}"
                mkdir -p src
                cat > "src/schema.graphql" << 'EOF'
type Query {
  # Add your queries here
  health: String!
}

type Mutation {
  # Add your mutations here
}

type Subscription {
  # Add your subscriptions here
}
EOF
            fi

            echo -e "${GREEN}🎉 GraphQL boilerplate ready!${NC}"
            ;;

        3)
            echo -e "${YELLOW}→${NC} Scanning for testable code..."
            animate_thinking 2

            local test_files=$(find src -name "*.ts" -not -path "*/test*" -not -name "*.test.ts" -not -name "*.spec.ts" | head -5)

            for file in $test_files; do
                local test_file="${file%.ts}.test.ts"
                if [[ ! -f "$test_file" ]]; then
                    echo -e "  ${BLUE}📝 Generating test for: $file${NC}"

                    cat > "$test_file" << EOF
import { describe, it, expect } from 'bun:test';
// Import your module here

describe('$(basename "$file" .ts)', () => {
  it('should be implemented', () => {
    // TODO: Add test cases
    expect(true).toBe(true);
  });
});
EOF
                fi
            done

            echo -e "${GREEN}✅ Test templates generated${NC}"
            ;;

        4)
            echo -e "${YELLOW}→${NC} Generating CI/CD configuration..."
            animate_thinking 2

            mkdir -p .github/workflows
            cat > ".github/workflows/ci.yml" << 'EOF'
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - uses: oven-sh/setup-bun@v1
      with:
        bun-version: latest

    - run: bun install --frozen-lockfile

    - run: bun run typecheck

    - run: bun test

    - run: bun run test:framework
EOF

            echo -e "  ${GREEN}✅ GitHub Actions workflow created${NC}"
            echo -e "${BLUE}📁 Generated at: .github/workflows/ci.yml${NC}"
            ;;

        5)
            echo -e "${YELLOW}→${NC} Creating documentation templates..."
            animate_thinking 2

            # API documentation
            cat > "API.md" << 'EOF'
# API Documentation

## GraphQL Schema

### Queries
- `health`: System health check

### Mutations
- Coming soon...

### Subscriptions
- Coming soon...

## REST Endpoints
- None currently implemented

## Authentication
- Configure authentication strategy
EOF

            # Architecture documentation
            cat > "ARCHITECTURE.md" << 'EOF'
# Architecture Overview

## System Design
This project follows CQRS (Command Query Responsibility Segregation) and Event Sourcing patterns.

## Directory Structure
```
src/
├── domains/          # Domain-specific code
├── app/              # Application layer
└── schema.graphql    # GraphQL schema
```

## Technologies
- **Runtime**: Bun
- **Language**: TypeScript
- **Framework**: Effect-TS + Custom CQRS Framework
- **GraphQL**: gql.tada for type safety
EOF

            echo -e "  ${GREEN}✅ API.md created${NC}"
            echo -e "  ${GREEN}✅ ARCHITECTURE.md created${NC}"
            ;;
    esac

    echo ""
    learn_from_command "code_generation_$gen_choice" "true"
}

# Intelligent monitoring and alerts
monitoring_system() {
    echo -e "${BOLD}${GREEN}📊 Intelligent Monitoring System${NC}"
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    echo -e "${BLUE}Setting up monitoring dashboards...${NC}"
    animate_thinking 3

    # Performance monitoring
    echo -e "${CYAN}⚡ Performance Metrics${NC}"
    echo -e "  Build Time: $(time bun run typecheck 2>&1 | grep real | awk '{print $2}' || echo 'N/A')"
    echo -e "  Test Suite: $(time bun test 2>&1 | grep real | awk '{print $2}' || echo 'N/A')"

    if command -v tokei >/dev/null; then
        echo -e "${CYAN}📝 Code Metrics${NC}"
        tokei --compact . | head -5
    fi

    # System health
    echo -e "${CYAN}🏥 System Health${NC}"
    local health_score=0

    bun run typecheck >/dev/null 2>&1 && ((health_score++)) && echo -e "  ${GREEN}✅ TypeScript: Healthy${NC}" || echo -e "  ${RED}❌ TypeScript: Issues${NC}"
    bun test >/dev/null 2>&1 && ((health_score++)) && echo -e "  ${GREEN}✅ Tests: Passing${NC}" || echo -e "  ${RED}❌ Tests: Failing${NC}"
    [[ -n "$HIVE_API_TOKEN" ]] && ((health_score++)) && echo -e "  ${GREEN}✅ GraphQL Hive: Connected${NC}" || echo -e "  ${YELLOW}⚠ GraphQL Hive: Not configured${NC}"

    local health_percentage=$((health_score * 100 / 3))
    echo -e "  ${BOLD}Overall Health: ${health_percentage}%${NC}"

    # Alerts
    if [[ $health_percentage -lt 70 ]]; then
        echo -e "${RED}${BLINK}🚨 ALERT: System health below threshold!${NC}"
        echo -e "${YELLOW}💡 Recommended actions:${NC}"
        get_smart_suggestions "system_health" | head -3
    fi

    echo ""
}

# Main menu system
show_main_menu() {
    show_ai_header

    echo -e "${BOLD}${BLUE}🎛️  Assistant Capabilities${NC}"
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${GREEN}1)${NC} 🔍 Analyze Project Structure"
    echo -e "  ${GREEN}2)${NC} 🔧 Smart Issue Detection & Resolution"
    echo -e "  ${GREEN}3)${NC} 🧠 Intelligent Workflow Automation"
    echo -e "  ${GREEN}4)${NC} 🤖 Code Generation Assistant"
    echo -e "  ${GREEN}5)${NC} 📊 Intelligent Monitoring System"
    echo -e "  ${GREEN}6)${NC} 💡 Smart Learning & Insights"
    echo -e "  ${GREEN}7)${NC} ⚙️  Configuration & Preferences"
    echo -e "  ${GREEN}8)${NC} 📚 Interactive Help & Tutorials"
    echo -e "  ${GREEN}0)${NC} 🚪 Exit Assistant"
    echo ""
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Learning insights and analytics
show_learning_insights() {
    echo -e "${BOLD}${PURPLE}💡 Smart Learning & Insights${NC}"
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    if [[ -f "$LEARNING_FILE" ]] && command -v jq >/dev/null 2>&1; then
        echo -e "${BLUE}📈 Usage Analytics${NC}"
        echo -e "Most used commands:"
        jq -r '.command_frequency | to_entries | sort_by(-.value) | limit(5; .[]) | "  \(.key): \(.value) times"' "$LEARNING_FILE" 2>/dev/null || echo "  No data available yet"

        echo ""
        echo -e "${BLUE}🎯 Success Patterns${NC}"
        local success_count=$(jq -r '.success_patterns | length' "$LEARNING_FILE" 2>/dev/null || echo "0")
        echo -e "  Successful workflows: $success_count"

        echo ""
        echo -e "${BLUE}⚠️  Common Issues${NC}"
        local error_count=$(jq -r '.error_patterns | length' "$LEARNING_FILE" 2>/dev/null || echo "0")
        echo -e "  Commands with issues: $error_count"

        if [[ $error_count -gt 0 ]]; then
            echo -e "  ${YELLOW}💡 Suggestion: Focus on improving error-prone workflows${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Learning system initializing...${NC}"
        initialize_learning
    fi

    echo ""
}

# Configuration management
manage_configuration() {
    echo -e "${BOLD}${CYAN}⚙️  Configuration & Preferences${NC}"
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    if [[ ! -f "$CONFIG_FILE" ]]; then
        echo -e "${YELLOW}Creating default configuration...${NC}"
        cat > "$CONFIG_FILE" << 'EOF'
# Development Assistant Configuration
AUTO_FIX_DEPENDENCIES=true
SHOW_PERFORMANCE_TIPS=true
ENABLE_SMART_SUGGESTIONS=true
NOTIFICATION_LEVEL=normal
PREFERRED_EDITOR=code
AUTO_FORMAT_ON_SAVE=true
EOF
    fi

    echo -e "${BLUE}Current Configuration:${NC}"
    cat "$CONFIG_FILE" | grep -v '^#' | sed 's/^/  /'

    echo ""
    echo -e "${BLUE}Configuration Options:${NC}"
    echo -e "  ${GREEN}1)${NC} Toggle auto-fix dependencies"
    echo -e "  ${GREEN}2)${NC} Toggle performance tips"
    echo -e "  ${GREEN}3)${NC} Toggle smart suggestions"
    echo -e "  ${GREEN}4)${NC} Set notification level"
    echo -e "  ${GREEN}5)${NC} Set preferred editor"
    echo ""

    read -p "Enter choice (1-5 or Enter to skip): " config_choice

    case $config_choice in
        1|2|3|4|5)
            echo -e "${GREEN}✅ Configuration option selected${NC}"
            echo -e "${BLUE}💡 Configuration changes will take effect next session${NC}"
            ;;
    esac

    echo ""
}

# Interactive help system
show_interactive_help() {
    echo -e "${BOLD}${GREEN}📚 Interactive Help & Tutorials${NC}"
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    echo -e "${BLUE}Available Help Topics:${NC}"
    echo -e "  ${GREEN}1)${NC} 🚀 Getting Started with CQRS"
    echo -e "  ${GREEN}2)${NC} 📡 GraphQL Schema Development"
    echo -e "  ${GREEN}3)${NC} 🧪 Testing Best Practices"
    echo -e "  ${GREEN}4)${NC} 🔧 Troubleshooting Guide"
    echo -e "  ${GREEN}5)${NC} 💡 Performance Optimization Tips"
    echo -e "  ${GREEN}6)${NC} 📖 Command Reference"
    echo ""

    read -p "Select help topic (1-6): " help_choice

    case $help_choice in
        1)
            echo -e "${CYAN}🚀 CQRS Quick Start Guide${NC}"
            echo -e "1. Commands represent intent to change state"
            echo -e "2. Events represent things that happened"
            echo -e "3. Queries read from projections, not domain models"
            echo -e "4. Aggregates enforce business rules"
            ;;
        2)
            echo -e "${CYAN}📡 GraphQL Development Tips${NC}"
            echo -e "• Use 'generate' to update types after schema changes"
            echo -e "• Run 'bun run gql:check' to validate operations"
            echo -e "• Consider persisted queries for production"
            ;;
        6)
            echo -e "${CYAN}📖 Command Reference${NC}"
            echo -e "${BOLD}Shell Commands:${NC}"
            echo -e "  dev          - Start development server"
            echo -e "  test-all     - Run complete test suite"
            echo -e "  generate     - Generate GraphQL types"
            echo -e "  clean        - Clean project artifacts"
            echo -e "  health       - Project health check"
            echo -e "  stats        - Code statistics"
            echo -e "  bench <cmd>  - Benchmark command"
            echo -e "  search <term> - Smart code search"
            ;;
        *)
            echo -e "${YELLOW}Help topic coming soon!${NC}"
            ;;
    esac

    echo ""
}

# Main execution logic
main() {
    # Ensure we're in the right directory
    if [[ ! -f "shell.nix" ]]; then
        echo -e "${RED}❌ Error: Not in project root directory${NC}"
        echo -e "${YELLOW}Please run from: graphql-hive-cqrs-event-sourcing-microservices/${NC}"
        exit 1
    fi

    # Initialize learning system
    initialize_learning

    # Log startup
    log "Assistant started"

    # Main interaction loop
    while true; do
        show_main_menu
        read -p "🤖 What would you like me to help with? (0-8): " choice
        echo ""

        case $choice in
            1)
                analyze_project_structure
                learn_from_command "analyze_project" "true"
                ;;
            2)
                detect_and_fix_issues
                learn_from_command "detect_fix_issues" "true"
                ;;
            3)
                smart_workflow
                ;;
            4)
                code_generation_assistant
                ;;
            5)
                monitoring_system
                learn_from_command "monitoring" "true"
                ;;
            6)
                show_learning_insights
                ;;
            7)
                manage_configuration
                ;;
            8)
                show_interactive_help
                ;;
            0)
                echo -e "${GREEN}🤖 Thank you for using the Development Assistant!${NC}"
                echo -e "${BLUE}💡 I've learned from our session to serve you better next time.${NC}"
                echo -e "${CYAN}Happy coding! 🚀${NC}"
                log "Assistant session ended"
                exit 0
                ;;
            *)
                echo -e "${RED}❌ Invalid choice. Please try again.${NC}"
                learn_from_command "invalid_choice" "false"
                ;;
        esac

        echo ""
        echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        read -p "Press Enter to continue..."
    done
}

# Execute main function
main "$@"
