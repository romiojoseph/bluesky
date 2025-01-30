import requests
import re
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

class BlueskyAPI:
    BASE_URL = "https://public.api.bsky.app/xrpc"
    RATE_LIMIT_DELAY = 1  # Seconds between requests
    MAX_BATCH_SIZE = 100

    def __init__(self):
        self.last_request_time = 0
        self.session = requests.Session()

    def _rate_limit(self):
        """Enforce rate limiting with timestamp."""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.RATE_LIMIT_DELAY:
            time.sleep(self.RATE_LIMIT_DELAY - elapsed)
        self.last_request_time = time.time()

    @lru_cache(maxsize=128)
    def resolve_handle(self, handle: str) -> str:
        """Resolve handle to DID with caching and timestamp."""
        self._rate_limit()
        self._timestamped_print(f"🔍 Resolving handle: {handle}...")
        response = self.session.get(
            f"{self.BASE_URL}/com.atproto.identity.resolveHandle",
            params={"handle": handle}
        )
        response.raise_for_status()
        return response.json()['did']

    @staticmethod
    def get_actor_from_link(profile_link: str) -> str:
        """Extract the actor handle or DID from the profile link or handle."""
        match = re.search(r'bsky\.app/profile/([^/]+)', profile_link)
        if match:
            return match.group(1)
        else:
            match = re.match(r'^[a-zA-Z0-9._-]+$', profile_link)
            if match:
                return profile_link
            else:
                raise ValueError("Invalid Bluesky profile link or handle")

    def fetch_author_feed(self, handle: str, cursor: Optional[str] = None) -> Dict:
        """Fetch author's posts feed with maximum efficiency."""
        endpoint = f"{self.BASE_URL}/app.bsky.feed.getAuthorFeed"
        params = {
            "actor": handle,
            "limit": 100,
            "filter": "posts_with_replies"
        }
        if cursor:
            params["cursor"] = cursor

        response = requests.get(endpoint, params=params)
        response.raise_for_status()
        return response.json()

    def fetch_follows(self, actor, cursor=None):
        """Fetches accounts that the given actor follows."""
        url = f"{self.BASE_URL}/app.bsky.graph.getFollows"
        params = {"actor": actor, "limit": 100}
        if cursor:
            params["cursor"] = cursor
        return self.fetch_data(url, params)

    def fetch_followers(self, actor, cursor=None):
        """Fetches followers for the given actor."""
        url = f"{self.BASE_URL}/app.bsky.graph.getFollowers"
        params = {"actor": actor, "limit": 100}
        if cursor:
            params["cursor"] = cursor
        return self.fetch_data(url, params)

    def fetch_lists(self, actor, cursor=None):
        """Fetches lists created by the given actor."""
        url = f"{self.BASE_URL}/app.bsky.graph.getLists"
        params = {"actor": actor, "limit": 100}
        if cursor:
            params["cursor"] = cursor
        return self.fetch_data(url, params)
    
    def fetch_list_details(self, list_uri, cursor=None):
        """Fetches details of a given list, including its members."""
        url = f"{self.BASE_URL}/app.bsky.graph.getList"
        params = {"list": list_uri, "limit": 100}
        if cursor:
            params["cursor"] = cursor
        return self.fetch_data(url, params)
    
    def fetch_starter_packs(self, actor, cursor=None):
        """Fetches starter packs created by the given actor."""
        url = f"{self.BASE_URL}/app.bsky.graph.getActorStarterPacks"
        params = {"actor": actor, "limit": 100}
        if cursor:
            params["cursor"] = cursor
        return self.fetch_data(url, params)

    def fetch_profile_details(self, actor):
        """Fetches profile details for the given actor."""
        url = f"{self.BASE_URL}/app.bsky.actor.getProfile"
        return self.fetch_data(url, {"actor": actor})

    def fetch_actor_feeds(self, actor):
        """Fetches actor feeds for the given actor."""
        url = f"{self.BASE_URL}/app.bsky.feed.getActorFeeds"
        return self.fetch_data(url, {"actor": actor})

    def fetch_actor_starter_packs(self, actor):
        """Fetches actor starter packs for the given actor."""
        url = f"{self.BASE_URL}/app.bsky.graph.getActorStarterPacks"
        return self.fetch_data(url, {"actor": actor})
    
    def detect_resource_type(self, url: str) -> "ResourceInfo":
        """Detect resource type from URL and extract identifier"""
        patterns = {
            'profile': r'(?:https://bsky\.app/profile/|@?)([^/]+)',
            'list': r'/lists/(\w+)$',
            'feed': r'/feed/(\w+)$'
        }

        if '/lists/' in url:
            handle_match = re.search(r'/profile/([^/]+)', url)
            list_id_match = re.search(patterns['list'], url)
            if handle_match and list_id_match:
                handle = handle_match.group(1)
                list_id = list_id_match.group(1)
                did = self.resolve_handle(handle)
                return ResourceInfo('list', f"at://{did}/app.bsky.graph.list/{list_id}", f"{handle}_list_{list_id}")

        elif '/feed/' in url:
            handle_match = re.search(r'/profile/([^/]+)', url)
            feed_id_match = re.search(patterns['feed'], url)
            if handle_match and feed_id_match:
                handle = handle_match.group(1)
                feed_id = feed_id_match.group(1)
                did = self.resolve_handle(handle)
                return ResourceInfo('feed', f"at://{did}/app.bsky.feed.generator/{feed_id}", f"{handle}_feed_{feed_id}")

        elif re.match(patterns['profile'], url):
            handle = re.search(patterns['profile'], url).group(1)
            return ResourceInfo('profile', self.resolve_handle(handle), handle)

        raise ValueError("❌ Invalid URL format. Please provide a valid Bluesky URL:\n   - Profile: https://bsky.app/profile/username\n   - List: https://bsky.app/profile/username/lists/listname\n   - Feed: https://bsky.app/profile/username/feed/feedname")

    def fetch_posts(self, resource_type: str, params: Dict, limit: int) -> tuple[List[Dict], str]:
        """Optimized paginated fetcher with progress tracking and timestamp."""
        all_posts = []
        cursor = None
        total_fetched = 0
        end_reason = "Requested number of posts collected"

        endpoint = {
            'profile': 'app.bsky.feed.getAuthorFeed',
            'list': 'app.bsky.feed.getListFeed',
            'feed': 'app.bsky.feed.getFeed'
        }[resource_type]

        while total_fetched < limit:
            self._rate_limit()
            current_params = {
                **params,
                "limit": min(limit - total_fetched, self.MAX_BATCH_SIZE),
                "cursor": cursor
            }

            response = self.session.get(
                f"{self.BASE_URL}/{endpoint}",
                params=current_params
            )
            response.raise_for_status()
            data = response.json()

            if 'feed' not in data:
                end_reason = "No more posts available"
                break

            posts = data['feed']
            if not posts:
                end_reason = "No more posts available"
                break

            all_posts.extend(posts)
            total_fetched += len(posts)

            progress = (total_fetched / limit) * 100 if limit != float('inf') else 0
            self._timestamped_print(f"📥 Fetched: {total_fetched} posts {f'({progress:.1f}%)' if limit != float('inf') else ''}")

            if not data.get('cursor'):
                end_reason = "End of feed reached"
                break

            cursor = data['cursor']

        return all_posts[:limit], end_reason
    
    def parse_post_url(self, url: str) -> "PostInfo":
        """Parse post URL to extract components with timestamp."""
        pattern = r'https://bsky\.app/profile/([^/]+)/post/([^/]+)'
        match = re.match(pattern, url)

        if not match:
            raise ValueError("❌ Invalid post URL format. Please provide a valid Bluesky post URL:\n"
                           "   Format: https://bsky.app/profile/username/post/post_id")

        username, post_id = match.groups()
        did = self.resolve_handle(username)

        # Get post URI and CID
        self._rate_limit()
        self._timestamped_print(f"🔍 Getting post URI and CID for: {url}...")
        response = self.session.get(
            f"{self.BASE_URL}/app.bsky.feed.getPostThread",
            params={"uri": f"at://{did}/app.bsky.feed.post/{post_id}"}
        )
        response.raise_for_status()
        post_data = response.json()

        return PostInfo(
            uri=f"at://{did}/app.bsky.feed.post/{post_id}",
            cid=post_data['thread']['post']['cid'],
            username=username,
            post_id=post_id
        )
    
    def get_post_thread(self, uri: str) -> Dict:
        """Fetch post thread with timestamp."""
        self._rate_limit()
        self._timestamped_print(f"🧵 Fetching post thread for: {uri}...")
        response = self.session.get(
            f"{self.BASE_URL}/app.bsky.feed.getPostThread",
            params={"uri": uri}
        )
        response.raise_for_status()
        return response.json()

    def get_likes(self, uri: str, cid: str) -> List[Dict]:
        """Fetch all likes for a post with timestamp."""
        all_likes = []
        cursor = None

        while True:
            self._rate_limit()
            params = {
                "uri": uri,
                "cid": cid,
                "limit": 100,
                "cursor": cursor
            }

            response = self.session.get(
                f"{self.BASE_URL}/app.bsky.feed.getLikes",
                params=params
            )
            response.raise_for_status()
            data = response.json()

            likes = data.get('likes', [])
            all_likes.extend(likes)
            self._timestamped_print(f"❤️  Fetched {len(all_likes)} likes...")

            cursor = data.get('cursor')
            if not cursor:
                break

        return all_likes

    def get_reposts(self, uri: str) -> List[Dict]:
        """Fetch all reposts for a post with timestamp."""
        all_reposts = []
        cursor = None

        while True:
            self._rate_limit()
            params = {
                "uri": uri,
                "limit": 100,
                "cursor": cursor
            }

            response = self.session.get(
                f"{self.BASE_URL}/app.bsky.feed.getRepostedBy",
                params=params
            )
            response.raise_for_status()
            data = response.json()

            reposts = data.get('repostedBy', [])
            all_reposts.extend(reposts)
            self._timestamped_print(f"🔄 Fetched {len(all_reposts)} reposts...")

            cursor = data.get('cursor')
            if not cursor:
                break

        return all_reposts

    def get_quotes(self, uri: str) -> List[Dict]:
        """Fetch all quotes for a post with timestamp."""
        all_quotes = []
        cursor = None

        while True:
            self._rate_limit()
            params = {
                "uri": uri,
                "limit": 100,
                "cursor": cursor
            }

            response = self.session.get(
                f"{self.BASE_URL}/app.bsky.feed.getQuotes",
                params=params
            )
            response.raise_for_status()
            data = response.json()

            quotes = data.get('posts', [])
            all_quotes.extend(quotes)
            self._timestamped_print(f"💬 Fetched {len(all_quotes)} quotes...")

            cursor = data.get('cursor')
            if not cursor:
                break

        return all_quotes

    @staticmethod
    def fetch_data(url, params):
        """Fetches data from the given URL with the given parameters."""
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 400:
                print(f"No data found for the given parameters at {url}.")
                return None
            else:
                raise

    @staticmethod
    def _timestamped_print(message: str):
        """Print message with timestamp."""
        current_time = datetime.now().strftime("%I:%M:%S %p")
        print(f"[{current_time}] {message}")

