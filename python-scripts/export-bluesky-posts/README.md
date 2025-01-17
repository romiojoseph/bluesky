_Script created using Mistral AI._

# Export the Entire Posts from a Bluesky Profile

This script collects and saves the raw JSON data of posts, reposts, and replies from a Bluesky profile. It fetches the author's feed, extracts relevant metadata from each post, and saves the raw feed to a JSON file named after the user's handle.

## Features

- Fetches the author's posts, reposts, and replies from Bluesky.
- Extracts relevant metadata from each post.
- Saves the raw feed data to a JSON file.
- Provides status messages during the data collection process.

## Requirements

- Python 3.x
- `requests` library

## Installation

1. Download the script.
2. Install the required libraries using pip:

`pip install requests`

## Usage

1. Run the script:

`python script_name.py`

2. Enter the Bluesky profile link when prompted. (Eg; https://bsky.app/profile/username)
3. The script will collect the data and save the raw JSON feed to a file named after the user's handle (e.g., `username.bsky.social.json`).
4. Please note that it might take some time if the given profile has created a lot of posts.

**Tip:** To find just the reposts, open the JSON file in any text editor or IDE and search for:

``` JSON
        "reason": {
            "$type": "app.bsky.feed.defs#reasonRepost",
```


---

**What is public and what is private on Bluesky?**: Bluesky is a public social network. Think of your posts as blog posts – anyone on the web can see them. Read more at https://blueskyweb.zendesk.com/hc/en-us/articles/15835264007693-Data-Privacy