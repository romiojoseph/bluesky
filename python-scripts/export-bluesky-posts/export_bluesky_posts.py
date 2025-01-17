import requests
from datetime import datetime
import json
from typing import Dict, List, Optional, Union

class BlueskyAPI:
    BASE_URL = "https://public.api.bsky.app/xrpc"

    @staticmethod
    def get_handle_from_url(profile_link: str) -> str:
        """Extract handle from profile URL."""
        return profile_link.split('/')[-1]

    def fetch_author_feed(self, handle: str, cursor: Optional[str] = None) -> Dict:
        """Fetch author's posts feed."""
        endpoint = f"{self.BASE_URL}/app.bsky.feed.getAuthorFeed"
        params = {"actor": handle, "limit": 50}
        if cursor:
            params["cursor"] = cursor

        response = requests.get(endpoint, params=params)
        response.raise_for_status()
        return response.json()

class PostProcessor:
    @staticmethod
    def format_datetime(dt_str: str) -> str:
        """Format ISO datetime string to readable format."""
        try:
            return datetime.fromisoformat(dt_str[:-1]).strftime('%Y-%m-%d %H:%M:%S')
        except (ValueError, TypeError):
            return 'N/A'

    @staticmethod
    def extract_post_metadata(post: Dict) -> Optional[Dict]:
        """Extract relevant metadata from a post."""
        post_data = post.get('post', {})
        record = post_data.get('record', {})

        # Skip if it's a repost
        if record.get('$type') == 'app.bsky.feed.repost':
            return None

        return {
            'uri': post_data.get('uri', ''),
            'created_at': PostProcessor.format_datetime(post_data.get('indexedAt', '')),
            'likes': post_data.get('likeCount', 0),
            'comments': post_data.get('replyCount', 0),
            'reposts': post_data.get('repostCount', 0),
            'quotes': post_data.get('quoteCount', 0),
            'text': record.get('text', '')
        }

class DataCollector:
    def __init__(self):
        self.api = BlueskyAPI()
        self.processor = PostProcessor()

    def collect_data(self, profile_link: str) -> tuple[List, List]:
        """Collect all posts data for a user."""
        handle = self.api.get_handle_from_url(profile_link)

        # Collect posts
        posts_raw = []
        posts_metadata = []
        cursor = None

        while True:
            try:
                feed = self.api.fetch_author_feed(handle, cursor)
                posts_raw.extend(feed.get('feed', []))

                for post in feed.get('feed', []):
                    metadata = self.processor.extract_post_metadata(post)
                    if metadata:
                        posts_metadata.append(metadata)

                cursor = feed.get('cursor')
                if not cursor:
                    break

            except requests.exceptions.RequestException as e:
                print(f"Error fetching feed page: {e}")
                break

        return posts_raw, posts_metadata

def save_json(data: Union[List, Dict], filename: str) -> None:
    """Save data to JSON file."""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def main():
    print("This script collects and saves the raw JSON data of posts from a Bluesky profile.")
    try:
        profile_link = input("Enter the Bluesky profile link: ")
        collector = DataCollector()
        handle = BlueskyAPI.get_handle_from_url(profile_link)

        print("\nCollecting data...")
        raw_feed, _ = collector.collect_data(profile_link)

        # Save all data
        filename = f"{handle}.json"
        save_json(raw_feed, filename)

        print(f"\nData collection complete! Saved to {filename}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
