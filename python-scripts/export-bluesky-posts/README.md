_Script created using Mistral AI and Google AI Studio + additional help from from DeepSeek._

# Export posts from Bluesky
This Python script provides a comprehensive toolkit for collecting data from the Bluesky social network. Export Bluesky posts in JSON format. Choose profile-based exports, including followers, following, and lists, etc. or use any profile, list, or feed link for customized downloads. You can also enter a Bluesky post link to download the full metadata of its thread. 

`*No authentication is needed. Bluesky is an open platform. But respect authors' privacy when using this tool.*`

Frontend project available at [https://romiojoseph.github.io/bluesky/export-bluesky-posts/](https://romiojoseph.github.io/bluesky/export-bluesky-posts/)

## Features
* **Profile Data Export:**
	* Fetch detailed profile information (display name, handle, follower/following counts, etc.).
	* Download lists of followers and followed accounts.
	* Export original posts (excluding reposts) or all posts (including reposts) in JSON format.
	* Fetch curated lists and starter packs created by a user.
* **Custom Data Collection:** 
	* Download posts from any public profile, list, or feed using its Bluesky URL.
	* Specify the number of posts to fetch or collect all available posts.
* **Post Thread Analysis:**
	* Download the complete metadata of a Bluesky post thread, including all replies, likes, reposts, and quotes.
	* Save the collected data in structured JSON format for easy analysis.

## Requirements

- Python 3.7 or higher
- `requests` library

## Installation

1. Download the script.
2. Install the required libraries using pip:

`pip install requests`

## Usage

1. Run the script:

`python export_bluesky_posts.py`

2. The script will present a main menu with the available options.
3. Choose an option and follow the prompts to enter the required information (e.g., profile link, post URL, number of posts).
4. The collected data is saved in JSON format in the same directory as the script.
5. Filenames are generated based on the type of data collected (e.g., `username_followers.json`, `handle_original_posts.json`, `post_id_thread.json`).
6. The script provides progress updates with timestamps in the console during data collection.
7. Please note that it might take some time if the given profile has created a lot of posts. 
8. Due to system limitations, only 100 posts can be processed at a time. If there are more than 100 posts, the job will be completed in batches. Please be patient while the requests are processed.

**Tip:** To find just the reposts, open the JSON file in any text editor or IDE and search for:

``` JSON
        "reason": {
            "$type": "app.bsky.feed.defs#reasonRepost",
```

## Notes

* **Rate Limiting:** The script incorporates rate limiting to avoid overloading the Bluesky API. There might be a slight delay between requests.
* **Public Data:** This script can only access publicly available data on Bluesky.
* **Error Handling:** Basic error handling is implemented to catch invalid URLs or API errors.
* **Ethical Considerations:** Use this tool responsibly and ethically. Respect user privacy and adhere to Bluesky's terms of service.


---

**What is public and what is private on Bluesky?**: Bluesky is a public social network. Think of your posts as blog posts – anyone on the web can see them. Read more at https://blueskyweb.zendesk.com/hc/en-us/articles/15835264007693-Data-Privacy