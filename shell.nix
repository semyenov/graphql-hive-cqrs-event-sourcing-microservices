{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Core runtime and package managers
    bun                    # Primary runtime and package manager
    nodejs_20              # Node.js LTS for compatibility

    # Language tooling
    typescript             # TypeScript compiler

    # Development tools
    git                    # Version control
    git-lfs                # Large file support
    curl                   # HTTP client for API testing
    jq                     # JSON processing
    yq                     # YAML processing

    # Database tools
    sqlite                 # SQLite database

    # Build tools
    gnumake                # Build automation

    # Development utilities
    htop                   # Process monitoring
    tree                   # Directory visualization
    ripgrep                # Fast text search
    fd                     # Fast file finder
    bat                    # Better cat with syntax highlighting
    eza                    # Better ls
    delta                  # Better git diff

    # Shell enhancements
    zsh                    # Zsh shell
    zsh-completions        # Additional completions
    zsh-syntax-highlighting # Syntax highlighting
    zsh-autosuggestions    # Auto suggestions
    starship               # Cross-shell prompt
    fzf                    # Fuzzy finder
    zoxide                 # Smart cd

    # Modern CLI tools
    gh                     # GitHub CLI
    glow                   # Markdown viewer
    tokei                  # Code statistics
    hyperfine              # Command benchmarking
    dust                   # Better du
    procs                  # Better ps
    bottom                 # Better top

    # Directory environment support
    direnv

    # Development servers and tools
    watchexec              # File watching
    entr                   # File watcher for commands

    # Network tools
    httpie                 # Better curl

    # JSON/API tools
    fx                     # JSON viewer

  ] ++ lib.optionals stdenv.isLinux [
    valgrind strace
  ] ++ lib.optionals stdenv.isDarwin [
    # macOS specific tools
  ];

  shellHook = ''
    # Enhanced environment setup with rich CLI experience

    # Color definitions
    export RED='\033[0;31m'
    export GREEN='\033[0;32m'
    export YELLOW='\033[1;33m'
    export BLUE='\033[0;34m'
    export PURPLE='\033[0;35m'
    export CYAN='\033[0;36m'
    export WHITE='\033[1;37m'
    export BOLD='\033[1m'
    export NC='\033[0m'

    # Rich welcome message with system info
    clear
    echo -e "''${CYAN}╭─────────────────────────────────────────────────────────────╮''${NC}"
    echo -e "''${CYAN}│''${WHITE}''${BOLD}  🚀 GraphQL Hive CQRS/Event Sourcing Environment''${NC}''${CYAN}        │''${NC}"
    echo -e "''${CYAN}╰─────────────────────────────────────────────────────────────╯''${NC}"
    echo ""

    # System information
    echo -e "''${BOLD}''${GREEN}System Information:''${NC}"
    echo -e "  ''${BLUE}•''${NC} Runtime: ''${GREEN}$(bun --version)''${NC}"
    echo -e "  ''${BLUE}•''${NC} Node.js: ''${GREEN}$(node --version)''${NC}"
    echo -e "  ''${BLUE}•''${NC} TypeScript: ''${GREEN}$(tsc --version)''${NC}"
    echo -e "  ''${BLUE}•''${NC} Platform: ''${GREEN}$(uname -s) $(uname -m)''${NC}"
    echo ""

    # Enhanced environment variables
    export NODE_ENV=development
    export PORT=3001
    export BUN_ENV=development
    export FORCE_COLOR=1
    export CLICOLOR_FORCE=1

    # Bun optimizations
    export BUN_CONFIG_VERBOSE_FETCH=false
    export BUN_RUNTIME_TRANSPILER_CACHE_PATH="$PWD/.bun/cache"

    # Development paths
    export PATH="$PWD/node_modules/.bin:$PATH"
    export PATH="$HOME/.bun/bin:$PATH"

    # Modern shell configuration
    CURRENT_SHELL=$(ps -p $$ -o comm= 2>/dev/null | tail -1)

    # Zsh-specific enhancements
    if [[ "$CURRENT_SHELL" == *"zsh"* ]] || [[ -n "$ZSH_VERSION" ]]; then
      # History configuration
      export HISTSIZE=50000
      export SAVEHIST=50000
      export HISTFILE="$HOME/.zsh_history_dev_''${PWD##*/}"

      # Advanced history options
      setopt HIST_VERIFY 2>/dev/null || true
      setopt HIST_IGNORE_ALL_DUPS 2>/dev/null || true
      setopt HIST_SAVE_NO_DUPS 2>/dev/null || true
      setopt HIST_IGNORE_SPACE 2>/dev/null || true
      setopt SHARE_HISTORY 2>/dev/null || true
      setopt APPEND_HISTORY 2>/dev/null || true
      setopt INC_APPEND_HISTORY 2>/dev/null || true
      setopt EXTENDED_HISTORY 2>/dev/null || true

      # Enhanced completions
      autoload -U compinit && compinit -d ~/.zcompdump_dev
      zstyle ':completion:*' menu select
      zstyle ':completion:*' list-colors "''${(s.:.)LS_COLORS}"
      zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}'

      # Load syntax highlighting and suggestions if available
      [[ -f ${pkgs.zsh-syntax-highlighting}/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ]] && \
        source ${pkgs.zsh-syntax-highlighting}/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
      [[ -f ${pkgs.zsh-autosuggestions}/share/zsh-autosuggestions/zsh-autosuggestions.zsh ]] && \
        source ${pkgs.zsh-autosuggestions}/share/zsh-autosuggestions/zsh-autosuggestions.zsh
    else
      # Bash configuration
      export HISTFILE="$HOME/.bash_history_dev_''${PWD##*/}"
      export HISTCONTROL=ignoredups:erasedups
      export HISTSIZE=50000
      export HISTFILESIZE=50000
      shopt -s histappend 2>/dev/null || true
    fi

    # Modern tool configurations
    export FZF_DEFAULT_COMMAND='fd --type f --hidden --follow --exclude .git --exclude node_modules'
    export FZF_DEFAULT_OPTS='--height 40% --layout=reverse --border --preview "bat --color=always --style=header,grid --line-range :300 {}" --preview-window=right:60%'
    export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
    export FZF_ALT_C_COMMAND='fd --type d --hidden --follow --exclude .git --exclude node_modules'

    # Zoxide configuration
    if command -v zoxide >/dev/null 2>&1; then
      if [[ -n "$ZSH_VERSION" ]]; then
        eval "$(zoxide init zsh)"
      else
        eval "$(zoxide init bash)"
      fi
    fi

    # Enhanced aliases with modern tools
    alias ll='eza -la --icons --git'
    alias ls='eza --icons'
    alias la='eza -la --icons'
    alias lt='eza --tree --icons'
    alias cat='bat'
    alias find='fd'
    alias grep='rg'
    alias top='btm'
    alias ps='procs'
    alias du='dust'
    alias cd='z'

    # Git aliases with delta
    alias gs='git status --short --branch'
    alias ga='git add'
    alias gc='git commit'
    alias gp='git push'
    alias gl='git pull'
    alias gd='git diff'
    alias gb='git branch'
    alias gco='git checkout'
    alias glog='git log --oneline --graph --decorate --all'
    alias gstash='git stash push -m'

    # Bun aliases
    alias bd='bun run dev'
    alias bs='bun run start'
    alias bt='bun test'
    alias bi='bun install'
    alias br='bun run'
    alias btc='bun run typecheck'
    alias bw='bun run --watch'

    # Modern development functions
    dev() {
      echo -e "''${GREEN}🚀 Starting development server...''${NC}"
      echo -e "''${BLUE}ℹ️  Server will be available at: http://localhost:''${PORT:-3001}''${NC}"
      bun run dev
    }

    test-all() {
      echo -e "''${GREEN}🧪 Running complete test suite...''${NC}"
      echo -e "''${YELLOW}1/3''${NC} TypeScript compilation check..."
      if bun run typecheck; then
        echo -e "''${GREEN}✅ TypeScript check passed''${NC}"
        echo -e "''${YELLOW}2/3''${NC} Unit tests..."
        if bun test; then
          echo -e "''${GREEN}✅ Unit tests passed''${NC}"
          echo -e "''${YELLOW}3/3''${NC} Framework tests..."
          if bun run test:framework; then
            echo -e "''${GREEN}🎉 All tests passed!''${NC}"
          else
            echo -e "''${RED}❌ Framework tests failed''${NC}"
            return 1
          fi
        else
          echo -e "''${RED}❌ Unit tests failed''${NC}"
          return 1
        fi
      else
        echo -e "''${RED}❌ TypeScript check failed''${NC}"
        return 1
      fi
    }

    generate() {
      echo -e "''${GREEN}⚡ Generating types and schemas...''${NC}"
      echo -e "''${BLUE}🔄 GraphQL codegen...''${NC}"
      bun run codegen
      echo -e "''${BLUE}🔄 gql.tada types...''${NC}"
      bun run gql:generate
      echo -e "''${GREEN}✅ Generation complete''${NC}"
    }

    clean() {
      echo -e "''${GREEN}🧹 Cleaning project...''${NC}"
      echo -e "''${BLUE}🔍 Finding unused exports...''${NC}"
      bun run clean:unused
      echo -e "''${BLUE}🗑️  Cleaning build artifacts...''${NC}"
      rm -rf dist/ build/ .bun/ node_modules/.cache/
      echo -e "''${GREEN}✅ Cleanup complete''${NC}"
    }

    # Project health check
    health() {
      echo -e "''${GREEN}🏥 Project Health Check''${NC}"
      echo -e "''${WHITE}========================''${NC}"

      # Check dependencies
      echo -e "''${BLUE}📦 Dependencies:''${NC}"
      if [[ -f "package.json" ]] && bun install --dry-run >/dev/null 2>&1; then
        echo -e "  ''${GREEN}✅ Dependencies are up to date''${NC}"
      else
        echo -e "  ''${YELLOW}⚠️  Dependencies may need update''${NC}"
      fi

      # Check TypeScript
      echo -e "''${BLUE}🔍 TypeScript:''${NC}"
      if bun run typecheck >/dev/null 2>&1; then
        echo -e "  ''${GREEN}✅ No type errors''${NC}"
      else
        echo -e "  ''${RED}❌ Type errors found''${NC}"
      fi

      # Check Git status
      echo -e "''${BLUE}📝 Git Status:''${NC}"
      if git status --porcelain | wc -l | grep -q "^0$"; then
        echo -e "  ''${GREEN}✅ Working directory clean''${NC}"
      else
        echo -e "  ''${YELLOW}⚠️  $(git status --porcelain | wc -l | tr -d ' ') files modified''${NC}"
      fi

      # Performance info
      echo -e "''${BLUE}⚡ Performance:''${NC}"
      if command -v tokei >/dev/null; then
        echo -e "  ''${CYAN}$(tokei --compact .)''${NC}"
      fi
    }

    # Quick project stats
    stats() {
      echo -e "''${GREEN}📊 Project Statistics''${NC}"
      echo -e "''${WHITE}====================''${NC}"

      if command -v tokei >/dev/null; then
        tokei
      fi

      echo -e "''${BLUE}📁 Directory sizes:''${NC}"
      if command -v dust >/dev/null; then
        dust -d 2 -r
      fi
    }

    # Benchmark commands
    bench() {
      local cmd="''${1:-bun run typecheck}"
      echo -e "''${GREEN}🏃 Benchmarking: ''${cmd}''${NC}"
      if command -v hyperfine >/dev/null; then
        hyperfine --warmup 1 --min-runs 3 "''${cmd}"
      else
        echo -e "''${YELLOW}⚠️  hyperfine not available, running single execution''${NC}"
        time eval "''${cmd}"
      fi
    }

    # Smart project finder
    proj() {
      if [[ -n "$1" ]]; then
        fd -t d "$1" . | fzf --preview 'eza --tree --level 2 {}' | xargs -I {} sh -c 'cd {}'
      else
        fd -t d . | fzf --preview 'eza --tree --level 2 {}' | xargs -I {} sh -c 'cd {}'
      fi
    }

    # Enhanced file search
    search() {
      if [[ -n "$1" ]]; then
        rg --type-add 'config:*.{json,yaml,yml,toml}' --smart-case --color=always "$1" | fzf --ansi
      else
        echo -e "''${YELLOW}Usage: search <pattern>''${NC}"
      fi
    }

    # Git workflow helpers
    feature() {
      local branch_name="$1"
      if [[ -z "$branch_name" ]]; then
        echo -e "''${YELLOW}Usage: feature <branch-name>''${NC}"
        return 1
      fi
      git checkout -b "feature/$branch_name"
      echo -e "''${GREEN}✅ Created and switched to feature/$branch_name''${NC}"
    }

    commit() {
      local message="$1"
      if [[ -z "$message" ]]; then
        echo -e "''${YELLOW}Usage: commit <message>''${NC}"
        return 1
      fi
      git add -A
      git status --short
      echo -e "''${BLUE}Commit message: $message''${NC}"
      git commit -m "$message"
    }

    # Development server with auto-restart
    dev-watch() {
      echo -e "''${GREEN}🔄 Starting development server with file watching...''${NC}"
      watchexec -r -e ts,js,json,graphql -- bun run dev
    }

    # Quick GraphQL schema validation
    schema-check() {
      echo -e "''${GREEN}🔍 Validating GraphQL schema...''${NC}"
      if bun run gql:check; then
        echo -e "''${GREEN}✅ Schema is valid''${NC}"
      else
        echo -e "''${RED}❌ Schema validation failed''${NC}"
      fi
    }

    # Environment info
    env-info() {
      echo -e "''${GREEN}🌍 Environment Information''${NC}"
      echo -e "''${WHITE}=========================''${NC}"
      echo -e "''${BLUE}Node Version:''${NC} $(node --version)"
      echo -e "''${BLUE}Bun Version:''${NC} $(bun --version)"
      echo -e "''${BLUE}TypeScript:''${NC} $(tsc --version)"
      echo -e "''${BLUE}Git Version:''${NC} $(git --version)"
      echo -e "''${BLUE}Platform:''${NC} $(uname -a)"
      echo -e "''${BLUE}Shell:''${NC} $SHELL"
      echo -e "''${BLUE}PWD:''${NC} $PWD"
      [[ -n "$HIVE_API_TOKEN" ]] && echo -e "''${BLUE}Hive:''${NC} ''${GREEN}✅ Configured''${NC}" || echo -e "''${BLUE}Hive:''${NC} ''${YELLOW}⚠️  Not configured''${NC}"
    }

    # Smart help system
    dev-help() {
      echo -e "''${GREEN}🚀 Development Environment Help''${NC}"
      echo -e "''${WHITE}==============================''${NC}"
      echo ""
      echo -e "''${BOLD}''${CYAN}Quick Commands:''${NC}"
      echo -e "  ''${BLUE}dev''${NC}           Start development server"
      echo -e "  ''${BLUE}test-all''${NC}      Run complete test suite"
      echo -e "  ''${BLUE}generate''${NC}      Generate GraphQL types"
      echo -e "  ''${BLUE}clean''${NC}         Clean project artifacts"
      echo -e "  ''${BLUE}health''${NC}        Check project health"
      echo -e "  ''${BLUE}stats''${NC}         Show project statistics"
      echo ""
      echo -e "''${BOLD}''${CYAN}Tools:''${NC}"
      echo -e "  ''${BLUE}bench <cmd>''${NC}   Benchmark a command"
      echo -e "  ''${BLUE}search <term>''${NC} Smart search in codebase"
      echo -e "  ''${BLUE}proj <name>''${NC}   Find and navigate to projects"
      echo ""
      echo -e "''${BOLD}''${CYAN}Git Workflow:''${NC}"
      echo -e "  ''${BLUE}feature <name>''${NC} Create feature branch"
      echo -e "  ''${BLUE}commit <msg>''${NC}  Stage all and commit"
      echo ""
      echo -e "''${BOLD}''${CYAN}Enhanced Aliases:''${NC}"
      echo -e "  ''${BLUE}ll, ls, cat, find, grep, top, ps, du, cd''${NC}"
      echo ""
      echo -e "''${BOLD}''${CYAN}Environment:''${NC}"
      echo -e "  ''${BLUE}env-info''${NC}      Show environment details"
      echo -e "  ''${BLUE}dev-help''${NC}      Show this help"
    }

    # Auto-install dependencies if needed
    if [[ -f "package.json" ]]; then
      echo -e "''${PURPLE}📦 Checking dependencies...''${NC}"
      if ! bun install --frozen-lockfile --silent 2>/dev/null; then
        echo -e "''${YELLOW}⚠️  Installing dependencies...''${NC}"
        bun install --frozen-lockfile
      fi
      echo -e "''${GREEN}✅ Dependencies ready''${NC}"
    fi

    # Check for required environment variables
    if [[ -z "$HIVE_API_TOKEN" ]]; then
      echo -e "''${YELLOW}⚠️  HIVE_API_TOKEN not set - GraphQL Hive integration disabled''${NC}"
      echo -e "   Set with: ''${BLUE}export HIVE_API_TOKEN=your_token_here''${NC}"
    else
      echo -e "''${GREEN}✅ GraphQL Hive integration enabled''${NC}"
    fi

    # Configure Starship if available
    if command -v starship >/dev/null 2>&1; then
      export STARSHIP_CONFIG="$PWD/.starship.toml"
      if [[ ! -f "$STARSHIP_CONFIG" ]]; then
        cat > "$STARSHIP_CONFIG" << 'STARSHIP_EOF'