@dataclass
class ResourceInfo:
    type: str
    uri: str
    name: str  # Handle, list name, or feed name

@dataclass
class PostInfo:
    uri: str
    cid: str
    username: str
    post_id: str

class PostProcessor:
    @staticmethod
    def format_datetime(dt_str: str) -> str:
        """Format ISO datetime string to readable format."""
        try:
            return datetime.fromisoformat(dt_str[:-1]).strftime('%Y-%m-%d %H:%M:%S')
        except (ValueError, TypeError):
            return 'N/A'

    @staticmethod
    def is_repost(post: Dict) -> bool:
        """Check if a post is a repost."""
        return 'reason' in post or post.get('post', {}).get('record', {}).get('$type') == 'app.bsky.feed.repost'

    @staticmethod
    def extract_post_metadata(post: Dict) -> Optional[Dict]:
        """Extract relevant metadata from a post."""
        if PostProcessor.is_repost(post):
            return None

        post_data = post.get('post', {})
        record = post_data.get('record', {})

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

    def collect_all_posts(self, profile_link: str) -> tuple[List, List]:
        """Collect all posts including reposts."""
        handle = self.api.get_actor_from_link(profile_link)
        return self._collect_posts(handle, include_reposts=True)

    def collect_original_posts(self, profile_link: str) -> tuple[List, List]:
        """Collect only original posts and replies (no reposts)."""
        handle = self.api.get_actor_from_link(profile_link)
        return self._collect_posts(handle, include_reposts=False)

    def _collect_posts(self, handle: str, include_reposts: bool) -> tuple[List, List]:
        """Generic post collection method with repost filtering."""
        posts_raw = []
        posts_metadata = []
        cursor = None
        total_posts = 0

        while True:
            try:
                feed = self.api.fetch_author_feed(handle, cursor)
                batch_posts = feed.get('feed', [])
                
                if not include_reposts:
                    batch_posts = [post for post in batch_posts if not self.processor.is_repost(post)]

                posts_raw.extend(batch_posts)
                total_posts += len(batch_posts)
                self.api._timestamped_print(f"Fetched {len(batch_posts)} posts in this batch. Total so far: {total_posts}")

                for post in batch_posts:
                    metadata = self.processor.extract_post_metadata(post)
                    if metadata:
                        posts_metadata.append(metadata)

                cursor = feed.get('cursor')
                if not cursor:
                    break

            except requests.exceptions.RequestException as e:
                self.api._timestamped_print(f"Error fetching feed page: {e}")
                break

        self.api._timestamped_print(f"Total posts fetched: {total_posts}")
        return posts_raw, posts_metadata

    def fetch_and_save_follows(self, profile_link):
        """Fetches and saves the list of accounts followed by the given actor."""
        try:
            actor = self.api.get_actor_from_link(profile_link)
            follows = []
            cursor = None
            total_follows = 0

            while True:
                data = self.api.fetch_follows(actor, cursor)
                if not data or 'follows' not in data:
                    break
                batch_follows = data['follows']
                follows.extend(batch_follows)
                total_follows += len(batch_follows)
                cursor = data.get('cursor')
                self.api._timestamped_print(f"Fetched {len(batch_follows)} follows in this batch. Total so far: {total_follows}")
                if not cursor:
                    break
                time.sleep(1)

            self.api._timestamped_print(f"Total follows fetched: {total_follows}")
            self.save_to_json(follows, f"{actor}_follows.json")
        except Exception as e:
            self.api._timestamped_print(f"An error occurred: {e}")

    def fetch_and_save_followers(self, profile_link):
        """Fetches and saves the list of followers for the given actor."""
        try:
            actor = self.api.get_actor_from_link(profile_link)
            followers = []
            cursor = None
            total_followers = 0

            while True:
                data = self.api.fetch_followers(actor, cursor)
                if not data or 'followers' not in data:
                    break
                batch_followers = data['followers']
                followers.extend(batch_followers)
                total_followers += len(batch_followers)
                cursor = data.get('cursor')
                self.api._timestamped_print(f"Fetched {len(batch_followers)} followers in this batch. Total so far: {total_followers}")
                if not cursor:
                    break
                time.sleep(1)

            self.api._timestamped_print(f"Total followers fetched: {total_followers}")
            self.save_to_json(followers, f"{actor}_followers.json")
        except Exception as e:
            self.api._timestamped_print(f"An error occurred: {e}")

    def fetch_and_save_lists(self, profile_link):
        """Fetches lists created by the given actor and their members, and saves to JSON."""
        try:
            actor = self.api.get_actor_from_link(profile_link)
            lists_data = []
            cursor = None

            while True:
                data = self.api.fetch_lists(actor, cursor)
                if not data or 'lists' not in data:
                    break
                lists_data.extend(data['lists'])
                cursor = data.get('cursor')
                if not cursor:
                    break
                time.sleep(1)

            for list_info in lists_data:
                list_uri = list_info['uri']
                members = []
                cursor = None
                while True:
                    list_details = self.api.fetch_list_details(list_uri, cursor)
                    if not list_details or 'items' not in list_details:
                        break
                    members.extend(list_details['items'])
                    cursor = list_details.get('cursor')
                    if not cursor:
                        break
                    time.sleep(1)
                list_info['members'] = members

            self.save_to_json(lists_data, f"{actor}_lists.json")
        except Exception as e:
            self.api._timestamped_print(f"An error occurred: {e}")
    
    def fetch_and_save_starter_packs(self, profile_link):
        """Fetches starter packs created by the given actor and their members, and saves to JSON."""
        try:
            actor = self.api.get_actor_from_link(profile_link)
            starter_packs_data = []
            cursor = None

            while True:
                data = self.api.fetch_starter_packs(actor, cursor)
                if not data or 'starterPacks' not in data:
                    break
                starter_packs_data.extend(data['starterPacks'])
                cursor = data.get('cursor')
                if not cursor:
                    break
                time.sleep(1)

            for starter_pack_info in starter_packs_data:
                list_uri = starter_pack_info['record'].get('list')
                if list_uri:
                    self.api._timestamped_print(f"Fetching members for starter pack: {starter_pack_info['uri']}")
                    members = []
                    cursor = None
                    while True:
                        list_details = self.api.fetch_list_details(list_uri, cursor)
                        if not list_details or 'items' not in list_details:
                            break
                        members.extend(list_details['items'])
                        cursor = list_details.get('cursor')
                        if not cursor:
                            break
                        time.sleep(1)
                    starter_pack_info['members'] = members
                else:
                    starter_pack_info['members'] = []

            self.save_to_json(starter_packs_data, f"{actor}_starter_packs.json")
        except Exception as e:
            self.api._timestamped_print(f"An error occurred: {e}")
    
    def fetch_and_process_profile(self, profile_link):
        """Fetches profile details, lists, feeds, starter packs, saves to JSON, and displays details."""
        try:
            actor = self.api.get_actor_from_link(profile_link)
            profile_details = self.api.fetch_profile_details(actor)

            lists = self.api.fetch_lists(actor)
            actor_feeds = self.api.fetch_actor_feeds(actor)
            actor_starter_packs = self.api.fetch_actor_starter_packs(actor)

            combined_details = {
                "profile": profile_details,
                "lists": lists,
                "feeds": actor_feeds,
                "starter_packs": actor_starter_packs
            }

            self.save_to_json(combined_details, f"{actor}_profile.json")
            self.display_profile_details(combined_details)
        except Exception as e:
            self.api._timestamped_print(f"An error occurred: {e}")

    def _get_profile_post_count(self, actor: str) -> int:
        """Get total posts count for profile"""
        try:
            self.api._rate_limit()
            response = self.api.session.get(
                f"{self.api.BASE_URL}/app.bsky.actor.getProfile",
                params={"actor": actor}
            )
            return response.json().get('postsCount', 0)
        except Exception as e:
            self.api._timestamped_print(f"❌ Error getting post count: {e}")
            return 0

    def _get_limit_input(self, max_limit: int) -> int:
        """Get validated limit input with improved UX"""
        while True:
            if max_limit != float('inf'):
                prompt = f"Enter number of posts to fetch (1-{max_limit}) or 'all': "
            else:
                prompt = "Enter number of posts to fetch: "
            
            user_input = input(prompt).lower()
            
            if user_input == 'all' and max_limit != float('inf'):
                return max_limit
            if user_input.isdigit():
                num = int(user_input)
                if num > 0 and (max_limit == float('inf') or num <= max_limit):
                    return num
            self.api._timestamped_print(f"❌ Please enter a valid number between 1-{max_limit if max_limit != float('inf') else 'any'}")

    def save_data(self, data: Union[List, Dict], resource_info: Optional[ResourceInfo]=None, limit: Optional[int]=None, post_info: Optional[PostInfo]=None) -> str:
        """Save data to JSON file with meaningful name"""
        if resource_info:
            filename = f"{resource_info.name}_{limit}_posts.json"
        elif post_info:
            filename = f"{post_info.username}_post_{post_info.post_id}"
            if "thread" in data:
                filename += "_thread.json"
            elif "likes" in data[0]:
                filename += "_likes.json"
            elif "repostedBy" in data[0]:
                filename += "_reposts.json"
            elif "text" in data[0]:
                filename += "_quotes.json"
            else:
                filename += "_data.json"
        else:
            filename = "data.json"

        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        self.api._timestamped_print(f"Data saved to {filename}")
        return filename

    def collect_data(self):
        """Streamlined collection flow with improved UX"""
        self.api._timestamped_print("\nEnter a Bluesky link. Profile/List/Feed")
        
        while True:
            url = input("\nEnter Bluesky URL: ").strip()
            try:
                resource_info = self.api.detect_resource_type(url)
                break
            except ValueError as e:
                print(f"{e}")

        self.api._timestamped_print(f"\n✨ Resource type: {resource_info.type}")
        
        if resource_info.type == 'profile':
            max_posts = self._get_profile_post_count(resource_info.uri)
            self.api._timestamped_print(f"📊 Available posts: {max_posts}")
            limit = self._get_limit_input(max_posts)
        else:
            self.api._timestamped_print("\nℹ️  Note: Posts are fetched in batches of 100. Large numbers will take longer due to rate limiting.")
            limit = self._get_limit_input(float('inf'))

        params = {
            "actor" if resource_info.type == 'profile' else resource_info.type: resource_info.uri
        }
        if resource_info.type == 'profile':
            params["filter"] = "posts_with_replies"

        self.api._timestamped_print("\n🚀 Starting data collection...")
        posts, end_reason = self.api.fetch_posts(
            resource_type=resource_info.type,
            params=params,
            limit=limit
        )

        filename = self.save_data(posts, resource_info, limit)
        self.api._timestamped_print(f"\n✅ Successfully saved {len(posts)} posts to {filename}")
        if len(posts) < limit:
            self.api._timestamped_print(f"ℹ️  Note: Fewer posts than requested were collected ({end_reason})")

        self.api._timestamped_print("\nWould you like to collect more data? (y/n)")
        if input().lower().startswith('y'):
            self.collect_data()

    def analyze_post(self):
        """Main analysis flow for a single post."""
        self.api._timestamped_print("\nGet the metadata of a Bluesky thread...")
        self.api._timestamped_print("Please provide a Bluesky post URL")
        self.api._timestamped_print("Format: https://bsky.app/profile/username/post/post_id")

        while True:
            url = input("\nEnter post URL: ").strip()
            try:
                post_info = self.api.parse_post_url(url)
                break
            except ValueError as e:
                print(f"{e}")
            except Exception as e:
                print(f"❌ Error processing URL: {e}")

        self.api._timestamped_print("\n🚀 Starting post analysis...")

        # Fetch and save post thread
        thread_data = self.api.get_post_thread(post_info.uri)
        self.save_data(thread_data, post_info=post_info)

        # Fetch and save likes
        likes_data = self.api.get_likes(post_info.uri, post_info.cid)
        self.save_data(likes_data, post_info=post_info)

        # Fetch and save reposts
        reposts_data = self.api.get_reposts(post_info.uri)
        self.save_data(reposts_data, post_info=post_info)

        # Fetch and save quotes
        quotes_data = self.api.get_quotes(post_info.uri)
        self.save_data(quotes_data, post_info=post_info)

        self.api._timestamped_print("\n✨ Analysis complete! All data has been saved.")
        self.api._timestamped_print("\nWould you like to analyze another post? (y/n)")
        if input().lower().startswith('y'):
            self.analyze_post()

    @staticmethod
    def save_to_json(data, filename):
        """Saves data to a JSON file."""
        with open(filename, 'w') as file:
            json.dump(data, file, indent=4)
        print(f"Data saved to {filename}")

    @staticmethod
    def format_timestamp(timestamp):
        """Formats an ISO 8601 timestamp to a more readable format."""
        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        local_offset = timedelta(seconds=time.altzone if time.localtime().tm_isdst else time.timezone)
        local_dt = dt - local_offset
        return local_dt.strftime('%b %d, %Y • %I:%M %p')

    @staticmethod
    def format_number(number):
        """Formats a number with commas as thousands separators."""
        return "{:,}".format(number)

    def display_profile_details(self, profile_details):
        """Displays profile details in a user-friendly format."""
        profile = profile_details.get("profile", {})
        associated = profile.get("associated", {})
        print(f'did: {profile.get("did")}')
        print(f'handle: {profile.get("handle")}')
        print(f'displayName: {profile.get("displayName")}')
        print(f'lists: {self.format_number(associated.get("lists", 0))}')
        print(f'feedgens: {self.format_number(associated.get("feedgens", 0))}')
        print(f'starterPacks: {self.format_number(associated.get("starterPacks", 0))}')
        print(f'labeler: {associated.get("labeler", False)}')
        print(f'createdAt: {self.format_timestamp(profile.get("createdAt"))}')
        print(f'indexedAt: {self.format_timestamp(profile.get("indexedAt"))}')
        print(f'followersCount: {self.format_number(profile.get("followersCount", 0))}')
        print(f'followsCount: {self.format_number(profile.get("followsCount", 0))}')
        print(f'postsCount: {self.format_number(profile.get("postsCount", 0))}')

