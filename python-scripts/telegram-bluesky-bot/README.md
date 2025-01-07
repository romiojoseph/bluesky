_Script created using Claude, Mistral AI and Google AI Studio._

# Telegram Bluesky Bot

A Python script that allows users to post messages to Bluesky via a Telegram bot. The bot uses the Bluesky API to create posts and handles authentication, rate limiting, and rich text formatting. Additionally, with Telegram's "Schedule Message" feature, you can schedule posts to Bluesky.

Note: You need to create a Telegram bot yourself, and the setup works only with the Telegram Chat ID you configure.

## Features
- Post messages from a Telegram bot to BlueSky.
- Rate limiting to comply with BlueSky API limits.
- Telegram's "Schedule Message" feature allows you to run this script in the background and schedule posts to Bluesky with ease.
- Supports rich text formatting, including hashtags, mentions, and URLs (No images and video). These are the only features supported. Telegram doesn't allow alt text for images, so it's best suited for use cases involving links, mentions, and hashtags.

## Prerequisites

- Python 3.7+
- Telegram Bot Token
- BlueSky API credentials (username and password)

## Installation

1. Download the Python file and the .env file and save it in a secure folder. Both files needs to be in the same folder.
2. Install the required dependencies:

    ```sh
    pip install python-dotenv requests python-telegram-bot ratelimit
    ```

## Configuration

### Telegram
- Create a Telegram Bot. Open Telegram and search for the [BotFather](https://t.me/BotFather).
- Start a chat with BotFather and use the `/newbot` command to create a new bot.
- Follow the instructions to set up your bot and note down the bot token.
- [Get your Telegram Chat ID using this bot](https://t.me/getmyid_bot).

Replace the credentials in the .env file.

```env
TELEGRAM_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
BLUESKY_USERNAME=your_bluesky_username
BLUESKY_PASSWORD=your_bluesky_password
```

##  Usage

1. Start the script: `python telegram_bluesky_bot.py`
2. Start and send a message with the Telegram bot you created. 
3. Try sending the first post and make sure it worked like it should.
4. Run the script as long as you want or press `Ctrl + C` to terminate it.

I created the basic skeleton of this script using Claude, then refined and cross-checked it with Mistral AI and Google AI Studio. If you can improve it further in terms of functionality or safety, feel free to enhance it and share your suggestions.

You can set a permanent path and [start the script by running a command in the terminal using the steps mentioned in this link](https://github.com/romiojoseph/open-source/tree/main/utility-scripts/version-control-backup-python-script-v2#add-on) .

I hope this helps you in someway.