format = """
$username$hostname$directory$git_branch$git_status$nodejs$bun$cmd_duration$line_break$character
"""

[directory]
style = "bold cyan"
truncation_length = 4
truncate_to_repo = false

[git_branch]
style = "bold purple"
format = "on [$symbol$branch]($style) "

[git_status]
style = "red"
format = '([\[$all_status$ahead_behind\]]($style) )'

[nodejs]
format = "via [⬢ $version](bold green) "

[bun]
format = "via [🥟 $version](bold red) "

[cmd_duration]
format = "took [$duration](bold yellow) "

[character]
success_symbol = "[❯](bold green)"
error_symbol = "[❯](bold red)"
STARSHIP_EOF
      fi

      if [[ -n "$ZSH_VERSION" ]]; then
        eval "$(starship init zsh)" 2>/dev/null || true
      else
        eval "$(starship init bash)" 2>/dev/null || true
      fi
    fi

    echo ""
    echo -e "''${BOLD}''${GREEN}🎉 Environment ready!''${NC} Type ''${BLUE}dev-help''${NC} for commands or ''${BLUE}dev''${NC} to start."
    echo ""
  '';

  # Environment variables
  BUN_INSTALL = "$HOME/.bun";
  NODE_OPTIONS = "--max-old-space-size=8192";

  # Enable completions
  enableCompletion = true;
}
