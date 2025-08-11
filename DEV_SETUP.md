# Development Environment Setup

This project features a **next-generation development experience** with intelligent automation, AI-powered assistance, and modern CLI tools. Built on **Nix** + **direnv** with enhanced **Zsh** integration.

## 🚀 Ultra-Quick Start

### Smart Development Launcher (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd graphql-hive-cqrs-event-sourcing-microservices

# Launch the intelligent development environment
./dev.sh
```

The smart launcher will:

- **Auto-detect** your optimal environment
- **Install missing tools** automatically
- **Provide intelligent recommendations**
- **Quick access** to all development tools
- **Visual status indicators** for project health

### One-Command Full Setup

```bash
# Complete automated setup
./setup-dev.sh
```

This comprehensive setup includes:

- ✅ Nix package manager installation
- ✅ direnv for automatic environment loading
- ✅ Shell configuration (zsh/bash)
- ✅ Modern CLI tools (exa, bat, fzf, ripgrep, etc.)
- ✅ Enhanced development aliases and functions
- ✅ Intelligent project health monitoring

### Manual Setup (Advanced Users)

If you prefer manual control:

1. **Install Nix** (if not already installed):

   ```bash
   curl -L https://nixos.org/nix/install | sh
   ```

2. **Install direnv**:

   ```bash
   # On macOS with Homebrew
   brew install direnv

   # On Ubuntu/Debian
   sudo apt install direnv

   # Or with Nix
   nix-env -iA nixpkgs.direnv
   ```

3. **Add direnv to your shell**:

   ```bash
   # For Zsh (add to ~/.zshrc)
   echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc

   # For Bash (add to ~/.bashrc)
   echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
   ```

4. **Restart your terminal and allow the environment**:
   ```bash
   cd graphql-hive-cqrs-event-sourcing-microservices
   direnv allow
   ```

## 🎯 Development Environment Options

### 🧠 Smart Launcher (Recommended)

```bash
./dev.sh                    # Intelligent environment detection & quick actions
./dev.sh --auto            # Auto-detect and load optimal environment
./dev.sh --setup           # Run setup process
```

### 🤖 AI-Powered Development Assistant

```bash
./dev-assistant.sh          # Intelligent automation with learning capabilities
```

### 📊 Interactive Development Dashboard

```bash
./dev-dashboard.sh          # Visual project management and monitoring
```

### 🐚 Enhanced Shell Environments

```bash
./dev-zsh.sh               # Clean Zsh with advanced features
direnv allow               # Automatic environment loading
nix-shell                  # Manual Nix environment
```

## 🛠 Enhanced Development Stack

### Core Runtime & Languages

- **Bun 1.2.19** - Ultra-fast runtime and package manager
- **Node.js 20 LTS** - Compatibility layer
- **TypeScript** - Strict type safety with latest features
- **Git + Git LFS** - Advanced version control

### Modern CLI Tools & Utilities

- **exa** - Enhanced file listing with icons and git integration
- **bat** - Syntax-highlighted file viewer
- **ripgrep (rg)** - Lightning-fast code search
- **fd** - Intuitive find replacement
- **fzf** - Fuzzy finder for files, history, and commands
- **zoxide** - Smart directory navigation
- **delta** - Beautiful git diff viewer
- **dust** - Intuitive disk usage analyzer
- **tokei** - Code statistics and metrics
- **hyperfine** - Command benchmarking tool
- **bottom (btm)** - Advanced system monitor

### Advanced Shell Experience

- **Starship** - Fast, customizable prompt with project context
- **zsh-completions** - Intelligent command completion
- **zsh-syntax-highlighting** - Real-time syntax highlighting
- **zsh-autosuggestions** - AI-like command suggestions
- **Comprehensive aliases** - Intuitive shortcuts for all tools

### Development Intelligence

- **Health monitoring** - Continuous project health assessment
- **Smart problem detection** - Automatic issue identification
- **Performance benchmarking** - Built-in performance analysis
- **Learning system** - AI-like adaptation to your workflow patterns
- **Interactive dashboards** - Visual project management

## ⚡ Enhanced Commands & Intelligent Aliases

### 🚀 Smart Development Commands

- `dev` - Start development server with pre-flight checks
- `test-all` - Comprehensive test suite with progress indicators
- `generate` - Intelligent GraphQL type generation with validation
- `clean` - Smart project cleanup with optimization
- `health` - Complete project health assessment
- `stats` - Advanced code metrics and analytics
- `bench <command>` - Performance benchmarking for any command

### 🔍 Intelligent Search & Navigation

- `search <term>` - Smart codebase search with previews
- `proj <name>` - Fuzzy project navigation
- `z <path>` - Smart directory jumping (zoxide)
- `cd` → Enhanced with zoxide intelligence

### 🌿 Advanced Git Workflow

- `feature <name>` - Create and switch to feature branch
- `commit <msg>` - Stage all files and commit with message
- `gs` → Enhanced git status with branch info
- `glog` → Beautiful git log with graph visualization
- `gstash` → Smart git stashing with messages
- Enhanced `gd` with delta diff viewer

### 🛠 Modern Tool Integration

- `ll, ls` → Beautiful file listings with icons (exa)
- `cat` → Syntax-highlighted file viewer (bat)
- `find` → Intuitive search with previews (fd)
- `grep` → Ultra-fast search with context (ripgrep)
- `top` → Advanced system monitoring (bottom)
- `ps` → Modern process viewer (procs)
- `du` → Intuitive disk usage (dust)

### 📊 Development Analytics

- `env-info` - Complete environment diagnostics
- `dev-help` - Contextual help system
- Performance monitoring with automatic baselines
- Usage pattern learning and optimization suggestions

## 🎨 Next-Generation Shell Experience

### 🧠 Intelligent History System

- **50,000 command history** with advanced deduplication
- **Project-specific history** with smart context switching
- **Cross-session synchronization** for seamless workflow
- **AI-like command suggestions** based on usage patterns
- **Pattern recognition** for frequently used command sequences

### 🔍 Advanced Fuzzy Finding (FZF)

- **Ctrl+T** - Smart file finder with syntax-highlighted previews
- **Ctrl+R** - Intelligent command history with context
- **Alt+C** - Directory navigation with tree previews
- **Real-time file previews** with bat integration
- **Multi-selection support** for batch operations

### ✨ Enhanced Starship Prompt

Intelligently displays:

- **Directory context** with git-aware truncation
- **Git branch and detailed status** with visual indicators
- **Runtime versions** (Node.js, Bun) with health status
- **Command execution time** for performance awareness
- **Custom project indicators** for GraphQL Hive CQRS context

### 🎯 Smart Completions & Suggestions

- **Context-aware completions** for all modern tools
- **Intelligent parameter suggestions** based on project structure
- **Auto-correction** for common typos and command variants
- **Real-time syntax highlighting** with error detection
- **Async suggestion loading** for zero-latency typing

## 🔧 Available Commands

### Development

```bash
bun run dev          # Start development server with hot reload
bun run start        # Start production server
bun test             # Run all tests
bun run test:framework # Run framework tests
bun run typecheck    # TypeScript type checking
```

### Code Generation

```bash
bun run generate:all # Generate both GraphQL types and gql.tada types
bun run codegen      # Generate GraphQL resolver types only
bun run gql:generate # Generate gql.tada types only
bun run gql:check    # Validate GraphQL operations
bun run gql:persisted # Generate persisted GraphQL documents
```

### Maintenance

```bash
bun run clean:unused # Remove unused exports (using knip)
```

## 🌍 Environment Variables

The shell automatically sets:

- `NODE_ENV=development`
- `PORT=3001`
- `BUN_ENV=development`
- Various FZF and Zsh configurations

### GraphQL Hive Integration

Set your GraphQL Hive token for monitoring:

```bash
export HIVE_API_TOKEN=your_token_here
```

## 🐛 Troubleshooting

### Environment Setup Issues

**Problem**: "direnv: command not found"

```bash
# Run the setup script to install direnv
./setup-dev.sh
```

**Problem**: ".envrc is blocked"

```bash
# Allow the environment file
direnv allow
```

**Problem**: "Nix not found"

```bash
# Install Nix first
curl -L https://nixos.org/nix/install | sh
# Then restart terminal and run setup
./setup-dev.sh
```

### Shell-Related Issues

**Problem**: "bindkey: command not found" or "setopt: command not found"

- This happens when zsh configuration is loaded in bash
- **Solutions**:
  - Use the smart launcher: `./dev.sh` (auto-detects optimal environment)
  - Use enhanced zsh: `./dev-zsh.sh`
  - Use basic environment: `nix-shell`

**Problem**: "bind: command not found"

- Caused by Neovim/shell configuration conflicts
- **Solutions**:
  - Smart launcher handles this automatically: `./dev.sh`
  - Clean zsh environment: `./dev-zsh.sh`
  - Use AI assistant for diagnosis: `./dev-assistant.sh`

**Problem**: Shell enhancements not working

```bash
# Best: Use intelligent launcher
./dev.sh

