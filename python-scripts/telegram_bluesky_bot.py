import logging
from dotenv import load_dotenv
import os
import requests
from telegram.ext import Application, CommandHandler, MessageHandler, filters
from telegram import Update, MessageEntity
from datetime import datetime
from ratelimit import limits, sleep_and_retry  # for rate limiting

load_dotenv()  # Load environment variables from .env file

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# Constants for rate limiting (adjust as needed based on Bluesky API limits)
BSKY_API_RATE_LIMIT_CALLS = 10
BSKY_API_RATE_LIMIT_PERIOD = 60  # seconds

class BlueSkyAPI:
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self.base_url = "https://bsky.social/xrpc/"
        self._refresh_token = None
        self._access_token = None
        self._did = None
        self._max_auth_retries = 3  # Maximum retries for authentication
        self._auth_retries = 0
        self._get_tokens()

    def _get_tokens(self) -> None:
        try:
            response = requests.post(
                f"{self.base_url}com.atproto.server.createSession",
                json={"identifier": self.username, "password": self.password},
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()
            self._refresh_token = data["refreshJwt"]
            self._access_token = data["accessJwt"]
            self._did = data["did"]
            self._auth_retries = 0  # Reset retry counter on success
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get BlueSky tokens: {e}")
            self._handle_auth_failure()

    def _refresh_session(self) -> None:
        try:
            response = requests.post(
                f"{self.base_url}com.atproto.server.refreshSession",
                headers={"Authorization": f"Bearer {self._refresh_token}"},
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()
            self._refresh_token = data["refreshJwt"]
            self._access_token = data["accessJwt"]
            self._auth_retries = 0  # Reset retry counter on success
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to refresh session: {e}")
            self._handle_auth_failure()

    def _handle_auth_failure(self):
        self._auth_retries += 1
        if self._auth_retries >= self._max_auth_retries:
            logger.error("Max authentication retries reached. Giving up.")
            raise Exception("Failed to authenticate with BlueSky API")
        else:
            logger.warning(
                f"Authentication attempt {self._auth_retries} failed. Retrying..."
            )
            self._get_tokens()  # Retry authentication

    def resolve_did(self, handle: str) -> str:
        try:
            response = requests.get(
                f"{self.base_url}com.atproto.identity.resolveHandle",
                params={"handle": handle},
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()
            return data["did"]
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to resolve handle {handle}: {e}")
            return handle  # Fallback to using the handle directly

    def create_rich_text(self, text: str, entities: list[MessageEntity]) -> tuple[str, list]:
        facets = []
        if not entities:
            return text, []

        # Extract hashtags and mentions from text
        words = text.split()
        byte_offset = 0

        for word in words:
            word_start = text.find(word, byte_offset)
            word_end = word_start + len(word)

            if word.startswith("#"):
                facets.append(
                    {
                        "index": {"byteStart": word_start, "byteEnd": word_end},
                        "features": [
                            {
                                "$type": "app.bsky.richtext.facet#tag",
                                "tag": word[1:],
                            }
                        ],
                    }
                )
            elif word.startswith("@"):
                # Resolve handle to DID
                did = self.resolve_did(word[1:])
                facets.append(
                    {
                        "index": {"byteStart": word_start, "byteEnd": word_end},
                        "features": [
                            {
                                "$type": "app.bsky.richtext.facet#mention",
                                "did": did,
                            }
                        ],
                    }
                )

            byte_offset = word_end

        # Add URL facets from entities
        for entity in entities:
            if entity.type == MessageEntity.URL or entity.type == MessageEntity.TEXT_LINK:
                url = (
                    entity.url
                    if entity.type == MessageEntity.TEXT_LINK
                    else text[entity.offset : entity.offset + entity.length]
                )
                facets.append(
                    {
                        "index": {
                            "byteStart": entity.offset,
                            "byteEnd": entity.offset + entity.length,
                        },
                        "features": [
                            {"$type": "app.bsky.richtext.facet#link", "uri": url}
                        ],
                    }
                )

        return text, facets
    
    @sleep_and_retry
    @limits(calls=BSKY_API_RATE_LIMIT_CALLS, period=BSKY_API_RATE_LIMIT_PERIOD)
    def create_post(self, text: str, entities: list[MessageEntity] = None) -> bool:
        try:
            # Basic input validation: Check for empty text and maximum length
            if not text:
                logger.warning("Cannot create an empty post.")
                return False
            
            # You might want to adjust this based on Bluesky's actual limit
            if len(text) > 300:
                logger.warning("Post text exceeds maximum length (300 characters).")
                return False

            text, facets = self.create_rich_text(text, entities or [])

            headers = {
                "Authorization": f"Bearer {self._access_token}",
                "Content-Type": "application/json",
            }

            post_data = {
                "repo": self._did,
                "collection": "app.bsky.feed.post",
                "record": {
                    "$type": "app.bsky.feed.post",
                    "text": text,
                    "createdAt": datetime.utcnow().isoformat() + "Z",
                },
            }

            if facets:
                post_data["record"]["facets"] = facets

            response = requests.post(
                f"{self.base_url}com.atproto.repo.createRecord",
                headers=headers,
                json=post_data,
                timeout=10,
            )

            if response.status_code == 401:
                self._refresh_session()
                headers["Authorization"] = f"Bearer {self._access_token}"
                response = requests.post(
                    f"{self.base_url}com.atproto.repo.createRecord",
                    headers=headers,
                    json=post_data,
                    timeout=10,
                )

            response.raise_for_status()
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create post: {e}")
            return False

class TelegramBot:
    def __init__(self, telegram_token: str, allowed_chat_id: str, bluesky_api: BlueSkyAPI):
        self.application = Application.builder().token(telegram_token).build()
        self.allowed_chat_id = int(allowed_chat_id)
        self.bluesky = bluesky_api

        self.application.add_handler(CommandHandler("start", self.start))
        self.application.add_handler(
            MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message)
        )

    async def start(self, update: Update, context) -> None:
        if update.effective_chat.id != self.allowed_chat_id:
            await update.message.reply_text("Unauthorized")
            logger.warning(f"Unauthorized access attempt from chat ID: {update.effective_chat.id}")
            return
        await update.message.reply_text("Bot ready. Send messages to post on BlueSky.")
        logger.info(f"Bot started in authorized chat: {self.allowed_chat_id}")

    async def handle_message(self, update: Update, context) -> None:
        if update.effective_chat.id != self.allowed_chat_id:
            await update.message.reply_text("Unauthorized")
            logger.warning(f"Unauthorized message from chat ID: {update.effective_chat.id}")
            return

        entities = update.message.entities or []
        if self.bluesky.create_post(update.message.text, entities):
            await update.message.reply_text("Posted to BlueSky successfully!")
            logger.info(f"Successfully posted to BlueSky from chat ID: {self.allowed_chat_id}")
        else:
            await update.message.reply_text("Failed to post. Please try again.")
            logger.error(f"Failed to post to BlueSky from chat ID: {self.allowed_chat_id}")

    def run(self) -> None:
        self.application.run_polling()

def main():
    TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
    TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
    BLUESKY_USERNAME = os.getenv("BLUESKY_USERNAME")
    BLUESKY_PASSWORD = os.getenv("BLUESKY_PASSWORD")

    if not all([TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, BLUESKY_USERNAME, BLUESKY_PASSWORD]):
        logger.error(
            "Missing environment variables: TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, BLUESKY_USERNAME, BLUESKY_PASSWORD"
        )
        return

    try:
        bluesky = BlueSkyAPI(BLUESKY_USERNAME, BLUESKY_PASSWORD)
        bot = TelegramBot(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, bluesky)
        bot.run()
    except Exception as e:
        logger.error(f"Bot startup failed: {e}")

if __name__ == "__main__":
    main()