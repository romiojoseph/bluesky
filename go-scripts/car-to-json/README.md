
_Script created using Mistral AI and Google AI Studio + additional help from from DeepSeek._

# Bluesky CAR File to JSON Converter

This script processes CAR files and extracts records into JSON files.

> Bluesky offers CAR format files as a snapshot of public data in the AT Protocol, including posts, likes, follows, profile information, etc. You can download it by going to settings > account > export my data.

Either download your CAR file using above mentioned step or [visit here and enter any Bluesky handle](https://romiojoseph.github.io/bluesky/download-car-json-blob/)


## Overview

The script reads a CAR file, groups records by type, and saves the results as JSON files. One file contains all records, and separate files are created for each record type.

## Requirements

You need Go (version 1.18 or newer). The project uses external packages, and dependency details are in the `go.mod` file. The `go.sum` file is included to keep track of dependency checksums.

## How to Use

1. Clone the repository and change to the project directory.
2. Run the script with your CAR file as the argument:
   ```bash
   go run car.go <path-to-car-file>
   ```
   Replace `<path-to-car-file>` with the actual path to your CAR file. For eg; `repository.car`

When the script runs, it creates:
- `output_all_records.json` (all records)
- `output_<type>.json` (records grouped by their type)

The script prints messages about how many blocks were processed or skipped.

_Like I mentioned earlier, this was created with the help of LLMs. If you can improve it further or spot any issues, please let me know._