# Alternative: Enhanced zsh environment
./dev-zsh.sh

# Check current environment status
./dev.sh --auto

# AI-powered troubleshooting
./dev-assistant.sh
```

**Problem**: Environment detection issues

```bash
# Smart environment diagnosis
./dev.sh -a

# Complete environment information
./dev-assistant.sh  # Choose option 1 (Analyze Project)

# Manual environment info
nix-shell --run env-info
```

### Direnv Issues

**Problem**: Direnv not loading automatically

```bash
# Check if direnv is installed
which direnv

# Check if hook is in shell config
grep "direnv hook" ~/.zshrc ~/.bashrc

# Manually reload
direnv reload

# Re-run setup if needed
./setup-dev.sh
```

**Problem**: Permission denied

```bash
# Make scripts executable
chmod +x setup-dev.sh dev-zsh.sh

# Allow direnv
direnv allow
```

### Nix Issues

**Problem**: Nix packages not found

```bash
# Update nixpkgs channel
nix-channel --update

# Force rebuild shell
rm -rf .direnv && direnv reload
```

**Problem**: Nix shell fails to load

```bash
# Test nix installation
nix-shell --version

# Check shell.nix syntax
nix-shell --dry-run

# Try manual activation
nix-shell
```

## 📁 Project Structure

The environment supports the monorepo structure:

```
graphql-hive-cqrs-event-sourcing-microservices/
├── packages/framework/          # @cqrs/framework package
├── src/
│   ├── app/                    # Application entry point
│   ├── domains/                # Domain implementations
│   ├── examples/               # Usage examples
│   └── graphql/                # GraphQL schema and types
├── shell.nix                   # Nix development environment
├── .envrc                      # Direnv configuration
└── package.json                # Workspace configuration
```

## 🎯 Next Steps & Quick Start Guide

### 1. **Initial Setup** (One-time only)

```bash
# Smart setup with auto-detection
./setup-dev.sh

