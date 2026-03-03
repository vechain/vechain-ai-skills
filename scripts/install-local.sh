#!/bin/bash

# VeChain Dev Plugin Installer for Claude Code
# Copies skills to the target location.
#
# Usage: ./scripts/install-local.sh [--project | --path <path>]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_NAME="vechain-dev"
SOURCE_DIR="$REPO_ROOT/skills"

# Default to personal installation
INSTALL_PATH="$HOME/.claude/skills/$PLUGIN_NAME"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --project)
            INSTALL_PATH=".claude/skills/$PLUGIN_NAME"
            shift
            ;;
        --path)
            INSTALL_PATH="$2"
            shift 2
            ;;
        -h|--help)
            echo "VeChain Dev Plugin Installer"
            echo ""
            echo "Usage: ./scripts/install-local.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --project     Install to current project (.claude/skills/$PLUGIN_NAME)"
            echo "  --path PATH   Install to custom path"
            echo "  -h, --help    Show this help message"
            echo ""
            echo "Default: Install to ~/.claude/skills/$PLUGIN_NAME"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory '$SOURCE_DIR' not found"
    exit 1
fi

# Validate before installing
echo "Validating..."
node "$REPO_ROOT/scripts/validate-plugin.cjs"
echo ""

# Create parent directory if needed
mkdir -p "$(dirname "$INSTALL_PATH")"

# Check if destination already exists
if [ -d "$INSTALL_PATH" ]; then
    echo "Warning: '$INSTALL_PATH' already exists"
    read -p "Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled"
        exit 0
    fi
    rm -rf "$INSTALL_PATH"
fi

# Copy skill files
echo "Installing VeChain Dev Plugin..."
cp -r "$SOURCE_DIR" "$INSTALL_PATH"

echo ""
echo "Successfully installed to: $INSTALL_PATH"
echo ""
echo "Installed skills:"
for skill_dir in "$INSTALL_PATH"/*/; do
    if [ -f "$skill_dir/SKILL.md" ]; then
        skill_name=$(basename "$skill_dir")
        ref_count=0
        if [ -d "$skill_dir/references" ]; then
            ref_count=$(find "$skill_dir/references" -name "*.md" | wc -l | tr -d ' ')
        fi
        echo "  - $skill_name (SKILL.md + $ref_count reference files)"
    fi
done
echo ""
echo "The plugin is now available in Claude Code."
echo "Try asking about VeChain development to activate it!"
