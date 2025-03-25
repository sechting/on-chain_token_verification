#!/bin/bash

# Ensure the script is run from the root of the project
if [ ! -d "./artifacts/contracts" ]; then
  echo "Error: Script must be run from the root directory of your Hardhat project."
  exit 1
fi

# Check if a prefix is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <name-prefix>"
  exit 1
fi

# Parameters
PREFIX="$1"
TARGET_DIR="./artifacts/contracts"

# Output directory
OUTPUT_DIR="./evaluation/$PREFIX"

# Create evaluation subdirectory for the prefix if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Array of contract names
CONTRACTS=("AuditCheck.sol" "Auditor.sol" "ozTokenA.sol" "SignedToken.sol" "TokenValidator.sol")

# Copy and rename artifacts
for CONTRACT in "${CONTRACTS[@]}"; do
  JSON_FILE="$TARGET_DIR/$CONTRACT/${CONTRACT%.sol}.json"
  
  if [ -f "$JSON_FILE" ]; then
    OUTPUT_FILE="$OUTPUT_DIR/${CONTRACT%.sol}.json"
    cp "$JSON_FILE" "$OUTPUT_FILE"
    echo "Copied $JSON_FILE to $OUTPUT_FILE"
  else
    echo "Warning: Artifact JSON for $CONTRACT not found at $JSON_FILE"
  fi
done

echo "Artifacts processed successfully. Check the 'evaluation/$PREFIX/' directory."