# Or use the intelligent launcher
./dev.sh --setup
```

### 2. **Enter Your Optimal Development Environment**

```bash
# 🧠 Smart launcher (recommended) - auto-detects best environment
./dev.sh

# 🤖 AI-powered development assistant
./dev-assistant.sh

# 📊 Interactive development dashboard
./dev-dashboard.sh

# 🐚 Enhanced Zsh environment
./dev-zsh.sh

# 🏠 Automatic loading (after direnv setup)
cd graphql-hive-cqrs-event-sourcing-microservices  # Environment auto-loads!
```

### 3. **Configure GraphQL Hive Integration** (Optional)

```bash
export HIVE_API_TOKEN=your_token_here
```

### 4. **Start Development Workflow**

```bash
# Quick actions from smart launcher
./dev.sh
# Then press: d (dev server), t (tests), g (generate types)

# Or use direct commands in any environment
dev          # Start development server
test-all     # Complete test suite
generate     # Generate GraphQL types
health       # Check project health
```

### 5. **Explore Advanced Features**

```bash
# Performance benchmarking
bench "bun run typecheck"

# Smart code search
search "GraphQL"

# Git workflow helpers
feature "new-awesome-feature"
commit "feat: add amazing functionality"

# Project analytics
stats        # Code metrics
env-info     # Environment details
```

## 🚀 Development Experience Levels

| Tool                 | Experience Level           | Features                                          |
| -------------------- | -------------------------- | ------------------------------------------------- |
| `./dev.sh`           | **Beginner to Expert**     | Smart detection, quick actions, visual feedback   |
| `./dev-assistant.sh` | **Intermediate to Expert** | AI-powered automation, learning system, workflows |
| `./dev-dashboard.sh` | **All Levels**             | Visual interface, interactive menus, monitoring   |
| `./dev-zsh.sh`       | **Intermediate**           | Clean Zsh, advanced shell features                |
| `direnv`             | **Expert**                 | Automatic, invisible, seamless integration        |

## 📋 Complete Development Toolkit

- 🧠 **Smart Launcher** (`./dev.sh`) - Intelligent entry point
- ⚙️ **Automated Setup** (`./setup-dev.sh`) - One-command installation
- 🤖 **AI Assistant** (`./dev-assistant.sh`) - Intelligent automation
- 📊 **Visual Dashboard** (`./dev-dashboard.sh`) - Interactive management
- 🐚 **Enhanced Shell** (`./dev-zsh.sh`) - Advanced development environment
- 🏠 **Auto Environment** (`direnv`) - Seamless background integration
- 🔧 **Nix Foundation** (`shell.nix`) - Reproducible development stack

## 🎉 Welcome to the Future of Development!

This environment learns from your patterns, suggests optimizations, automates repetitive tasks, and provides intelligent assistance throughout your development journey.

**Ready to experience next-generation development?** Start with:

```bash
./dev.sh
```

Happy coding! 🚀✨
