_Script created using Claude, Mistral AI and Google AI Studio._

> I used the .js extension in the repository for syntax highlighting, but note that this is actually Google Apps Script code, which typically uses the .gs extension.
# Bookmark Bluesky Posts via Telegram Bot

This Google Apps Script integrates with Telegram to save Bluesky post metadata to a Google Sheet. The script listens for messages from a specified Telegram chat, extracts metadata from Bluesky post URLs, and saves the data to a Google Sheet.

Note: You need to create a Telegram bot yourself, and the setup works only with the Telegram Chat ID you configure.

## Features

1) Extracts metadata from Bluesky post URLs.
2) Saves post metadata to a Google Sheet.
3) Integrates with Telegram for easy interaction.
4) Supports the following metadata:
	- Post_ID
	- Post_URI
	- Post_Link
	- Author_DID
	- Author_Handle
	- Author_DisplayName
	- Author_Avatar
	- Author_CreatedAt
	- Author_Labels
	- Post_Text
	- Post_CreatedAt
	- Post_IndexedAt
	- Post_Language
	- Reply_Count
	- Repost_Count
	- Like_Count
	- Quote_Count
	- Has_Media
	- Media_Count
	- Media_URLs
	- Media_Alt_Texts
	- Image_Aspect_Ratio_Height
	- Image_Aspect_Ratio_Width
	- Embed_Type
	- Embed_Title
	- Embed_Description
	- Embed_URL	Embed_Thumb
	- Video_Thumbnail
	- Video_CID
	- Video_Playlist
	- Video_Aspect_Ratio_Height
	- Video_Aspect_Ratio_Width
	- Mentions
	- Links
	- Labels
	- saved_at
	- Category

## Getting Started

### Prerequisites
- A Google account.
- A Telegram account and a bot token.
- A Google Sheet to store the data.
- Basic knowledge of Google Apps Script and Telegram bots.

### Installation
1. Create a new Google Sheet
2. Do not add or type anything, just go to Extensions > Apps Script
3. It will open a IDE (Default Code.gs file), Delete any code on that file and just copy paste the entire script there.
4. Create a new bot using the BotFather on Telegram [Check the detailed steps here](https://github.com/romiojoseph/open-source/tree/main/telegram-bots/rss-new-post-alert-via-telegram). To get your unique chat id use this bot - https://t.me/getmyid_bot
5. Then move to the left menu bar and open "Project settings" (Gear icon).
6. Scroll down and find the "Script Properties".
7. Add three properties and fill their respective fields with your unique id's. Make sure there is no mistakes of any kind.
   - SPREADSHEET_ID
   - TELEGRAM_BOT_TOKEN
   - TELEGRAM_CHAT_ID
8. If you reached so far, just two more steps and you are good to go. Find the "Deploy" button in the top right side.
9. Click on it and select "New deployment"
10. Select type > web app >add some description > execute as me > set access to "Anyone" > click deploy.
11. This will initiate the Google auth process. Complete it.
12. It will process and then it will display a web app url. Copy it.
13. Now either go to a new tab in your browser or use this link https://romiojoseph.github.io/open-source/telegram-bot-api-assistant-web/
14. Now we have to set a webhook to do that we have to construct a link or like i said use the above tool.
    - https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_API_KEY>/setWebhook?url=<YOUR_WEB_APP_URL>
15. After properly constructing the link just hit enter and the browser will display a return. if the message is successful, try sending a test Bluesky post link.
16. Periodically check the "Overview" menu of this file so that you can see the number of users and execution count.

## Usage
1. **Send a Bluesky post URL:**
   - In the Telegram bot using the chat id you configured, send a Bluesky post URL

2. **Send a keyword/category:**
   - After sending the URL, send a keyword or category for the post. This is a necessary step.

3. **View the data:**
   - The post metadata will be saved to the specified Google Sheet in a page named "Bluesky Bookmarks" it will be automatically created.

## Contributing
Please note that the entire script is created using LLMs. So if you are an experienced coder, you might see issues or bugs or even unnecessary steps. So contributions are always welcome! Make a better version with more metadata and please let me know too.

Google Apps Script rate limits - https://developers.google.com/apps-script/guides/services/quotas