def main():
    collector = DataCollector()
    print()
    print("Export posts from Bluesky in JSON format!")
    print()
    print("Choose profile-based exports, including followers, following, and lists, etc or use any profile, list, or feed link for customized downloads. You can also enter a Bluesky post link to download the full metadata of its thread.")

    while True:
        print("\nMain Menu:")
        print("1. Download Bluesky Profile Data")
        print("2. Profile Posts, Lists or Feeds")
        print("3. Download Bluesky Post Thread")
        print("4. Exit")

        choice = input("Enter your choice (1-4): ")

        if choice == '1':
            print("\nDownload Bluesky Profile Data")
            while True:
                print("\nSub-Menu:")
                print("1. Get profile details")
                print("2. Fetch followed accounts")
                print("3. Fetch followers")
                print("4. Export original posts only (exclude reposts)")
                print("5. Export all posts (including reposts)")
                print("6. Fetch curated lists")
                print("7. Fetch starter packs")
                print("8. Back to Main Menu")

                sub_choice = input("Enter your choice (1-8): ")

                if sub_choice == '1':
                    print("\nFetching detailed profile information...")
                    profile_link = input("Enter Bluesky profile link/handle: ")
                    collector.fetch_and_process_profile(profile_link)
                    break  # Go back to Sub-Menu after operation

                elif sub_choice == '2':
                    print("\nFetching accounts followed by the profile...")
                    profile_link = input("Enter Bluesky profile link/handle: ")
                    collector.fetch_and_save_follows(profile_link)
                    break

                elif sub_choice == '3':
                    print("\nFetching profile followers...")
                    profile_link = input("Enter Bluesky profile link/handle: ")
                    collector.fetch_and_save_followers(profile_link)
                    break

                elif sub_choice == '4':
                    print("\nExporting original posts (excluding reposts)...")
                    profile_link = input("Enter Bluesky profile link/handle: ")
                    try:
                        raw_feed, _ = collector.collect_original_posts(profile_link)
                        handle = BlueskyAPI.get_actor_from_link(profile_link)
                        collector.save_to_json(raw_feed, f"{handle}_original_posts.json")
                    except Exception as e:
                        print(f"Error: {e}")
                    break

                elif sub_choice == '5':
                    print("\nExporting all posts including reposts...")
                    profile_link = input("Enter Bluesky profile link/handle: ")
                    try:
                        raw_feed, _ = collector.collect_all_posts(profile_link)
                        handle = BlueskyAPI.get_actor_from_link(profile_link)
                        collector.save_to_json(raw_feed, f"{handle}_all_posts.json")
                    except Exception as e:
                        print(f"Error: {e}")
                    break

                elif sub_choice == '6':
                    print("\nFetching curated lists...")
                    profile_link = input("Enter Bluesky profile link/handle: ")
                    collector.fetch_and_save_lists(profile_link)
                    break

                elif sub_choice == '7':
                    print("\nFetching starter packs...")
                    profile_link = input("Enter Bluesky profile link/handle: ")
                    collector.fetch_and_save_starter_packs(profile_link)
                    break

                elif sub_choice == '8':
                    break  # Go back to Main Menu

                else:
                    print("Invalid choice. Please enter a number between 1 and 8.")

        elif choice == '2':
            collector.collect_data()

        elif choice == '3':
            collector.analyze_post()

        elif choice == '4':
            print("Exiting the script. Goodbye!")
            break

        else:
            print("Invalid choice. Please enter a number between 1 and 4.")

if __name__ == "__main__":
    main()