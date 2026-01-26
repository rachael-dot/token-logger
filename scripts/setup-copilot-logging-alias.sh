#!/bin/bash

# Setup script to create an alias for copilot with logging

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WRAPPER_PATH="$SCRIPT_DIR/copilot-with-logging"

echo "Setting up copilot logging alias..."
echo ""
echo "This will create an alias so that when you type 'copilot', it will"
echo "automatically log token usage to your token-logger API and logs."
echo ""
echo "Add this line to your shell configuration file:"
echo ""
echo "  alias copilot=\"$WRAPPER_PATH\""
echo ""
echo "Shell config files:"
echo "  - Bash: ~/.bashrc or ~/.bash_profile"
echo "  - Zsh:  ~/.zshrc"
echo ""
echo "After adding the alias, run:"
echo "  source ~/.zshrc    (or your shell config file)"
echo ""

# Detect current shell
CURRENT_SHELL=$(basename "$SHELL")

read -p "Would you like me to add this alias to your ~/.$CURRENT_SHELL"rc" file now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    CONFIG_FILE="$HOME/.${CURRENT_SHELL}rc"

    # Check if alias already exists
    if grep -q "alias copilot=" "$CONFIG_FILE" 2>/dev/null; then
        echo "Warning: An alias for 'copilot' already exists in $CONFIG_FILE"
        read -p "Do you want to replace it? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Remove old alias
            sed -i.backup '/alias copilot=/d' "$CONFIG_FILE"
            echo "Old alias removed (backup saved as ${CONFIG_FILE}.backup)"
        else
            echo "Cancelled."
            exit 0
        fi
    fi

    # Add the alias
    echo "" >> "$CONFIG_FILE"
    echo "# Copilot CLI with token logging" >> "$CONFIG_FILE"
    echo "alias copilot=\"$WRAPPER_PATH\"" >> "$CONFIG_FILE"

    echo "✓ Alias added to $CONFIG_FILE"
    echo ""
    echo "To activate it in your current shell, run:"
    echo "  source $CONFIG_FILE"
    echo ""
    echo "Or simply open a new terminal window."
else
    echo "Alias not added. You can add it manually later."
fi
